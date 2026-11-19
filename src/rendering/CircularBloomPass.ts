import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Generates true 3-sigma circular Gaussian blur coefficients whose tail decays
 * smoothly to < 3% of the center weight before kernel truncation.
 *
 * Stock Three.js UnrealBloomPass uses sigma = kernelRadius, which truncates the
 * Gaussian at ~60.6% of peak height — turning the separable H+V pass into a hard
 * 2D box filter that makes distant 1-2px point lights bloom into square/cube shapes.
 * Using sigma = (kernelRadius - 0.5) / 3.0 produces radially symmetric circular halos.
 */
export function computeCircularGaussianCoefficients(
  kernelRadius: number,
  sigmaDivisor: number = 3.0
): number[] {
  const safeRadius = Math.max(2, Math.floor(kernelRadius));
  const sigma = Math.max(0.85, (safeRadius - 0.5) / sigmaDivisor);
  const twoSigmaSq = 2 * sigma * sigma;
  const coefficients: number[] = [];

  for (let i = 0; i < safeRadius; i++) {
    coefficients.push(Math.exp(-(i * i) / twoSigmaSq) / Math.sqrt(Math.PI * twoSigmaSq));
  }

  return coefficients;
}

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CIRCULAR_HIGH_PASS_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexelSize;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform float maxBloomLuminance;
  varying vec2 vUv;

  float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 extractSoftKnee(vec3 c) {
    float v = getLuma(c);
    float knee = max(smoothWidth, 0.001);
    float soft = v - luminosityThreshold + knee;
    soft = clamp(soft, 0.0, 2.0 * knee);
    soft = (soft * soft) / (4.0 * knee);
    float contrib = max(soft, v - luminosityThreshold) / max(v, 0.0001);
    vec3 bright = c * max(contrib, 0.0);

    // Softly compress extreme sub-pixel HDR spikes while preserving emitter hue
    float bl = getLuma(bright);
    if (bl > maxBloomLuminance) {
      bright *= (maxBloomLuminance + (bl - maxBloomLuminance) * 0.22) / max(bl, 0.0001);
    }
    return bright;
  }

  void main() {
    // 9-tap circular anti-aliased prefilter with gentle Karis weighting eliminates
    // distant 1px fireflies and pre-rounds sub-pixel lights before mip blur.
    vec2 ts = uTexelSize;
    vec3 c0 = extractSoftKnee(texture2D(tDiffuse, vUv).rgb);

    vec3 d1 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2(-0.5, -0.5) * ts).rgb);
    vec3 d2 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2( 0.5, -0.5) * ts).rgb);
    vec3 d3 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2(-0.5,  0.5) * ts).rgb);
    vec3 d4 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2( 0.5,  0.5) * ts).rgb);

    vec3 a1 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2(-1.0,  0.0) * ts).rgb);
    vec3 a2 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2( 1.0,  0.0) * ts).rgb);
    vec3 a3 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2( 0.0, -1.0) * ts).rgb);
    vec3 a4 = extractSoftKnee(texture2D(tDiffuse, vUv + vec2( 0.0,  1.0) * ts).rgb);

    float w0  = 0.25   / (1.0 + getLuma(c0) * 0.35);
    float wd1 = 0.125  / (1.0 + getLuma(d1) * 0.35);
    float wd2 = 0.125  / (1.0 + getLuma(d2) * 0.35);
    float wd3 = 0.125  / (1.0 + getLuma(d3) * 0.35);
    float wd4 = 0.125  / (1.0 + getLuma(d4) * 0.35);
    float wa1 = 0.0625 / (1.0 + getLuma(a1) * 0.35);
    float wa2 = 0.0625 / (1.0 + getLuma(a2) * 0.35);
    float wa3 = 0.0625 / (1.0 + getLuma(a3) * 0.35);
    float wa4 = 0.0625 / (1.0 + getLuma(a4) * 0.35);

    float wSum = w0 + wd1 + wd2 + wd3 + wd4 + wa1 + wa2 + wa3 + wa4;
    vec3 result = (
      c0 * w0 +
      d1 * wd1 + d2 * wd2 + d3 * wd3 + d4 * wd4 +
      a1 * wa1 + a2 * wa2 + a3 * wa3 + a4 * wa4
    ) / max(wSum, 0.0001);

    gl_FragColor = vec4(result, 1.0);
  }
