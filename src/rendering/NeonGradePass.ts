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
    uSaturation: { value: 1.1 },
    uContrast: { value: 1.04 },
    uVignette: { value: 0.22 },
    uUltraClarity: { value: 0.0 },
    uAccelRush: { value: 0.0 },
    uDecelPulse: { value: 0.0 },
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
    uniform float uAccelRush;
    uniform float uDecelPulse;
    uniform vec2 uTexelSize;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      float radialDist = length(centered);
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = clamp(texel.rgb, 0.0, 1.0);

      // Kinetic Acceleration Screen Effect: radial edge motion streak + subtle peripheral chromatic aberration
      if (uAccelRush > 0.005) {
        float edgeMask = smoothstep(0.16, 0.72, radialDist) * uAccelRush;
        vec2 radialStep = centered * (0.022 * edgeMask);
        vec3 tap1 = texture2D(tDiffuse, clamp(vUv - radialStep * 0.5, 0.001, 0.999)).rgb;
        vec3 tap2 = texture2D(tDiffuse, clamp(vUv - radialStep, 0.001, 0.999)).rgb;
        vec3 blurred = col * 0.5 + tap1 * 0.3 + tap2 * 0.2;

        // Subtle peripheral chromatic dispersion during hard acceleration/boost
        vec2 chromaOffset = centered * (0.0085 * edgeMask);
        float rCh = texture2D(tDiffuse, clamp(vUv + chromaOffset, 0.001, 0.999)).r;
        float bCh = texture2D(tDiffuse, clamp(vUv - chromaOffset, 0.001, 0.999)).b;
        vec3 chromaCol = vec3(rCh, blurred.g, bCh);
        col = clamp(mix(col, chromaCol, clamp(edgeMask * 0.85, 0.0, 0.85)), 0.0, 1.0);
      }

      // Adaptive micro-contrast clarity kernel (clamped detail prevents ringing/aliasing)
      if (uUltraClarity > 0.01) {
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexelSize.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, uTexelSize.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(uTexelSize.x, 0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv - vec2(uTexelSize.x, 0.0)).rgb;
        vec3 avg = 0.25 * (n + s + e + w);
        vec3 detail = clamp(col - avg, vec3(-0.08), vec3(0.08));
        col = clamp(col + detail * (0.38 * uUltraClarity), 0.0, 1.0);
      }

      // Gentle post-ACES filmic contrast around mid-grey
      col = clamp((col - 0.5) * (uContrast + uUltraClarity * 0.03) + 0.5, 0.0, 1.0);

      // Luminance-preserving saturation polish
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation + uUltraClarity * 0.04);

      // Subtle architectural split-toning: cool obsidian shadows & warm solar highlights
      vec3 shadowTint = vec3(0.95, 0.98, 1.04);
      vec3 highlightTint = mix(vec3(1.03, 1.005, 0.96), vec3(0.97, 1.01, 1.04), uNightFactor * 0.55);
      col *= mix(shadowTint, highlightTint, smoothstep(0.12, 0.85, luma));

      // Wetness atmospheric coolness
      col = mix(col, col * vec3(0.95, 1.0, 1.05), uRainIntensity * 0.22);

      // Subtle optical vignette + deceleration braking G-force squeeze
      float vigStrength = uVignette + uDecelPulse * 0.28 + uAccelRush * 0.08;
      if (vigStrength > 0.001) {
        float vig = clamp(1.0 - dot(centered, centered) * vigStrength * 1.35, 0.62, 1.0);
        col *= vig;
      }

      // Deceleration / heavy braking peripheral crimson G-force pulse
      if (uDecelPulse > 0.005) {
        float brakeEdge = smoothstep(0.32, 0.76, radialDist) * uDecelPulse;
        col = mix(col, col * vec3(1.18, 0.84, 0.86) + vec3(0.14, 0.015, 0.03) * brakeEdge, brakeEdge * 0.65);
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
