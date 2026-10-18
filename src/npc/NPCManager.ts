import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DialogueSystem } from './DialogueSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { NavigationSystem } from '../map/NavigationSystem';
import { MissionSystem } from '../gameplay/MissionSystem';
import { TrafficLightSystem } from '../city/TrafficLightSystem';
import { WeatherSystem } from '../world/WeatherSystem';

export type PedestrianAIState =
  | 'PATROL'
  | 'WAIT_CROSSWALK'
  | 'CROSSING_STREET'
  | 'WINDOW_SHOPPING'
  | 'CONVERSING'
  | 'SHELTER_SEEKING';

export type PedestrianAccessory =
  | 'HOLO_TABLET'
  | 'BRIEFCASE'
  | 'COURIER_PACK'
  | 'UMBRELLA_DRONE'
  | 'NONE';

export type SidewalkRouteType =
  | 'STORY_PATROL'
  | 'NS_AVENUE'
  | 'EW_AVENUE'
  | 'BLOCK_PERIMETER'
  | 'PARK_PROMENADE'
  | 'CROSSWAY_LOOP';

export interface NPCDef {
  id: string;
  name: string;
  role: string;
  isStoryNpc?: boolean;
  routeType: SidewalkRouteType;
  armorColor: string;
  visorColor: string;
  secondaryColor: string;
  scale: number;
  accessory: PedestrianAccessory;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  waypoints: THREE.Vector3[];
  currentWaypointIdx: number;
  walkSpeed: number;
  currentSpeed: number;
  isWalking: boolean;
  waitTimer: number;
  facingYaw: number;
  headLookYaw: number;
  aiState: PedestrianAIState;
  laneOffset: number;
  conversePartnerId?: string | null;
}

const CITIZEN_FIRST_NAMES = [
  'Aiden', 'Nyx', 'Sora', 'Kieran', 'Vesper', 'Talia', 'Orion', 'Mireille',
  'Zane', 'freya', 'Cassian', 'Elara', 'Dax', 'Linnea', 'Juno', 'Riven',
  'Kaelen', 'Sable', 'Toren', 'Yara', 'Cyrus', 'Nova', 'Idris', 'Valen',
  'Seren', 'Bram', 'Lyric', 'Elowen', 'Zephyr', 'Astra', 'Corin', 'Maeve',
  'Ren', 'Sylas', 'Vega', 'Aris',
];

const CITIZEN_ROLES = [
  'Arcology Structural Analyst',
  'Neural Grid Technician',
  'Synth-Market Courier',
  'Mag-Transit Commuter',
  'Biosphere Botanist',
  'Quantum Data Broker',
  'Civic Telemetry Auditor',
  'Holo-Media Producer',
  'Orbital Logistics Clerk',
  'Cryo-Turbine Engineer',
];

export class NPCManager {
  private static instance: NPCManager;
  public readonly npcs: NPCDef[] = [];
  private renderedIds = new Set<string>();
  private readonly respawnCheckInterval = 1.5;
  private respawnTimer = 0;

  private constructor() {
    this.initNPCs();
  }

  public static getInstance(): NPCManager {
    if (!NPCManager.instance) {
      NPCManager.instance = new NPCManager();
    }
    return NPCManager.instance;
  }

