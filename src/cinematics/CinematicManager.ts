import * as THREE from 'three';

export type CinematicPhase = 'LOADING' | 'CINEMATIC_INTRO' | 'TRANSITION_TO_PLAYER' | 'GAMEPLAY' | 'VISTA_MODE';

export interface CinematicState {
  phase: CinematicPhase;
  caption: string;
  subcaption: string;
  progress: number;
  canSkip: boolean;
}

type CinematicListener = (state: CinematicState) => void;

interface Waypoint {
  time: number;
  camPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  caption: string;
  subcaption: string;
}

export class CinematicManager {
  private static instance: CinematicManager;
  private phase: CinematicPhase = 'LOADING';
  private timer = 0;
  private readonly totalDuration = 11.5;

  private transitionTimer = 0;
  private readonly transitionDuration = 2.0;
  private startTransitionCamPos = new THREE.Vector3();
  private startTransitionLookAt = new THREE.Vector3();

  private vistaCenter = new THREE.Vector3(0, 0, 0);
  private vistaAngle = 0;
  private readonly vistaRadius = 38;
  private readonly vistaHeight = 20;

  private currentCamPos = new THREE.Vector3(0, 220, 260);
  private currentLookAt = new THREE.Vector3(0, 28, 0);
  private currentCaption = 'NEXUS // ARCHITECTURAL METROPOLIS';
  private currentSubcaption = 'INITIALIZING SPATIAL TELEMETRY';
  private listeners = new Set<CinematicListener>();

  private readonly waypoints: Waypoint[] = [
    {
      time: 0.0,
      camPos: new THREE.Vector3(0, 220, 260),
      lookAt: new THREE.Vector3(0, 28, 0),
      caption: 'SECTOR 01 // CENTRAL CIVIC AXIS',
      subcaption: '3KM PROCEDURAL METROPOLITAN GRID • SEED #847291',
    },
    {
      time: 3.6,
      camPos: new THREE.Vector3(-105, 98, 76),
      lookAt: new THREE.Vector3(28, 46, -28),
      caption: 'ELEVATED TRANSIT & MONOLITH SPIRES',
      subcaption: 'REAL-TIME DIURNAL ILLUMINATION & REGIONAL BIOMES',
    },
    {
      time: 7.2,
      camPos: new THREE.Vector3(48, 22, 48),
      lookAt: new THREE.Vector3(75, 4, 75),
      caption: 'BIOSPHERE SANCTUARY // REFLECTIVE BASIN',
      subcaption: 'HYDROLOGICAL CAUSTICS, BOTANICAL FLORA & FOOTBRIDGE',
    },
    {
      time: 9.8,
      camPos: new THREE.Vector3(0, 48, 34),
      lookAt: new THREE.Vector3(0, 1.45, 10),
      caption: 'GROUND TELEMETRY SYNCHRONIZED',
      subcaption: 'TRANSFERRING DIRECT OPERATIVE CONTROL',
    },
  ];

  private constructor() {}

  public static getInstance(): CinematicManager {
    if (!CinematicManager.instance) {
      CinematicManager.instance = new CinematicManager();
    }
    return CinematicManager.instance;
  }

  public finishLoading(): void {
    if (this.phase === 'LOADING') {
      this.phase = 'CINEMATIC_INTRO';
      this.timer = 0;
      this.notify();
    }
  }

  public skip(): void {
    if (this.phase === 'CINEMATIC_INTRO' || this.phase === 'LOADING' || this.phase === 'VISTA_MODE') {
      this.beginTransitionToPlayer();
    }
  }

  public triggerVista(
    centerPos: THREE.Vector3,
    caption: string = 'AERIAL ORBIT // SECTOR RECONNAISSANCE',
    subcaption: string = 'PRESS [V] OR INPUT MOVEMENT TO RESUME GROUND CONTROL'
  ): void {
    if (this.phase !== 'GAMEPLAY') return;
    this.phase = 'VISTA_MODE';
    this.vistaCenter.copy(centerPos);
    this.vistaAngle = 0;
    this.currentCaption = caption;
    this.currentSubcaption = subcaption;
    this.notify();
  }

  public exitVista(): void {
    if (this.phase === 'VISTA_MODE') {
      this.beginTransitionToPlayer();
    }
  }

  public toggleVista(centerPos: THREE.Vector3, caption?: string, subcaption?: string): void {
    if (this.phase === 'VISTA_MODE') this.exitVista();
    else if (this.phase === 'GAMEPLAY') this.triggerVista(centerPos, caption, subcaption);
  }

