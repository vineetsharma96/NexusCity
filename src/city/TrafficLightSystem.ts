import * as THREE from 'three';

export type SignalColor = 'GREEN' | 'AMBER' | 'RED';

export interface IntersectionSignalState {
  northSouth: SignalColor;
  eastWest: SignalColor;
  pedestrianNorthSouth: 'WALK' | 'DONT_WALK';
  pedestrianEastWest: 'WALK' | 'DONT_WALK';
  cycleTimer: number;
}

type SignalListener = (state: IntersectionSignalState) => void;

export class TrafficLightSystem {
  private static instance: TrafficLightSystem;

  // Cycle durations in seconds
  private static readonly GREEN_DURATION = 12.0;
  private static readonly AMBER_DURATION = 3.0;
  private static readonly ALL_RED_DURATION = 1.5;

  private totalCycleDuration =
    (TrafficLightSystem.GREEN_DURATION +
      TrafficLightSystem.AMBER_DURATION +
      TrafficLightSystem.ALL_RED_DURATION) *
    2;

  private timer: number = 0;
  private state: IntersectionSignalState = {
    northSouth: 'GREEN',
    eastWest: 'RED',
    pedestrianNorthSouth: 'DONT_WALK',
    pedestrianEastWest: 'WALK',
    cycleTimer: 0,
  };

  private listeners: Set<SignalListener> = new Set();

  public static getInstance(): TrafficLightSystem {
    if (!TrafficLightSystem.instance) {
      TrafficLightSystem.instance = new TrafficLightSystem();
    }
    return TrafficLightSystem.instance;
  }

  public update(delta: number): void {
    this.timer = (this.timer + delta) % this.totalCycleDuration;

    const g = TrafficLightSystem.GREEN_DURATION;
    const a = TrafficLightSystem.AMBER_DURATION;
    const r = TrafficLightSystem.ALL_RED_DURATION;
    const halfCycle = g + a + r;

    let ns: SignalColor = 'RED';
    let ew: SignalColor = 'RED';
    let pedNS: 'WALK' | 'DONT_WALK' = 'DONT_WALK';
    let pedEW: 'WALK' | 'DONT_WALK' = 'DONT_WALK';

    if (this.timer < g) {
      // Phase 1: NS Green, EW Red
      ns = 'GREEN';
      ew = 'RED';
      pedNS = 'DONT_WALK';
      pedEW = 'WALK';
    } else if (this.timer < g + a) {
      // Phase 2: NS Amber, EW Red
      ns = 'AMBER';
      ew = 'RED';
      pedNS = 'DONT_WALK';
      pedEW = 'DONT_WALK';
    } else if (this.timer < halfCycle) {
      // Phase 3: All Red
      ns = 'RED';
      ew = 'RED';
      pedNS = 'DONT_WALK';
      pedEW = 'DONT_WALK';
    } else if (this.timer < halfCycle + g) {
      // Phase 4: EW Green, NS Red
      ns = 'RED';
      ew = 'GREEN';
      pedNS = 'WALK';
      pedEW = 'DONT_WALK';
    } else if (this.timer < halfCycle + g + a) {
      // Phase 5: EW Amber, NS Red
      ns = 'RED';
      ew = 'AMBER';
      pedNS = 'DONT_WALK';
      pedEW = 'DONT_WALK';
    } else {
      // Phase 6: All Red
      ns = 'RED';
      ew = 'RED';
      pedNS = 'DONT_WALK';
      pedEW = 'DONT_WALK';
    }

    const changed =
      this.state.northSouth !== ns ||
      this.state.eastWest !== ew ||
      this.state.pedestrianNorthSouth !== pedNS ||
      this.state.pedestrianEastWest !== pedEW;

    this.state = {
      northSouth: ns,
      eastWest: ew,
      pedestrianNorthSouth: pedNS,
      pedestrianEastWest: pedEW,
      cycleTimer: this.timer,
    };

    if (changed) {
      this.notify();
    }
  }

  public getState(): IntersectionSignalState {
    return this.state;
  }

  /**
   * Check signal for a vehicle traveling along an axis (z: North/South, x: East/West)
   */
  public getVehicleSignal(axis: 'x' | 'z'): SignalColor {
    return axis === 'z' ? this.state.northSouth : this.state.eastWest;
  }

  /**
   * Check if pedestrians are allowed to cross an axis
   */
  public canPedestrianCross(axis: 'x' | 'z'): boolean {
    return axis === 'z'
      ? this.state.pedestrianNorthSouth === 'WALK'
      : this.state.pedestrianEastWest === 'WALK';
  }

  public subscribe(listener: SignalListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}