  private buildSidewalkRoutes(rng: SeedRandom): {
    routeType: SidewalkRouteType;
    waypoints: THREE.Vector3[];
  }[] {
    const routes: { routeType: SidewalkRouteType; waypoints: THREE.Vector3[] }[] = [];
    const y = 0.2;

    // 1. North-South Central Avenue Sidewalks (West & East curbs, with crosswalk connections)
    const nsWestA: THREE.Vector3[] = [
      new THREE.Vector3(-9.8, y, -135),
      new THREE.Vector3(-9.8, y, -82),
      new THREE.Vector3(-9.8, y, -68),
      new THREE.Vector3(-9.8, y, -14.5),
      new THREE.Vector3(-9.8, y, 14.5),
      new THREE.Vector3(-9.8, y, 68),
      new THREE.Vector3(-9.8, y, 82),
      new THREE.Vector3(-9.8, y, 135),
    ];
    const nsEastA: THREE.Vector3[] = [
      new THREE.Vector3(9.8, y, 135),
      new THREE.Vector3(9.8, y, 82),
      new THREE.Vector3(9.8, y, 68),
      new THREE.Vector3(9.8, y, 14.5),
      new THREE.Vector3(9.8, y, -14.5),
      new THREE.Vector3(9.8, y, -68),
      new THREE.Vector3(9.8, y, -82),
      new THREE.Vector3(9.8, y, -135),
    ];
    routes.push({ routeType: 'NS_AVENUE', waypoints: nsWestA });
    routes.push({ routeType: 'NS_AVENUE', waypoints: [...nsWestA].reverse() });
    routes.push({ routeType: 'NS_AVENUE', waypoints: nsEastA });
    routes.push({ routeType: 'NS_AVENUE', waypoints: [...nsEastA].reverse() });

    // Outer parallel North-South sidewalk avenues (x = ±61)
    routes.push({
      routeType: 'NS_AVENUE',
      waypoints: [
        new THREE.Vector3(-61, y, -130),
        new THREE.Vector3(-61, y, -68),
        new THREE.Vector3(-61, y, -14.5),
        new THREE.Vector3(-61, y, 14.5),
        new THREE.Vector3(-61, y, 68),
        new THREE.Vector3(-61, y, 130),
      ],
    });
    routes.push({
      routeType: 'NS_AVENUE',
      waypoints: [
        new THREE.Vector3(61, y, -130),
        new THREE.Vector3(61, y, -68),
        new THREE.Vector3(61, y, -14.5),
        new THREE.Vector3(61, y, 14.5),
        new THREE.Vector3(61, y, 36),
      ],
    });

    // 2. East-West Central Avenue Sidewalks (z = ±9.8, with crosswalk crossings across NS avenue)
    const ewNorth: THREE.Vector3[] = [
      new THREE.Vector3(-125, y, -9.8),
      new THREE.Vector3(-64, y, -9.8),
      new THREE.Vector3(-14.5, y, -9.8),
      new THREE.Vector3(14.5, y, -9.8),
      new THREE.Vector3(64, y, -9.8),
      new THREE.Vector3(125, y, -9.8),
    ];
    const ewSouth: THREE.Vector3[] = [
      new THREE.Vector3(125, y, 9.8),
      new THREE.Vector3(64, y, 9.8),
      new THREE.Vector3(14.5, y, 9.8),
      new THREE.Vector3(-14.5, y, 9.8),
      new THREE.Vector3(-64, y, 9.8),
      new THREE.Vector3(-125, y, 9.8),
    ];
    routes.push({ routeType: 'EW_AVENUE', waypoints: ewNorth });
    routes.push({ routeType: 'EW_AVENUE', waypoints: [...ewNorth].reverse() });
    routes.push({ routeType: 'EW_AVENUE', waypoints: ewSouth });
    routes.push({ routeType: 'EW_AVENUE', waypoints: [...ewSouth].reverse() });

    // 3. 4 Central High-Rise Block Perimeter Sidewalk Loops (walking around building colonnades)
    const blockCenters = [
      { cx: -38, cz: -38, halfW: 23.5, halfD: 23.5 }, // Helix Data Citadel
      { cx: 38, cz: -38, halfW: 23.5, halfD: 23.5 },  // Twin Spire Skybridge
      { cx: -38, cz: 38, halfW: 23.5, halfD: 23.5 },  // Cyber-Synth Lounge
      { cx: 38, cz: 38, halfW: 23.5, halfD: 23.5 },   // Apex Monolith Tower
    ];
    for (const blk of blockCenters) {
      const cw = [
        new THREE.Vector3(blk.cx - blk.halfW, y, blk.cz - blk.halfD),
        new THREE.Vector3(blk.cx + blk.halfW, y, blk.cz - blk.halfD),
        new THREE.Vector3(blk.cx + blk.halfW, y, blk.cz + blk.halfD),
        new THREE.Vector3(blk.cx - blk.halfW, y, blk.cz + blk.halfD),
      ];
      routes.push({ routeType: 'BLOCK_PERIMETER', waypoints: cw });
      routes.push({ routeType: 'BLOCK_PERIMETER', waypoints: [...cw].reverse() });
    }

    // 4. Central Intersection Crosswalk Loop (pedestrians actively crossing all 4 zebra crossings)
    const centralCrosswalkLoop = [
      new THREE.Vector3(-11.5, y, -11.5),
      new THREE.Vector3(11.5, y, -11.5),
      new THREE.Vector3(11.5, y, 11.5),
      new THREE.Vector3(-11.5, y, 11.5),
    ];
    routes.push({ routeType: 'CROSSWAY_LOOP', waypoints: centralCrosswalkLoop });
    routes.push({ routeType: 'CROSSWAY_LOOP', waypoints: [...centralCrosswalkLoop].reverse() });

    // North & South Crossway Avenue Sidewalks (z = -66.5 and z = 66.5)
    routes.push({
      routeType: 'CROSSWAY_LOOP',
      waypoints: [
        new THREE.Vector3(-85, y, -66.5),
        new THREE.Vector3(-14.5, y, -66.5),
        new THREE.Vector3(14.5, y, -66.5),
        new THREE.Vector3(85, y, -66.5),
        new THREE.Vector3(85, y, -83.5),
        new THREE.Vector3(14.5, y, -83.5),
        new THREE.Vector3(-14.5, y, -83.5),
        new THREE.Vector3(-85, y, -83.5),
      ],
    });
    routes.push({
      routeType: 'CROSSWAY_LOOP',
      waypoints: [
        new THREE.Vector3(-85, y, 66.5),
        new THREE.Vector3(-14.5, y, 66.5),
        new THREE.Vector3(14.5, y, 66.5),
        new THREE.Vector3(38, y, 66.5),
        new THREE.Vector3(38, y, 83.5),
        new THREE.Vector3(14.5, y, 83.5),
        new THREE.Vector3(-14.5, y, 83.5),
        new THREE.Vector3(-85, y, 83.5),
      ],
    });

    // 5. Central Park Sanctuary Botanical Promenade Loop (center at [75, 0, 75])
    const parkRing: THREE.Vector3[] = [];
    const parkSteps = 8;
    const parkRadius = 21.5;
    for (let s = 0; s < parkSteps; s++) {
      const ang = (s / parkSteps) * Math.PI * 2;
      parkRing.push(
        new THREE.Vector3(
          75 + Math.cos(ang) * parkRadius,
          y,
          75 + Math.sin(ang) * parkRadius
        )
      );
    }
    routes.push({ routeType: 'PARK_PROMENADE', waypoints: parkRing });
    routes.push({ routeType: 'PARK_PROMENADE', waypoints: [...parkRing].reverse() });

    // Shuffle slightly for variety while remaining deterministic
    if (rng.next() > 0.5) {
      routes.push({ routeType: 'CROSSWAY_LOOP', waypoints: centralCrosswalkLoop });
    }
    return routes;
  }

