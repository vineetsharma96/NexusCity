import * as THREE from 'three';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';

export interface AudioSettings {
  isMuted: boolean;
  masterVolume: number; // 0.0 to 1.0
  ambientVolume: number;
  sfxVolume: number;
}

type AudioListener = (settings: AudioSettings) => void;

export class AudioManager {
  private static instance: AudioManager;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private weatherGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private interiorFilter: BiquadFilterNode | null = null;

  // Ambient synth nodes
  private currentDistrictName: string = '';
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientNoiseNode: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;

  // Weather synth nodes
  private rainNoiseNode: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private prevLightningState: boolean = false;

  private isMuted: boolean = true; // start muted until user activates or interacts
  private masterVolume: number = 0.75;
  private ambientVolume: number = 0.6;
  private sfxVolume: number = 0.7;

  private listeners: Set<AudioListener> = new Set();
  private initialized: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('nexus_audio_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('nexus_audio_volume');
      if (savedVol !== null) {
        this.masterVolume = parseFloat(savedVol) || 0.75;
      }
    }
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initializes or resumes the AudioContext on first user interaction.
   */
  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Interior Acoustic Muffle Filter (lowpass that cuts high frequencies when indoors)
      this.interiorFilter = this.ctx.createBiquadFilter();
      this.interiorFilter.type = 'lowpass';
      this.interiorFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.interiorFilter.connect(this.masterGain);

      // Ambient Sub-bus
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
      this.ambientGain.connect(this.interiorFilter);

      // Weather Sub-bus
      this.weatherGain = this.ctx.createGain();
      this.weatherGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.weatherGain.connect(this.interiorFilter);

      // SFX Sub-bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Start continuous ambient synths
      this.setupWeatherSynth();
      this.startDistrictAmbient('Central City');

      // Subscribe to weather shifts
      WeatherSystem.getInstance().subscribe((w) => this.handleWeatherUpdate(w));

      // Subscribe to district shifts
      ChunkManager.getInstance().subscribe((c) => this.handleDistrictUpdate(c));

