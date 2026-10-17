export interface WebGLDiagnosticInfo {
  supported: boolean;
  version: 'webgl2' | 'webgl1' | 'none';
  renderer: string;
  vendor: string;
  unmaskedRenderer: string;
  unmaskedVendor: string;
  maxTextureSize: number;
  maxRenderBufferSize: number;
  maxViewportDims: [number, number];
  maxVertexTextureImageUnits: number;
  supportsFloatTextures: boolean;
  supportsHalfFloatTextures: boolean;
  supportsFloatLinear: boolean;
  supportsFloatRenderTarget: boolean;
  supportsHalfFloatRenderTarget: boolean;
  isVirGL: boolean;
  isMobile: boolean;
  isConstrained: boolean;
  recommendedDpr: number;
  recommendedPreset: 'LOW' | 'MEDIUM' | 'HIGH';
  extensions: string[];
}

class WebGLCapabilitiesDetector {
  private cachedInfo: WebGLDiagnosticInfo | null = null;

  public detect(): WebGLDiagnosticInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return this.getFallbackInfo('SSR Environment');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let version: 'webgl2' | 'webgl1' | 'none' = 'none';

    try {
      gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl) {
        version = 'webgl2';
      } else {
        gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (gl) {
          version = 'webgl1';
        }
      }
    } catch (e) {
      console.warn('[WebGLCapabilities] Failed to create WebGL context:', e);
      return this.getFallbackInfo('Context Creation Failed');
    }

    if (!gl) {
      return this.getFallbackInfo('No WebGL Available');
    }

    // 1. Query basic strings and unmasked renderer
    const vendor = gl.getParameter(gl.VENDOR) || 'Unknown Vendor';
    const renderer = gl.getParameter(gl.RENDERER) || 'Unknown Renderer';

    let unmaskedVendor = vendor;
    let unmaskedRenderer = renderer;

    const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbgExt) {
      unmaskedVendor = gl.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL) || vendor;
      unmaskedRenderer = gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) || renderer;
    }

    // 2. Query system limits
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 2048;
    const maxViewportDimsParam = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const maxViewportDims: [number, number] = maxViewportDimsParam
      ? [maxViewportDimsParam[0] || 2048, maxViewportDimsParam[1] || 2048]
      : [2048, 2048];
    const maxVertexTextureImageUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) || 0;

    // 3. Query Extensions
    const supportedExtensions = gl.getSupportedExtensions() || [];

    // Test float texture support
    const supportsFloatTextures =
      version === 'webgl2' ||
      supportedExtensions.includes('OES_texture_float');
    const supportsHalfFloatTextures =
      version === 'webgl2' ||
      supportedExtensions.includes('OES_texture_half_float');
    const supportsFloatLinear =
      supportedExtensions.includes('OES_texture_float_linear') ||
      supportedExtensions.includes('OES_texture_half_float_linear');

    // Test render target capabilities for PostProcessing (UnrealBloomPass)
    let supportsFloatRenderTarget = false;
    let supportsHalfFloatRenderTarget = false;

    if (version === 'webgl2') {
      const extFloat = gl.getExtension('EXT_color_buffer_float');
      if (extFloat) {
        supportsFloatRenderTarget = true;
        supportsHalfFloatRenderTarget = true;
      }
    } else {
      if (supportedExtensions.includes('WEBGL_color_buffer_float')) {
        supportsFloatRenderTarget = true;
      }
      if (supportedExtensions.includes('EXT_color_buffer_half_float')) {
        supportsHalfFloatRenderTarget = true;
      }
    }

    // Practical framebuffer probe to verify if float renderbuffer really works
    if (supportsHalfFloatRenderTarget) {
      let fbo: WebGLFramebuffer | null = null;
      let tex: WebGLTexture | null = null;
      try {
        fbo = gl.createFramebuffer();
        tex = gl.createTexture();
        if (!fbo || !tex) throw new Error('Framebuffer probe allocation failed');
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        if (version === 'webgl2') {
          const gl2 = gl as WebGL2RenderingContext;
          gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, 16, 16, 0, gl2.RGBA, gl2.HALF_FLOAT, null);
          gl2.framebufferTexture2D(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, tex, 0);
          const status = gl2.checkFramebufferStatus(gl2.FRAMEBUFFER);
          if (status !== gl2.FRAMEBUFFER_COMPLETE) {
            supportsHalfFloatRenderTarget = false;
          }
        }
      } catch (e) {
        supportsHalfFloatRenderTarget = false;
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if (tex) gl.deleteTexture(tex);
        if (fbo) gl.deleteFramebuffer(fbo);
      }
    }

    // 4. Architecture / Environment classification
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const hasTouch = 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const isSmallScreen = window.innerWidth < 800 || window.innerHeight < 600;

    // Detect VirGL / Turnip / Qualcomm Adreno / Mali / software renderers
    const rendererLower = (unmaskedRenderer + ' ' + renderer).toLowerCase();
    const isVirGL = rendererLower.includes('virgl') || rendererLower.includes('virpipe') || rendererLower.includes('zink');
    const isMobileGPU =
      rendererLower.includes('adreno') ||
      rendererLower.includes('mali') ||
      rendererLower.includes('powervr') ||
      rendererLower.includes('apple') ||
      rendererLower.includes('freedreno') ||
      rendererLower.includes('turnip');
    const isSoftwareRenderer =
      rendererLower.includes('llvmpipe') ||
      rendererLower.includes('softpipe') ||
      rendererLower.includes('swiftshader') ||
      rendererLower.includes('software');

    const isMobile = isMobileUA || (hasTouch && (isSmallScreen || isMobileGPU)) || isVirGL;
    const isConstrained = isMobile || isSoftwareRenderer || isVirGL || maxTextureSize <= 4096;

    // 5. Recommended Settings
    let recommendedDpr = 1.0;
    if (isConstrained || isVirGL) {
      recommendedDpr = Math.min(1.0, window.devicePixelRatio || 1.0);
    } else {
      recommendedDpr = Math.min(1.5, window.devicePixelRatio || 1.0);
    }

    let recommendedPreset: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    if (isSoftwareRenderer) {
      recommendedPreset = 'LOW';
    } else if (isVirGL || isMobile || isConstrained) {
      // Conservative start on VirGL / mobile Linux to guarantee no OOM crash
      recommendedPreset = 'MEDIUM';
    } else {
      recommendedPreset = 'HIGH';
    }

    // Clean up test context
    const loseExt = gl.getExtension('WEBGL_lose_context');
    if (loseExt) {
      loseExt.loseContext();
    }

    this.cachedInfo = {
      supported: version === 'webgl2',
      version,
      renderer,
      vendor,
      unmaskedRenderer,
      unmaskedVendor,
      maxTextureSize,
      maxRenderBufferSize,
      maxViewportDims,
      maxVertexTextureImageUnits,
      supportsFloatTextures,
      supportsHalfFloatTextures,
      supportsFloatLinear,
      supportsFloatRenderTarget,
      supportsHalfFloatRenderTarget,
      isVirGL,
      isMobile,
      isConstrained,
      recommendedDpr,
      recommendedPreset,
      extensions: supportedExtensions,
    };

    return this.cachedInfo;
  }

  private getFallbackInfo(reason: string): WebGLDiagnosticInfo {
    return {
      supported: false,
      version: 'none',
      renderer: reason,
      vendor: 'None',
      unmaskedRenderer: reason,
      unmaskedVendor: 'None',
      maxTextureSize: 0,
      maxRenderBufferSize: 0,
      maxViewportDims: [0, 0],
      maxVertexTextureImageUnits: 0,
      supportsFloatTextures: false,
      supportsHalfFloatTextures: false,
      supportsFloatLinear: false,
      supportsFloatRenderTarget: false,
      supportsHalfFloatRenderTarget: false,
      isVirGL: false,
      isMobile: true,
      isConstrained: true,
      recommendedDpr: 1.0,
      recommendedPreset: 'LOW',
      extensions: [],
    };
  }
}

export const WebGLCapabilities = new WebGLCapabilitiesDetector();
