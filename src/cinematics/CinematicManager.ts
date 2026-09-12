import * as THREE from 'three';

export type CinematicPhase = 'LOADING' | 'CINEMATIC_INTRO' | 'TRANSITION_TO_PLAYER' | 'GAMEPLAY';

export interface CinematicState {
  phase: CinematicPhase;
  caption: string;
  subcaption: string;
  progress: number; // 0.0 to 1.0 within phase
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
  private timer: number = 0;
  private totalDuration: number = 12.5; // seconds for cinematic intro

  // Transition to player variables
  private transitionTimer: number = 0;
  private transitionDuration: number = 2.2;
  private startTransitionCamPos: THREE.Vector3 = new THREE.Vector3();
  private startTransitionLookAt: THREE.Vector3 = new THREE.Vector3();

  private currentCamPos: THREE.Vector3 = new THREE.Vector3(0, 240, 280);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 30, 0);

  private currentCaption: string = 'NEXUS METROPOLIS';
  private currentSubcaption: string = 'INITIALIZING SYSTEM OVERVIEW';

  private listeners: Set<CinematicListener> = new Set();

  private waypoints: Waypoint[] = [
    {
      time: 0.0,
      camPos: new THREE.Vector3(0, 240, 280),
      lookAt: new THREE.Vector3(0, 30, 0),
      caption: 'NEXUS CITY // SECTOR 01: CENTRAL PLAZA',
      subcaption: 'POPULATION: 5.8M ENHANCED CITIZENS • 3KM METROPOLITAN GRID',
    },
    {
      time: 3.8,
      camPos: new THREE.Vector3(-110, 110, 80),
      lookAt: new THREE.Vector3(30, 50, -30),
      caption: 'SKYWAY COMMUTER ARTERY // SKY DISTRICT',
      subcaption: 'HIGH-ALTITUDE TRANSIT CORRIDORS & DYNAMIC VIDEO MATRICES',
    },
    {
      time: 7.5,
      camPos: new THREE.Vector3(50, 22, 50),
      lookAt: new THREE.Vector3(75, 4, 75),
      caption: 'CENTRAL SANCTUARY // BIOLUMINESCENT POND',
      subcaption: 'REFLECTIVE WATER OASIS, ARCHING FOOTBRIDGE & FLORA',
    },
    {
      time: 10.5,
      camPos: new THREE.Vector3(0, 55, 35),
      lookAt: new THREE.Vector3(0, 1.45, 10),
      caption: 'NEURAL LINK SYNCHRONIZED',
      subcaption: 'TRANSFERRING CONTROL TO GROUND OPERATIVE',
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
    if (this.phase === 'CINEMATIC_INTRO' || this.phase === 'LOADING') {
      this.beginTransitionToPlayer();
    }
  }

  private beginTransitionToPlayer(): void {
    this.phase = 'TRANSITION_TO_PLAYER';
    this.transitionTimer = 0;
    this.startTransitionCamPos.copy(this.currentCamPos);
    this.startTransitionLookAt.copy(this.currentLookAt);
    this.currentCaption = 'TRANSFERRING NEURAL CONTROL';
    this.currentSubcaption = 'ALIGNING VISUAL CORTEX...';
    this.notify();
  }

  public update(
    delta: number,
    targetPlayerPos: THREE.Vector3,
    outCamPos: THREE.Vector3,
    outLookAt: THREE.Vector3
  ): boolean {
    if (this.phase === 'GAMEPLAY') {
      return false; // PlayerCamera handles everything
    }

    if (this.phase === 'LOADING') {
      // Hold high overview camera during loading screen
      this.currentCamPos.set(0, 240, 280);
      this.currentLookAt.set(0, 30, 0);
      outCamPos.copy(this.currentCamPos);
      outLookAt.copy(this.currentLookAt);
      return true;
    }

    if (this.phase === 'CINEMATIC_INTRO') {
      this.timer += delta;
      if (this.timer >= this.totalDuration) {
        this.beginTransitionToPlayer();
        return true;
      }

      // Interpolate through waypoints
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
        const segDuration = w1.time - w0.time;
        const rawT = (this.timer - w0.time) / segDuration;
        // Smooth Hermite ease
        const t = THREE.MathUtils.smoothstep(rawT, 0, 1);

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
      this.transitionTimer += delta;
      const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);
      // Smooth quintic ease-in-out curve
      const t = progress < 0.5
        ? 16 * progress * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 5) / 2;

      // Target camera pose behind player
      const idealPlayerCamPos = targetPlayerPos.clone().add(new THREE.Vector3(0, 3.2, 7.5));
      const idealPlayerLookAt = targetPlayerPos.clone().add(new THREE.Vector3(0, 1.45, 0));

      this.currentCamPos.lerpVectors(this.startTransitionCamPos, idealPlayerCamPos, t);
      this.currentLookAt.lerpVectors(this.startTransitionLookAt, idealPlayerLookAt, t);

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
      progress: this.phase === 'CINEMATIC_INTRO'
        ? this.timer / this.totalDuration
        : this.phase === 'TRANSITION_TO_PLAYER'
        ? this.transitionTimer / this.transitionDuration
        : 1.0,
      canSkip: this.phase === 'CINEMATIC_INTRO' || this.phase === 'LOADING',
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
