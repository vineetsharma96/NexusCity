export interface TransitStop { id: string; name: string; position: [number, number, number]; dwellSeconds: number; }

export class TransitScheduleSystem {
  private static instance: TransitScheduleSystem;
  private readonly stops: TransitStop[] = [
    { id: 'central', name: 'Central Transit Node', position: [-7, 0.2, 10], dwellSeconds: 4 },
    { id: 'east', name: 'East Exchange', position: [42, 0.2, 10], dwellSeconds: 3 },
    { id: 'west', name: 'West Exchange', position: [-42, 0.2, 10], dwellSeconds: 3 },
  ];

  public static getInstance(): TransitScheduleSystem {
    if (!TransitScheduleSystem.instance) TransitScheduleSystem.instance = new TransitScheduleSystem();
    return TransitScheduleSystem.instance;
  }

  public getStops(): readonly TransitStop[] { return this.stops; }
  public getNextStop(index: number): TransitStop { return this.stops[(index + 1) % this.stops.length]; }
  public getScheduleMinutes(now = new Date()): number { return now.getMinutes() % 10; }
}
