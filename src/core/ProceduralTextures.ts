import * as THREE from 'three';

/**
 * Procedural canvas-based texture generator.
 * Zero external images required — 100% generated in-browser.
 */
export class ProceduralTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Generates a sleek cyberpunk street pavement / plaza grid texture.
   */
  public static getPlazaGridTexture(): THREE.CanvasTexture {
    const key = 'plaza-grid';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Dark titanium pavement base
    ctx.fillStyle = '#0d1322';
    ctx.fillRect(0, 0, size, size);

    // Subtle noise / micro-grain
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Panel division lines
    ctx.strokeStyle = '#18243b';
    ctx.lineWidth = 4;
    const step = 64;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Inset glowing neon conduits
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(32, 32, size - 64, size - 64);
    ctx.strokeRect(size / 2 - 2, 0, 4, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generates a procedural skyscraper window array texture.
   */
  public static getBuildingFacadeTexture(litRatio: number = 0.6): THREE.CanvasTexture {
    const key = `facade-${litRatio}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Building exterior panel
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 256, 512);

    const cols = 8;
    const rows = 16;
    const padX = 6;
    const padY = 8;
    const winW = (256 - (cols + 1) * padX) / cols;
    const winH = (512 - (rows + 1) * padY) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (winW + padX);
        const y = padY + r * (winH + padY);

        const isLit = Math.random() < litRatio;
        if (isLit) {
          const warmOrCool = Math.random();
          if (warmOrCool > 0.6) {
            ctx.fillStyle = '#ffeed0'; // warm office
          } else if (warmOrCool > 0.3) {
            ctx.fillStyle = '#78c6ff'; // cool cyber cyan
          } else {
            ctx.fillStyle = '#00f0ff'; // intense neon
          }
        } else {
          ctx.fillStyle = '#121a2d'; // unlit dark window
        }

        ctx.fillRect(x, y, winW, winH);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.cache.set(key, texture);
    return texture;
  }
}
