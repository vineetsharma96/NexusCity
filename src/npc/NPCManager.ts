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
    // 1. Primary Story NPCs strictly placed on Footpaths / Sidewalks
    const storyNPCs: NPCDef[] = [
      {
        id: 'dr_vance',
        name: 'Dr. Vance Kael',
        role: 'Chief Neural Architect',
        armorColor: '#1e293b',
        visorColor: '#00f0ff',
        position: new THREE.Vector3(13.5, 0.18, 14),
        waypoints: [
          new THREE.Vector3(13.5, 0.18, 14),
          new THREE.Vector3(13.5, 0.18, 38),
          new THREE.Vector3(13.5, 0.18, 65),
          new THREE.Vector3(13.5, 0.18, 38),
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
        position: new THREE.Vector3(-13.5, 0.18, 45),
        waypoints: [
          new THREE.Vector3(-13.5, 0.18, 45),
          new THREE.Vector3(-13.5, 0.18, 15),
          new THREE.Vector3(-13.5, 0.18, -45),
          new THREE.Vector3(-13.5, 0.18, 15),
        ],
        currentWaypointIdx: 0,
        facingYaw: Math.PI,
        isWalking: true,
        isTalking: false,
        walkSpeed: 3.2,
        pauseTimer: 0,
      },
      {
        id: 'echo_android',
        name: 'Echo-7',
        role: 'Maintenance Android',
        armorColor: '#334155',
        visorColor: '#00ffaa',
        position: new THREE.Vector3(13.5, 0.18, 35),
        waypoints: [
          new THREE.Vector3(13.5, 0.18, 35),
          new THREE.Vector3(30, 0.18, 55),
          new THREE.Vector3(60, 0.18, 65),
          new THREE.Vector3(30, 0.18, 55),
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
        position: new THREE.Vector3(-13.5, 0.18, -14),
        waypoints: [
          new THREE.Vector3(-13.5, 0.18, -14), // West curb of North Zebra
          new THREE.Vector3(13.5, 0.18, -14),  // East curb of North Zebra
          new THREE.Vector3(35, 0.18, -11.5),  // East footpath
          new THREE.Vector3(13.5, 0.18, -14),
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

      // Distribute across footpaths and designated zebra crosswalks
      const corridorType = i % 6;
      const waypoints: THREE.Vector3[] = [];
      let initialPos = new THREE.Vector3();

      if (corridorType === 0) {
        // North-South East Sidewalk (Footpath at x = 13.5m)
        const zStart = -75 + (i * 14) % 150;
        initialPos = new THREE.Vector3(13.5, 0.18, zStart);
        waypoints.push(
          new THREE.Vector3(13.5, 0.18, zStart),
          new THREE.Vector3(13.5, 0.18, Math.min(80, zStart + 35)),
          new THREE.Vector3(13.5, 0.18, Math.max(-80, zStart - 35))
        );
      } else if (corridorType === 1) {
        // North-South West Sidewalk (Footpath at x = -13.5m)
        const zStart = 75 - (i * 14) % 150;
        initialPos = new THREE.Vector3(-13.5, 0.18, zStart);
        waypoints.push(
          new THREE.Vector3(-13.5, 0.18, zStart),
          new THREE.Vector3(-13.5, 0.18, Math.max(-80, zStart - 40)),
          new THREE.Vector3(-13.5, 0.18, Math.min(80, zStart + 40))
        );
      } else if (corridorType === 2) {
        // East-West North Sidewalk (Footpath at z = -11.5m)
        const xStart = -75 + (i * 15) % 150;
        initialPos = new THREE.Vector3(xStart, 0.18, -11.5);
        waypoints.push(
          new THREE.Vector3(xStart, 0.18, -11.5),
          new THREE.Vector3(Math.min(80, xStart + 35), 0.18, -11.5),
          new THREE.Vector3(Math.max(-80, xStart - 35), 0.18, -11.5)
        );
      } else if (corridorType === 3) {
        // East-West South Sidewalk (Footpath at z = 11.5m)
        const xStart = 75 - (i * 13) % 150;
        initialPos = new THREE.Vector3(xStart, 0.18, 11.5);
        waypoints.push(
          new THREE.Vector3(xStart, 0.18, 11.5),
          new THREE.Vector3(Math.max(-80, xStart - 40), 0.18, 11.5),
          new THREE.Vector3(Math.min(80, xStart + 40), 0.18, 11.5)
        );
      } else if (corridorType === 4) {
        // Zebra Crossings: crossing avenue between opposite sidewalk curbs
        const crossIdx = i % 4;
        if (crossIdx === 0) {
          // North crosswalk (z = -14.0, crossing between East & West footpaths)
          initialPos = new THREE.Vector3(13.5, 0.18, -14);
          waypoints.push(
            new THREE.Vector3(13.5, 0.18, -14),
            new THREE.Vector3(-13.5, 0.18, -14),
            new THREE.Vector3(-13.5, 0.18, -35),
            new THREE.Vector3(-13.5, 0.18, -14),
            new THREE.Vector3(13.5, 0.18, -14),
            new THREE.Vector3(13.5, 0.18, -35)
          );
        } else if (crossIdx === 1) {
          // South crosswalk (z = 14.0, crossing between West & East footpaths)
          initialPos = new THREE.Vector3(-13.5, 0.18, 14);
          waypoints.push(
            new THREE.Vector3(-13.5, 0.18, 14),
            new THREE.Vector3(13.5, 0.18, 14),
            new THREE.Vector3(13.5, 0.18, 35),
            new THREE.Vector3(13.5, 0.18, 14),
            new THREE.Vector3(-13.5, 0.18, 14),
            new THREE.Vector3(-13.5, 0.18, 35)
          );
        } else if (crossIdx === 2) {
          // East crosswalk (x = 14.0, crossing between North & South footpaths)
          initialPos = new THREE.Vector3(14, 0.18, -11.5);
          waypoints.push(
            new THREE.Vector3(14, 0.18, -11.5),
            new THREE.Vector3(14, 0.18, 11.5),
            new THREE.Vector3(35, 0.18, 11.5),
            new THREE.Vector3(14, 0.18, 11.5),
            new THREE.Vector3(14, 0.18, -11.5),
            new THREE.Vector3(35, 0.18, -11.5)
          );
        } else {
          // West crosswalk (x = -14.0, crossing between South & North footpaths)
          initialPos = new THREE.Vector3(-14, 0.18, 11.5);
          waypoints.push(
            new THREE.Vector3(-14, 0.18, 11.5),
            new THREE.Vector3(-14, 0.18, -11.5),
            new THREE.Vector3(-35, 0.18, -11.5),
            new THREE.Vector3(-14, 0.18, -11.5),
            new THREE.Vector3(-14, 0.18, 11.5),
            new THREE.Vector3(-35, 0.18, 11.5)
          );
        }
      } else {
        // Central Park Sanctuary Footpaths (around pond & footbridge)
        const parkStep = i % 4;
        if (parkStep === 0) {
          initialPos = new THREE.Vector3(62, 0.18, 62);
          waypoints.push(
            new THREE.Vector3(62, 0.18, 62),
            new THREE.Vector3(62, 0.18, 88),
            new THREE.Vector3(88, 0.18, 88),
            new THREE.Vector3(88, 0.18, 62)
          );
        } else if (parkStep === 1) {
          // Walking across the arching footbridge over the pond
          initialPos = new THREE.Vector3(66, 0.18, 75);
          waypoints.push(
            new THREE.Vector3(66, 0.18, 75),
            new THREE.Vector3(75, 1.2, 75),
            new THREE.Vector3(84, 0.18, 75),
            new THREE.Vector3(75, 1.2, 75)
          );
        } else {
          initialPos = new THREE.Vector3(85, 0.18, 65);
          waypoints.push(
            new THREE.Vector3(85, 0.18, 65),
            new THREE.Vector3(85, 0.18, 85),
            new THREE.Vector3(65, 0.18, 85),
            new THREE.Vector3(65, 0.18, 65)
          );
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
        walkSpeed: 1.6 + (i % 5) * 0.22,
        pauseTimer: (i % 3 === 0) ? Math.random() * 3.5 : 0,
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

      // Check if crossing an avenue zebra and pedestrian signal is red (DONT_WALK)
      // 1. Crossing North or South zebra crosswalk (stepping across between East and West footpaths)
      const isSteppingAcrossZRoad = Math.abs(target.x - npc.position.x) > 15 && (Math.abs(npc.position.z - (-14)) < 2.5 || Math.abs(npc.position.z - 14) < 2.5);
      // 2. Crossing East or West zebra crosswalk (stepping across between North and South footpaths)
      const isSteppingAcrossXRoad = Math.abs(target.z - npc.position.z) > 15 && (Math.abs(npc.position.x - (-14)) < 2.5 || Math.abs(npc.position.x - 14) < 2.5);

      if (isSteppingAcrossZRoad) {
        // At sidewalk curb threshold about to cross avenue
        const atCurb = Math.abs(npc.position.x) >= 12.0 && Math.abs(npc.position.x) <= 15.0;
        if (atCurb) {
          if (!TrafficLightSystem.getInstance().canPedestrianCross('z')) {
            npc.isWalking = false;
            continue; // Wait at curb for walk signal
          }
        }
      } else if (isSteppingAcrossXRoad) {
        // At sidewalk curb threshold about to cross avenue
        const atCurb = Math.abs(npc.position.z) >= 10.0 && Math.abs(npc.position.z) <= 13.0;
        if (atCurb) {
          if (!TrafficLightSystem.getInstance().canPedestrianCross('x')) {
            npc.isWalking = false;
            continue; // Wait at curb for walk signal
          }
        }
      }

      // Move smoothly toward target waypoint with collision & mutual avoidance steering
      const dir = target.clone().sub(npc.position);
      dir.y = 0;
      dir.normalize();

      // 1. Dynamic Player Collision & Personal Space Avoidance
      const playerDist = npc.position.distanceTo(playerPos);
      if (playerDist < 2.4) {
        if (playerDist < 1.05) {
          // Too close directly to player: politely halt until player steps aside
          npc.isWalking = false;
          // Physical separation if player walks directly into NPC (< 0.75m)
          if (playerDist < 0.75 && playerDist > 0.001) {
            const pushDir = playerPos.clone().sub(npc.position).normalize();
            playerPos.addScaledVector(pushDir, (0.75 - playerDist) * 0.5);
          }
          continue;
        }
        // Repulsive steering around player
        const avoidPlayer = npc.position.clone().sub(playerPos);
        avoidPlayer.y = 0;
        const avoidWeight = (2.4 - playerDist) * 1.8;
        dir.addScaledVector(avoidPlayer.normalize(), avoidWeight).normalize();
      }

      // 2. Dynamic NPC-to-NPC Mutual Steering Avoidance
      let yielded = false;
      for (let j = 0; j < this.npcs.length; j++) {
        if (i === j) continue;
        const other = this.npcs[j];
        const npcDistSq = npc.position.distanceToSquared(other.position);
        if (npcDistSq < 2.8 * 2.8) {
          const npcDist = Math.sqrt(npcDistSq);
          if (npcDist < 0.85) {
            // Close proximity: junior NPC halts to give way
            if (i > j) {
              npc.isWalking = false;
              yielded = true;
              break;
            }
          }
          const avoidNpc = npc.position.clone().sub(other.position);
          avoidNpc.y = 0;
          dir.addScaledVector(avoidNpc.normalize(), (2.8 - npcDist) * 0.9).normalize();
        }
      }

      if (yielded) continue;

      // Integrate position along steered trajectory
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
