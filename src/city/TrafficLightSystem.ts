export type LightSignal = 'GREEN' | 'YELLOW' | 'RED';

export interface IntersectionLightState {
  nsSignal: LightSignal;
  ewSignal: LightSignal;
  nsWalk: boolean;
  ewWalk: boolean;
  timer: number;
}

export class TrafficLightSystem {
  private static instance: TrafficLightSystem;
  private readonly cycleDuration = 24.0;
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
    const t = this.timer;

    if (t < 9.0) {
      this.state.nsSignal = 'GREEN';
      this.state.ewSignal = 'RED';
      this.state.nsWalk = true;
      this.state.ewWalk = false;
    } else if (t < 11.5) {
      this.state.nsSignal = 'YELLOW';
      this.state.ewSignal = 'RED';
      this.state.nsWalk = false;
      this.state.ewWalk = false;
    } else if (t < 12.0) {
      this.state.nsSignal = 'RED';
      this.state.ewSignal = 'RED';
      this.state.nsWalk = false;
      this.state.ewWalk = false;
    } else if (t < 21.0) {
      this.state.nsSignal = 'RED';
      this.state.ewSignal = 'GREEN';
      this.state.nsWalk = false;
      this.state.ewWalk = true;
    } else if (t < 23.5) {
      this.state.nsSignal = 'RED';
      this.state.ewSignal = 'YELLOW';
      this.state.nsWalk = false;
      this.state.ewWalk = false;
    } else {
      this.state.nsSignal = 'RED';
      this.state.ewSignal = 'RED';
      this.state.nsWalk = false;
      this.state.ewWalk = false;
    }
    this.state.timer = t;
  }

  public getState(): IntersectionLightState {
    return this.state;
  }

  public canProceed(axis: 'NS' | 'EW', currentCoord: number, dir: 1 | -1): boolean {
    const signal = axis === 'NS' ? this.state.nsSignal : this.state.ewSignal;
    if (signal === 'GREEN') return true;
    const stopCoord = dir === 1 ? -14.5 : 14.5;
    const distToStop = (stopCoord - currentCoord) * dir;
    return !(distToStop > 0 && distToStop < 6.5);
  }
}
