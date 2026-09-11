/**
 * Deterministic Pseudo-Random Number Generator based on Mulberry32.
 * Guarantees identical generation results across platforms for a given seed.
 */
export class SeedRandom {
  private s: number;
  public readonly initialSeed: number;

  constructor(seed: number = 847291) {
    this.initialSeed = Math.floor(seed);
    this.s = this.initialSeed;
  }

  /**
   * Resets the generator state back to the initial seed.
   */
  public reset(): void {
    this.s = this.initialSeed;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float in [min, max).
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns an integer in [min, max] (inclusive).
   */
  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Returns true with the given probability (0..1).
   */
  public bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Picks a random element from an array.
   */
  public pick<T>(array: T[]): T {
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /**
   * Shuffles an array in place deterministically using Fisher-Yates.
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// Global default instance for the canonical city seed
export const defaultRNG = new SeedRandom(847291);
