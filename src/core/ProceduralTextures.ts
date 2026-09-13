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

  /**
   * Generates a procedural tangent-space normal map for asphalt micro-granulate and gravel pores.
   */
  public static getAsphaltNormalMap(): THREE.CanvasTexture {
    const key = 'asphalt-normal';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Generate micro-granulate heightfield
    const heights = new Float32Array(size * size);
    for (let i = 0; i < heights.length; i++) {
      heights[i] = Math.random() * 0.7 + Math.sin(i * 0.17) * 0.15 + Math.cos(i * 0.31) * 0.15;
    }

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const strength = 1.8;

    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;

        const hL = heights[y * size + xm];
        const hR = heights[y * size + xp];
        const hD = heights[ym * size + x];
        const hU = heights[yp * size + x];

        // Central difference gradient
        const dx = (hR - hL) * strength;
        const dy = (hU - hD) * strength;
        const dz = 1.0;

        const len = Math.hypot(dx, dy, dz);
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = dz / len;

        const idx = (y * size + x) * 4;
        data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generates a procedural wet puddle roughness map.
   * Dark areas (low roughness) correspond to deep mirror-like water puddles.
   * Light areas (high roughness) correspond to porous damp asphalt.
   */
  public static getWetPuddleRoughnessMap(): THREE.CanvasTexture {
    const key = 'wet-puddle-roughness';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base damp asphalt roughness (~0.55 = 140/255)
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, size, size);

    // Draw organic puddle pools using soft blurred gradients
    const numPuddles = 7;
    for (let p = 0; p < numPuddles; p++) {
      const px = (0.2 + (p * 0.13) % 0.7) * size;
      const py = (0.15 + (p * 0.23) % 0.75) * size;
      const radius = 35 + ((p * 17) % 45);

      const radGrad = ctx.createRadialGradient(px, py, 4, px, py, radius);
      radGrad.addColorStop(0, '#0a0a0a');   // Center of puddle: glassy mirror (roughness ~0.04)
      radGrad.addColorStop(0.65, '#202020'); // Shallow water margin
      radGrad.addColorStop(1, '#909090');   // Damp surrounding asphalt

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, radius * 1.3, radius * 0.8, (p * Math.PI) / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Secondary tire-track water collection ruts
    ctx.fillStyle = 'rgba(25, 25, 25, 0.45)';
    ctx.fillRect(size * 0.22, 0, size * 0.14, size);
    ctx.fillRect(size * 0.64, 0, size * 0.14, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 16);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generates a procedural normal map for skyscraper exterior titanium cladding and seam bevels.
   */
  public static getBuildingCladdingNormalMap(): THREE.CanvasTexture {
    const key = 'cladding-normal';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Default flat normal (128, 128, 255)
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    // Beveled panel seams
    const panels = 4;
    const step = size / panels;
    ctx.lineWidth = 3;

    for (let i = 0; i <= size; i += step) {
      // Horizontal seam with bevel
      ctx.strokeStyle = '#7080ff'; // Light tilt
      ctx.beginPath();
      ctx.moveTo(0, i - 1);
      ctx.lineTo(size, i - 1);
      ctx.stroke();

      ctx.strokeStyle = '#9080ff'; // Opposite tilt
      ctx.beginPath();
      ctx.moveTo(0, i + 1);
      ctx.lineTo(size, i + 1);
      ctx.stroke();

      // Vertical seam
      ctx.strokeStyle = '#8070ff';
      ctx.beginPath();
      ctx.moveTo(i - 1, 0);
      ctx.lineTo(i - 1, size);
      ctx.stroke();

      ctx.strokeStyle = '#8090ff';
      ctx.beginPath();
      ctx.moveTo(i + 1, 0);
      ctx.lineTo(i + 1, size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    this.cache.set(key, texture);
    return texture;
  }
}
