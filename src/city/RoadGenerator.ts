import * as THREE from 'three';

export interface RoadSegment {
  id: string;
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
}

export interface SidewalkSegment {
  box: THREE.Box3;
}

export class RoadGenerator {
  private static asphaltTexture: THREE.CanvasTexture | null = null;
  private static sidewalkTexture: THREE.CanvasTexture | null = null;

  /**
   * Generates a procedural asphalt texture with painted highway stripes and wet road specularity.
   */
  public static getAsphaltTexture(): THREE.CanvasTexture {
    if (this.asphaltTexture) return this.asphaltTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt base
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, size, size);

    // Micro-gravel aggregate noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle tire wear streaks
    ctx.fillStyle = 'rgba(5, 7, 10, 0.4)';
    ctx.fillRect(size * 0.15, 0, size * 0.2, size);
    ctx.fillRect(size * 0.65, 0, size * 0.2, size);

    // Center divider dash lines (glowing cyber amber)
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 6;
    const dashH = 40;
    const gapH = 24;
    for (let y = 0; y < size; y += dashH + gapH) {
      ctx.fillRect(size / 2 - 2, y, 4, dashH);
    }

    // Outer lane boundary stripes (cyan neon)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 4;
    ctx.fillRect(16, 0, 3, size);
    ctx.fillRect(size - 19, 0, 3, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 8);
    this.asphaltTexture = texture;
    return texture;
  }

  /**
   * Generates a sleek concrete sidewalk slab texture.
   */
  public static getSidewalkTexture(): THREE.CanvasTexture {
    if (this.sidewalkTexture) return this.sidewalkTexture;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Concrete pavement
    ctx.fillStyle = '#182032';
    ctx.fillRect(0, 0, size, size);

    // Panel slab joints
    ctx.strokeStyle = '#0d1320';
    ctx.lineWidth = 3;
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    this.sidewalkTexture = texture;
    return texture;
  }
}
