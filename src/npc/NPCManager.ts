import * as THREE from 'three';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { DialogueSystem } from './DialogueSystem';
import { TimeSystem } from '../world/TimeSystem';
import { TrafficLightSystem } from '../city/TrafficLightSystem';

export interface NPCDef {
  id: string;
  name: string;
  role: string;
  armorColor: string;
  visorColor: string;
  position: THREE.Vector3;
  waypoints: THREE.Vector3[];
  currentWaypointIdx: number;
  facingYaw: number;
  isWalking: boolean;
  isTalking: boolean;
  walkSpeed: number;
  pauseTimer: number;
}

export class NPCManager {
  private static instance: NPCManager;
  public npcs: NPCDef[] = [];

  constructor() {
    this.initNPCs();
  }

  public static getInstance(): NPCManager {
    if (!NPCManager.instance) {
      NPCManager.instance = new NPCManager();
    }
    return NPCManager.instance;
  }

  private initNPCs(): void {
    // 1. Primary Story NPCs
    const storyNPCs: NPCDef[] = [
      {
        id: 'dr_vance',
        name: 'Dr. Vance Kael',
        role: 'Chief Neural Architect',
        armorColor: '#1e293b',
        visorColor: '#00f0ff',
        position: new THREE.Vector3(8, 0.18, 8),
        waypoints: [
          new THREE.Vector3(8, 0.18, 8),
          new THREE.Vector3(12, 0.18, 18),
          new THREE.Vector3(17, 0.18, 35),
          new THREE.Vector3(12, 0.18, 18),
        ],
        currentWaypointIdx: 0,
        facingYaw: 0,
        isWalking: true,
        isTalking: false,
        walkSpeed: 2.2,
        pauseTimer: 0,
      },
      {
        id: 'kira_courier',
        name: 'Kira Jin',
        role: 'Urban Courier',
        armorColor: '#3b0764',
        visorColor: '#f59e0b',
        position: new THREE.Vector3(-17, 0.18, 25),
        waypoints: [
          new THREE.Vector3(-17, 0.18, 25),
          new THREE.Vector3(-17, 0.18, -25),
          new THREE.Vector3(-17, 0.18, -60),
          new THREE.Vector3(-17, 0.18, -25),
        ],
        currentWaypointIdx: 0,
        facingYaw: Math.PI,
        isWalking: true,
        isTalking: false,
        walkSpeed: 3.5,
        pauseTimer: 0,
      },
      {
        id: 'echo_android',
        name: 'Echo-7',
        role: 'Maintenance Android',
        armorColor: '#334155',
        visorColor: '#00ffaa',
        position: new THREE.Vector3(17, 0.18, -35),
        waypoints: [
          new THREE.Vector3(17, 0.18, -35),
          new THREE.Vector3(17, 0.18, -65),
          new THREE.Vector3(17, 0.18, -10),
          new THREE.Vector3(17, 0.18, -35),
        ],
        currentWaypointIdx: 0,
        facingYaw: 0,
        isWalking: true,
        isTalking: false,
        walkSpeed: 1.8,
        pauseTimer: 0,
      },
      {
        id: 'officer_chen',
        name: 'Officer Chen',
        role: 'Metropolis Peacekeeper',
        armorColor: '#0f172a',
        visorColor: '#ff0055',
        position: new THREE.Vector3(-8, 0.18, -8),
        waypoints: [
          new THREE.Vector3(-8, 0.18, -8),
          new THREE.Vector3(-12, 0.18, 8),
          new THREE.Vector3(-8, 0.18, 14),
          new THREE.Vector3(-8, 0.18, -8),
        ],
        currentWaypointIdx: 0,
        facingYaw: Math.PI / 2,
        isWalking: true,
        isTalking: false,
        walkSpeed: 2.0,
        pauseTimer: 0,
      },
    ];

    // 2. Procedurally generate 48 additional citizens (Total = 52 NPCs)
    const proceduralCitizens: NPCDef[] = [];
    const firstNames = ['Jax', 'Maya', 'Taro', 'Zephyr', 'Nyx', 'Orion', 'Kaelen', 'Lyra', 'Riku', 'Vesper', 'Soren', 'Cassian', 'Aria', 'Dante', 'Elysia', 'Kael'];
    const lastNames = ['Thorne', 'Sterling', 'Mercer', 'Cross', 'Zhao', 'Blackwood', 'Novak', 'Steele', 'Vance', 'Solano', 'Kovacs', 'Sinclair'];
    const roles = ['Courier', 'Neural Analyst', 'Quantum Engineer', 'Civic Resident', 'Cyber Tech', 'Plaza Merchant', 'Data Runner', 'Transit Commuter'];
    const armorColors = ['#0f172a', '#1e293b', '#14532d', '#1e1b4b', '#312e81', '#4c0519', '#701a75', '#78350f', '#022c22', '#18181b'];
    const visorColors = ['#00f0ff', '#ffaa00', '#ff0077', '#00ffaa', '#a855f7', '#38bdf8'];

    for (let i = 1; i <= 48; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 3) % lastNames.length];
      const role = roles[i % roles.length];
      const armorColor = armorColors[i % armorColors.length];
      const visorColor = visorColors[i % visorColors.length];

