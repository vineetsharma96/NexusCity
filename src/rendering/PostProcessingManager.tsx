import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { QualitySettings } from './QualityManager';
import { WebGLCapabilities } from './WebGLCapabilities';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { createNeonGradePass } from './NeonGradePass';
import { computeAtmosphericBloomParams } from './BloomProfile';
import { CircularBloomPass } from './CircularBloomPass';
import { computeCappedBloomResolution } from './StaticInstanceBatcher';
import { VehicleInteractionSystem } from '../vehicle/VehicleInteractionSystem';

export interface PostProcessingManagerProps {
  quality: QualitySettings;
  bloomIntensityMultiplier?: number;
}

export const PostProcessingManager: React.FC<PostProcessingManagerProps> = ({
  quality,
  bloomIntensityMultiplier = 1.0,
}) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<CircularBloomPass | null>(null);
  const gradePassRef = useRef<ShaderPass | null>(null);
  const pipelineBrokenRef = useRef(false);

  const canUsePost = useMemo(() => {
    const caps = WebGLCapabilities.detect();
    return (quality.postProcessing || quality.bloom) && !caps.isVirGL && caps.supportsHalfFloatRenderTarget;
  }, [quality.postProcessing, quality.bloom]);

  const isUltra = quality.name === 'ULTRA' || quality.reflectionQuality === 'HIGH';

  useEffect(() => {
    if (!canUsePost) {
      composerRef.current = null;
      bloomPassRef.current = null;
      gradePassRef.current = null;
      return;
    }

    try {
      const targetDpr = Math.min(window.devicePixelRatio || 1, quality.dpr[1]);
      const clampedDpr = Math.max(quality.dpr[0], targetDpr);
      gl.setPixelRatio(clampedDpr);

      const rtWidth = Math.max(1, Math.floor(size.width * clampedDpr));
      const rtHeight = Math.max(1, Math.floor(size.height * clampedDpr));

      const caps = WebGLCapabilities.detect();
      // Linear HalfFloat render target preserves HDR (>1.0) city light values for selective bloom.
      // Use 2x MSAA on desktop WebGL2 and 0x on mobile tile GPUs (Snapdragon/Adreno) to avoid 130MB+ 4x MSAA HalfFloat resolves.
      const desiredSamples = quality.antiAliasing && gl.capabilities.isWebGL2 && !caps.isMobile ? 2 : 0;
      let renderTarget: THREE.WebGLRenderTarget;
      try {
        renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          depthBuffer: true,
          stencilBuffer: false,
          samples: desiredSamples,
        });
      } catch {
        renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          depthBuffer: true,
          stencilBuffer: false,
          samples: 0,
        });
      }

      const composer = new EffectComposer(gl, renderTarget);
      composer.setPixelRatio(clampedDpr);
      composer.setSize(size.width, size.height);
      composer.addPass(new RenderPass(scene, camera));

      const initialTime = TimeSystem.getInstance().getState();
      const initialWeather = WeatherSystem.getInstance().getState();
      const initialEvent = LivingCityEventSystem.getInstance().getState();
      const initialBloom = computeAtmosphericBloomParams({
        nightFactor: initialTime.nightFactor,
        goldenHourFactor: initialTime.goldenHourFactor,
        wetnessFactor: initialWeather.wetnessFactor,
        fogDensityMultiplier: initialWeather.fogDensityMultiplier,
        isUltra,
        gridIsOut: initialEvent.type === 'POWER_OUTAGE' && initialEvent.phase === 'ACTIVE',
        lightScale: initialEvent.lightScale,
      });

      // Cap bloom pyramid long edge (960px mobile / 1152px desktop) to cut fragment fillrate 3x-4x
      // while keeping mip 4 >= 20px so distant lights stay smoothly circular without square artifacts.
      const bloomDims = computeCappedBloomResolution(rtWidth, rtHeight, caps.isMobile ? 960 : 1152);
      const bloomPass = new CircularBloomPass(
        new THREE.Vector2(bloomDims.width, bloomDims.height),
        quality.bloom ? initialBloom.strength * bloomIntensityMultiplier : 0.0,
        initialBloom.radius,
        initialBloom.threshold
      );
      bloomPass.enabled = quality.bloom;
      composer.addPass(bloomPass);
      bloomPassRef.current = bloomPass;

      // Run ACESFilmic tone mapping + linear->sRGB conversion on full HDR bloom buffer BEFORE color grading
      composer.addPass(new OutputPass());

      const gradePass = createNeonGradePass();
      gradePass.enabled = quality.postProcessing;
      gradePass.uniforms.uUltraClarity.value = quality.sharpeningEnabled
        ? isUltra
          ? 0.95
          : 0.5
        : 0.0;
      gradePass.uniforms.uVignette.value = quality.vignetteEnabled ? 0.22 : 0.0;
      if (gradePass.uniforms.uTexelSize?.value?.set) {
        gradePass.uniforms.uTexelSize.value.set(1 / rtWidth, 1 / rtHeight);
      } else {
        gradePass.uniforms.uTexelSize.value = new THREE.Vector2(1 / rtWidth, 1 / rtHeight);
      }
      composer.addPass(gradePass);
      gradePassRef.current = gradePass;

      composerRef.current = composer;
      pipelineBrokenRef.current = false;

      return () => {
        bloomPass.dispose();
        composer.dispose();
        renderTarget.dispose();
        bloomPassRef.current = null;
        gradePassRef.current = null;
        composerRef.current = null;
      };
    } catch {
      pipelineBrokenRef.current = true;
      composerRef.current = null;
      bloomPassRef.current = null;
      gradePassRef.current = null;
    }
  }, [
    canUsePost,
    quality.postProcessing,
    quality.bloom,
    quality.antiAliasing,
    quality.dpr[0],
    quality.dpr[1],
    isUltra,
    bloomIntensityMultiplier,
    gl,
    scene,
    camera,
  ]);

  useEffect(() => {
    const targetDpr = Math.max(quality.dpr[0], Math.min(window.devicePixelRatio || 1, quality.dpr[1]));
    gl.setPixelRatio(targetDpr);
    const rtWidth = Math.max(1, Math.floor(size.width * targetDpr));
    const rtHeight = Math.max(1, Math.floor(size.height * targetDpr));

    if (composerRef.current) {
      composerRef.current.setPixelRatio(targetDpr);
      composerRef.current.setSize(size.width, size.height);
    }
    if (bloomPassRef.current) {
      const caps = WebGLCapabilities.detect();
      const bloomDims = computeCappedBloomResolution(rtWidth, rtHeight, caps.isMobile ? 960 : 1152);
      bloomPassRef.current.resolution.set(bloomDims.width, bloomDims.height);
      bloomPassRef.current.setSize(bloomDims.width, bloomDims.height);
      bloomPassRef.current.enabled = quality.bloom;
    }
    if (gradePassRef.current) {
      gradePassRef.current.enabled = quality.postProcessing;
      gradePassRef.current.uniforms.uUltraClarity.value = quality.sharpeningEnabled
        ? isUltra
          ? 0.95
          : 0.5
        : 0.0;
      gradePassRef.current.uniforms.uVignette.value = quality.vignetteEnabled ? 0.22 : 0.0;
      if (gradePassRef.current.uniforms.uTexelSize?.value?.set) {
        gradePassRef.current.uniforms.uTexelSize.value.set(1 / rtWidth, 1 / rtHeight);
      }
    }
  }, [
    size.width,
    size.height,
    quality.postProcessing,
    quality.bloom,
    quality.sharpeningEnabled,
    quality.vignetteEnabled,
    quality.dpr[0],
    quality.dpr[1],
    isUltra,
    gl,
  ]);

  useFrame((_, delta) => {
    if (!canUsePost || pipelineBrokenRef.current || !composerRef.current) {
      gl.render(scene, camera);
      return;
    }

    const dt = Math.min(delta, 0.05);
    const dampAlpha = 1 - Math.exp(-4.5 * dt);
    const timeState = TimeSystem.getInstance().getState();
    const weatherState = WeatherSystem.getInstance().getState();
    const eventState = LivingCityEventSystem.getInstance().getState();

    if (bloomPassRef.current && quality.bloom) {
      const targetBloom = computeAtmosphericBloomParams({
        nightFactor: timeState.nightFactor,
        goldenHourFactor: timeState.goldenHourFactor,
        wetnessFactor: weatherState.wetnessFactor,
        fogDensityMultiplier: weatherState.fogDensityMultiplier,
        isUltra,
        gridIsOut: eventState.type === 'POWER_OUTAGE' && eventState.phase === 'ACTIVE',
        lightScale: eventState.lightScale,
      });

      bloomPassRef.current.strength = THREE.MathUtils.lerp(
        bloomPassRef.current.strength,
        targetBloom.strength * bloomIntensityMultiplier,
        dampAlpha
      );
      bloomPassRef.current.radius = THREE.MathUtils.lerp(
        bloomPassRef.current.radius,
        targetBloom.radius,
        dampAlpha
      );
      bloomPassRef.current.threshold = THREE.MathUtils.lerp(
        bloomPassRef.current.threshold,
        targetBloom.threshold,
        dampAlpha
      );
    }

    if (gradePassRef.current && quality.postProcessing) {
      gradePassRef.current.uniforms.uNightFactor.value = timeState.nightFactor;
      gradePassRef.current.uniforms.uRainIntensity.value = weatherState.rainIntensity;

      const vState = VehicleInteractionSystem.getInstance().getState();
      const isRiding = vState.mode === 'RIDING';
      const tel = vState.telemetry;
      const targetAccelRush = isRiding
        ? THREE.MathUtils.clamp(
            Math.max(0, tel.longitudinalAccelG) * 0.45 +
              THREE.MathUtils.clamp((tel.speedMs - 10) / 36, 0, 1) * 0.45 +
              (tel.isBoosting ? 0.35 : 0),
            0,
            1
          )
        : 0;
      const targetDecelPulse = isRiding
        ? THREE.MathUtils.clamp(
            Math.max(0, -tel.longitudinalAccelG) * 0.52 +
              (tel.isBraking && tel.speedMs > 2.5 ? 0.22 : 0),
            0,
            1
          )
        : 0;
      const fxAlpha = 1 - Math.exp(-8.5 * dt);
      gradePassRef.current.uniforms.uAccelRush.value = THREE.MathUtils.lerp(
        gradePassRef.current.uniforms.uAccelRush.value,
        targetAccelRush,
        fxAlpha
      );
      gradePassRef.current.uniforms.uDecelPulse.value = THREE.MathUtils.lerp(
        gradePassRef.current.uniforms.uDecelPulse.value,
        targetDecelPulse,
        fxAlpha
      );
    }

    try {
      composerRef.current.render(dt);
    } catch {
      pipelineBrokenRef.current = true;
      gl.render(scene, camera);
    }
  }, 1);

  return null;
};