`;

const CIRCULAR_SEPARABLE_BLUR_FRAGMENT = /* glsl */ `
  #include <common>
  varying vec2 vUv;
  uniform sampler2D colorTexture;
  uniform vec2 invSize;
  uniform vec2 direction;
  uniform float gaussianCoefficients[KERNEL_RADIUS];

  void main() {
    float weightSum = gaussianCoefficients[0];
    vec3 diffuseSum = texture2D(colorTexture, vUv).rgb * weightSum;
    for (int i = 1; i < KERNEL_RADIUS; i++) {
      float x = float(i);
      float w = gaussianCoefficients[i];
      vec2 uvOffset = direction * invSize * x;
      vec3 sample1 = texture2D(colorTexture, vUv + uvOffset).rgb;
      vec3 sample2 = texture2D(colorTexture, vUv - uvOffset).rgb;
      diffuseSum += (sample1 + sample2) * w;
      weightSum += 2.0 * w;
    }
    gl_FragColor = vec4(diffuseSum / weightSum, 1.0);
  }
`;

const CIRCULAR_COMPOSITE_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D blurTexture1;
  uniform sampler2D blurTexture2;
  uniform sampler2D blurTexture3;
  uniform sampler2D blurTexture4;
  uniform sampler2D blurTexture5;
  uniform float bloomStrength;
  uniform float bloomRadius;
  uniform float bloomFactors[NUM_MIPS];
  uniform vec3 bloomTintColors[NUM_MIPS];
  uniform vec2 uMip4Texel;
  uniform vec2 uMip5Texel;

  float lerpBloomFactor(const in float factor) {
    float mirrorFactor = 1.2 - factor;
    return mix(factor, mirrorFactor, bloomRadius);
  }

  // Smooth 4-tap tent upsample removes piecewise-linear grid/square artifacts on coarse mips
  vec4 sampleTent(sampler2D tex, vec2 uv, vec2 texel) {
    vec4 s = texture2D(tex, uv + vec2(-0.5, -0.5) * texel);
    s += texture2D(tex, uv + vec2( 0.5, -0.5) * texel);
    s += texture2D(tex, uv + vec2(-0.5,  0.5) * texel);
    s += texture2D(tex, uv + vec2( 0.5,  0.5) * texel);
    return s * 0.25;
  }

  void main() {
    vec4 m1 = texture2D(blurTexture1, vUv);
    vec4 m2 = texture2D(blurTexture2, vUv);
    vec4 m3 = texture2D(blurTexture3, vUv);
    vec4 m4 = sampleTent(blurTexture4, vUv, uMip4Texel);
    vec4 m5 = sampleTent(blurTexture5, vUv, uMip5Texel);

    gl_FragColor = bloomStrength * (
      lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * m1 +
      lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * m2 +
      lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * m3 +
      lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * m4 +
      lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * m5
    );
  }
`;

const CIRCULAR_KERNEL_SIZES = [5, 7, 9, 11, 13];
const OPTICAL_BLOOM_FACTORS = [1.0, 0.82, 0.6, 0.36, 0.18];

function createCircularSeparableBlurMaterial(kernelRadius: number, resx: number, resy: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    defines: {
      KERNEL_RADIUS: kernelRadius,
    },
    uniforms: {
      colorTexture: { value: null },
      invSize: { value: new THREE.Vector2(1 / Math.max(1, resx), 1 / Math.max(1, resy)) },
      direction: { value: new THREE.Vector2(0.5, 0.5) },
      gaussianCoefficients: { value: computeCircularGaussianCoefficients(kernelRadius) },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: CIRCULAR_SEPARABLE_BLUR_FRAGMENT,
  });
}

/**
 * Enhanced UnrealBloomPass that replaces stock truncated 1-sigma box-like blur kernels
 * with true 3-sigma circular Gaussian kernels, a 9-tap soft-knee Karis prefilter,
 * and tent-filtered coarse mip upsampling so distant lights always render as smooth
 * circular halos instead of square/cube artifacts.
 */