  private beginTransitionToPlayer(): void {
    this.phase = 'TRANSITION_TO_PLAYER';
    this.transitionTimer = 0;
    this.startTransitionCamPos.copy(this.currentCamPos);
    this.startTransitionLookAt.copy(this.currentLookAt);
    this.currentCaption = 'TRANSFERRING FIELD CONTROL';
    this.currentSubcaption = 'LOCKING THIRD-PERSON CAMERA RIG';
    this.notify();
  }

  public update(
    delta: number,
    targetPlayerPos: THREE.Vector3,
    outCamPos: THREE.Vector3,
    outLookAt: THREE.Vector3
  ): boolean {
    const dt = Math.min(Math.max(delta, 0), 0.1);
    if (this.phase === 'GAMEPLAY') return false;

    if (this.phase === 'LOADING') {
      this.currentCamPos.set(0, 220, 260);
      this.currentLookAt.set(0, 28, 0);
      outCamPos.copy(this.currentCamPos);
      outLookAt.copy(this.currentLookAt);
      return true;
    }

    if (this.phase === 'VISTA_MODE') {
      this.vistaAngle += dt * 0.22;
      const targetLookAt = this.vistaCenter.clone().add(new THREE.Vector3(0, 3.2, 0));
      const targetCamPos = new THREE.Vector3(
        this.vistaCenter.x + Math.cos(this.vistaAngle) * this.vistaRadius,
        this.vistaCenter.y + this.vistaHeight,
        this.vistaCenter.z + Math.sin(this.vistaAngle) * this.vistaRadius
      );
      this.currentCamPos.lerp(targetCamPos, dt * 2.4);
      this.currentLookAt.lerp(targetLookAt, dt * 3.0);
      outCamPos.copy(this.currentCamPos);
      outLookAt.copy(this.currentLookAt);
      return true;
    }

    if (this.phase === 'CINEMATIC_INTRO') {
      this.timer += dt;
      if (this.timer >= this.totalDuration) {
        this.beginTransitionToPlayer();
        return true;
      }

      let wIndex = 0;
      for (let i = 0; i < this.waypoints.length - 1; i++) {
        if (this.timer >= this.waypoints[i].time && this.timer < this.waypoints[i + 1].time) {
          wIndex = i;
          break;
        }
        if (i === this.waypoints.length - 2 && this.timer >= this.waypoints[i + 1].time) {
          wIndex = i + 1;
        }
      }

      if (wIndex < this.waypoints.length - 1) {
        const w0 = this.waypoints[wIndex];
        const w1 = this.waypoints[wIndex + 1];
        const t = THREE.MathUtils.smoothstep((this.timer - w0.time) / (w1.time - w0.time), 0, 1);
        this.currentCamPos.lerpVectors(w0.camPos, w1.camPos, t);
        this.currentLookAt.lerpVectors(w0.lookAt, w1.lookAt, t);
        this.currentCaption = w0.caption;
        this.currentSubcaption = w0.subcaption;
      } else {
        const last = this.waypoints[this.waypoints.length - 1];
        this.currentCamPos.copy(last.camPos);
        this.currentLookAt.copy(last.lookAt);
        this.currentCaption = last.caption;
        this.currentSubcaption = last.subcaption;
      }

      outCamPos.copy(this.currentCamPos);
      outLookAt.copy(this.currentLookAt);
      this.notify();
      return true;
    }

    if (this.phase === 'TRANSITION_TO_PLAYER') {
      this.transitionTimer += dt;
      const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const idealCamPos = targetPlayerPos.clone().add(new THREE.Vector3(0, 3.2, 7.5));
      const idealLookAt = targetPlayerPos.clone().add(new THREE.Vector3(0, 1.45, 0));

      this.currentCamPos.lerpVectors(this.startTransitionCamPos, idealCamPos, t);
      this.currentLookAt.lerpVectors(this.startTransitionLookAt, idealLookAt, t);
      outCamPos.copy(this.currentCamPos);
      outLookAt.copy(this.currentLookAt);

      if (progress >= 1.0) {
        this.phase = 'GAMEPLAY';
        this.notify();
      }
      return true;
    }

    return false;
  }

  public getState(): CinematicState {
    return {
      phase: this.phase,
      caption: this.currentCaption,
      subcaption: this.currentSubcaption,
      progress:
        this.phase === 'CINEMATIC_INTRO'
          ? this.timer / this.totalDuration
          : this.phase === 'TRANSITION_TO_PLAYER'
          ? this.transitionTimer / this.transitionDuration
          : 1.0,
      canSkip: this.phase === 'CINEMATIC_INTRO' || this.phase === 'LOADING' || this.phase === 'VISTA_MODE',
    };
  }

  public subscribe(listener: CinematicListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
