import * as THREE from 'three';

export type FacadeStyleVariant = 'CURTAIN_GLASS' | 'DIAGRID_HEX' | 'BRUTALIST_RIBBED' | 'ARCOLOGY_TERRACE';

/**
 * High-definition procedural PBR architectural texture generator.
 * Produces rich multi-archetype curtain-wall facades with sky-gradient reflections,
 * recessed interior office depth, matched emissive/roughness/normal maps,
 * basalt plaza slabs, and fine architectural concrete/metal surface normal maps.
 */
export class ProceduralTextures {
  private static cache = new Map<string, THREE.CanvasTexture>();

  private static createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return [canvas, canvas.getContext('2d')!];
  }

  public static getPlazaGridTexture(): THREE.CanvasTexture {
    const key = 'plaza-grid';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 512;
    const [canvas, ctx] = this.createCanvas(size, size);

    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, size, size);

    // Subtle alternating honed basalt & dark slate slabs
    for (let y = 0; y < size; y += 64) {
      for (let x = 0; x < size; x += 64) {
        const checker = ((x / 64 + y / 64) & 1) === 0 ? 4 : -3;
        const hash = (((x * 17 + y * 31) % 7) - 3);
        const r = 14 + checker + hash;
        const g = 20 + checker + hash;
        const b = 34 + checker + hash;
        const grad = ctx.createLinearGradient(x, y, x + 64, y + 64);
        grad.addColorStop(0, `rgb(${r + 4}, ${g + 5}, ${b + 7})`);
        grad.addColorStop(1, `rgb(${Math.max(4, r - 3)}, ${Math.max(6, g - 3)}, ${Math.max(10, b - 4)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, 60, 60);

        // Beveled stone highlight along top-left & shadow along bottom-right
        ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.fillRect(x + 2, y + 2, 60, 1.5);
        ctx.fillRect(x + 2, y + 2, 1.5, 60);
        ctx.fillStyle = 'rgba(2, 6, 14, 0.35)';
        ctx.fillRect(x + 2, y + 60.5, 60, 1.5);
        ctx.fillRect(x + 60.5, y + 2, 1.5, 60);
      }
    }

    // Fine stone grain
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const delta = ((i * 19 + (i >> 8) * 7) % 9) - 4;
      data[i] = Math.max(0, Math.min(255, data[i] + delta));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
    }
    ctx.putImageData(imgData, 0, 0);

    // Architectural expansion joints
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let p = 0; p <= size; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    // Precision brushed brass/amber and ice-cyan architectural inlays
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.82)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(18, 18, size - 36, size - 36);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(size / 2 - 1, 0, 2, size);
    ctx.strokeRect(0, size / 2 - 1, size, 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 12;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    this.cache.set(key, texture);
    return texture;
  }

  public static getBuildingFacadeTexture(
    litRatio: number = 0.6,
    variant: FacadeStyleVariant = 'CURTAIN_GLASS'
  ): THREE.CanvasTexture {
    const key = `facade-${litRatio}-${variant}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const w = 1024;
    const h = 1024;
    const [canvas, ctx] = this.createCanvas(w, h);

    // Distinct architectural base cladding finish per building archetype
    const baseCladding =
      variant === 'BRUTALIST_RIBBED'
        ? '#1a2232'
        : variant === 'DIAGRID_HEX'
        ? '#121a2b'
        : variant === 'ARCOLOGY_TERRACE'
        ? '#101d28'
        : '#0b1322';
    ctx.fillStyle = baseCladding;
    ctx.fillRect(0, 0, w, h);

    // Subtle brushed architectural aluminum/concrete horizontal micro-sheen
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)';
      ctx.fillRect(0, y, w, 2);
    }

    const cols = variant === 'BRUTALIST_RIBBED' ? 12 : 16;
    const rows = 32;
    const padX = variant === 'BRUTALIST_RIBBED' ? 16 : 9;
    const padY = 8;
    const winW = (w - (cols + 1) * padX) / cols;
    const winH = (h - (rows + 1) * padY) / rows;

    // Vertical structural mullions with beveled metallic highlights
    for (let c = 0; c <= cols; c++) {
      const mx = c * (winW + padX);
      const mullGrad = ctx.createLinearGradient(mx, 0, mx + padX, 0);
      if (variant === 'DIAGRID_HEX') {
        mullGrad.addColorStop(0, '#1f2937');
        mullGrad.addColorStop(0.45, '#3b4252');
        mullGrad.addColorStop(1, '#0f172a');
      } else if (variant === 'BRUTALIST_RIBBED') {
        mullGrad.addColorStop(0, '#2a3444');
        mullGrad.addColorStop(0.35, '#475569');
        mullGrad.addColorStop(1, '#111827');
      } else {
        mullGrad.addColorStop(0, '#162033');
        mullGrad.addColorStop(0.5, '#2b3b55');
        mullGrad.addColorStop(1, '#0b1220');
      }
      ctx.fillStyle = mullGrad;
      ctx.fillRect(mx, 0, padX, h);
    }

    let hash = Math.floor(litRatio * 1000) + variant.charCodeAt(0) * 31 + 17;
    for (let r = 0; r < rows; r++) {
      const y = padY + r * (winH + padY);

      // Every 8th floor is a recessed mechanical louver & telemetry gallery
      if (r % 8 === 4) {
        ctx.fillStyle = '#090e1a';
        ctx.fillRect(0, y - 3, w, winH + 6);
        // Brushed horizontal intake louvers
        for (let ly = y + 2; ly < y + winH - 2; ly += 4) {
          ctx.fillStyle = '#243247';
          ctx.fillRect(0, ly, w, 1.6);
          ctx.fillStyle = '#050810';
          ctx.fillRect(0, ly + 1.6, w, 1.4);
        }
        // Subtle architectural accent band
        ctx.fillStyle = variant === 'ARCOLOGY_TERRACE' ? '#10b981' : variant === 'DIAGRID_HEX' ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(0, y + winH * 0.5, w, 2.5);
        continue;
      }

      // Horizontal spandrel slab beam with subtle top bevel & bottom shadow
      const spandrelGrad = ctx.createLinearGradient(0, y - padY, 0, y);
      spandrelGrad.addColorStop(0, '#273549');
      spandrelGrad.addColorStop(0.35, '#192538');
      spandrelGrad.addColorStop(1, '#090f1c');
      ctx.fillStyle = spandrelGrad;
      ctx.fillRect(0, y - padY, w, padY);

      // Arcology greenery planter sill accent on alternate floors
      if (variant === 'ARCOLOGY_TERRACE' && r % 4 === 2) {
        ctx.fillStyle = '#065f46';
        ctx.fillRect(0, y + winH - 3, w, 4);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.fillRect(0, y + winH - 3, w, 1.5);
      }

      for (let c = 0; c < cols; c++) {
        hash = (hash * 1664525 + 1013904223) >>> 0;
        const rnd = (hash & 0xffff) / 0xffff;
        const x = padX + c * (winW + padX);

        if (rnd < litRatio) {
          const tone = ((hash >>> 16) & 0xff) / 255;
          let ceilingCol = '#fffbeb';
          let topColor = '#93c5fd';
          let botColor = '#1e3a8a';

          if (variant === 'ARCOLOGY_TERRACE') {
            ceilingCol = tone > 0.5 ? '#ecfdf5' : '#fef9c3';
            topColor = tone > 0.52 ? '#6ee7b7' : tone > 0.22 ? '#fcd34d' : '#7dd3fc';
            botColor = tone > 0.52 ? '#065f46' : tone > 0.22 ? '#92400e' : '#1e3a8a';
          } else if (variant === 'DIAGRID_HEX') {
            ceilingCol = tone > 0.45 ? '#fffbeb' : '#e0f2fe';
            topColor = tone > 0.48 ? '#fcd34d' : tone > 0.18 ? '#fdba74' : '#7dd3fc';
            botColor = tone > 0.48 ? '#92400e' : tone > 0.18 ? '#9a3412' : '#0c4a6e';
          } else {
            ceilingCol = tone > 0.5 ? '#fffbeb' : '#e0f2fe';
            topColor = tone > 0.56 ? '#fde68a' : tone > 0.24 ? '#93c5fd' : tone > 0.08 ? '#fbbf24' : '#6ee7b7';
            botColor = tone > 0.56 ? '#78350f' : tone > 0.24 ? '#0c4a6e' : '#7c2d12';
          }

          // Multi-stop recessed office lighting gradient (bright ceiling fixture -> warm/cool mid -> floor depth)
          const grad = ctx.createLinearGradient(x, y, x, y + winH);
          grad.addColorStop(0, ceilingCol);
          grad.addColorStop(0.24, topColor);
          grad.addColorStop(0.82, botColor);
          grad.addColorStop(1, '#0b1324');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, winW, winH);

          // Interior room architecture: office partitions, desks, blinds & recessed ceiling soffits
          const interiorDetail = (hash >>> 8) & 7;
          if (interiorDetail === 0 || interiorDetail === 1) {
            ctx.fillStyle = 'rgba(7, 11, 19, 0.52)';
            ctx.fillRect(x, y + winH * 0.58, winW, 4);
            ctx.fillRect(x + winW * 0.18, y + winH * 0.62, winW * 0.64, winH * 0.36);
          } else if (interiorDetail === 2) {
            // Partially lowered venetian blinds
            ctx.fillStyle = 'rgba(15, 23, 42, 0.46)';
            ctx.fillRect(x, y, winW, winH * 0.4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
            for (let by = y + 2; by < y + winH * 0.4; by += 3) {
              ctx.fillRect(x, by, winW, 1);
            }
          } else if (interiorDetail === 3) {
            ctx.fillStyle = 'rgba(7, 11, 19, 0.62)';
            ctx.fillRect(x + winW * 0.46, y, 4, winH);
          }

          // Diagonal glass specular reflection streak across the glazing
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + winW * 0.55, y);
          ctx.lineTo(x, y + winH * 0.65);
          ctx.closePath();
          ctx.fill();

          // Recessed window frame gasket
          ctx.strokeStyle = 'rgba(10, 16, 28, 0.78)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, y + 0.75, winW - 1.5, winH - 1.5);
        } else {
          // Unlit reflective architectural glass with crisp sky/horizon reflection gradient
          const darkGrad = ctx.createLinearGradient(x, y, x + winW * 0.35, y + winH);
          darkGrad.addColorStop(0, '#2a4365');
          darkGrad.addColorStop(0.38, '#172740');
          darkGrad.addColorStop(0.75, '#0e192c');
          darkGrad.addColorStop(1, '#1a2c47');
          ctx.fillStyle = darkGrad;
          ctx.fillRect(x, y, winW, winH);

          // Subtle diagonal sky reflection glint on unlit glass
          ctx.fillStyle = 'rgba(186, 230, 253, 0.11)';
          ctx.beginPath();
          ctx.moveTo(x + winW * 0.1, y);
          ctx.lineTo(x + winW * 0.45, y);
          ctx.lineTo(x + winW * 0.12, y + winH);
          ctx.lineTo(x, y + winH);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(148, 197, 255, 0.22)';
          ctx.fillRect(x, y, winW, 2);
          ctx.strokeStyle = 'rgba(6, 10, 20, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, y + 0.75, winW - 1.5, winH - 1.5);
        }
      }
    }

    if (variant === 'DIAGRID_HEX') {
      // Beveled anodized steel diagrid exoskeleton trusses
      const stepY = 128;
      ctx.strokeStyle = '#090e1a';
      ctx.lineWidth = 14;
      for (let y = -stepY; y < h + stepY; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + stepY * 2);
        ctx.moveTo(w, y);
        ctx.lineTo(0, y + stepY * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 9;
      for (let y = -stepY; y < h + stepY; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + stepY * 2);
        ctx.moveTo(w, y);
        ctx.lineTo(0, y + stepY * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.26)';
      ctx.lineWidth = 2;
      for (let y = -stepY; y < h + stepY; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y - 2);
        ctx.lineTo(w, y + stepY * 2 - 2);
        ctx.stroke();
      }
    } else if (variant === 'BRUTALIST_RIBBED') {
      // Sculpted fluted architectural stone/concrete pilasters
      for (let x = 0; x < w; x += 128) {
        const ribGrad = ctx.createLinearGradient(x, 0, x + 22, 0);
        ribGrad.addColorStop(0, '#0f172a');
        ribGrad.addColorStop(0.25, '#334155');
        ribGrad.addColorStop(0.55, '#475569');
        ribGrad.addColorStop(1, '#111827');
        ctx.fillStyle = ribGrad;
        ctx.fillRect(x, 0, 22, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 12;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Dedicated nocturnal window emissive map aligned pixel-for-pixel with getBuildingFacadeTexture.
   */
  public static getBuildingEmissiveTexture(
    litRatio: number = 0.6,
    variant: FacadeStyleVariant = 'CURTAIN_GLASS'
  ): THREE.CanvasTexture {
    const key = `facade-emissive-${litRatio}-${variant}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const w = 1024;
    const h = 1024;
    const [canvas, ctx] = this.createCanvas(w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const cols = variant === 'BRUTALIST_RIBBED' ? 12 : 16;
    const rows = 32;
    const padX = variant === 'BRUTALIST_RIBBED' ? 16 : 9;
    const padY = 8;
    const winW = (w - (cols + 1) * padX) / cols;
    const winH = (h - (rows + 1) * padY) / rows;

    let hash = Math.floor(litRatio * 1000) + variant.charCodeAt(0) * 31 + 17;
    for (let r = 0; r < rows; r++) {
      const y = padY + r * (winH + padY);
      if (r % 8 === 4) {
        ctx.fillStyle = variant === 'ARCOLOGY_TERRACE' ? '#10b981' : variant === 'DIAGRID_HEX' ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(0, y + winH * 0.5, w, 2.5);
        continue;
      }

      for (let c = 0; c < cols; c++) {
        hash = (hash * 1664525 + 1013904223) >>> 0;
        const rnd = (hash & 0xffff) / 0xffff;
        const x = padX + c * (winW + padX);

        if (rnd < litRatio) {
          const tone = ((hash >>> 16) & 0xff) / 255;
          let topColor = '#bae6fd';
          let botColor = '#0284c7';
          if (variant === 'ARCOLOGY_TERRACE') {
            topColor = tone > 0.52 ? '#a7f3d0' : tone > 0.22 ? '#fde68a' : '#bae6fd';
            botColor = tone > 0.52 ? '#059669' : tone > 0.22 ? '#d97706' : '#0284c7';
          } else if (variant === 'DIAGRID_HEX') {
            topColor = tone > 0.48 ? '#fde68a' : tone > 0.18 ? '#fed7aa' : '#7dd3fc';
            botColor = tone > 0.48 ? '#d97706' : tone > 0.18 ? '#c2410c' : '#0369a1';
          } else {
            topColor = tone > 0.56 ? '#fde68a' : tone > 0.24 ? '#bae6fd' : tone > 0.08 ? '#f59e0b' : '#6ee7b7';
            botColor = tone > 0.56 ? '#d97706' : tone > 0.24 ? '#0284c7' : '#b45309';
          }
          const grad = ctx.createLinearGradient(x, y, x, y + winH);
          grad.addColorStop(0, '#fffdf5');
          grad.addColorStop(0.24, topColor);
          grad.addColorStop(1, botColor);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, winW, winH);

          const interiorDetail = (hash >>> 8) & 7;
          if (interiorDetail === 0 || interiorDetail === 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
            ctx.fillRect(x, y + winH * 0.58, winW, 4);
            ctx.fillRect(x + winW * 0.18, y + winH * 0.62, winW * 0.64, winH * 0.36);
          } else if (interiorDetail === 2) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
            ctx.fillRect(x, y, winW, winH * 0.4);
          } else if (interiorDetail === 3) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(x + winW * 0.46, y, 4, winH);
          }
        }
      }
    }

    if (variant === 'DIAGRID_HEX') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 14;
      const stepY = 128;
      for (let y = -stepY; y < h + stepY; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + stepY * 2);
        ctx.moveTo(w, y);
        ctx.lineTo(0, y + stepY * 2);
        ctx.stroke();
      }
    } else if (variant === 'BRUTALIST_RIBBED') {
      ctx.fillStyle = '#000000';
      for (let x = 0; x < w; x += 128) {
        ctx.fillRect(x, 0, 22, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 12;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Dedicated PBR roughness map for building facades:
   * Glossy mirror-like glass panes (dark values ~0.12) contrasted against satin/matte mullions & stone spandrels (~0.62).
   */
  public static getBuildingRoughnessMap(variant: FacadeStyleVariant = 'CURTAIN_GLASS'): THREE.CanvasTexture {
    const key = `facade-roughness-${variant}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 512;
    const [canvas, ctx] = this.createCanvas(size, size);
    // Satin/matte structural cladding frame
    ctx.fillStyle = variant === 'BRUTALIST_RIBBED' ? '#c8c8c8' : '#8c8c8c';
    ctx.fillRect(0, 0, size, size);

    const cols = variant === 'BRUTALIST_RIBBED' ? 12 : 16;
    const rows = 32;
    const padX = variant === 'BRUTALIST_RIBBED' ? 8 : 4.5;
    const padY = 4;
    const winW = (size - (cols + 1) * padX) / cols;
    const winH = (size - (rows + 1) * padY) / rows;

    // Ultra-smooth reflective architectural glass panes
    ctx.fillStyle = '#202020';
    for (let r = 0; r < rows; r++) {
      if (r % 8 === 4) continue; // Mechanical louver floor stays matte
      const y = padY + r * (winH + padY);
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (winW + padX);
        ctx.fillRect(x, y, winW, winH);
      }
    }

    if (variant === 'DIAGRID_HEX') {
      ctx.strokeStyle = '#9a9a9a';
      ctx.lineWidth = 7;
      const stepY = 64;
      for (let y = -stepY; y < size + stepY; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y + stepY * 2);
        ctx.moveTo(size, y);
        ctx.lineTo(0, y + stepY * 2);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  public static getAsphaltNormalMap(): THREE.CanvasTexture {
    const key = 'asphalt-normal';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 256;
    const [canvas, ctx] = this.createCanvas(size, size);
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Multi-octave tileable fine mineral aggregate micro-relief
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;
        const n1 = Math.sin(u * 6 + v * 9) * 11 + Math.sin(u * 17 - v * 13) * 6 + Math.sin(u * 29 + v * 23) * 3;
        const n2 = Math.cos(u * 8 - v * 5) * 11 + Math.cos(u * 15 + v * 19) * 6 + Math.cos(u * 31 - v * 27) * 3;
        data[idx] = Math.max(0, Math.min(255, Math.round(128 + n1)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + n2)));
        data[idx + 2] = 248;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    this.cache.set(key, texture);
    return texture;
  }

  public static getWetPuddleRoughnessMap(): THREE.CanvasTexture {
    const key = 'wet-puddle-roughness';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 256;
    const [canvas, ctx] = this.createCanvas(size, size);
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(0, 0, size, size);

    for (let p = 0; p < 10; p++) {
      const px = (0.12 + ((p * 0.17) % 0.76)) * size;
      const py = (0.1 + ((p * 0.23) % 0.8)) * size;
      const radius = 20 + ((p * 13) % 30);
      const grad = ctx.createRadialGradient(px, py, 2, px, py, radius);
      grad.addColorStop(0, '#080808');
      grad.addColorStop(0.62, '#1e1e1e');
      grad.addColorStop(1, '#8c8c8c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, radius * 1.3, radius * 0.78, p * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 12);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * High-resolution beveled mullion & recessed window-pane normal map
   * aligned to the 16x32 curtain-wall grid so sunlight catches realistic 3D depth on every tower.
   */
  public static getBuildingCladdingNormalMap(): THREE.CanvasTexture {
    const key = 'cladding-normal';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 512;
    const [canvas, ctx] = this.createCanvas(size, size);
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    const cols = 16;
    const rows = 32;
    const cellW = size / cols;
    const cellH = size / rows;

    // Beveled vertical mullions & horizontal spandrel ledges
    for (let r = 0; r < rows; r++) {
      const y = r * cellH;
      // Top bevel (+Y normal tilt)
      ctx.fillStyle = '#80a8ff';
      ctx.fillRect(0, y, size, 2);
      // Bottom bevel (-Y normal tilt)
      ctx.fillStyle = '#8058ff';
      ctx.fillRect(0, y + 3, size, 2);
    }

    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      // Left mullion edge (-X tilt)
      ctx.fillStyle = '#5880ff';
      ctx.fillRect(x, 0, 2, size);
      // Right mullion edge (+X tilt)
      ctx.fillStyle = '#a880ff';
      ctx.fillRect(x + 2.5, 0, 2, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Beveled architectural granite paver normal map for sidewalks and plazas.
   */
  public static getSidewalkNormalMap(): THREE.CanvasTexture {
    const key = 'sidewalk-normal';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 256;
    const [canvas, ctx] = this.createCanvas(size, size);
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    const step = 32;
    for (let i = 0; i < size; i += step) {
      ctx.fillStyle = '#80a6ff';
      ctx.fillRect(0, i, size, 1.5);
      ctx.fillStyle = '#805aff';
      ctx.fillRect(0, i + 1.5, size, 1.5);

      ctx.fillStyle = '#a680ff';
      ctx.fillRect(i, 0, 1.5, size);
      ctx.fillStyle = '#5a80ff';
      ctx.fillRect(i + 1.5, 0, 1.5, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    this.cache.set(key, texture);
    return texture;
  }
}