export class CircularBloomPass extends UnrealBloomPass {
  private readonly prefilterTexelSize: THREE.Vector2;
  private readonly mip4TexelSize: THREE.Vector2;
  private readonly mip5TexelSize: THREE.Vector2;

  constructor(resolution: THREE.Vector2, strength: number, radius: number, threshold: number) {
    super(resolution, strength, radius, threshold);

    this.prefilterTexelSize = new THREE.Vector2(1 / Math.max(1, resolution.x), 1 / Math.max(1, resolution.y));

    // 1. Replace hard-step LuminosityHighPass with 9-tap circular soft-knee Karis prefilter
    this.materialHighPassFilter.dispose();
    const highPassUniforms: Record<string, THREE.IUniform> = {
      tDiffuse: { value: null },
      uTexelSize: { value: this.prefilterTexelSize },
      luminosityThreshold: { value: threshold },
      smoothWidth: { value: 0.24 },
      maxBloomLuminance: { value: 3.4 },
    };
    this.highPassUniforms = highPassUniforms;
    this.materialHighPassFilter = new THREE.ShaderMaterial({
      uniforms: highPassUniforms,
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: CIRCULAR_HIGH_PASS_FRAGMENT,
    });

    // 2. Replace stock 1-sigma truncated separable kernels with true 3-sigma circular Gaussian kernels
    let resx = Math.max(1, Math.round(resolution.x / 2));
    let resy = Math.max(1, Math.round(resolution.y / 2));
    for (let i = 0; i < this.nMips; i++) {
      const oldMat = this.separableBlurMaterials[i];
      if (oldMat) oldMat.dispose();

      const kRadius = CIRCULAR_KERNEL_SIZES[i] ?? 11;
      this.separableBlurMaterials[i] = createCircularSeparableBlurMaterial(kRadius, resx, resy);

      resx = Math.max(1, Math.round(resx / 2));
      resy = Math.max(1, Math.round(resy / 2));
    }

    // 3. Upgrade composite material with tent upsampling on coarse mips 4 & 5 and optical falloff factors
    const oldComposite = this.compositeMaterial;
    const mip4Target = this.renderTargetsVertical[3];
    const mip5Target = this.renderTargetsVertical[4];
    this.mip4TexelSize = new THREE.Vector2(1 / Math.max(1, mip4Target.width), 1 / Math.max(1, mip4Target.height));
    this.mip5TexelSize = new THREE.Vector2(1 / Math.max(1, mip5Target.width), 1 / Math.max(1, mip5Target.height));

    this.compositeMaterial = new THREE.ShaderMaterial({
      defines: {
        NUM_MIPS: this.nMips,
      },
      uniforms: {
        blurTexture1: { value: this.renderTargetsVertical[0].texture },
        blurTexture2: { value: this.renderTargetsVertical[1].texture },
        blurTexture3: { value: this.renderTargetsVertical[2].texture },
        blurTexture4: { value: mip4Target.texture },
        blurTexture5: { value: mip5Target.texture },
        bloomStrength: { value: strength },
        bloomRadius: { value: radius },
        bloomFactors: { value: [...OPTICAL_BLOOM_FACTORS] },
        bloomTintColors: { value: this.bloomTintColors },
        uMip4Texel: { value: this.mip4TexelSize },
        uMip5Texel: { value: this.mip5TexelSize },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: CIRCULAR_COMPOSITE_FRAGMENT,
    });
    oldComposite.dispose();
  }

  override setSize(width: number, height: number): void {
    const safeW = Math.max(2, Math.round(width));
    const safeH = Math.max(2, Math.round(height));
    super.setSize(safeW, safeH);

    this.prefilterTexelSize.set(1 / safeW, 1 / safeH);

    const mip4Target = this.renderTargetsVertical[3];
    const mip5Target = this.renderTargetsVertical[4];
    if (mip4Target) {
      this.mip4TexelSize.set(1 / Math.max(1, mip4Target.width), 1 / Math.max(1, mip4Target.height));
    }
    if (mip5Target) {
      this.mip5TexelSize.set(1 / Math.max(1, mip5Target.width), 1 / Math.max(1, mip5Target.height));
    }
  }
}