  private initNPCs(): void {
    const rng = new SeedRandom(739201);
    const dialogue = DialogueSystem.getInstance();

    const storyNpcs: {
      id: string;
      name: string;
      role: string;
      armorColor: string;
      visorColor: string;
      secondaryColor: string;
      accessory: PedestrianAccessory;
      position: THREE.Vector3;
      waypoints: THREE.Vector3[];
      walkSpeed: number;
    }[] = [
      {
        id: 'npc_kael',
        name: 'Archivist Kael',
        role: 'Civic Telemetry Officer',
        armorColor: '#0f172a',
        visorColor: '#f59e0b',
        secondaryColor: '#38bdf8',
        accessory: 'HOLO_TABLET',
        position: new THREE.Vector3(-9.5, 0.2, 9.5),
        waypoints: [
          new THREE.Vector3(-9.5, 0.2, 9.5),
          new THREE.Vector3(-9.5, 0.2, -9.5),
          new THREE.Vector3(9.5, 0.2, -9.5),
          new THREE.Vector3(9.5, 0.2, 9.5),
        ],
        walkSpeed: 2.05,
      },
      {
        id: 'npc_lyra',
        name: 'Director Lyra',
        role: 'Apex Structural Lead',
        armorColor: '#1e1b4b',
        visorColor: '#38bdf8',
        secondaryColor: '#f59e0b',
        accessory: 'BRIEFCASE',
        position: new THREE.Vector3(16, 0.2, 16),
        waypoints: [
          new THREE.Vector3(16, 0.2, 16),
          new THREE.Vector3(28, 0.2, 16),
          new THREE.Vector3(28, 0.2, 28),
          new THREE.Vector3(16, 0.2, 28),
        ],
        walkSpeed: 2.15,
      },
      {
        id: 'npc_vex',
        name: 'Curator Vex',
        role: 'Biosphere Botanist',
        armorColor: '#064e3b',
        visorColor: '#10b981',
        secondaryColor: '#38bdf8',
        accessory: 'HOLO_TABLET',
        position: new THREE.Vector3(56, 0.2, 75),
        waypoints: [
          new THREE.Vector3(56, 0.2, 75),
          new THREE.Vector3(64, 0.2, 75),
          new THREE.Vector3(64, 0.2, 65),
          new THREE.Vector3(56, 0.2, 65),
        ],
        walkSpeed: 1.9,
      },
      {
        id: 'npc_soren',
        name: 'Relay Courier Soren',
        role: 'Transit Network Specialist',
        armorColor: '#31102f',
        visorColor: '#f43f5e',
        secondaryColor: '#f59e0b',
        accessory: 'COURIER_PACK',
        position: new THREE.Vector3(-15, 0.2, -16),
        waypoints: [
          new THREE.Vector3(-15, 0.2, -16),
          new THREE.Vector3(-15, 0.2, -46),
          new THREE.Vector3(-11, 0.2, -46),
          new THREE.Vector3(-11, 0.2, -16),
        ],
        walkSpeed: 2.55,
      },
    ];

    storyNpcs.forEach((s) => {
      this.npcs.push({
        ...s,
        isStoryNpc: true,
        routeType: 'STORY_PATROL',
        scale: 1.02,
        velocity: new THREE.Vector3(),
        currentWaypointIdx: 1,
        currentSpeed: s.walkSpeed,
        isWalking: true,
        waitTimer: 0,
        facingYaw: 0,
        headLookYaw: 0,
        aiState: 'PATROL',
        laneOffset: 0,
        conversePartnerId: null,
      });

      dialogue.registerConversation({
        npcId: s.id,
        startNodeId: 'root',
        nodes: {
          root: {
            id: 'root',
            speaker: s.name,
            role: s.role,
            text: `Greetings operative. Sector telemetry is synchronized across the Central Axis. How can I assist your reconnaissance?`,
            choices: [
              {
                text: 'Mark Central Park Sanctuary on my Atlas',
                nextNodeId: 'marked',
                action: () => NavigationSystem.getInstance().setDestination('park_sanctuary'),
              },
              {
                text: 'Mark Apex Monolith Tower on my Atlas',
                nextNodeId: 'marked',
                action: () => NavigationSystem.getInstance().setDestination('apex_tower'),
              },
              { text: 'Conclude transmission', nextNodeId: null },
            ],
          },
          marked: {
            id: 'marked',
            speaker: s.name,
            role: s.role,
            text: 'Wayfinding coordinates uploaded to your HUD ribbon. Safe travels through the metropolis.',
            choices: [{ text: 'Acknowledge', nextNodeId: null }],
          },
        },
      });
    });

    // Procedural Sidewalk Pedestrian Pool (36 active metropolitan citizens across all sidewalk networks)
    const armorPalette = [
      '#0f172a',
      '#1e293b',
      '#172554',
      '#064e3b',
      '#3b0764',
      '#1e1b4b',
      '#27272a',
      '#31102f',
    ];
    const visorPalette = ['#38bdf8', '#f59e0b', '#10b981', '#f43f5e', '#a855f7'];
    const accessories: PedestrianAccessory[] = [
      'HOLO_TABLET',
      'BRIEFCASE',
      'COURIER_PACK',
      'UMBRELLA_DRONE',
      'NONE',
    ];
    const routes = this.buildSidewalkRoutes(rng);
    const citizenObservations = [
      'Pedestrian signals along the Central Plaza sync with the mag-shuttle loop—makes commuting between Helix Citadel and the Sanctuary effortless.',
      'Have you walked through the Central Park Conservatory at dusk? The bioluminescent lotus lagoon and warm lantern arches are breathtaking.',
      'The new diagrid exoskeletons on the downtown towers dampen high-altitude wind shear during electrical storms.',
      'If you need to cross the metropolis quickly, hail one of the Solaris Hover-Coupes or hop the autonomous Mag-Shuttle at the avenue shelters.',
      'Keep an eye on the avenue telemetry gantries—whenever a grid surge or weather front rolls in, the whole skyline shifts color temperature.',
      'I just finished a shift at the North-East Exchange. Even at midnight, the sidewalk colonnades stay bustling.',
    ];

    for (let i = 0; i < 36; i++) {
      const id = `citizen_${i}`;
      const routeDef = routes[i % routes.length];
      const waypoints = routeDef.waypoints.map((wp) => wp.clone());
      const startWpIdx = i % waypoints.length;
      const nextWpIdx = (startWpIdx + 1) % waypoints.length;
      const segmentT = rng.range(0.12, 0.85);
      const startPos = new THREE.Vector3().lerpVectors(
        waypoints[startWpIdx],
        waypoints[nextWpIdx],
        segmentT
      );
      startPos.y = 0.2;

      const laneOffset = (i % 2 === 0 ? 1 : -1) * rng.range(0.32, 0.75);
      const firstName = CITIZEN_FIRST_NAMES[i % CITIZEN_FIRST_NAMES.length];
      const citizenName = `${firstName} #${104 + i}`;
      const role = CITIZEN_ROLES[i % CITIZEN_ROLES.length];
      const armorColor = rng.pick(armorPalette);
      const visorColor = rng.pick(visorPalette);
      const secondaryColor = visorPalette[(i + 2) % visorPalette.length];
      const accessory = accessories[i % accessories.length];
      const walkSpeed = rng.range(1.75, 2.55);

      const dx = waypoints[nextWpIdx].x - startPos.x;
      const dz = waypoints[nextWpIdx].z - startPos.z;
      const initialYaw = Math.atan2(dx, dz);

      this.npcs.push({
        id,
        name: citizenName,
        role,
        isStoryNpc: false,
        routeType: routeDef.routeType,
        armorColor,
        visorColor,
        secondaryColor,
        scale: rng.range(0.94, 1.06),
        accessory,
        position: startPos,
        velocity: new THREE.Vector3(),
        waypoints,
        currentWaypointIdx: nextWpIdx,
        walkSpeed,
        currentSpeed: walkSpeed,
        isWalking: true,
        waitTimer: 0,
        facingYaw: initialYaw,
        headLookYaw: 0,
        aiState: 'PATROL',
        laneOffset,
        conversePartnerId: null,
      });

      const observation = citizenObservations[i % citizenObservations.length];
      dialogue.registerConversation({
        npcId: id,
        startNodeId: 'hello',
        nodes: {
          hello: {
            id: 'hello',
            speaker: citizenName,
            role,
            text: observation,
            choices: [
              {
                text: 'What are you working on in this sector?',
                nextNodeId: 'sector_info',
              },
              { text: 'Safe travels, citizen', nextNodeId: null },
            ],
          },
          sector_info: {
            id: 'sector_info',
            speaker: citizenName,
            role,
            text: `As a ${role}, I spend most of my cycle moving between the avenue colonnades and telemetry terminals. Check your Atlas [M] if you need sector bearings.`,
            choices: [{ text: 'Appreciated', nextNodeId: null }],
          },
        },
      });
    }

    this.setRenderedNpcs(this.npcs);
  }

