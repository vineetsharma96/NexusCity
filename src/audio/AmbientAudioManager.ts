import { DayPhase, TimeLightingState } from '../world/TimeSystem';
import { WeatherState, WeatherType } from '../world/WeatherSystem';
import { WindState } from '../world/WindSystem';

export interface AmbientSoundscapeState {
  profileName: string;
  activePhase: DayPhase;
  activeWeather: WeatherType;
  trafficLevel: number;
  windLevel: number;
  rainLevel: number;
  nocturneDroneLevel: number;
  daylightAirLevel: number;
  wetRoadHiss: number;
  windCutoffHz: number;
  trafficCutoffHz: number;
  thunderCount: number;
  passByCount: number;
}

export interface AmbientChannelSettings {
  ambientEnabled: boolean;
  ambientVolume: number;
  trafficEnabled: boolean;
  windEnabled: boolean;
  rainEnabled: boolean;
  droneEnabled: boolean;
}

interface AmbientNodes {
  masterBus: GainNode;
  trafficGain: GainNode;
  trafficLowFilter: BiquadFilterNode;
  trafficHissGain: GainNode;
  trafficHissFilter: BiquadFilterNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
  rainGain: GainNode;
  rainFilter: BiquadFilterNode;
  droneGain: GainNode;
  droneFilter: BiquadFilterNode;
  dayAirGain: GainNode;
  dayAirFilter: BiquadFilterNode;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class AmbientAudioManager {
  private static instance: AmbientAudioManager;
  private ctx: AudioContext | null = null;
  private nodes: AmbientNodes | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private lastLightningFlash = 0;
  private passByTimer = 4.5;
  private privateThunderCooldown = 0;

  private channelSettings: AmbientChannelSettings = {
    ambientEnabled: true,
    ambientVolume: 0.75,
    trafficEnabled: true,
    windEnabled: true,
    rainEnabled: true,
    droneEnabled: true,
  };

  private state: AmbientSoundscapeState = {
    profileName: 'NOCTURNE NEON HUM',
    activePhase: 'NIGHT',
    activeWeather: 'CLEAR',
    trafficLevel: 0.28,
    windLevel: 0.22,
    rainLevel: 0.0,
    nocturneDroneLevel: 0.62,
    daylightAirLevel: 0.08,
    wetRoadHiss: 0.06,
    windCutoffHz: 320,
    trafficCutoffHz: 165,
    thunderCount: 0,
    passByCount: 0,
  };

  private listeners = new Set<(state: AmbientSoundscapeState) => void>();

  private constructor() {
    try {
      const raw = localStorage.getItem('nexus_ambient_audio_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.channelSettings = {
            ambientEnabled:
              typeof parsed.ambientEnabled === 'boolean' ? parsed.ambientEnabled : true,
            ambientVolume:
              typeof parsed.ambientVolume === 'number' && Number.isFinite(parsed.ambientVolume)
                ? clamp01(parsed.ambientVolume)
                : 0.75,
            trafficEnabled:
              typeof parsed.trafficEnabled === 'boolean' ? parsed.trafficEnabled : true,
            windEnabled: typeof parsed.windEnabled === 'boolean' ? parsed.windEnabled : true,
            rainEnabled: typeof parsed.rainEnabled === 'boolean' ? parsed.rainEnabled : true,
            droneEnabled: typeof parsed.droneEnabled === 'boolean' ? parsed.droneEnabled : true,
          };
        }
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  public static getInstance(): AmbientAudioManager {
    if (!AmbientAudioManager.instance) {
      AmbientAudioManager.instance = new AmbientAudioManager();
    }
    return AmbientAudioManager.instance;
  }

  public attachContext(ctx: AudioContext, destination: AudioNode): void {
    if (this.ctx === ctx && this.nodes) return;
    this.ctx = ctx;

    try {
      const sampleRate = ctx.sampleRate || 44100;
      const length = sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      // Generate pink-weighted procedural noise for natural wind, rain, and distant traffic rumble
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;

      const randomValues = new Uint32Array(length);
      const MAX_ELEMENTS = 16384; // 65536 bytes / 4 bytes per element
      for (let offset = 0; offset < length; offset += MAX_ELEMENTS) {
        const end = Math.min(offset + MAX_ELEMENTS, length);
        const chunk = randomValues.subarray(offset, end);
        crypto.getRandomValues(chunk);
      }

      for (let i = 0; i < length; i++) {
        // Normalize Uint32 (0 to 4294967295) to [0, 1), then scale to [-1, 1]
        const randomVal = randomValues[i] / (0xffffffff + 1);
        const white = randomVal * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.14));
      }
      this.noiseBuffer = buffer;

      const createLoopingNoise = (): AudioBufferSourceNode => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.start(0);
        return src;
      };

      const masterBus = ctx.createGain();
      masterBus.gain.value = this.channelSettings.ambientEnabled
        ? this.channelSettings.ambientVolume
        : 0;
      masterBus.connect(destination);

      // 1. Distant Traffic Rumble + Wet Road Tire/Hover Wash
      const trafficGain = ctx.createGain();
      trafficGain.gain.value = 0.06;
      const trafficLowFilter = ctx.createBiquadFilter();
      trafficLowFilter.type = 'lowpass';
      trafficLowFilter.frequency.value = 175;
      trafficLowFilter.Q.value = 0.9;
      const trafficNoise = createLoopingNoise();
      trafficNoise.connect(trafficLowFilter);
      trafficLowFilter.connect(trafficGain);
      trafficGain.connect(masterBus);

      const trafficHissGain = ctx.createGain();
      trafficHissGain.gain.value = 0.01;
      const trafficHissFilter = ctx.createBiquadFilter();
      trafficHissFilter.type = 'bandpass';
      trafficHissFilter.frequency.value = 540;
      trafficHissFilter.Q.value = 1.4;
      const trafficHissNoise = createLoopingNoise();
      trafficHissNoise.connect(trafficHissFilter);
      trafficHissFilter.connect(trafficHissGain);
      trafficHissGain.connect(masterBus);

      // 2. Canyon Wind & Atmospheric Gusts
      const windGain = ctx.createGain();
      windGain.gain.value = 0.04;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 340;
      windFilter.Q.value = 2.4;
      const windNoise = createLoopingNoise();
      windNoise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterBus);

