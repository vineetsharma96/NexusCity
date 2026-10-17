import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DialogueSystem } from './DialogueSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { NavigationSystem } from '../map/NavigationSystem';
import { MissionSystem } from '../gameplay/MissionSystem';

export interface NPCDef {
  id: string;
  name: string;
  role: string;
  armorColor: string;
  visorColor: string;
  position: THREE.Vector3;
  waypoints: THREE.Vector3[];
  currentWaypointIdx: number;
  walkSpeed: number;
  isWalking: boolean;
  waitTimer: number;
  facingYaw: number;
}

export class NPCManager {
  private static instance: NPCManager;
  public readonly npcs: NPCDef[] = [];
  private renderedIds = new Set<string>();

  private constructor() {
    this.initNPCs();
  }

  public static getInstance(): NPCManager {
    if (!NPCManager.instance) {
      NPCManager.instance = new NPCManager();
    }
    return NPCManager.instance;
  }

  private initNPCs(): void {
    const rng = new SeedRandom(739201);
    const dialogue = DialogueSystem.getInstance();

    const storyNpcs: Omit<NPCDef, 'currentWaypointIdx' | 'isWalking' | 'waitTimer' | 'facingYaw'>[] = [
      {
        id: 'npc_kael',
        name: 'Archivist Kael',
        role: 'Civic Telemetry Officer',
        armorColor: '#0f172a',
        visorColor: '#f59e0b',
        position: new THREE.Vector3(-8, 0.2, 8),
        waypoints: [
          new THREE.Vector3(-8, 0.2, 8),
          new THREE.Vector3(-8, 0.2, -8),
          new THREE.Vector3(8, 0.2, -8),
          new THREE.Vector3(8, 0.2, 8),
        ],
        walkSpeed: 2.1,
      },
      {
        id: 'npc_lyra',
        name: 'Director Lyra',
        role: 'Apex Structural Lead',
        armorColor: '#1e1b4b',
        visorColor: '#38bdf8',
        position: new THREE.Vector3(18, 0.2, 18),
        waypoints: [
          new THREE.Vector3(18, 0.2, 18),
          new THREE.Vector3(28, 0.2, 18),
          new THREE.Vector3(28, 0.2, 28),
          new THREE.Vector3(18, 0.2, 28),
        ],
        walkSpeed: 2.2,
      },
      {
        id: 'npc_vex',
        name: 'Curator Vex',
        role: 'Biosphere Botanist',
        armorColor: '#064e3b',
        visorColor: '#10b981',
        position: new THREE.Vector3(56, 0.2, 75),
        waypoints: [
          new THREE.Vector3(56, 0.2, 75),
          new THREE.Vector3(64, 0.2, 75),
          new THREE.Vector3(64, 0.2, 65),
        ],
        walkSpeed: 1.9,
      },
      {
        id: 'npc_soren',
        name: 'Relay Courier Soren',
        role: 'Transit Network Specialist',
        armorColor: '#31102f',
        visorColor: '#f43f5e',
        position: new THREE.Vector3(-18, 0.2, -18),
        waypoints: [
          new THREE.Vector3(-18, 0.2, -18),
          new THREE.Vector3(-18, 0.2, -42),
          new THREE.Vector3(-18, 0.2, -18),
        ],
        walkSpeed: 2.6,
      },
    ];

    storyNpcs.forEach((s) => {
      this.npcs.push({
        ...s,
        currentWaypointIdx: 0,
        isWalking: true,
        waitTimer: 0,
        facingYaw: 0,
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

    // Procedural ambient citizens
    const armorPalette = ['#0f172a', '#1e293b', '#172554', '#064e3b', '#3b0764'];
    const visorPalette = ['#38bdf8', '#f59e0b', '#10b981', '#f43f5e'];

    for (let i = 0; i < 20; i++) {
      const id = `citizen_${i}`;
      const side = i % 2 === 0 ? -9.5 : 9.5;
      const zStart = -110 + i * 11;
      const zEnd = zStart + (i % 2 === 0 ? 28 : -28);

      this.npcs.push({
        id,
        name: `Citizen #${104 + i}`,
        role: 'Metropolitan Resident',
        armorColor: rng.pick(armorPalette),
        visorColor: rng.pick(visorPalette),
        position: new THREE.Vector3(side, 0.2, zStart),
        waypoints: [new THREE.Vector3(side, 0.2, zStart), new THREE.Vector3(side, 0.2, zEnd)],
        currentWaypointIdx: 1,
        walkSpeed: rng.range(1.8, 2.5),
        isWalking: true,
        waitTimer: 0,
        facingYaw: 0,
      });

      dialogue.registerConversation({
        npcId: id,
        startNodeId: 'hello',
        nodes: {
          hello: {
            id: 'hello',
            speaker: `Citizen #${104 + i}`,
            role: 'Metropolitan Resident',
            text: 'The diurnal light cycle across these titanium towers never gets old. Check the Atlas [M] if you need bearings.',
            choices: [{ text: 'Carry on', nextNodeId: null }],
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

  public update(delta: number, playerPos: THREE.Vector3): void {
    const dt = Math.min(delta, 0.1);
    const isDialogueOpen = Boolean(DialogueSystem.getInstance().getActiveNode());

    for (const npc of this.npcs) {
      if (!this.renderedIds.has(npc.id)) continue;

      const distToPlayer = npc.position.distanceTo(playerPos);
      if (distToPlayer < 2.6 || isDialogueOpen) {
        npc.isWalking = false;
        npc.facingYaw = Math.atan2(playerPos.x - npc.position.x, playerPos.z - npc.position.z);
        continue;
      }

      if (npc.waitTimer > 0) {
        npc.waitTimer -= dt;
        npc.isWalking = false;
        continue;
      }

      const target = npc.waypoints[npc.currentWaypointIdx];
      const dx = target.x - npc.position.x;
      const dz = target.z - npc.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.35) {
        npc.currentWaypointIdx = (npc.currentWaypointIdx + 1) % npc.waypoints.length;
        npc.waitTimer = 1.2;
        npc.isWalking = false;
      } else {
        npc.isWalking = true;
        const step = Math.min(dist, npc.walkSpeed * dt);
        npc.position.x += (dx / dist) * step;
        npc.position.z += (dz / dist) * step;
        npc.facingYaw = Math.atan2(dx, dz);
      }
    }
  }
}
