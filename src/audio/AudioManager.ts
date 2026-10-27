import { AmbientAudioManager, AmbientSoundscapeState } from './AmbientAudioManager';
import { TimeLightingState } from '../world/TimeSystem';
import { WeatherState } from '../world/WeatherSystem';
import { WindState } from '../world/WindSystem';

export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
}

type AudioListener = (settings: AudioSettings) => void;

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isInitialized = false;
  private unlockListenersBound = false;
  private settings: AudioSettings = { muted: false, masterVolume: 0.45 };
  private listeners = new Set<AudioListener>();

  private constructor() {
    try {
      const savedMuted = localStorage.getItem('nexus_audio_muted');
      const savedVol = localStorage.getItem('nexus_audio_volume');
      if (savedMuted !== null) this.settings.muted = savedMuted === 'true';
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        this.settings.masterVolume = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.45;
      }
    } catch {
      // Ignore storage restrictions
    }
    this.bindUserGestureUnlock();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private bindUserGestureUnlock(): void {
    if (this.unlockListenersBound || typeof window === 'undefined' || !window.addEventListener) return;
    this.unlockListenersBound = true;
    const activateAudio = () => {
      this.ensureContext();
    };
    window.addEventListener('pointerdown', activateAudio, { passive: true });
    window.addEventListener('keydown', activateAudio, { passive: true });
  }

  public ensureContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
        this.masterGain.connect(this.ctx.destination);
        AmbientAudioManager.getInstance().attachContext(this.ctx, this.masterGain);
        this.isInitialized = true;
      } catch {
        return;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public updateAmbientSoundscape(
    delta: number,
    timeState: TimeLightingState,
    weatherState: WeatherState,
    windState?: WindState,
    trafficSpeedMultiplier: number = 1.0
  ): AmbientSoundscapeState {
    return AmbientAudioManager.getInstance().update(
      delta,
      timeState,
      weatherState,
      windState,
      trafficSpeedMultiplier
    );
  }

  public getAmbientState(): AmbientSoundscapeState {
    return AmbientAudioManager.getInstance().getState();
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal: number = 0.14
  ): void {
    this.ensureContext();
    if (!this.ctx || !this.masterGain || this.settings.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore
    }
  }

  public playFootstep(isRun: boolean = false): void {
    this.playTone(isRun ? 135 : 95, 42, 0.065, 'triangle', isRun ? 0.12 : 0.07);
  }

  public playJump(): void {
    this.playTone(140, 420, 0.22, 'sine', 0.16);
  }

  public playLand(): void {
    this.playTone(90, 32, 0.12, 'triangle', 0.18);
  }

  public playUI(kind: 'click' | 'open' | 'close' | 'toggle' | 'waypoint' = 'click'): void {
    if (kind === 'open') this.playTone(440, 660, 0.11, 'sine', 0.12);
    else if (kind === 'close') this.playTone(580, 340, 0.11, 'sine', 0.12);
    else if (kind === 'waypoint') this.playTone(520, 880, 0.16, 'triangle', 0.14);
    else this.playTone(620, 740, 0.06, 'sine', 0.1);
  }

  public playDiscoveryChime(): void {
    this.playTone(440, 880, 0.35, 'triangle', 0.15);
  }

  public playAlertChime(): void {
    this.playTone(520, 390, 0.25, 'sawtooth', 0.08);
  }

  public playTransitArrival(): void {
    this.playTone(392, 587.33, 0.28, 'sine', 0.1);
  }

  public playRepairComplete(): void {
    this.playTone(330, 660, 0.24, 'triangle', 0.14);
  }

  public setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.settings.masterVolume, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('nexus_audio_muted', String(muted));
    } catch {
      // Ignore storage quota errors
    }
    this.notify();
  }

  public toggleMute(): void {
    this.setMuted(!this.settings.muted);
  }

  public setMasterVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.settings.masterVolume = clamped;
    if (this.masterGain && this.ctx && !this.settings.muted) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('nexus_audio_volume', String(clamped));
    } catch {
      // Ignore storage quota errors
    }
    this.notify();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public isAudioInitialized(): boolean {
    return this.isInitialized;
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.getSettings();
    this.listeners.forEach((l) => l(snap));
  }
}
