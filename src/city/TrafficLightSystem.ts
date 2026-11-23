export type LightSignal = 'GREEN' | 'YELLOW' | 'RED';

export interface IntersectionLightState {
  nsSignal: LightSignal;
  ewSignal: LightSignal;
  nsWalk: boolean;
  ewWalk: boolean;
  timer: number;
}

export interface StopControlResult {
  shouldStop: boolean;
  distToStop: number;
  signal: LightSignal;
}

const CYCLE_DURATION = 24.0;

function computeSignalStateAtTime(tRaw: number): IntersectionLightState {
  const t = ((tRaw % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (t < 9.0) {
    return { nsSignal: 'GREEN', ewSignal: 'RED', nsWalk: true, ewWalk: false, timer: t };
  }
  if (t < 11.5) {
    return { nsSignal: 'YELLOW', ewSignal: 'RED', nsWalk: false, ewWalk: false, timer: t };
  }
  if (t < 12.0) {
    return { nsSignal: 'RED', ewSignal: 'RED', nsWalk: false, ewWalk: false, timer: t };
  }
  if (t < 21.0) {
    return { nsSignal: 'RED', ewSignal: 'GREEN', nsWalk: false, ewWalk: true, timer: t };
  }
  if (t < 23.5) {
    return { nsSignal: 'RED', ewSignal: 'YELLOW', nsWalk: false, ewWalk: false, timer: t };
  }
  return { nsSignal: 'RED', ewSignal: 'RED', nsWalk: false, ewWalk: false, timer: t };
}

export class TrafficLightSystem {
  private static instance: TrafficLightSystem;
  private readonly cycleDuration = CYCLE_DURATION;
  private timer = 0;
  private state: IntersectionLightState = {
    nsSignal: 'GREEN',
    ewSignal: 'RED',
    nsWalk: true,
    ewWalk: false,
    timer: 0,
  };

  private constructor() {}

  public static getInstance(): TrafficLightSystem {
    if (!TrafficLightSystem.instance) {
      TrafficLightSystem.instance = new TrafficLightSystem();
    }
    return TrafficLightSystem.instance;
  }

  public update(delta: number): void {
    this.timer = (this.timer + delta) % this.cycleDuration;
    const next = computeSignalStateAtTime(this.timer);
    this.state.nsSignal = next.nsSignal;
    this.state.ewSignal = next.ewSignal;
    this.state.nsWalk = next.nsWalk;
    this.state.ewWalk = next.ewWalk;
    this.state.timer = next.timer;
  }

  public getState(): IntersectionLightState {
    return this.state;
  }

  /**
   * Computes a synchronized green-wave traffic signal state for any city intersection (ix, iz).
   * Primary Central Plaza (0, 0) uses phase offset 0 (matching getState() verbatim);
   * alternating grid intersections offset by half a cycle (12s) for natural boulevard green waves.
   */
  public getIntersectionPhaseOffset(ix: number, iz: number): number {
    const gx = Math.round(ix / 75);
    const gz = Math.round(iz / 75);
    return ((Math.abs(gx + gz) & 1) === 1) ? 12.0 : 0.0;
  }

  public getSignalAtIntersection(ix: number, iz: number): IntersectionLightState {
    const offset = this.getIntersectionPhaseOffset(ix, iz);
    if (offset === 0) return this.state;
    return computeSignalStateAtTime(this.timer + offset);
  }

  /**
   * Evaluates whether an approaching vehicle should brake and stop at an intersection stop bar.
   * Vehicles that have already crossed the stop bar safely continue to clear the intersection.
   */
  public evaluateStopControl(
    axis: 'NS' | 'EW',
    currentCoord: number,
    dir: 1 | -1,
    intersectionCoord: number,
    crossRoadWidth: number,
    perpRoadCoord: number = 0,
  ): StopControlResult {
    const ix = axis === 'NS' ? perpRoadCoord : intersectionCoord;
    const iz = axis === 'NS' ? intersectionCoord : perpRoadCoord;
    const sigState = this.getSignalAtIntersection(ix, iz);
    const signal = axis === 'NS' ? sigState.nsSignal : sigState.ewSignal;

    // Stop center sits behind the amber stop bar + vehicle front overhang (~2.3m) so bumpers stay off zebra crosswalks
    const stopOffset = ix === 0 && iz === 0 ? 19.8 : crossRoadWidth * 0.5 + 8.0;
    const stopCoord = intersectionCoord - dir * stopOffset;
    const distToStop = (stopCoord - currentCoord) * dir;

    if (signal === 'GREEN') {
      return { shouldStop: false, distToStop, signal };
    }

    // Stop smoothly if approaching before the stop line; if already past the stop bar (distToStop <= -0.6), clear safely
    const shouldStop = distToStop > -0.6 && distToStop < 20.0;
    return { shouldStop, distToStop, signal };
  }

  public canProceed(axis: 'NS' | 'EW', currentCoord: number, dir: 1 | -1): boolean {
    const signal = axis === 'NS' ? this.state.nsSignal : this.state.ewSignal;
    if (signal === 'GREEN') return true;
    const stopCoord = dir === 1 ? -14.5 : 14.5;
    const distToStop = (stopCoord - currentCoord) * dir;
    return !(distToStop > 0 && distToStop < 6.5);
  }
}
