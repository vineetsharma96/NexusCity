import * as THREE from 'three';

/**
 * High-definition procedural canvas-based architectural texture generator.
 * Produces crisp basalt paving, multi-story curtain-wall facades with interior depth,
 * and surface normal/roughness maps.
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

    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, size, size);

    // Subtle stone grain
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const delta = ((i * 19) % 11) - 5;
      data[i] = Math.max(0, Math.min(255, data[i] + delta));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
    }
    ctx.putImageData(imgData, 0, 0);

    // Architectural basalt joints & sub-tiles
    ctx.strokeStyle = '#151e30';
    ctx.lineWidth = 1.5;
    for (let p = 0; p <= size; p += 32) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

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

    // Precision brass/solar-amber and ice-cyan inlay strips
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(20, 20, size - 40, size - 40);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(size / 2 - 1, 0, 2, size);
    ctx.strokeRect(0, size / 2 - 1, size, 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    this.cache.set(key, texture);
    return texture;
  }

  public static getBuildingFacadeTexture(litRatio: number = 0.6): THREE.CanvasTexture {
    const key = `facade-${litRatio}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const w = 512;
    const h = 1024;
    const [canvas, ctx] = this.createCanvas(w, h);
    ctx.fillStyle = '#070b13';
    ctx.fillRect(0, 0, w, h);

    // Vertical structural mullions & corner pilasters
    ctx.fillStyle = '#111827';
    for (let x = 0; x < w; x += 32) {
      ctx.fillRect(x, 0, 4, h);
    }
    ctx.fillStyle = '#1e293b';
    for (let x = 0; x < w; x += 128) {
      ctx.fillRect(x, 0, 8, h);
    }

    const cols = 16;
    const rows = 36;
    const padX = 5;
    const padY = 6;
    const winW = (w - (cols + 1) * padX) / cols;
    const winH = (h - (rows + 1) * padY) / rows;

    let hash = Math.floor(litRatio * 1000) + 17;
    for (let r = 0; r < rows; r++) {
      // Every 9th floor is a dark mechanical louver floor with accent piping
      if (r % 9 === 4) {
        const y = padY + r * (winH + padY);
        ctx.fillStyle = '#0b111e';
        ctx.fillRect(0, y - 2, w, winH + 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(0, y + winH * 0.45, w, 2);
        continue;
      }

      for (let c = 0; c < cols; c++) {
        hash = (hash * 1664525 + 1013904223) >>> 0;
        const rnd = (hash & 0xffff) / 0xffff;
        const x = padX + c * (winW + padX);
        const y = padY + r * (winH + padY);

        if (rnd < litRatio) {
          const tone = ((hash >>> 16) & 0xff) / 255;
          const topColor = tone > 0.56 ? '#fde68a' : tone > 0.24 ? '#bae6fd' : tone > 0.08 ? '#f59e0b' : '#6ee7b7';
          const botColor = tone > 0.56 ? '#d97706' : tone > 0.24 ? '#0284c7' : '#b45309';

          const grad = ctx.createLinearGradient(x, y, x, y + winH);
          grad.addColorStop(0, topColor);
          grad.addColorStop(1, botColor);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, winW, winH);

          // Interior horizontal blind / mezzanine silhouette for architectural depth
          if (((hash >>> 8) & 3) === 0) {
            ctx.fillStyle = 'rgba(7, 11, 19, 0.55)';
            ctx.fillRect(x, y + winH * 0.55, winW, 3);
          }
        } else {
          ctx.fillStyle = '#0d1526';
          ctx.fillRect(x, y, winW, winH);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.fillRect(x, y, winW, 2);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  public static getAsphaltNormalMap(): THREE.CanvasTexture {
    const key = 'asphalt-normal';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 128;
    const [canvas, ctx] = this.createCanvas(size, size);
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n1 = Math.sin(x * 0.45 + y * 0.7) * 16 + Math.sin(x * 1.7 - y * 1.3) * 6;
        const n2 = Math.cos(x * 0.8 - y * 0.35) * 16 + Math.cos(x * 1.4 + y * 1.9) * 6;
        data[idx] = Math.round(128 + n1);
        data[idx + 1] = Math.round(128 + n2);
        data[idx + 2] = 248;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
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

    for (let p = 0; p < 8; p++) {
      const px = (0.14 + ((p * 0.17) % 0.72)) * size;
      const py = (0.12 + ((p * 0.23) % 0.76)) * size;
      const radius = 22 + ((p * 13) % 32);
      const grad = ctx.createRadialGradient(px, py, 2, px, py, radius);
      grad.addColorStop(0, '#080808');
      grad.addColorStop(0.65, '#202020');
      grad.addColorStop(1, '#8c8c8c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, radius * 1.25, radius * 0.8, p * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 12);
    this.cache.set(key, texture);
    return texture;
  }

  public static getBuildingCladdingNormalMap(): THREE.CanvasTexture {
    const key = 'cladding-normal';
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = 256;
    const [canvas, ctx] = this.createCanvas(size, size);
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    const step = 32;
    ctx.lineWidth = 2;
    for (let i = 0; i <= size; i += step) {
      ctx.strokeStyle = '#6e80ff';
      ctx.beginPath();
      ctx.moveTo(0, i - 1);
      ctx.lineTo(size, i - 1);
      ctx.stroke();

      ctx.strokeStyle = '#806eff';
      ctx.beginPath();
      ctx.moveTo(i - 1, 0);
      ctx.lineTo(i - 1, size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 6);
    this.cache.set(key, texture);
    return texture;
  }
}
