export interface GPUCapabilities {
  version: 'webgl2' | 'webgl1' | 'none';
  renderer: string;
  vendor: string;
  unmaskedRenderer: string;
  unmaskedVendor: string;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewportDims: [number, number];
  maxVertexTextureImageUnits: number;
  supportsFloatTextures: boolean;
  supportsHalfFloatTextures: boolean;
  supportsColorBufferFloat: boolean;
  supportsHalfFloatRenderTarget: boolean;
  supportsInstancing: boolean;
  isVirGL: boolean;
  isSwiftShader: boolean;
  isMesaSoftware: boolean;
  isMobile: boolean;
  isConstrained: boolean;
  recommendedPreset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  recommendedDpr: number;
}

export class WebGLCapabilities {
  private static cached: GPUCapabilities | null = null;

  public static detect(): GPUCapabilities {
    if (this.cached) return this.cached;

    const fallback: GPUCapabilities = {
      version: 'none',
      renderer: 'Unknown',
      vendor: 'Unknown',
      unmaskedRenderer: 'Unknown',
      unmaskedVendor: 'Unknown',
      maxTextureSize: 2048,
      maxRenderbufferSize: 2048,
      maxViewportDims: [2048, 2048],
      maxVertexTextureImageUnits: 4,
      supportsFloatTextures: false,
      supportsHalfFloatTextures: false,
      supportsColorBufferFloat: false,
      supportsHalfFloatRenderTarget: false,
      supportsInstancing: false,
      isVirGL: false,
      isSwiftShader: false,
      isMesaSoftware: false,
      isMobile: false,
      isConstrained: true,
      recommendedPreset: 'LOW',
      recommendedDpr: 1.0,
    };

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return fallback;
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const hasTouch =
      'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      (window.innerWidth < 768 && hasTouch);

    try {
      const canvas = document.createElement('canvas');
      let gl: WebGL2RenderingContext | WebGLRenderingContext | null = canvas.getContext('webgl2', {
        powerPreference: 'high-performance',
      }) as WebGL2RenderingContext | null;
      let version: 'webgl2' | 'webgl1' = 'webgl2';

      if (!gl) {
        gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        version = 'webgl1';
      }

      if (!gl) {
        this.cached = fallback;
        return fallback;
      }

      const vendor = String(gl.getParameter(gl.VENDOR) || 'Unknown');
      const renderer = String(gl.getParameter(gl.RENDERER) || 'Unknown');
      let unmaskedVendor = vendor;
      let unmaskedRenderer = renderer;

      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        unmaskedVendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || vendor);
        unmaskedRenderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || renderer);
      }

      const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      const maxRenderbufferSize = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 4096;
      const vpDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      const maxViewportDims: [number, number] = vpDims ? [vpDims[0], vpDims[1]] : [4096, 4096];
      const maxVertexTextureImageUnits = Number(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)) || 8;

      const isWebGL2 = version === 'webgl2';
      const supportsFloatTextures = isWebGL2 || !!gl.getExtension('OES_texture_float');
      const supportsHalfFloatTextures = isWebGL2 || !!gl.getExtension('OES_texture_half_float');
      const supportsColorBufferFloat = isWebGL2
        ? !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
        : !!gl.getExtension('WEBGL_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
      const supportsInstancing = isWebGL2 || !!gl.getExtension('ANGLE_instanced_arrays');

      let supportsHalfFloatRenderTarget = false;
      if (supportsHalfFloatTextures && supportsColorBufferFloat) {
        let fbo: WebGLFramebuffer | null = null;
        let tex: WebGLTexture | null = null;
        try {
          fbo = gl.createFramebuffer();
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          if (isWebGL2) {
            const gl2 = gl as WebGL2RenderingContext;
            gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, 4, 4, 0, gl2.RGBA, gl2.HALF_FLOAT, null);
          } else {
            const hfExt = gl.getExtension('OES_texture_half_float');
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, hfExt ? hfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          supportsHalfFloatRenderTarget = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        } catch {
          supportsHalfFloatRenderTarget = false;
        } finally {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.bindTexture(gl.TEXTURE_2D, null);
          if (tex) gl.deleteTexture(tex);
          if (fbo) gl.deleteFramebuffer(fbo);
        }
      }

      const rLower = `${unmaskedRenderer} ${renderer}`.toLowerCase();
      const isVirGL = rLower.includes('virgl') || rLower.includes('virtio') || rLower.includes('red hat');
      const isSwiftShader = rLower.includes('swiftshader') || rLower.includes('google swiftshader');
      const isMesaSoftware = rLower.includes('llvmpipe') || rLower.includes('softpipe') || rLower.includes('software');
      const isConstrained =
        isVirGL ||
        isSwiftShader ||
        isMesaSoftware ||
        version === 'webgl1' ||
        maxTextureSize < 4096 ||
        !supportsHalfFloatRenderTarget;

      let recommendedPreset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' = 'HIGH';
      let recommendedDpr = Math.min(window.devicePixelRatio || 1, 2.0);

      if (isVirGL || isSwiftShader || isMesaSoftware) {
        recommendedPreset = 'LOW';
        recommendedDpr = 1.0;
      } else if (isConstrained || isMobile) {
        recommendedPreset = 'MEDIUM';
        recommendedDpr = Math.min(window.devicePixelRatio || 1, 1.25);
      }

      this.cached = {
        version,
        renderer,
        vendor,
        unmaskedRenderer,
        unmaskedVendor,
        maxTextureSize,
        maxRenderbufferSize,
        maxViewportDims,
        maxVertexTextureImageUnits,
        supportsFloatTextures,
        supportsHalfFloatTextures,
        supportsColorBufferFloat,
        supportsHalfFloatRenderTarget,
        supportsInstancing,
        isVirGL,
        isSwiftShader,
        isMesaSoftware,
        isMobile,
        isConstrained,
        recommendedPreset,
        recommendedDpr,
      };
      return this.cached;
    } catch {
      this.cached = fallback;
      return fallback;
    }
  }
}