  public setRenderedNpcs(rendered: NPCDef[]): void {
    const interactions = InteractionSystem.getInstance();
    for (const id of this.renderedIds) {
      interactions.unregister(id);
    }
    this.renderedIds.clear();

    for (const npc of rendered) {
      this.renderedIds.add(npc.id);
      interactions.register({
        id: npc.id,
        name: npc.name,
        actionText: `SPEAK WITH ${npc.name.toUpperCase()}`,
        position: npc.position,
        radius: 3.0,
        onInteract: () => {
          MissionSystem.getInstance().recordInteraction();
          DialogueSystem.getInstance().startDialogue(npc.id);
        },
      });
    }
  }

  public getRenderedNpcs(): NPCDef[] {
    return this.npcs.filter((n) => this.renderedIds.has(n.id));
  }

  /**
   * Checks if moving from `pos` toward `target` is about to step off a sidewalk curb
   * onto a primary vehicular avenue where the pedestrian walk signal is currently RED.
   */
  private shouldWaitAtCrosswalk(pos: THREE.Vector3, target: THREE.Vector3): boolean {
    const lights = TrafficLightSystem.getInstance().getState();
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return false;

    // Crossing the North-South Avenue (road spans x in [-7.5, 7.5])
    const crossesNSAvenue =
      (Math.abs(pos.x) >= 7.8 && Math.abs(pos.x) <= 15.5) &&
      (pos.x * target.x < 0 || Math.abs(target.x) < 7.0) &&
      Math.abs(dx) > Math.abs(dz);
    if (crossesNSAvenue && !lights.ewWalk) {
      return true;
    }

    // Crossing the East-West Avenue (road spans z in [-7.5, 7.5])
    const crossesEWAvenue =
      (Math.abs(pos.z) >= 7.8 && Math.abs(pos.z) <= 15.5) &&
      (pos.z * target.z < 0 || Math.abs(target.z) < 7.0) &&
      Math.abs(dz) > Math.abs(dx);
    if (crossesEWAvenue && !lights.nsWalk) {
      return true;
    }

    return false;
  }

