import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { QualitySettings } from './QualityManager';
import { createNeonGradePass } from './NeonGradePass';

export const PostProcessingManager: React.FC<{ quality: QualitySettings }> = ({ quality }) => {
  const { gl, scene, camera, size, viewport } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const gradeRef = useRef<ShaderPass | null>(null);
  const enabled = quality.postProcessing;

  // Allocate GPU resources in the effect so StrictMode and profile changes can
  // dispose every render target, including the composer's full-size buffers.
  useEffect(() => {
    if (!enabled) return;
    const composer = new EffectComposer(gl);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.38, 0.82);
    const grade = createNeonGradePass();
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    bloomRef.current = bloom;
    gradeRef.current = grade;
    return () => {
      composerRef.current = null;
      bloomRef.current = null;
      gradeRef.current = null;
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
    };
  }, [gl, scene, camera, enabled]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    if (bloomRef.current) {
      const ultra = quality.name === 'ULTRA';
      bloomRef.current.strength = ultra ? 0.42 : 0.28;
      // Resize the actual bloom targets; changing resolution alone has no effect.
      const scale = ultra ? 1 : 0.5;
      bloomRef.current.setSize(size.width * gl.getPixelRatio() * scale, size.height * gl.getPixelRatio() * scale);
    }
  }, [gl, enabled, quality.name, size.width, size.height, viewport.dpr]);

  useFrame((_, delta) => {
    if (!enabled) return;
    if (gradeRef.current) gradeRef.current.uniforms.uTime.value += delta;
    if (composerRef.current) composerRef.current.render(delta);
    else gl.render(scene, camera);
  }, enabled ? 1 : 0);

  return null;
};
