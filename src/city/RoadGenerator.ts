import * as THREE from 'three';

export class RoadGenerator {
  private static asphaltTexture: THREE.CanvasTexture | null = null;
  private static sidewalkTexture: THREE.CanvasTexture | null = null;

  public static getAsphaltTexture(): THREE.CanvasTexture {
    if (this.asphaltTexture) return this.asphaltTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle aggregate texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let i = 0; i < 900; i++) {
      ctx.fillRect((i * 73) % 512, (i * 139) % 512, 2, 2);
    }

    // Curbside ice-cyan edge guides
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, 0, 3, 512);
    ctx.fillRect(499, 0, 3, 512);

    // Solar-amber dual center divider
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(251, 0, 3, 512);
    ctx.fillRect(258, 0, 3, 512);

    // Dashed lane markers
    ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(128, y, 3, 32);
      ctx.fillRect(381, y, 3, 32);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 16);
    this.asphaltTexture = tex;
    return tex;
  }

  public static getSidewalkTexture(): THREE.CanvasTexture {
    if (this.sidewalkTexture) return this.sidewalkTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.sidewalkTexture = tex;
    return tex;
  }
}
