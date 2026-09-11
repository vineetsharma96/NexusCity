import * as THREE from 'three';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { DialogueSystem } from './DialogueSystem';
import { TimeSystem } from '../world/TimeSystem';

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
    this.npcs = [
      // 1. Dr. Vance Kael — Central Plaza / Research Labs
      {
        id: 'dr_vance',
        name: 'Dr. Vance Kael',
        role: 'Chief Neural Architect',
        armorColor: '#1e293b', // Sleek lab slate
        visorColor: '#00f0ff', // Cyber cyan
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
      // 2. Kira Jin — Rooftop Courier / Avenue Runner
      {
        id: 'kira_courier',
        name: 'Kira Jin',
        role: 'Urban Courier',
        armorColor: '#3b0764', // Electric purple
        visorColor: '#f59e0b', // Amber yellow
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
        walkSpeed: 3.5, // Faster courier pace
        pauseTimer: 0,
      },
      // 3. Echo-7 — Infrastructure Android
      {
        id: 'echo_android',
        name: 'Echo-7',
        role: 'Maintenance Android',
        armorColor: '#334155', // Industrial titanium
        visorColor: '#00ffaa', // Diagnostic emerald
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
      // 4. Officer Chen — Metropolis Peacekeeper
      {
        id: 'officer_chen',
        name: 'Officer Chen',
        role: 'Metropolis Peacekeeper',
        armorColor: '#0f172a', // Enforcer navy
        visorColor: '#ff0055', // Enforcer crimson
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

    // Register each NPC in InteractionSystem
    this.npcs.forEach((npc) => {
      InteractionSystem.getInstance().register({
        id: npc.id,
        name: npc.name,
        actionText: `TALK TO ${npc.name.toUpperCase()} // ${npc.role.toUpperCase()}`,
        position: npc.position,
        radius: 3.0,
        onInteract: () => {
          npc.isTalking = true;
          DialogueSystem.getInstance().startDialogue(npc.id);
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

    this.npcs.forEach((npc) => {
      // If talking to player, stop and face player
      if (npc.isTalking) {
        npc.isWalking = false;
        const dx = playerPos.x - npc.position.x;
        const dz = playerPos.z - npc.position.z;
        npc.facingYaw = Math.atan2(dx, dz);
        return;
      }

      // At late night (01:00 - 05:00), NPCs pause more often under streetlights
      const isLateNight = hour > 1.0 && hour < 5.0;

      // Handle pause timers at waypoints
      if (npc.pauseTimer > 0) {
        npc.pauseTimer -= delta;
        npc.isWalking = false;
        return;
      }

      npc.isWalking = true;
      const target = npc.waypoints[npc.currentWaypointIdx];
      const dist = npc.position.distanceTo(target);

      if (dist < 0.6) {
        // Reached waypoint: advance to next
        npc.currentWaypointIdx = (npc.currentWaypointIdx + 1) % npc.waypoints.length;
        npc.pauseTimer = isLateNight ? 6.0 : 2.5; // Pause to look around
        return;
      }

      // Move toward target waypoint
      const dir = target.clone().sub(npc.position).normalize();
      npc.position.addScaledVector(dir, npc.walkSpeed * delta);
      npc.facingYaw = Math.atan2(dir.x, dir.z);

      // Keep registered position updated
      const ent = InteractionSystem.getInstance().getActive();
      if (ent?.id === npc.id) {
        ent.position.copy(npc.position);
      }
    });
  }
}
