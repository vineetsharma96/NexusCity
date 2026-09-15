import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QualitySettings } from './QualityManager';

interface PostProcessingManagerProps {
  quality: QualitySettings;
}

export const PostProcessingManager: React.FC<PostProcessingManagerProps> = ({ quality }) => {
  const { gl, scene, camera, size } = useThree();

  const isPostEnabled = quality.postProcessing && (quality.name === 'HIGH' || quality.name === 'ULTRA');

  const composer = useMemo(() => {
    if (!isPostEnabled) return null;

    const comp = new EffectComposer(gl);
    comp.setSize(size.width, size.height);

    // 1. Base Scene Render Pass
    const renderPass = new RenderPass(scene, camera);
    comp.addPass(renderPass);

    // 2. Selective Controlled Bloom Pass
    // Threshold 0.82 ensures only bright neon, car headlights, emissive billboards, and streetlamps bloom
    const bloomStrength = quality.name === 'ULTRA' ? 0.42 : 0.28;
    const bloomRadius = 0.38;
    const bloomThreshold = 0.82;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    comp.addPass(bloomPass);

    // 3. Output Pass with Tone Mapping & sRGB Color Space Handling
    const outputPass = new OutputPass();
    comp.addPass(outputPass);

    return comp;
  }, [gl, scene, camera, isPostEnabled, quality.name, size.width, size.height]);

  useEffect(() => {
    if (!composer) return;
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useEffect(() => {
    return () => {
      if (composer) {
        composer.passes.forEach((pass) => {
          if ('dispose' in pass && typeof (pass as any).dispose === 'function') {
            (pass as any).dispose();
          }
        });
      }
    };
  }, [composer]);

  // Hook into R3F render loop with priority 1 to take over canvas rendering when postprocessing is active
  useFrame((_, delta) => {
    if (composer && isPostEnabled) {
      composer.render(delta);
    }
  }, isPostEnabled ? 1 : 0);

  return null;
};
