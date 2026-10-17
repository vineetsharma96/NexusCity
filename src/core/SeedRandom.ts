/**
 * Mulberry32 deterministic PRNG for reproducible city layout across sessions.
 */
export class SeedRandom {
  private state: number;
  public readonly initialSeed: number;

  constructor(seed: number = 847291) {
    this.initialSeed = Math.floor(seed);
    this.state = this.initialSeed;
  }

  public reset(): void {
    this.state = this.initialSeed;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  public shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

export const defaultRNG = new SeedRandom(847291);
