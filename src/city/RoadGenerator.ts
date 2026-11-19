import * as THREE from 'three';

export class RoadGenerator {
  private static asphaltTexture: THREE.CanvasTexture | null = null;
  private static sidewalkTexture: THREE.CanvasTexture | null = null;

  public static getAsphaltTexture(): THREE.CanvasTexture {
    if (this.asphaltTexture) return this.asphaltTexture;

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
    ctx.fillStyle = 'rgba(2, 6, 14, 0.36)';
    const laneCenters = [150, 380, 644, 874];
    for (const cx of laneCenters) {
      ctx.fillRect(cx - 42, 0, 22, 512);
      ctx.fillRect(cx + 20, 0, 22, 512);
    }

    // Fine mineral asphalt aggregate grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
    for (let i = 0; i < 2400; i++) {
      ctx.fillRect((i * 137) % 1024, (i * 251) % 512, 2, 2);
    }
    ctx.fillStyle = 'rgba(148, 163, 184, 0.022)';
    for (let i = 0; i < 900; i++) {
      ctx.fillRect((i * 193 + 41) % 1024, (i * 89 + 17) % 512, 3, 2);
    }

    // Curbside transit/shoulder lines (crisp ice-cyan + inner white shoulder)
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, 0, 5, 512);
    ctx.fillRect(991, 0, 5, 512);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
    ctx.fillRect(58, 0, 3, 512);
    ctx.fillRect(963, 0, 3, 512);

    // Raised median painted buffer + double solar-amber center divider
    ctx.fillStyle = '#0d1424';
    ctx.fillRect(492, 0, 40, 512);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(497, 0, 6, 512);
    ctx.fillRect(521, 0, 6, 512);
    // Subtle reflective cat's-eye studs along median
    ctx.fillStyle = '#fde68a';
    for (let y = 24; y < 512; y += 64) {
      ctx.fillRect(509, y, 6, 10);
    }

    // Dashed multi-lane dividers separating inner express & outer boulevard lanes
    ctx.fillStyle = 'rgba(226, 232, 240, 0.58)';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(264, y, 6, 34);
      ctx.fillRect(754, y, 6, 34);
    }

    // Subtle directional chevrons / lane flow ticks
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    for (const cx of laneCenters) {
      ctx.fillRect(cx - 2, 128, 4, 24);
      ctx.fillRect(cx - 2, 384, 4, 24);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 16);
    this.asphaltTexture = tex;
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

    // Subtle alternating granite slab tone variation
    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        const shade = ((x / 64 + y / 64) % 2 === 0 ? 2 : -2) + (((x * 13 + y * 7) % 5) - 2);
        ctx.fillStyle = `rgb(${17 + shade}, ${24 + shade}, ${39 + shade})`;
        ctx.fillRect(x + 2, y + 2, 60, 60);
      }
    }

    // Recessed architectural paver mortar seams
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Tactile stone micro-speckle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let i = 0; i < 800; i++) {
      ctx.fillRect((i * 97) % 512, (i * 163) % 512, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.sidewalkTexture = tex;
    return tex;
  }
}
