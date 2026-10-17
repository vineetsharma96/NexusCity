import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { QualitySettings } from './QualityManager';
import { createNeonGradePass } from './NeonGradePass';
import { WebGLCapabilities } from './WebGLCapabilities';

function disposeComposer(composer: EffectComposer): void {
  for (const pass of composer.passes) {
    try { pass.dispose(); } catch { /* Continue releasing the remaining GPU resources. */ }
  }
  composer.dispose();
}

export const PostProcessingManager: React.FC<{ quality: QualitySettings }> = ({ quality }) => {
  const { gl, scene, camera, size, viewport } = useThree();
  const caps = useMemo(() => WebGLCapabilities.detect(), []);
  const [renderError, setRenderError] = useState(false);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const gradeRef = useRef<ShaderPass | null>(null);
  const clearColor = useMemo(() => new THREE.Color(), []);
  const enabled = quality.postProcessing && !renderError && caps.supported &&
    caps.version === 'webgl2' && !caps.isConstrained && !caps.isVirGL;
  const bloomEnabled = enabled && quality.bloom && caps.supportsHalfFloatRenderTarget;

  // Allocate in an effect so StrictMode and profile changes release all passes
  // and both full-size composer buffers. Start at 1px before applying the budget.
  useEffect(() => {
    if (!enabled) return;
    let composer: EffectComposer | null = null;
    let target: THREE.WebGLRenderTarget | null = null;
    try {
      target = new THREE.WebGLRenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type: caps.supportsHalfFloatRenderTarget ? THREE.HalfFloatType : THREE.UnsignedByteType,
        samples: 0,
        depthBuffer: true,
        stencilBuffer: false,
      });
      composer = new EffectComposer(gl, target);
      composer.setPixelRatio(1);
      composer.addPass(new RenderPass(scene, camera));
      if (bloomEnabled) {
        const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.38, 0.82);
        for (const buffer of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) {
          buffer.depthBuffer = false;
          buffer.stencilBuffer = false;
          buffer.samples = 0;
        }
        composer.addPass(bloom);
        bloomRef.current = bloom;
      }
      const grade = createNeonGradePass();
      composer.addPass(grade);
      composer.addPass(new OutputPass());
      composerRef.current = composer;
      gradeRef.current = grade;
    } catch (error) {
      if (composer) disposeComposer(composer);
      else target?.dispose();
      composerRef.current = null;
      bloomRef.current = null;
      gradeRef.current = null;
      console.warn('[PostProcessingManager] Initialization failed; using direct rendering.', error);
      setRenderError(true);
      return;
    }
    return () => {
      if (composerRef.current === composer) {
        composerRef.current = null;
        bloomRef.current = null;
        gradeRef.current = null;
      }
      if (composer) disposeComposer(composer);
    };
  }, [gl, scene, camera, enabled, bloomEnabled, caps.supportsHalfFloatRenderTarget]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    try {
      const physicalWidth = Math.max(1, Math.round(size.width * gl.getPixelRatio()));
      const physicalHeight = Math.max(1, Math.round(size.height * gl.getPixelRatio()));
      const maxWidth = Math.max(1, Math.min(caps.maxTextureSize, caps.maxRenderBufferSize, caps.maxViewportDims[0]));
      const maxHeight = Math.max(1, Math.min(caps.maxTextureSize, caps.maxRenderBufferSize, caps.maxViewportDims[1]));
      // Bound physical pixels, including DPR, while preserving the viewport aspect.
      const scale = Math.min(1, maxWidth / physicalWidth, maxHeight / physicalHeight,
        Math.sqrt((1920 * 1080) / (physicalWidth * physicalHeight)));
      const width = Math.max(1, Math.floor(physicalWidth * scale));
      const height = Math.max(1, Math.floor(physicalHeight * scale));
      composer.setSize(width, height);
      const bloom = bloomRef.current;
      if (bloom) {
        const ultra = quality.name === 'ULTRA';
        bloom.strength = ultra ? 0.42 : 0.28;
        const bloomScale = Math.min(ultra ? 1 : 0.5, 1280 / width, 720 / height);
        // Composer.setSize resizes every pass; apply the actual bloom target budget last.
        bloom.setSize(Math.max(1, Math.floor(width * bloomScale)), Math.max(1, Math.floor(height * bloomScale)));
      }
    } catch (error) {
      console.warn('[PostProcessingManager] Resize failed; using direct rendering.', error);
      setRenderError(true);
    }
  }, [gl, enabled, bloomEnabled, quality.name, size.width, size.height, viewport.dpr, caps]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const composer = composerRef.current;
    if (!composer) {
      gl.render(scene, camera);
      return;
    }
    const previousAutoClear = gl.autoClear;
    gl.getClearColor(clearColor);
    const previousClearAlpha = gl.getClearAlpha();
    try {
      if (gradeRef.current) gradeRef.current.uniforms.uTime.value += delta;
      composer.render(delta);
    } catch (error) {
      // Bloom can fail after switching render targets and clear state. Restore
      // the normal renderer before presenting the same frame through the fallback.
      gl.setRenderTarget(null);
      gl.autoClear = previousAutoClear;
      gl.setClearColor(clearColor, previousClearAlpha);
      console.warn('[PostProcessingManager] Render failed; disabling post-processing.', error);
      setRenderError(true);
      gl.render(scene, camera);
    }
  }, enabled ? 1 : 0);

  return null;
};
