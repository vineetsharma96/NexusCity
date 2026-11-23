import * as THREE from 'three';

export class RoadGenerator {
  private static asphaltCanvas: HTMLCanvasElement | null = null;
  private static asphaltTextures = new Map<number, THREE.CanvasTexture>();
  private static sidewalkTexture: THREE.CanvasTexture | null = null;

  private static getAsphaltCanvas(): HTMLCanvasElement {
    if (this.asphaltCanvas) return this.asphaltCanvas;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep charcoal asphalt base
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle dark curb gutter strips on both outer edges
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, 26, 512);
    ctx.fillRect(998, 0, 26, 512);

    // Subtle wheel-track wear lanes across all 4 traffic lanes
    ctx.fillStyle = 'rgba(2, 6, 14, 0.34)';
    const laneCenters = [150, 380, 644, 874];
    for (const cx of laneCenters) {
      ctx.fillRect(cx - 42, 0, 22, 512);
      ctx.fillRect(cx + 20, 0, 22, 512);
    }

    // Fine mineral asphalt aggregate grain (subtle so mipmaps stay clean without sparkling)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    for (let i = 0; i < 2000; i++) {
      ctx.fillRect((i * 137) % 1024, (i * 251) % 512, 2, 2);
    }
    ctx.fillStyle = 'rgba(148, 163, 184, 0.018)';
    for (let i = 0; i < 800; i++) {
      ctx.fillRect((i * 193 + 41) % 1024, (i * 89 + 17) % 512, 3, 2);
    }

    // Curbside transit/shoulder lines (crisp ice-cyan + inner white shoulder with soft shoulder edge)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.fillRect(26, 0, 11, 512);
    ctx.fillRect(987, 0, 11, 512);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, 0, 7, 512);
    ctx.fillRect(989, 0, 7, 512);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.fillRect(58, 0, 4, 512);
    ctx.fillRect(962, 0, 4, 512);

    // Anti-aliased raised median buffer + clean continuous double solar-amber center divider
    // Wider soft-edged strokes prevent sub-pixel mipmap shimmer down the middle of long avenues
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(486, 0, 52, 512);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.fillRect(492, 0, 14, 512);
    ctx.fillRect(518, 0, 14, 512);
    ctx.fillStyle = '#e89b10';
    ctx.fillRect(495, 0, 8, 512);
    ctx.fillRect(521, 0, 8, 512);

    // Subtle matte center median seam (no high-contrast sparkling dots that moire at shallow angles)
    ctx.fillStyle = 'rgba(253, 230, 138, 0.16)';
    for (let y = 32; y < 512; y += 128) {
      ctx.fillRect(509, y, 6, 18);
    }

    // Dashed multi-lane dividers separating inner express & outer boulevard lanes
    ctx.fillStyle = 'rgba(226, 232, 240, 0.52)';
    for (let y = 20; y < 512; y += 64) {
      ctx.fillRect(263, y, 8, 32);
      ctx.fillRect(753, y, 8, 32);
    }

    this.asphaltCanvas = canvas;
    return canvas;
  }

  public static getAsphaltTexture(repeatY: number = 16): THREE.CanvasTexture {
    const key = Math.max(1, Math.round(repeatY));
    const cached = this.asphaltTextures.get(key);
    if (cached) return cached;

    const tex = new THREE.CanvasTexture(this.getAsphaltCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, key);
    tex.needsUpdate = true;
    this.asphaltTextures.set(key, tex);
    return tex;
  }

  public static getSidewalkTexture(): THREE.CanvasTexture {
    if (this.sidewalkTexture) return this.sidewalkTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 512);

    // Honed granite slabs with subtle directional stone sheen & beveled edges
    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        const shade = ((x / 64 + y / 64) % 2 === 0 ? 3 : -2) + (((x * 13 + y * 7) % 7) - 3);
        const r = 20 + shade;
        const g = 28 + shade;
        const b = 44 + shade;
        const grad = ctx.createLinearGradient(x, y, x + 64, y + 64);
        grad.addColorStop(0, `rgb(${r + 4}, ${g + 5}, ${b + 7})`);
        grad.addColorStop(1, `rgb(${Math.max(6, r - 3)}, ${Math.max(8, g - 3)}, ${Math.max(14, b - 4)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, 60, 60);

        // Micro-bevel catchlight on top-left and recessed shadow on bottom-right
        ctx.fillStyle = 'rgba(203, 213, 225, 0.08)';
        ctx.fillRect(x + 2, y + 2, 60, 1.5);
        ctx.fillRect(x + 2, y + 2, 1.5, 60);
        ctx.fillStyle = 'rgba(2, 6, 14, 0.36)';
        ctx.fillRect(x + 2, y + 60.5, 60, 1.5);
        ctx.fillRect(x + 60.5, y + 2, 1.5, 60);
      }
    }

    // Recessed architectural paver mortar seams
    ctx.strokeStyle = '#0b1120';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Tactile granite quartz micro-speckle
    ctx.fillStyle = 'rgba(226, 232, 240, 0.032)';
    for (let i = 0; i < 1400; i++) {
      ctx.fillRect((i * 97) % 512, (i * 163) % 512, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 12;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.sidewalkTexture = tex;
    return tex;
  }
}