      // Distribute across city corridors
      const corridorType = i % 6;
      const waypoints: THREE.Vector3[] = [];
      let initialPos = new THREE.Vector3();

      if (corridorType === 0) {
        // North-South East Sidewalk (x = 17m)
        const zStart = -85 + (i * 12) % 170;
        initialPos = new THREE.Vector3(17, 0.18, zStart);
        waypoints.push(
          new THREE.Vector3(17, 0.18, zStart),
          new THREE.Vector3(17, 0.18, Math.min(85, zStart + 35)),
          new THREE.Vector3(17, 0.18, Math.max(-85, zStart - 35))
        );
      } else if (corridorType === 1) {
        // North-South West Sidewalk (x = -17m)
        const zStart = 85 - (i * 14) % 170;
        initialPos = new THREE.Vector3(-17, 0.18, zStart);
        waypoints.push(
          new THREE.Vector3(-17, 0.18, zStart),
          new THREE.Vector3(-17, 0.18, Math.max(-85, zStart - 40)),
          new THREE.Vector3(-17, 0.18, Math.min(85, zStart + 40))
        );
      } else if (corridorType === 2) {
        // East-West North Sidewalk (z = -17m)
        const xStart = -85 + (i * 15) % 170;
        initialPos = new THREE.Vector3(xStart, 0.18, -17);
        waypoints.push(
          new THREE.Vector3(xStart, 0.18, -17),
          new THREE.Vector3(Math.min(85, xStart + 35), 0.18, -17),
          new THREE.Vector3(Math.max(-85, xStart - 35), 0.18, -17)
        );
      } else if (corridorType === 3) {
        // East-West South Sidewalk (z = 17m)
        const xStart = 85 - (i * 13) % 170;
        initialPos = new THREE.Vector3(xStart, 0.18, 17);
        waypoints.push(
          new THREE.Vector3(xStart, 0.18, 17),
          new THREE.Vector3(Math.max(-85, xStart - 40), 0.18, 17),
          new THREE.Vector3(Math.min(85, xStart + 40), 0.18, 17)
        );
      } else if (corridorType === 4) {
        // Road Crosswalk Pedestrians (Crossing Avenue via Zebra Footpath)
        const crossIdx = i % 4;
        if (crossIdx === 0) {
          // North crosswalk across Z avenue
          initialPos = new THREE.Vector3(17, 0.18, -14);
          waypoints.push(
            new THREE.Vector3(17, 0.18, -14),
            new THREE.Vector3(-17, 0.18, -14),
            new THREE.Vector3(-17, 0.18, -32),
            new THREE.Vector3(-17, 0.18, -14),
            new THREE.Vector3(17, 0.18, -14),
            new THREE.Vector3(17, 0.18, -32)
          );
        } else if (crossIdx === 1) {
          // South crosswalk across Z avenue
          initialPos = new THREE.Vector3(-17, 0.18, 14);
          waypoints.push(
            new THREE.Vector3(-17, 0.18, 14),
            new THREE.Vector3(17, 0.18, 14),
            new THREE.Vector3(17, 0.18, 32),
            new THREE.Vector3(17, 0.18, 14),
            new THREE.Vector3(-17, 0.18, 14),
            new THREE.Vector3(-17, 0.18, 32)
          );
        } else if (crossIdx === 2) {
          // East crosswalk across X avenue
          initialPos = new THREE.Vector3(14, 0.18, -17);
          waypoints.push(
            new THREE.Vector3(14, 0.18, -17),
            new THREE.Vector3(14, 0.18, 17),
            new THREE.Vector3(32, 0.18, 17),
            new THREE.Vector3(14, 0.18, 17),
            new THREE.Vector3(14, 0.18, -17),
            new THREE.Vector3(32, 0.18, -17)
          );
        } else {
          // West crosswalk across X avenue
          initialPos = new THREE.Vector3(-14, 0.18, 17);
          waypoints.push(
            new THREE.Vector3(-14, 0.18, 17),
            new THREE.Vector3(-14, 0.18, -17),
            new THREE.Vector3(-32, 0.18, -17),
            new THREE.Vector3(-14, 0.18, -17),
            new THREE.Vector3(-14, 0.18, 17),
            new THREE.Vector3(-32, 0.18, 17)
          );
        }
      } else {
        // Central Plaza Loop Walkers (inside [-12..12, -12..12])
        const angle = (i / 10) * Math.PI * 2;
        const radius = 6 + (i % 6);
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;
        initialPos = new THREE.Vector3(px, 0.18, pz);
        for (let step = 0; step < 4; step++) {
          const a = angle + (step * Math.PI) / 2;
          waypoints.push(new THREE.Vector3(Math.cos(a) * radius, 0.18, Math.sin(a) * radius));
        }
      }

