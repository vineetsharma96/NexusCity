import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Small screen-space GLSL pass for the final neon grade.
 * It intentionally uses one scene sample so it stays much cheaper than
 * another blur/bloom pass while still giving the high-end presets a distinct
 * cyberpunk finish.
 */
export const createNeonGradePass = (): ShaderPass =>
  new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uStrength: { value: 0.18 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uStrength;
      varying vec2 vUv;

      void main() {
        vec4 source = texture2D(tDiffuse, vUv);
        vec2 centered = vUv - 0.5;
        float vignette = 1.0 - smoothstep(0.18, 0.88, dot(centered, centered));
        float scanline = 0.985 + 0.015 * sin(vUv.y * 900.0 + uTime * 1.5);

        vec3 graded = source.rgb;
        graded += vec3(0.0, 0.012, 0.018) * uStrength;
        graded *= mix(0.92, 1.04, vignette);
        graded *= scanline;

        gl_FragColor = vec4(graded, source.a);
      }
    `,
  });
