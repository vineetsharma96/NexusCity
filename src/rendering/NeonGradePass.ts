import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Architectural Color Grading & Ultra Clarity Pass:
 * Deep obsidian shadow toe, warm solar-gold highlights, crisp cyan midtones,
 * adaptive local micro-contrast sharpening, and toggleable optical vignette.
 */
export const NeonGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uNightFactor: { value: 1.0 },
    uRainIntensity: { value: 0.0 },
    uSaturation: { value: 1.18 },
    uContrast: { value: 1.09 },
    uVignette: { value: 0.26 },
    uUltraClarity: { value: 0.0 },
    uTexelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
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
    uniform float uNightFactor;
    uniform float uRainIntensity;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uUltraClarity;
    uniform vec2 uTexelSize;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = max(texel.rgb, vec3(0.0));

      // Ultra micro-contrast unsharp clarity kernel
      if (uUltraClarity > 0.01) {
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexelSize.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, uTexelSize.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(uTexelSize.x, 0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv - vec2(uTexelSize.x, 0.0)).rgb;
        vec3 avg = 0.25 * (n + s + e + w);
        vec3 detail = col - avg;
        col = max(col + detail * (0.45 * uUltraClarity), vec3(0.0));
      }

      // Contrast S-curve around mid-grey
      col = (col - 0.5) * (uContrast + uUltraClarity * 0.04) + 0.5;
      col = max(col, vec3(0.0));

      // Luminance-preserving saturation boost
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation + uUltraClarity * 0.06);

      // Architectural split-toning: obsidian-blue shadows & warm solar highlights
      vec3 shadowTint = vec3(0.91, 0.96, 1.07);
      vec3 highlightTint = mix(vec3(1.04, 1.0, 0.94), vec3(0.95, 1.02, 1.08), uNightFactor * 0.5);
      col *= mix(shadowTint, highlightTint, smoothstep(0.08, 0.85, luma));

      // Wetness atmospheric coolness & specular lift
      col = mix(col, col * vec3(0.94, 1.0, 1.06), uRainIntensity * 0.28);

      // Subtle optical vignette (when uVignette > 0)
      if (uVignette > 0.001) {
        vec2 centered = vUv - 0.5;
        float vig = clamp(1.0 - dot(centered, centered) * uVignette * 1.55, 0.68, 1.0);
        col *= vig;
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), texel.a);
    }
  `,
};

export function createNeonGradePass(): ShaderPass {
  const pass = new ShaderPass(NeonGradeShader);
  pass.material.toneMapped = false;
  return pass;
}