  private isInsideRoadwayCrosswalk(pos: THREE.Vector3): boolean {
    return Math.abs(pos.x) < 7.6 || Math.abs(pos.z) < 7.6;
  }

  /**
   * Dynamically recycles distant ambient pedestrians onto sidewalks near the player
   * when the player explores outer streamed districts (> 165m away), keeping sidewalks lively.
   */
  private recycleDistantPedestrians(playerPos: THREE.Vector3): void {
    // Only recycle if player is at least 95m away from the Central Plaza origin
    // so central district landmarks stay naturally populated when the player is near center
    if (Math.hypot(playerPos.x, playerPos.z) < 95) return;

    const gridSnap = 75;
    const baseSectorX = Math.round(playerPos.x / gridSnap) * gridSnap;
    const baseSectorZ = Math.round(playerPos.z / gridSnap) * gridSnap;

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.isStoryNpc || !this.renderedIds.has(npc.id)) continue;

      const distToPlayer = Math.hypot(npc.position.x - playerPos.x, npc.position.z - playerPos.z);
      if (distToPlayer > 175) {
        // Relocate this citizen onto a sidewalk loop around the player's current sector
        const sideOffset = (i % 2 === 0 ? 1 : -1) * 9.8;
        const blockHalf = 24;
        const loopCenterX = baseSectorX + ((i % 3) - 1) * 38;
        const loopCenterZ = baseSectorZ + ((Math.floor(i / 3) % 3) - 1) * 38;

        const newWaypoints = [
          new THREE.Vector3(loopCenterX - blockHalf, 0.2, loopCenterZ - blockHalf),
          new THREE.Vector3(loopCenterX + blockHalf, 0.2, loopCenterZ - blockHalf),
          new THREE.Vector3(loopCenterX + blockHalf, 0.2, loopCenterZ + blockHalf),
          new THREE.Vector3(loopCenterX - blockHalf, 0.2, loopCenterZ + blockHalf),
        ];

        const wpIdx = i % newWaypoints.length;
        npc.waypoints = newWaypoints;
        npc.currentWaypointIdx = (wpIdx + 1) % newWaypoints.length;
        npc.position.copy(newWaypoints[wpIdx]);
        npc.position.x += sideOffset * 0.08;
        npc.position.y = 0.2;
        npc.aiState = 'PATROL';
        npc.waitTimer = 0;
        npc.isWalking = true;
      }
    }
  }

  public update(delta: number, playerPos: THREE.Vector3): void {
    const dt = Math.min(delta, 0.1);
    const isDialogueOpen = Boolean(DialogueSystem.getInstance().getActiveNode());
    const weather = WeatherSystem.getInstance().getState();
    const isRainy = weather.rainIntensity > 0.35;

    this.respawnTimer += dt;
    if (this.respawnTimer >= this.respawnCheckInterval) {
      this.respawnTimer = 0;
      this.recycleDistantPedestrians(playerPos);
    }

    const renderedList = this.npcs.filter((n) => this.renderedIds.has(n.id));

    for (let i = 0; i < renderedList.length; i++) {
      const npc = renderedList[i];
      const distToPlayer = npc.position.distanceTo(playerPos);

      // 1. Player Proximity Interaction Pause
      if (distToPlayer < 2.6 || isDialogueOpen) {
        npc.isWalking = false;
        npc.currentSpeed = 0;
        npc.aiState = 'CONVERSING';
        npc.facingYaw = Math.atan2(playerPos.x - npc.position.x, playerPos.z - npc.position.z);
        npc.headLookYaw = 0;
        continue;
      }

      // Subtle head glance when player walks within 6.5m
      if (distToPlayer < 6.5) {
        const angleToPlayer = Math.atan2(playerPos.x - npc.position.x, playerPos.z - npc.position.z);
        let relYaw = angleToPlayer - npc.facingYaw;
        while (relYaw > Math.PI) relYaw -= Math.PI * 2;
        while (relYaw < -Math.PI) relYaw += Math.PI * 2;
        npc.headLookYaw = THREE.MathUtils.clamp(relYaw * 0.65, -0.65, 0.65);
      } else {
        npc.headLookYaw = 0;
      }

      // 2. Active Wait Timer (Window Shopping, Kiosk Inspection, or Brief Social Pause)
      if (npc.waitTimer > 0) {
        npc.waitTimer -= dt;
        npc.isWalking = false;
        npc.currentSpeed = 0;
        if (npc.waitTimer <= 0) {
          npc.aiState = isRainy ? 'SHELTER_SEEKING' : 'PATROL';
          npc.conversePartnerId = null;
        }
        continue;
      }

      const target = npc.waypoints[npc.currentWaypointIdx];
      if (!target) continue;

      // 3. Crosswalk Traffic Signal Awareness
      if (!npc.isStoryNpc && this.shouldWaitAtCrosswalk(npc.position, target)) {
        npc.aiState = 'WAIT_CROSSWALK';
        npc.isWalking = false;
        npc.currentSpeed = 0;
        npc.facingYaw = Math.atan2(target.x - npc.position.x, target.z - npc.position.z);
        continue;
      }

      // Determine active target with subtle sidewalk lane offset
      const rawDx = target.x - npc.position.x;
      const rawDz = target.z - npc.position.z;
      const rawDist = Math.hypot(rawDx, rawDz);

      if (rawDist < 0.42) {
        npc.currentWaypointIdx = (npc.currentWaypointIdx + 1) % npc.waypoints.length;
        // Story NPCs pause 1.2s at waypoints; ambient citizens either smoothly turn corners or pause to window-shop
        if (npc.isStoryNpc) {
          npc.waitTimer = 1.2;
          npc.isWalking = false;
          npc.currentSpeed = 0;
          npc.aiState = 'WINDOW_SHOPPING';
        } else {
          // Deterministic check based on waypoint index & citizen id for storefront/kiosk pauses
          const shouldPause = (npc.currentWaypointIdx + i) % 3 === 0 && !this.isInsideRoadwayCrosswalk(npc.position);
          if (shouldPause) {
            npc.waitTimer = isRainy ? 0.65 : 1.35;
            npc.isWalking = false;
            npc.currentSpeed = 0;
            npc.aiState = 'WINDOW_SHOPPING';
          } else {
            npc.waitTimer = 0;
            npc.isWalking = true;
            npc.aiState = isRainy ? 'SHELTER_SEEKING' : 'PATROL';
          }
        }
        continue;
      }

      // 4. Compute Forward Desired Direction + Mutual Sidewalk Separation Steering
      let dirX = rawDx / rawDist;
      let dirZ = rawDz / rawDist;

      // Apply personal-space separation from other nearby pedestrians
      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < renderedList.length; j++) {
        if (i === j) continue;
        const other = renderedList[j];
        const ox = npc.position.x - other.position.x;
        const oz = npc.position.z - other.position.z;
        const dSq = ox * ox + oz * oz;
        if (dSq > 0.0001 && dSq < 1.96) {
          // Within 1.4m personal space radius
          const d = Math.sqrt(dSq);
          const strength = (1.4 - d) / 1.4;
          sepX += (ox / d) * strength * 0.55;
          sepZ += (oz / d) * strength * 0.55;
        }
      }

      dirX += sepX;
      dirZ += sepZ;
      const norm = Math.hypot(dirX, dirZ) || 1;
      dirX /= norm;
      dirZ /= norm;

      // Speed modulation based on AI state & weather
      const crossingStreet = this.isInsideRoadwayCrosswalk(npc.position);
      if (crossingStreet) {
        npc.aiState = 'CROSSING_STREET';
      } else if (isRainy) {
        npc.aiState = 'SHELTER_SEEKING';
      } else {
        npc.aiState = 'PATROL';
      }

      const speedMult = crossingStreet ? 1.24 : isRainy ? 1.18 : 1.0;
      const effectiveSpeed = npc.walkSpeed * speedMult;
      const step = Math.min(rawDist, effectiveSpeed * dt);

      npc.isWalking = true;
      npc.currentSpeed = effectiveSpeed;
      npc.velocity.set(dirX * effectiveSpeed, 0, dirZ * effectiveSpeed);
      npc.position.x += dirX * step;
      npc.position.z += dirZ * step;
      npc.facingYaw = Math.atan2(dirX, dirZ);
    }
  }
}
