export interface AtmosphericBloomInput {
  nightFactor: number;
  goldenHourFactor: number;
  wetnessFactor: number;
  fogDensityMultiplier: number;
  isUltra: boolean;
  gridIsOut: boolean;
  lightScale: number;
}

export interface AtmosphericBloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes physically balanced HDR UnrealBloomPass parameters synchronized
 * with the diurnal cycle, atmospheric moisture/fog scattering, and city grid power.
 *
 * - Daytime: high threshold (~0.98) and subtle strength (~0.14) prevent sky/facade washout
 *   while preserving crisp specular sun glints.
 * - Dusk / Golden Hour: smooth transition lowering threshold and widening halo radius.
 * - Nighttime: rich atmospheric glow (strength ~0.72–0.92, threshold ~0.62–0.68, radius ~0.72–0.84)
 *   making HDR streetlights, neon strips, skyscraper windows, traffic signals, and vehicle lights bloom realistically.
 * - Rain / Fog: increases radius and softly boosts halo scatter to simulate humid urban air.
 * - Power Outage: attenuates nighttime bloom so emergency/backup lights stay moody and restrained.
 */
export function computeAtmosphericBloomParams(input: AtmosphericBloomInput): AtmosphericBloomParams {
  const night = clamp01(input.nightFactor);
  const golden = clamp01(input.goldenHourFactor);
  const wetness = clamp01(input.wetnessFactor);
  const fogFactor = clamp01((input.fogDensityMultiplier - 1.0) / 4.2);
  const gridFactor = input.gridIsOut ? 0.35 : Math.min(1.25, Math.max(0.2, input.lightScale));

  const ultraBoost = input.isUltra ? 0.08 : 0.0;

  // Base diurnal curve for bloom strength
  const baseStrength = lerp(0.14, 0.72 + ultraBoost, night) + golden * 0.12;
  const atmosphericScatter = (wetness * 0.14 + fogFactor * 0.12) * (0.35 + night * 0.65);
  const strength = Math.max(0.08, Math.min(1.15, (baseStrength + atmosphericScatter) * lerp(1.0, gridFactor, night)));

  // Smooth circular optical halo spread at night and in humid/foggy air
  // (capped at 0.64 so fine/mid mips remain dominant over coarse atmospheric mips)
  const radius = Math.min(
    0.64,
    lerp(0.24, input.isUltra ? 0.54 : 0.48, night) + golden * 0.05 + wetness * 0.05 + fogFactor * 0.05
  );

  // Higher luminance threshold during day so bright sunlit concrete stays crisp;
  // lower threshold at night so streetlights, windows, neon trims, and taillights bloom cleanly
  const threshold = Math.max(
    0.58,
    lerp(0.98, input.isUltra ? 0.64 : 0.68, night) - golden * 0.05 - fogFactor * 0.04
  );

  return { strength, radius, threshold };
}
