import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { QualitySettings } from './QualityManager';
import { WebGLCapabilities } from './WebGLCapabilities';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { createNeonGradePass } from './NeonGradePass';

interface PostProcessingManagerProps {
  quality: QualitySettings;
}

export const PostProcessingManager: React.FC<PostProcessingManagerProps> = ({ quality }) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const gradePassRef = useRef<ShaderPass | null>(null);
  const pipelineBrokenRef = useRef(false);

  const canUsePost = useMemo(() => {
    const caps = WebGLCapabilities.detect();
    return quality.postProcessing && !caps.isVirGL && caps.supportsHalfFloatRenderTarget;
  }, [quality.postProcessing]);

  const isUltra = quality.name === 'ULTRA' || quality.reflectionQuality === 'HIGH';

  useEffect(() => {
    if (!canUsePost) {
      composerRef.current = null;
      return;
    }

    try {
      const targetDpr = Math.min(window.devicePixelRatio || 1, quality.dpr[1]);
      const clampedDpr = Math.max(quality.dpr[0], targetDpr);
      gl.setPixelRatio(clampedDpr);

      const rtWidth = Math.max(1, Math.floor(size.width * clampedDpr));
      const rtHeight = Math.max(1, Math.floor(size.height * clampedDpr));

      // Linear HalfFloat render target (no sRGB colorSpace on HalfFloat to prevent WebGL2 internalformat mismatch)
      const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false,
      });

      const composer = new EffectComposer(gl, renderTarget);
      composer.setPixelRatio(clampedDpr);
      composer.setSize(size.width, size.height);
      composer.addPass(new RenderPass(scene, camera));

      const bloomScale = isUltra ? 1 : 2;
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(
          Math.max(1, Math.floor((size.width * clampedDpr) / bloomScale)),
          Math.max(1, Math.floor((size.height * clampedDpr) / bloomScale))
        ),
        quality.bloom ? (isUltra ? 0.42 : 0.34) : 0.0,
        isUltra ? 0.56 : 0.46,
        isUltra ? 0.78 : 0.84
      );
      bloomPass.enabled = quality.bloom;
      composer.addPass(bloomPass);
      bloomPassRef.current = bloomPass;

      const gradePass = createNeonGradePass();
      gradePass.uniforms.uUltraClarity.value = quality.sharpeningEnabled
        ? isUltra
          ? 1.0
          : 0.55
        : 0.0;
      gradePass.uniforms.uVignette.value = quality.vignetteEnabled ? 0.26 : 0.0;
      if (gradePass.uniforms.uTexelSize?.value?.set) {
        gradePass.uniforms.uTexelSize.value.set(1 / rtWidth, 1 / rtHeight);
      } else {
        gradePass.uniforms.uTexelSize.value = new THREE.Vector2(1 / rtWidth, 1 / rtHeight);
      }
      composer.addPass(gradePass);
      gradePassRef.current = gradePass;

      composer.addPass(new OutputPass());

      composerRef.current = composer;
      pipelineBrokenRef.current = false;

      return () => {
        composer.dispose();
        renderTarget.dispose();
        composerRef.current = null;
      };
    } catch {
      pipelineBrokenRef.current = true;
      composerRef.current = null;
    }
  }, [canUsePost, quality.bloom, quality.dpr[0], quality.dpr[1], isUltra, gl, scene, camera]);

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
      const bloomScale = isUltra ? 1 : 2;
      bloomPassRef.current.resolution.set(
        Math.max(1, Math.floor(rtWidth / bloomScale)),
        Math.max(1, Math.floor(rtHeight / bloomScale))
      );
      bloomPassRef.current.enabled = quality.bloom;
    }
    if (gradePassRef.current) {
      gradePassRef.current.uniforms.uUltraClarity.value = quality.sharpeningEnabled
        ? isUltra
          ? 1.0
          : 0.55
        : 0.0;
      gradePassRef.current.uniforms.uVignette.value = quality.vignetteEnabled ? 0.26 : 0.0;
      if (gradePassRef.current.uniforms.uTexelSize?.value?.set) {
        gradePassRef.current.uniforms.uTexelSize.value.set(1 / rtWidth, 1 / rtHeight);
      }
    }
  }, [
    size.width,
    size.height,
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

    const timeState = TimeSystem.getInstance().getState();
    const weatherState = WeatherSystem.getInstance().getState();

    if (bloomPassRef.current && quality.bloom) {
      const ultraBoost = isUltra ? 0.08 : 0.0;
      const targetStrength =
        0.16 + ultraBoost + timeState.nightFactor * 0.26 + weatherState.wetnessFactor * 0.14;
      bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, targetStrength, delta * 3);
    }

    if (gradePassRef.current) {
      gradePassRef.current.uniforms.uNightFactor.value = timeState.nightFactor;
      gradePassRef.current.uniforms.uRainIntensity.value = weatherState.rainIntensity;
    }

    try {
      composerRef.current.render(delta);
    } catch {
      pipelineBrokenRef.current = true;
      gl.render(scene, camera);
    }
  }, 1);

  return null;
};