      // 3. Precipitation Rain & Monsoon Wash
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.0;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1850;
      rainFilter.Q.value = 0.75;
      const rainNoise = createLoopingNoise();
      rainNoise.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(masterBus);

      // 4. Nocturnal Neon Grid Drone (55Hz + 82.41Hz + 110Hz harmonic pad)
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.07;
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 190;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 55;
      osc2.type = 'triangle';
      osc2.frequency.value = 82.41;
      osc1.connect(droneFilter);
      osc2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(masterBus);
      osc1.start();
      osc2.start();

      // 5. Daylight Civic Plaza Harmonic Air (164.81Hz + 246.94Hz soft sine shimmer)
      const dayAirGain = ctx.createGain();
      dayAirGain.gain.value = 0.015;
      const dayAirFilter = ctx.createBiquadFilter();
      dayAirFilter.type = 'lowpass';
      dayAirFilter.frequency.value = 420;
      const dayOsc1 = ctx.createOscillator();
      const dayOsc2 = ctx.createOscillator();
      dayOsc1.type = 'sine';
      dayOsc1.frequency.value = 164.81;
      dayOsc2.type = 'sine';
      dayOsc2.frequency.value = 246.94;
      dayOsc1.connect(dayAirFilter);
      dayOsc2.connect(dayAirFilter);
      dayAirFilter.connect(dayAirGain);
      dayAirGain.connect(masterBus);
      dayOsc1.start();
      dayOsc2.start();

