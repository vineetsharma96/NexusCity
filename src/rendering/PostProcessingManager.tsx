import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QualitySettings } from './QualityManager';
import { WebGLCapabilities } from './WebGLCapabilities';

interface PostProcessingManagerProps {
  quality: QualitySettings;
}

export const PostProcessingManager: React.FC<PostProcessingManagerProps> = ({ quality }) => {
  const { gl, scene, camera, size } = useThree();
  const [renderError, setRenderError] = useState(false);

  const caps = useMemo(() => WebGLCapabilities.detect(), []);

  // Only enable post-processing and bloom if hardware capability permits and quality allows
  const isPostEnabled =
    !renderError &&
    quality.postProcessing &&
    quality.bloom &&
    caps.supportsHalfFloatRenderTarget &&
    (quality.name === 'HIGH' || quality.name === 'ULTRA' || quality.name === 'CUSTOM');

  const composer = useMemo(() => {
    if (!isPostEnabled) return null;

    try {
      const comp = new EffectComposer(gl);
      comp.setSize(size.width, size.height);

      // 1. Base Scene Render Pass
      const renderPass = new RenderPass(scene, camera);
      comp.addPass(renderPass);

      // 2. Selective Controlled Bloom Pass
      // Safe resolution clamp prevents multi-gigabyte framebuffer allocations on mobile / VirGL
      const bloomResX = Math.min(size.width, 1280);
      const bloomResY = Math.min(size.height, 720);

      const bloomStrength = quality.name === 'ULTRA' ? 0.38 : 0.24;
      const bloomRadius = 0.35;
      const bloomThreshold = 0.85;

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(bloomResX, bloomResY),
        bloomStrength,
        bloomRadius,
        bloomThreshold
      );
      comp.addPass(bloomPass);

      // 3. Output Pass with Tone Mapping & sRGB Color Space Handling
      const outputPass = new OutputPass();
      comp.addPass(outputPass);

      return comp;
    } catch (err) {
      console.warn('[PostProcessingManager] Failed to initialize EffectComposer, falling back to standard pipeline:', err);
      setRenderError(true);
      return null;
    }
  }, [gl, scene, camera, isPostEnabled, quality.name, quality.bloom, size.width, size.height, caps.supportsHalfFloatRenderTarget]);

  useEffect(() => {
    if (!composer) return;
    try {
      composer.setSize(size.width, size.height);
    } catch (e) {
      console.warn('[PostProcessingManager] Resize failed:', e);
    }
  }, [composer, size.width, size.height]);

  useEffect(() => {
    return () => {
      if (composer) {
        composer.passes.forEach((pass) => {
          if ('dispose' in pass && typeof (pass as any).dispose === 'function') {
            try {
              (pass as any).dispose();
            } catch (e) {}
          }
        });
      }
    };
  }, [composer]);

  // Hook into R3F render loop at priority 1 to control scene presentation
  // Always guarantees clean fallback to standard gl.render if composer is disabled or fails
  useFrame((state, delta) => {
    if (composer && isPostEnabled) {
      try {
        composer.render(delta);
      } catch (err) {
        console.warn('[PostProcessingManager] Runtime render failure, disabling post-processing:', err);
        setRenderError(true);
        state.gl.render(state.scene, state.camera);
      }
    } else {
      state.gl.render(state.scene, state.camera);
    }
  }, 1);

  return null;
};