      this.initialized = true;
    } catch (err) {
      console.warn('AudioContext initialization failed:', err);
    }
  }

  public setInteriorMode(isInside: boolean): void {
    if (!this.ctx || !this.interiorFilter) return;
    const targetFreq = isInside ? 360 : 20000;
    this.interiorFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.15);
  }

  public ensureContext(): void {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.ensureContext();
    this.isMuted = !this.isMuted;

    if (this.ctx && this.masterGain) {
      const targetGain = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_audio_muted', this.isMuted ? 'true' : 'false');
    }

    this.notify();
    return this.isMuted;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = THREE.MathUtils.clamp(vol, 0, 1);
    if (!this.isMuted && this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_audio_volume', this.masterVolume.toString());
    }
    this.notify();
  }

  public getSettings(): AudioSettings {
    return {
      isMuted: this.isMuted,
      masterVolume: this.masterVolume,
      ambientVolume: this.ambientVolume,
      sfxVolume: this.sfxVolume,
    };
  }

  // ==========================================
  // PROCEDURAL BUFFER GENERATORS
  // ==========================================

  private createNoiseBuffer(durationSeconds: number = 3): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createPinkNoiseBuffer(durationSeconds: number = 3): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // ==========================================
  // AMBIENT DISTRICT SYNTHESIZERS (6 DISTINCT DISTRICTS)
  // ==========================================

  private startDistrictAmbient(districtName: string): void {
    if (!this.ctx || !this.ambientGain) return;
    if (this.currentDistrictName === districtName) return;
    this.currentDistrictName = districtName;

    // Clean up previous ambient nodes
    try {
      this.ambientOsc1?.stop();
      this.ambientOsc2?.stop();
      this.ambientNoiseNode?.stop();
    } catch {}

    const now = this.ctx.currentTime;

    // Base filter
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.connect(this.ambientGain);

    const dUpper = districtName.toUpperCase();

    if (dUpper.includes('SKY')) {
      // 1. Sky District: High-altitude wind whistle + crystalline harmonics
      this.ambientFilter.type = 'bandpass';
      this.ambientFilter.frequency.setValueAtTime(460, now);
      this.ambientFilter.Q.setValueAtTime(1.8, now);

      const noiseBuf = this.createPinkNoiseBuffer(4);
      this.ambientNoiseNode = this.ctx.createBufferSource();
      this.ambientNoiseNode.buffer = noiseBuf;
      this.ambientNoiseNode.loop = true;
      this.ambientNoiseNode.connect(this.ambientFilter);
      this.ambientNoiseNode.start();

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(330, now);
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.045, now);
      this.ambientOsc1.connect(oscGain);
      oscGain.connect(this.ambientGain);
      this.ambientOsc1.start();
    } else if (dUpper.includes('NEURAL')) {
      // 2. Neural District: Resonant data-center compute hum & server cooling
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(340, now);

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sawtooth';
      this.ambientOsc1.frequency.setValueAtTime(88, now);

      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientOsc2.type = 'sine';
      this.ambientOsc2.frequency.setValueAtTime(176, now);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.065, now);

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(subGain);
      subGain.connect(this.ambientGain);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } else if (dUpper.includes('INDUSTRIAL') || dUpper.includes('REACTOR')) {
      // 3. Industrial Reactor Zone: Heavy transformer hum & low machinery throb
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(140, now);

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sawtooth';
      this.ambientOsc1.frequency.setValueAtTime(46, now); // 46Hz heavy sub generator

      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientOsc2.type = 'square';
      this.ambientOsc2.frequency.setValueAtTime(92, now); // 92Hz electrical hum

      const indGain = this.ctx.createGain();
      indGain.gain.setValueAtTime(0.09, now);

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(indGain);
      indGain.connect(this.ambientGain);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } else if (dUpper.includes('OLD') || dUpper.includes('TOWN')) {
      // 4. Old Cyber Town: Retro neon tube buzz & rain gutter reverberation
      this.ambientFilter.type = 'bandpass';
      this.ambientFilter.frequency.setValueAtTime(120, now);
      this.ambientFilter.Q.setValueAtTime(4.0, now);

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sawtooth';
      this.ambientOsc1.frequency.setValueAtTime(60, now); // 60Hz mains transformer hum

      const neonGain = this.ctx.createGain();
      neonGain.gain.setValueAtTime(0.07, now);

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientFilter.connect(neonGain);
      neonGain.connect(this.ambientGain);
      this.ambientOsc1.start();
    } else if (dUpper.includes('GREEN') || dUpper.includes('BIOSPHERE')) {
      // 5. Biosphere Preserve: Tranquil organic canopy breeze & soft chimes
      this.ambientFilter.type = 'bandpass';
      this.ambientFilter.frequency.setValueAtTime(750, now);
      this.ambientFilter.Q.setValueAtTime(0.9, now);

      const noiseBuf = this.createPinkNoiseBuffer(4);
      this.ambientNoiseNode = this.ctx.createBufferSource();
      this.ambientNoiseNode.buffer = noiseBuf;
      this.ambientNoiseNode.loop = true;
      this.ambientNoiseNode.connect(this.ambientFilter);
      this.ambientNoiseNode.start();

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(392, now); // G4 peaceful tone
      const padGain = this.ctx.createGain();
      padGain.gain.setValueAtTime(0.035, now);
      this.ambientOsc1.connect(padGain);
      padGain.connect(this.ambientGain);
      this.ambientOsc1.start();
    } else {
      // 6. Central Metropolis (Default): Low urban street traffic rumble
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(160, now);

      const pinkBuf = this.createPinkNoiseBuffer(4);
      this.ambientNoiseNode = this.ctx.createBufferSource();
      this.ambientNoiseNode.buffer = pinkBuf;
      this.ambientNoiseNode.loop = true;
      this.ambientNoiseNode.connect(this.ambientFilter);
      this.ambientNoiseNode.start();

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, now); // 55Hz deep sub hum
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.08, now);
      this.ambientOsc1.connect(oscGain);
      oscGain.connect(this.ambientGain);
      this.ambientOsc1.start();
    }
  }

  // ==========================================
  // WEATHER SYNTHESIZERS (RAIN & THUNDER)
  // ==========================================

  private setupWeatherSynth(): void {
    if (!this.ctx || !this.weatherGain) return;

    // Rain noise buffer
    const rainBuf = this.createNoiseBuffer(3);
    this.rainNoiseNode = this.ctx.createBufferSource();
    this.rainNoiseNode.buffer = rainBuf;
    this.rainNoiseNode.loop = true;

    // Bandpass filter for gentle rain patter
    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(1.1, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.rainNoiseNode.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.weatherGain);
    this.rainNoiseNode.start();
  }

  private handleWeatherUpdate(w: WeatherState): void {
    if (!this.ctx || !this.rainGain) return;

    // Modulate rain patter volume
    const targetGain = w.rainIntensity > 0.05 ? w.rainIntensity * 0.45 : 0.0;
    this.rainGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);

    // Trigger thunder on lightning flash
    if (w.isLightningActive && !this.prevLightningState) {
      this.playThunder();
    }
    this.prevLightningState = w.isLightningActive;
  }

  private handleDistrictUpdate(c: ChunkManagerState): void {
    this.startDistrictAmbient(c.activeDistrict.name);
  }

  public playThunder(): void {
    if (!this.ctx || !this.weatherGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 1.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.weatherGain);

    osc.start(now);
    osc.stop(now + 2.3);
  }

  // ==========================================
  // PROCEDURAL SOUND EFFECTS (SFX)
  // ==========================================

  public playFootstep(isSprinting: boolean = false): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = isSprinting ? 80 : 65;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);

    gain.gain.setValueAtTime(isSprinting ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playJump(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.16);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playDoor(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playUI(type: 'click' | 'open' | 'close' = 'click'): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = type === 'open' ? 1480 : type === 'close' ? 740 : 1200;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playVehicleHorn(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(310, now);
    osc2.frequency.setValueAtTime(370, now);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.31);
    osc2.stop(now + 0.31);
  }

  public playHoverFlyby(pan: number = 0, speedFactor: number = 1.0): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    noise.buffer = this.createNoiseBuffer(1);

    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, now);
    filter.frequency.setValueAtTime(420 * speedFactor, now);
    filter.frequency.exponentialRampToValueAtTime(180 * speedFactor, now + 0.55);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260 * speedFactor, now);
    osc.frequency.exponentialRampToValueAtTime(130 * speedFactor, now + 0.55);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(THREE.MathUtils.clamp(pan, -1, 1), now);
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }

    noise.start(now);
    noise.stop(now + 0.56);
    osc.start(now);
    osc.stop(now + 0.56);
  }

  public playBrakeSqueal(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const settings = this.getSettings();
    this.listeners.forEach((l) => l(settings));
  }
}