      proceduralCitizens.push({
        id: `citizen_${i}`,
        name: `${fn} ${ln}`,
        role,
        armorColor,
        visorColor,
        position: initialPos,
        waypoints,
        currentWaypointIdx: 0,
        facingYaw: Math.random() * Math.PI * 2,
        isWalking: true,
        isTalking: false,
        walkSpeed: 1.6 + (i % 5) * 0.25,
        pauseTimer: (i % 3 === 0) ? Math.random() * 4 : 0,
      });
    }

    this.npcs = [...storyNPCs, ...proceduralCitizens];

    // Register all 52 NPCs in InteractionSystem
    this.npcs.forEach((npc) => {
      InteractionSystem.getInstance().register({
        id: npc.id,
        name: npc.name,
        actionText: `TALK TO ${npc.name.toUpperCase()} // ${npc.role.toUpperCase()}`,
        position: npc.position,
        radius: 2.8,
        onInteract: () => {
          npc.isTalking = true;
          DialogueSystem.getInstance().startDialogue(npc.id, npc.name, npc.role);
        },
      });
    });

    // Close talking state when dialogue closes
    DialogueSystem.getInstance().subscribe((node) => {
      if (!node) {
        this.npcs.forEach((n) => (n.isTalking = false));
      }
    });
  }

  public update(delta: number, playerPos: THREE.Vector3): void {
    const hour = TimeSystem.getInstance().getHour();
    const isLateNight = hour > 1.0 && hour < 5.0;

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];

      // Distance culling for performance optimization
      const distToPlayerSq = npc.position.distanceToSquared(playerPos);
      if (distToPlayerSq > 160 * 160) {
        continue; // skip far NPCs
      }

      // If talking to player, stop and face player
      if (npc.isTalking) {
        npc.isWalking = false;
        const dx = playerPos.x - npc.position.x;
        const dz = playerPos.z - npc.position.z;
        npc.facingYaw = Math.atan2(dx, dz);
        continue;
      }

      // Handle pause timers at waypoints
      if (npc.pauseTimer > 0) {
        npc.pauseTimer -= delta;
        npc.isWalking = false;
        continue;
      }

      npc.isWalking = true;
      const target = npc.waypoints[npc.currentWaypointIdx];
      const dist = npc.position.distanceTo(target);

      if (dist < 0.8) {
        // Reached waypoint: advance to next
        npc.currentWaypointIdx = (npc.currentWaypointIdx + 1) % npc.waypoints.length;
        npc.pauseTimer = isLateNight ? 5.0 : (i % 4 === 0 ? 3.0 : 0.8);
        continue;
      }

      // Check if entering a crosswalk and pedestrian signal is DONT_WALK
      const isCrossingZRoad = Math.abs(target.x - npc.position.x) > 20 && Math.abs(npc.position.z) < 20;
      const isCrossingXRoad = Math.abs(target.z - npc.position.z) > 20 && Math.abs(npc.position.x) < 20;

      if (isCrossingZRoad) {
        // Checking curb threshold: about to step onto Z avenue
        if (Math.abs(npc.position.x) >= 14 && Math.abs(npc.position.x) <= 17.5) {
          if (!TrafficLightSystem.getInstance().canPedestrianCross('z')) {
            npc.isWalking = false;
            continue;
          }
        }
      } else if (isCrossingXRoad) {
        // Checking curb threshold: about to step onto X avenue
        if (Math.abs(npc.position.z) >= 14 && Math.abs(npc.position.z) <= 17.5) {
          if (!TrafficLightSystem.getInstance().canPedestrianCross('x')) {
            npc.isWalking = false;
            continue;
          }
        }
      }

      // Move toward target waypoint
      const dir = target.clone().sub(npc.position).normalize();
      npc.position.addScaledVector(dir, npc.walkSpeed * delta);
      npc.facingYaw = Math.atan2(dir.x, dir.z);

      // Keep registered position updated for interaction
      const ent = InteractionSystem.getInstance().getActive();
      if (ent?.id === npc.id) {
        ent.position.copy(npc.position);
      }
    }
  }
}