      this.nodes = {
        masterBus,
        trafficGain,
        trafficLowFilter,
        trafficHissGain,
        trafficHissFilter,
        windGain,
        windFilter,
        rainGain,
        rainFilter,
        droneGain,
        droneFilter,
        dayAirGain,
        dayAirFilter,
      };
    } catch {
      // Ignore WebAudio node creation errors on restricted devices
    }
  }

  public computeTargetSoundscape(
    timeState: TimeLightingState,
    weatherState: WeatherState,
    windState?: WindState,
    trafficSpeedMultiplier: number = 1.0
  ): Omit<AmbientSoundscapeState, 'thunderCount' | 'passByCount'> {
    const phase = timeState.phase;
    const nightFactor = clamp01(timeState.nightFactor);
    const rain = clamp01(weatherState.rainIntensity);
    const wetness = clamp01(weatherState.wetnessFactor);
    const fogMult = Math.max(1, weatherState.fogDensityMultiplier);
    const gust = windState ? Math.max(0.5, Math.min(2.8, windState.gustStrength)) : 1.0;

    // Diurnal traffic activity curve:
    // High during DAY (0.78) and SUNSET/SUNRISE rush hours (0.85), low at deep NIGHT (0.26)
    const phaseTrafficBase =
      phase === 'SUNSET'
        ? 0.86
        : phase === 'SUNRISE'
        ? 0.74
        : phase === 'DAY'
        ? 0.8
        : 0.28;
    const weatherTrafficDamp =
      weatherState.currentWeather === 'HEAVY_RAIN' || weatherState.currentWeather === 'BLIZZARD'
        ? 0.78
        : 1.0;
    const trafficLevel = this.channelSettings.trafficEnabled
      ? clamp01(phaseTrafficBase * weatherTrafficDamp * Math.max(0.2, Math.min(1.3, trafficSpeedMultiplier)))
      : 0;

    // Wet road tire/hover hiss scales with both traffic volume and surface wetness
    const wetRoadHiss = this.channelSettings.trafficEnabled
      ? clamp01(trafficLevel * (0.18 + wetness * 0.82))
      : 0;

    // Wind level scales with gust factor, rain/blizzard storm intensity, and nocturnal canyon drafts
    const baseWind =
      weatherState.currentWeather === 'HEAVY_RAIN' || weatherState.currentWeather === 'BLIZZARD'
        ? 0.88
        : weatherState.currentWeather === 'RAIN' || weatherState.currentWeather === 'SNOW'
        ? 0.58
        : weatherState.currentWeather === 'FOG'
        ? 0.42
        : 0.2 + nightFactor * 0.14;
    const windLevel = this.channelSettings.windEnabled
      ? clamp01(baseWind * (0.7 + (gust - 0.8) * 0.35))
      : 0;

    const snow = clamp01(weatherState.snowIntensity ?? 0);
    const rainLevel = this.channelSettings.rainEnabled ? clamp01(Math.max(rain, snow * 0.45)) : 0;

    // Nocturnal cyberpunk grid drone swells at night and in dense fog
    const nocturneDroneLevel = this.channelSettings.droneEnabled
      ? clamp01(0.18 + nightFactor * 0.62 + Math.min(0.2, (fogMult - 1) * 0.08))
      : 0;

    // Daylight civic air harmonic layer rises during clear/calm sunrise & daytime
    const daylightAirLevel = this.channelSettings.droneEnabled
      ? clamp01((1 - nightFactor) * (1 - Math.max(rain, snow) * 0.75) * 0.65)
      : 0;

    const windCutoffHz = Math.round(220 + windLevel * 540 + (gust - 0.8) * 140);
    const trafficCutoffHz = Math.round(135 + trafficLevel * 125 + wetness * 85);

    let profileName = 'METROPOLITAN AMBIENCE';
    if (weatherState.currentWeather === 'HEAVY_RAIN') {
      profileName = nightFactor > 0.5 ? 'NOCTURNE MONSOON TEMPEST' : 'DAYLIGHT STORM FRONT';
    } else if (weatherState.currentWeather === 'BLIZZARD') {
      profileName = nightFactor > 0.5 ? 'NOCTURNE ARCTIC BLIZZARD' : 'CRYOGENIC SQUALL FRONT';
    } else if (weatherState.currentWeather === 'RAIN') {
      profileName = nightFactor > 0.5 ? 'NEON RAINFALL & WET ASPHALT' : 'URBAN RAINSHOWER';
    } else if (weatherState.currentWeather === 'SNOW') {
      profileName = nightFactor > 0.5 ? 'NOCTURNE CRYSTAL SNOWFALL' : 'WINTER METROPOLITAN DRIFT';
    } else if (weatherState.currentWeather === 'FOG') {
      profileName = nightFactor > 0.5 ? 'ABYSSAL FOG RESONANCE' : 'MIST CANYON DRIFT';
    } else if (phase === 'SUNRISE') {
      profileName = 'DAWN ARTERIAL AWAKENING';
    } else if (phase === 'DAY') {
      profileName = 'ZENITH METROPOLITAN RUSH';
    } else if (phase === 'SUNSET') {
      profileName = 'SOLAR DUSK COMMUTE';
    } else {
      profileName = 'NOCTURNE NEON HUM';
    }

    return {
      profileName,
      activePhase: phase,
      activeWeather: weatherState.currentWeather,
      trafficLevel,
      windLevel,
      rainLevel,
      nocturneDroneLevel,
      daylightAirLevel,
      wetRoadHiss,
      windCutoffHz,
      trafficCutoffHz,
    };
  }

  public update(
    delta: number,
    timeState: TimeLightingState,
    weatherState: WeatherState,
    windState?: WindState,
    trafficSpeedMultiplier: number = 1.0
  ): AmbientSoundscapeState {
    const dt = Math.max(0, Math.min(delta, 0.25));
    const target = this.computeTargetSoundscape(
      timeState,
      weatherState,
      windState,
      trafficSpeedMultiplier
    );

    const prevProfile = this.state.profileName;
    const prevPhase = this.state.activePhase;
    const prevWeather = this.state.activeWeather;

    this.state = {
      ...target,
      thunderCount: this.state.thunderCount,
      passByCount: this.state.passByCount,
    };

    // Trigger procedural thunderclap when lightning flashes spike during storms
    this.privateThunderCheck(dt, weatherState);

    // Trigger periodic distant vehicle pass-by sweeps based on time-of-day traffic level
    this.privatePassByCheck(dt, target.trafficLevel, weatherState.wetnessFactor);

    // Apply WebAudio parameter smoothing if AudioContext is active
    if (this.ctx && this.nodes) {
      try {
        const now = this.ctx.currentTime;
        const tau = 0.18;
        const masterTarget = this.channelSettings.ambientEnabled
          ? this.channelSettings.ambientVolume
          : 0;
        this.nodes.masterBus.gain.setTargetAtTime(masterTarget, now, 0.08);

        this.nodes.trafficGain.gain.setTargetAtTime(target.trafficLevel * 0.16, now, tau);
        this.nodes.trafficLowFilter.frequency.setTargetAtTime(target.trafficCutoffHz, now, tau);

        this.nodes.trafficHissGain.gain.setTargetAtTime(target.wetRoadHiss * 0.09, now, tau);
        this.nodes.trafficHissFilter.frequency.setTargetAtTime(
          460 + weatherState.wetnessFactor * 420,
          now,
          tau
        );

        this.nodes.windGain.gain.setTargetAtTime(target.windLevel * 0.15, now, tau);
        this.nodes.windFilter.frequency.setTargetAtTime(target.windCutoffHz, now, tau);

        this.nodes.rainGain.gain.setTargetAtTime(target.rainLevel * 0.22, now, tau);
        this.nodes.rainFilter.frequency.setTargetAtTime(
          1500 + target.rainLevel * 900,
          now,
          tau
        );

        this.nodes.droneGain.gain.setTargetAtTime(target.nocturneDroneLevel * 0.11, now, tau);
        this.nodes.droneFilter.frequency.setTargetAtTime(
          140 + (1 - timeState.nightFactor) * 90,
          now,
          tau
        );

        this.nodes.dayAirGain.gain.setTargetAtTime(target.daylightAirLevel * 0.05, now, tau);
      } catch {
        // Ignore audio scheduling errors
      }
    }

    if (
      prevProfile !== this.state.profileName ||
      prevPhase !== this.state.activePhase ||
      prevWeather !== this.state.activeWeather
    ) {
      this.notify();
    }

    return this.state;
  }

  private privateThunderCheck(dt: number, weatherState: WeatherState): void {
    if (this.privateThunderCooldown > 0) {
      this.privateThunderCooldown = Math.max(0, this.privateThunderCooldown - dt);
    }
    const flashDelta = weatherState.lightningFlash - this.lastLightningFlash;
    this.lastLightningFlash = weatherState.lightningFlash;

    if (
      this.channelSettings.ambientEnabled &&
      this.channelSettings.rainEnabled &&
      weatherState.lightningFlash > 0.65 &&
      flashDelta > 0.25 &&
      this.privateThunderCooldown <= 0
    ) {
      this.privateThunderCooldown = 2.5;
      this.state.thunderCount += 1;
      this.triggerThunderclap(weatherState.lightningFlash);
      this.notify();
    }
  }

  private privatePassByCheck(dt: number, trafficLevel: number, wetness: number): void {
    if (!this.channelSettings.ambientEnabled || !this.channelSettings.trafficEnabled || trafficLevel <= 0.05) {
      return;
    }
    this.passByTimer -= dt * (0.45 + trafficLevel * 1.15);
    if (this.passByTimer <= 0) {
      this.passByTimer = 3.8 + (1 - trafficLevel) * 5.2;
      this.state.passByCount += 1;
      this.triggerDistantPassBy(trafficLevel, wetness);
    }
  }

  public triggerThunderclap(intensity: number = 1.0): void {
    if (!this.ctx || !this.nodes || !this.noiseBuffer || !this.channelSettings.ambientEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.exponentialRampToValueAtTime(48, now + 2.2);

      const gain = this.ctx.createGain();
      const peak = Math.min(0.32, 0.18 * intensity);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.nodes.masterBus);
      src.start(now);
      src.stop(now + 2.45);
    } catch {
      // Ignore
    }
  }

  public triggerDistantPassBy(trafficLevel: number = 0.6, wetness: number = 0.2): void {
    if (!this.ctx || !this.nodes || !this.channelSettings.ambientEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const duration = 1.65;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      // Doppler shift: approaches higher pitch, recedes lower pitch
      const baseFreq = 115 + wetness * 35;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq * 0.92, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + duration * 0.45);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.74, now + duration);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(260 + wetness * 220, now);
      filter.Q.value = 2.2;

      const peakGain = Math.min(0.045, 0.018 + trafficLevel * 0.024);
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + duration * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.nodes.masterBus);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {
      // Ignore
    }
  }

  public getState(): AmbientSoundscapeState {
    return { ...this.state };
  }

  public getChannelSettings(): AmbientChannelSettings {
    return { ...this.channelSettings };
  }

  public updateChannelSettings(partial: Partial<AmbientChannelSettings>): void {
    this.channelSettings = {
      ...this.channelSettings,
      ...partial,
      ambientVolume:
        typeof partial.ambientVolume === 'number' && Number.isFinite(partial.ambientVolume)
          ? clamp01(partial.ambientVolume)
          : this.channelSettings.ambientVolume,
    };
    try {
      localStorage.setItem('nexus_ambient_audio_v1', JSON.stringify(this.channelSettings));
    } catch {
      // Ignore storage restrictions
    }
    if (this.ctx && this.nodes) {
      const target = this.channelSettings.ambientEnabled ? this.channelSettings.ambientVolume : 0;
      this.nodes.masterBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
    }
    this.notify();
  }

  public subscribe(listener: (state: AmbientSoundscapeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.getState();
    this.listeners.forEach((l) => l(snap));
  }
}
