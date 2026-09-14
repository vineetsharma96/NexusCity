import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { InteriorManager, InteriorType, InteriorState } from '../world/InteriorManager';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { AudioManager } from '../audio/AudioManager';
import { DialogueSystem } from '../npc/DialogueSystem';

interface ProceduralInteriorProps {
  type: InteriorType;
  onExit: () => void;
}

// Procedural 3D Cyber Humanoid for Interior Characters
const InteriorHumanoid: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  armorColor: string;
  visorColor: string;
  accessory?: 'HEADSET' | 'STETHOSCOPE' | 'COAT' | 'PAD';
}> = ({ position, rotationY = 0, armorColor, visorColor, accessory }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Subtle idle breathing
      groupRef.current.position.y = position[1] + Math.sin(t * 2.2 + position[0]) * 0.015;
    }
    if (headRef.current) {
      // Gentle natural head motion
      headRef.current.rotation.y = Math.sin(t * 0.8 + position[2]) * 0.12;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {/* Torso & Armored Chestplate */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.55, 0.65, 0.3]} />
        <meshStandardMaterial color={armorColor} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Arc Reactor Core */}
      <mesh position={[0, 1.05, 0.16]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={visorColor} />
      </mesh>

      {/* Pelvis & Cyber Belt */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.48, 0.22, 0.28]} />
        <meshStandardMaterial color="#090d16" metalness={0.9} />
      </mesh>

      {/* Legs & Armored Boots */}
      <mesh position={[-0.15, 0.25, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.22]} />
        <meshStandardMaterial color={armorColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.15, 0.25, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.22]} />
        <meshStandardMaterial color={armorColor} roughness={0.5} />
      </mesh>

      {/* Head & Glowing Visor */}
      <group ref={headRef} position={[0, 1.42, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.32, 0.28]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.02, 0.15]}>
          <boxGeometry args={[0.24, 0.09, 0.04]} />
          <meshBasicMaterial color={visorColor} />
        </mesh>
        {accessory === 'HEADSET' && (
          <mesh position={[0.16, 0.02, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
            <meshStandardMaterial color="#00f0ff" />
          </mesh>
        )}
      </group>

      {/* Arms Resting or Typing */}
      <mesh position={[-0.34, 0.85, 0.08]} rotation={[0.4, 0, -0.1]}>
        <boxGeometry args={[0.12, 0.45, 0.14]} />
        <meshStandardMaterial color={armorColor} />
      </mesh>
      <mesh position={[0.34, 0.85, 0.08]} rotation={[0.4, 0, 0.1]}>
        <boxGeometry args={[0.12, 0.45, 0.14]} />
        <meshStandardMaterial color={armorColor} />
      </mesh>
    </group>
  );
};

export const ProceduralInterior: React.FC<ProceduralInteriorProps> = ({ type, onExit }) => {
  const origin = InteriorManager.INTERIOR_ORIGIN;
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const holoRef = useRef<THREE.Mesh>(null);
  const cityHoloRef = useRef<THREE.Group>(null);

  const [interiorState, setInteriorState] = useState<InteriorState>(() =>
    InteriorManager.getInstance().getState()
  );

  useEffect(() => {
    return InteriorManager.getInstance().subscribe(setInteriorState);
  }, []);

  const floor = interiorState.currentFloor || 1;

  // Register interior colliders, elevator interactable, and exit doorway
  useEffect(() => {
    if (type === 'NONE') return;

    // Room Dimensions: 22m wide, 4.5m high, 18m deep
    const w = 22;
    const h = 4.5;
    const d = 18;

    // 1. Perimeter Room Walls
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, h / 2, -d / 2 - 0.5)), new THREE.Vector3(w, h, 1));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, h / 2, d / 2 + 0.5)), new THREE.Vector3(w, h, 1));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-w / 2 - 0.5, h / 2, 0)), new THREE.Vector3(1, h, d));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(w / 2 + 0.5, h / 2, 0)), new THREE.Vector3(1, h, d));

    // 2. Elevator Lift Shaft Collider (Southeast Corner)
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(8.5, h / 2, 6.5)), new THREE.Vector3(3.5, h, 3.5));

    // 3. Register Elevator Interactable
    const elevatorPos = origin.clone().add(new THREE.Vector3(7.5, 0.2, 5.5));
    const targetFloor = floor === 1 ? 2 : 1;
    const elevatorActionText =
      floor === 1
        ? 'TAKE ELEVATOR // ACCESS LEVEL 2 MEZZANINE & SKY DECK'
        : 'TAKE ELEVATOR // RETURN TO LEVEL 1 MAIN FLOOR';

    InteractionSystem.getInstance().register({
      id: 'interior_elevator_lift',
      name: 'Elevator Lift',
      actionText: elevatorActionText,
      position: elevatorPos,
      radius: 2.8,
      onInteract: () => {
        InteriorManager.getInstance().changeFloor(targetFloor);
      },
    });

    // 4. Floor 1 specific colliders & interactables
    if (floor === 1) {
      // Register Exit Doorway Interactable (Floor 1 Only)
      const exitPos = origin.clone().add(new THREE.Vector3(0, 0.2, 8.2));
      InteractionSystem.getInstance().register({
        id: 'interior_exit_door',
        name: 'Exit Door',
        actionText: 'EXIT TO STREET // METROPOLIS SIDEWALK',
        position: exitPos,
        radius: 2.6,
        onInteract: onExit,
      });

      // Type-specific Level 1 colliders & interactive objects
      if (type === 'LAB') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(4.5, 3.6, 4.5));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));

        // NPC Nova
        InteractionSystem.getInstance().register({
          id: 'npc_lab_nova',
          name: 'Senior Researcher Nova',
          actionText: 'TALK TO DR. NOVA // QUANTUM SPECIALIST',
          position: origin.clone().add(new THREE.Vector3(-5, 0.2, -3)),
          radius: 2.5,
          onInteract: () => DialogueSystem.getInstance().startDialogue('lab_researcher_nova'),
        });

        // Interactive Terminal
        InteractionSystem.getInstance().register({
          id: 'term_lab_quantum',
          name: 'Quantum Telemetry Terminal',
          actionText: 'RUN QUANTUM CONTAINMENT TELEMETRY SCAN',
          position: origin.clone().add(new THREE.Vector3(5, 0.2, -3)),
          radius: 2.5,
          onInteract: () => {
            AudioManager.getInstance().playTerminalBeep();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('nexus:notification', {
                  detail: {
                    title: 'QUANTUM TELEMETRY NOMINAL',
                    message: 'Core rotation: 14,000 RPM • Decoherence: 0.00% • Status: STABLE',
                  },
                })
              );
            }
          },
        });
      } else if (type === 'LOUNGE' || type === 'RAMEN_DINER') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, -4)), new THREE.Vector3(12, 1.6, 2.5));

        if (type === 'LOUNGE') {
          // NPC Bartender K-9
          InteractionSystem.getInstance().register({
            id: 'npc_lounge_k9',
            name: 'Mixologist Unit K-9',
            actionText: 'ORDER FROM BARTENDER K-9',
            position: origin.clone().add(new THREE.Vector3(0, 0.2, -2.8)),
            radius: 2.5,
            onInteract: () => DialogueSystem.getInstance().startDialogue('lounge_bartender_k9'),
          });

          // Drink Synthesizer Terminal
          InteractionSystem.getInstance().register({
            id: 'term_lounge_dispenser',
            name: 'Holographic Mixology Terminal',
            actionText: 'DISPENSE SYNTH-COCKTAIL // NEON BLUE MIRAGE',
            position: origin.clone().add(new THREE.Vector3(4, 0.2, -2.8)),
            radius: 2.5,
            onInteract: () => {
              AudioManager.getInstance().playTerminalBeep();
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('nexus:notification', {
                    detail: {
                      title: 'DISPENSING SYNTH-COCKTAIL',
                      message: 'Neon Blue Mirage poured. Neural temperature reduced by 4.2°.',
                    },
                  })
                );
              }
            },
          });
        } else {
          // NPC Chef Taro
          InteractionSystem.getInstance().register({
            id: 'npc_ramen_taro',
            name: 'Chef Taro',
            actionText: 'TALK TO MASTER CHEF TARO',
            position: origin.clone().add(new THREE.Vector3(0, 0.2, -2.8)),
            radius: 2.5,
            onInteract: () => DialogueSystem.getInstance().startDialogue('chef_taro'),
          });
        }
      } else if (type === 'CLINIC') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(3, 1.6, 2.5));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-7, 1.2, -4)), new THREE.Vector3(4, 2.4, 2));

        // NPC Doc Viktor
        InteractionSystem.getInstance().register({
          id: 'npc_clinic_viktor',
          name: 'Doc Viktor Vance',
          actionText: 'CONSULT DOC VIKTOR // CYBER-SURGEON',
          position: origin.clone().add(new THREE.Vector3(2.5, 0.2, 0)),
          radius: 2.5,
          onInteract: () => DialogueSystem.getInstance().startDialogue('ripperdoc_viktor'),
        });

        // Biometric Scanner Terminal
        InteractionSystem.getInstance().register({
          id: 'term_clinic_scanner',
          name: 'Biometric Pod Scanner',
          actionText: 'INITIATE BIOMETRIC DIAGNOSTIC SCAN',
          position: origin.clone().add(new THREE.Vector3(-5, 0.2, -3)),
          radius: 2.5,
          onInteract: () => {
            AudioManager.getInstance().playTerminalBeep();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('nexus:notification', {
                  detail: {
                    title: 'BIOMETRICS NOMINAL',
                    message: 'Neural Latency: 0.4ms • Armor Integrity: 100% • Zero Malicious Code',
                  },
                })
              );
            }
          },
        });
      } else if (type === 'NETRUNNER_DEN' || type === 'SERVER_VAULT') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 1.8, 0)), new THREE.Vector3(2.5, 3.6, 10));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(6, 1.8, 0)), new THREE.Vector3(2.5, 3.6, 10));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.2, -5)), new THREE.Vector3(4, 2.4, 3));

        if (type === 'NETRUNNER_DEN') {
          // NPC Netrunner Zero-Day
          InteractionSystem.getInstance().register({
            id: 'npc_hacker_zeroday',
            name: 'Netrunner Zero-Day',
            actionText: 'TALK TO NETRUNNER ZERO-DAY',
            position: origin.clone().add(new THREE.Vector3(-2.5, 0.2, -4)),
            radius: 2.5,
            onInteract: () => DialogueSystem.getInstance().startDialogue('netrunner_zeroday'),
          });

          // Deep-Net ICE Breaker Terminal
          InteractionSystem.getInstance().register({
            id: 'term_hacker_ice',
            name: 'Deep-Net Terminal',
            actionText: 'EXECUTE DEEP-NET ICEBREAKER SCAN',
            position: origin.clone().add(new THREE.Vector3(0, 0.2, -3.5)),
            radius: 2.5,
            onInteract: () => {
              AudioManager.getInstance().playTerminalBeep();
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('nexus:notification', {
                    detail: {
                      title: 'ICEBREAKER ACCESS GRANTED',
                      message: 'Corporate satellite telemetry decrypted. Security protocols bypassed.',
                    },
                  })
                );
              }
            },
          });
        }
      } else if (type === 'PENTHOUSE') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.6, 1)), new THREE.Vector3(5, 1.2, 3));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.0, -8)), new THREE.Vector3(8, 2.0, 1.5));

        // NPC Executive Vane
        InteractionSystem.getInstance().register({
          id: 'npc_penthouse_vane',
          name: 'Executive Vane',
          actionText: 'SPEAK TO EXECUTIVE VANE',
          position: origin.clone().add(new THREE.Vector3(0, 0.2, -6.5)),
          radius: 2.5,
          onInteract: () => DialogueSystem.getInstance().startDialogue('penthouse_executive_vane'),
        });
      } else if (type === 'ARCADE') {
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-7, 1.2, 0)), new THREE.Vector3(2.5, 2.4, 10));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(7, 1.2, 0)), new THREE.Vector3(2.5, 2.4, 10));
        KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(4, 0.6, 4));

        // Arcade Cabinet Terminal
        InteractionSystem.getInstance().register({
          id: 'term_arcade_machine',
          name: 'Cyber-Strike 2099 Cabinet',
          actionText: 'INSERT TOKEN: PLAY CYBER-STRIKE 2099',
          position: origin.clone().add(new THREE.Vector3(-4, 0.2, -2)),
          radius: 2.5,
          onInteract: () => {
            AudioManager.getInstance().playTerminalBeep();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('nexus:notification', {
                  detail: {
                    title: 'CYBER-STRIKE 2099 // NEW HIGH SCORE',
                    message: 'Stage 50 Cleared! Final Score: 984,200 PTS. Leaderboard Rank #1.',
                  },
                })
              );
            }
          },
        });
      }
    } else {
      // Floor 2 (Upper Mezzanine / Sky Deck) specific colliders & interactables
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(8, 1.6, 4));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 0.6, 3)), new THREE.Vector3(4, 1.2, 3));

      // Strategy Blueprint Terminal (Level 2)
      InteractionSystem.getInstance().register({
        id: 'term_mezzanine_blueprint',
        name: 'Metropolis Core Hologram',
        actionText: 'INSPECT 3D METROPOLIS BLUEPRINT DATA',
        position: origin.clone().add(new THREE.Vector3(0, 0.2, 2.5)),
        radius: 2.5,
        onInteract: () => {
          AudioManager.getInstance().playTerminalBeep();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('nexus:notification', {
                detail: {
                  title: 'METROPOLIS GRID SYNCED',
                  message: 'Level 2 Telemetry Uplink Active. 24x24 District Chunks Synchronized.',
                },
              })
            );
          }
        },
      });
    }

    return () => {
      InteractionSystem.getInstance().unregister('interior_exit_door');
      InteractionSystem.getInstance().unregister('interior_elevator_lift');
      InteractionSystem.getInstance().unregister('npc_lab_nova');
      InteractionSystem.getInstance().unregister('term_lab_quantum');
      InteractionSystem.getInstance().unregister('npc_lounge_k9');
      InteractionSystem.getInstance().unregister('term_lounge_dispenser');
      InteractionSystem.getInstance().unregister('npc_ramen_taro');
      InteractionSystem.getInstance().unregister('npc_clinic_viktor');
      InteractionSystem.getInstance().unregister('term_clinic_scanner');
      InteractionSystem.getInstance().unregister('npc_hacker_zeroday');
      InteractionSystem.getInstance().unregister('term_hacker_ice');
      InteractionSystem.getInstance().unregister('npc_penthouse_vane');
      InteractionSystem.getInstance().unregister('term_arcade_machine');
      InteractionSystem.getInstance().unregister('term_mezzanine_blueprint');
    };
  }, [type, origin, onExit, floor]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 1.2;
      coreRef.current.position.y = 1.8 + Math.sin(t * 2) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.8;
      ringRef.current.rotation.y = t * 0.5;
    }
    if (holoRef.current) {
      holoRef.current.rotation.y = t * 0.6;
    }
    if (cityHoloRef.current) {
      cityHoloRef.current.rotation.y = t * 0.4;
    }
  });

  if (type === 'NONE') return null;

  // Visual Theme Colors
  const themeColors = {
    LAB: { floor: '#0f172a', wall: '#111c33', accent: '#00f0ff', light: '#38bdf8' },
    LOUNGE: { floor: '#1e1b18', wall: '#241a29', accent: '#ec4899', light: '#f43f5e' },
    CLINIC: { floor: '#0e1726', wall: '#11222e', accent: '#06b6d4', light: '#22d3ee' },
    NETRUNNER_DEN: { floor: '#0a0a0f', wall: '#0f1715', accent: '#10b981', light: '#059669' },
    RAMEN_DINER: { floor: '#261815', wall: '#2e1c14', accent: '#f59e0b', light: '#fb923c' },
    DRONE_HANGAR: { floor: '#18181b', wall: '#27272a', accent: '#f97316', light: '#ea580c' },
    PENTHOUSE: { floor: '#1c1917', wall: '#292524', accent: '#e2e8f0', light: '#38bdf8' },
    SERVER_VAULT: { floor: '#051329', wall: '#091e3d', accent: '#3b82f6', light: '#60a5fa' },
    GREENHOUSE: { floor: '#062817', wall: '#0b3820', accent: '#22c55e', light: '#4ade80' },
    METRO_STATION: { floor: '#1e222b', wall: '#2b303c', accent: '#fbbf24', light: '#facc15' },
    ARCADE: { floor: '#180728', wall: '#2a0845', accent: '#d946ef', light: '#a855f7' },
  };

  if ((type as string) === 'NONE') return null;

  const currentTheme = themeColors[type as keyof typeof themeColors] || themeColors.LAB;

  return (
    <group position={origin} name="InteriorContainer">
      {/* 1. Room Envelope: Floor, Ceiling, Walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial
          color={floor === 2 ? '#0b1324' : currentTheme.floor}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.5, 0]}>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#070c18" roughness={0.7} />
      </mesh>

      {/* North Wall (Back) — On Floor 2, becomes a stunning panoramic observation window! */}
      {floor === 1 ? (
        <mesh position={[0, 2.25, -9]} receiveShadow>
          <boxGeometry args={[22, 4.5, 0.2]} />
          <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
        </mesh>
      ) : (
        <group position={[0, 2.25, -9]}>
          <mesh receiveShadow>
            <boxGeometry args={[22, 4.5, 0.2]} />
            <meshStandardMaterial color="#020617" roughness={0.3} metalness={0.9} />
          </mesh>
          {/* Panoramic Skyline Window Glass */}
          <mesh position={[0, 0.2, 0.05]}>
            <boxGeometry args={[18, 3.2, 0.1]} />
            <meshStandardMaterial
              color="#00f0ff"
              transparent
              opacity={0.35}
              roughness={0.05}
              metalness={0.95}
            />
          </mesh>
          <mesh position={[0, -1.5, 0.15]}>
            <boxGeometry args={[18.2, 0.15, 0.2]} />
            <meshBasicMaterial color="var(--neon-cyan)" />
          </mesh>
        </group>
      )}

      {/* South Wall */}
      <mesh position={[0, 2.25, 9]} receiveShadow>
        <boxGeometry args={[22, 4.5, 0.2]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* West Wall */}
      <mesh position={[-11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* East Wall */}
      <mesh position={[11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Ceiling Neon Recessed Channels */}
      <mesh position={[0, 4.48, -4]}>
        <boxGeometry args={[18, 0.05, 0.3]} />
        <meshBasicMaterial color={floor === 2 ? '#00f0ff' : currentTheme.accent} />
      </mesh>
      <mesh position={[0, 4.48, 4]}>
        <boxGeometry args={[18, 0.05, 0.3]} />
        <meshBasicMaterial color={floor === 2 ? '#00f0ff' : currentTheme.accent} />
      </mesh>

      {/* Interior Ambient Lighting */}
      <pointLight
        position={[0, 3.8, 0]}
        color={floor === 2 ? '#38bdf8' : currentTheme.light}
        distance={20}
        intensity={2.8}
      />
      <pointLight position={[0, 2.5, 7.5]} color="#ffffff" distance={8} intensity={1.5} />

      {/* Exit Doorway Frame & Glowing Indicator (Floor 1 Only) */}
      {floor === 1 && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 1.8, 8.85]}>
            <boxGeometry args={[3.2, 3.6, 0.2]} />
            <meshStandardMaterial color="#020617" metalness={0.9} />
          </mesh>
          <mesh position={[0, 3.65, 8.88]}>
            <boxGeometry args={[2.8, 0.4, 0.05]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
        </group>
      )}

      {/* 2. Southeast Corner Elevator Lift Shaft */}
      <group position={[8.5, 0, 6.5]}>
        {/* Elevator Shaft Frame */}
        <mesh position={[0, 2.25, 0]}>
          <boxGeometry args={[3.4, 4.5, 3.4]} />
          <meshStandardMaterial color="#0b1120" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Elevator Door Cutout */}
        <mesh position={[-1.72, 1.8, 0]}>
          <boxGeometry args={[0.08, 3.4, 2.2]} />
          <meshStandardMaterial color="#020617" metalness={0.95} />
        </mesh>
        {/* Glowing Floor Indicator Sign */}
        <mesh position={[-1.76, 3.6, 0]}>
          <boxGeometry args={[0.04, 0.35, 1.8]} />
          <meshBasicMaterial color={floor === 1 ? '#00f0ff' : '#ffaa00'} />
        </mesh>
        {/* Interior Lift Cabin Lighting */}
        <pointLight
          position={[-1.0, 2.5, 0]}
          color={floor === 1 ? '#00f0ff' : '#ffaa00'}
          distance={4}
          intensity={2.0}
        />
      </group>

      {/* =========================================================
          LEVEL 1 INTERIOR ROOM PROPS & NPCs
          ========================================================= */}
      {floor === 1 && (
        <>
          {/* 1. LAB: Quantum Reactor Core & Nova */}
          {type === 'LAB' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0.25, 0]} receiveShadow>
                <cylinderGeometry args={[2.4, 2.6, 0.5, 16]} />
                <meshStandardMaterial color="#0b1324" metalness={0.9} />
              </mesh>
              <mesh ref={coreRef} position={[0, 1.8, 0]}>
                <octahedronGeometry args={[1.1, 0]} />
                <meshBasicMaterial color="#00f0ff" wireframe />
              </mesh>
              <group ref={ringRef} position={[0, 1.8, 0]}>
                <mesh>
                  <torusGeometry args={[1.8, 0.08, 8, 24]} />
                  <meshBasicMaterial color="#ff00aa" />
                </mesh>
              </group>
              {/* Workstations */}
              <mesh position={[-6, 0.8, -4]}>
                <boxGeometry args={[3.5, 1.6, 2]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <mesh position={[6, 0.8, -4]}>
                <boxGeometry args={[3.5, 1.6, 2]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {/* Terminal Hologram */}
              <mesh position={[5, 1.8, -3.8]}>
                <boxGeometry args={[1.2, 0.8, 0.05]} />
                <meshBasicMaterial color="#00f0ff" />
              </mesh>
              {/* NPC Dr. Nova */}
              <InteriorHumanoid
                position={[-5, 0, -3]}
                rotationY={0.5}
                armorColor="#0284c7"
                visorColor="#00f0ff"
                accessory="HEADSET"
              />
            </group>
          )}

          {/* 2. LOUNGE: Curved Cyber Bar & Mixologist K-9 */}
          {type === 'LOUNGE' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0.8, -4]} castShadow>
                <boxGeometry args={[12, 1.6, 2.5]} />
                <meshStandardMaterial color="#312e81" metalness={0.7} />
              </mesh>
              <mesh position={[0, 1.65, -4]}>
                <boxGeometry args={[12.2, 0.1, 2.7]} />
                <meshBasicMaterial color="#ec4899" />
              </mesh>
              {/* Bar Shelves */}
              <mesh position={[0, 2.8, -8.8]}>
                <boxGeometry args={[10, 2.2, 0.3]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <pointLight position={[0, 2.2, -4]} color="#ec4899" distance={10} intensity={2.0} />
              {/* NPC Mixologist K-9 */}
              <InteriorHumanoid
                position={[0, 0, -5.2]}
                rotationY={0}
                armorColor="#4c1d95"
                visorColor="#ec4899"
              />
            </group>
          )}

          {/* 3. CLINIC: Ripperdoc Operating Chair & Doc Viktor */}
          {type === 'CLINIC' && (
            <group position={[0, 0, 0]}>
              {/* Operating Recliner Chair */}
              <mesh position={[0, 0.7, 0]} castShadow>
                <boxGeometry args={[1.8, 0.8, 3.2]} />
                <meshStandardMaterial color="#164e63" roughness={0.3} metalness={0.8} />
              </mesh>
              <mesh position={[0, 1.4, -0.8]} rotation={[-0.4, 0, 0]}>
                <boxGeometry args={[1.6, 0.8, 0.2]} />
                <meshStandardMaterial color="#083344" />
              </mesh>
              {/* Surgical Arm */}
              <mesh position={[0, 3.2, 0]}>
                <cylinderGeometry args={[0.08, 0.12, 1.8, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} />
              </mesh>
              <mesh position={[0, 2.2, 0]}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              {/* Display Cases */}
              <mesh position={[-7, 1.4, -4]} castShadow>
                <boxGeometry args={[4, 2.8, 1.2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.6} roughness={0.1} />
              </mesh>
              <pointLight position={[0, 2.4, 0]} color="#06b6d4" distance={8} intensity={3.0} />
              {/* NPC Doc Viktor */}
              <InteriorHumanoid
                position={[2.5, 0, 0]}
                rotationY={-1.5}
                armorColor="#0f766e"
                visorColor="#22d3ee"
                accessory="HEADSET"
              />
            </group>
          )}

          {/* 4. NETRUNNER_DEN: Server Banks & Netrunner Zero-Day */}
          {type === 'NETRUNNER_DEN' && (
            <group position={[0, 0, 0]}>
              {[-7, 7].map((xPos, idx) => (
                <group key={`racks-${idx}`} position={[xPos, 1.8, 0]}>
                  <mesh castShadow>
                    <boxGeometry args={[2.2, 3.6, 12]} />
                    <meshStandardMaterial color="#052e16" roughness={0.4} metalness={0.8} />
                  </mesh>
                  <mesh position={[xPos > 0 ? -1.12 : 1.12, 0, 0]}>
                    <boxGeometry args={[0.04, 3.2, 11]} />
                    <meshBasicMaterial color="#10b981" />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.9, -4]} castShadow>
                <boxGeometry args={[3.8, 1.8, 2.4]} />
                <meshStandardMaterial color="#022c22" />
              </mesh>
              <mesh ref={holoRef} position={[0, 2.4, -4]}>
                <cylinderGeometry args={[1.2, 1.2, 0.6, 6]} />
                <meshBasicMaterial color="#22c55e" wireframe />
              </mesh>
              {/* NPC Netrunner Zero-Day */}
              <InteriorHumanoid
                position={[-2.5, 0, -3.8]}
                rotationY={0.8}
                armorColor="#064e3b"
                visorColor="#10b981"
              />
            </group>
          )}

          {/* 5. RAMEN_DINER: Ramen Counter & Chef Taro */}
          {type === 'RAMEN_DINER' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0.8, -3.5]} castShadow>
                <boxGeometry args={[12, 1.6, 2.2]} />
                <meshStandardMaterial color="#78350f" roughness={0.6} />
              </mesh>
              {[-4, -2, 0, 2, 4].map((stX, sIdx) => (
                <mesh key={`stool-${sIdx}`} position={[stX, 0.45, -1.8]}>
                  <cylinderGeometry args={[0.35, 0.35, 0.9, 8]} />
                  <meshStandardMaterial color="#451a03" />
                </mesh>
              ))}
              {/* Red Lantern Glows */}
              {[-5, -2.5, 2.5, 5].map((lx, lIdx) => (
                <group key={`lantern-${lIdx}`} position={[lx, 3.2, -3.5]}>
                  <mesh>
                    <cylinderGeometry args={[0.3, 0.3, 0.6, 12]} />
                    <meshBasicMaterial color="#ef4444" />
                  </mesh>
                  <pointLight color="#f87171" distance={5} intensity={2.0} />
                </group>
              ))}
              {/* NPC Chef Taro */}
              <InteriorHumanoid
                position={[0, 0, -4.8]}
                rotationY={0}
                armorColor="#991b1b"
                visorColor="#fbbf24"
              />
            </group>
          )}

          {/* 6. PENTHOUSE: Lounge & Executive Vane */}
          {type === 'PENTHOUSE' && (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0.45, 1]} castShadow>
                <boxGeometry args={[5, 0.9, 2.5]} />
                <meshStandardMaterial color="#44403c" />
              </mesh>
              <mesh position={[0, 0.4, -2]}>
                <cylinderGeometry args={[1.5, 1.5, 0.5, 16]} />
                <meshStandardMaterial color="#1c1917" metalness={0.9} />
              </mesh>
              {/* NPC Executive Vane */}
              <InteriorHumanoid
                position={[0, 0, -6.5]}
                rotationY={0}
                armorColor="#18181b"
                visorColor="#38bdf8"
              />
            </group>
          )}

          {/* 7. ARCADE: Neon Machines */}
          {type === 'ARCADE' && (
            <group position={[0, 0, 0]}>
              {[-8, -6, -4, 4, 6, 8].map((ax, aIdx) => (
                <group key={`arc-${aIdx}`} position={[ax, 1.2, -4]}>
                  <mesh castShadow>
                    <boxGeometry args={[1.4, 2.4, 1.6]} />
                    <meshStandardMaterial color="#4a044e" metalness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.4, 0.81]}>
                    <planeGeometry args={[1.1, 0.9]} />
                    <meshBasicMaterial color={aIdx % 2 === 0 ? '#d946ef' : '#06b6d4'} />
                  </mesh>
                </group>
              ))}
            </group>
          )}
        </>
      )}

      {/* =========================================================
          LEVEL 2 UPPER MEZZANINE & OBSERVATION SKY-DECK
          ========================================================= */}
      {floor === 2 && (
        <group position={[0, 0, 0]}>
          {/* Center Strategy Table */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[3.2, 3.4, 1.6, 24]} />
            <meshStandardMaterial color="#091322" roughness={0.2} metalness={0.95} />
          </mesh>
          <mesh position={[0, 1.62, 0]}>
            <cylinderGeometry args={[3.0, 3.0, 0.05, 24]} />
            <meshBasicMaterial color="var(--neon-cyan)" />
          </mesh>

          {/* Rotating 3D City Blueprint Hologram */}
          <group ref={cityHoloRef} position={[0, 2.4, 0]}>
            {/* Center Landmark Tower */}
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[0.5, 1.2, 0.5]} />
              <meshBasicMaterial color="#00f0ff" wireframe />
            </mesh>
            {/* Surrounding City District Towers */}
            {[-1.2, 1.2].map((bx, bIdx) => (
              <mesh key={`b1-${bIdx}`} position={[bx, 0.2, 0]}>
                <boxGeometry args={[0.4, 0.7, 0.4]} />
                <meshBasicMaterial color="#ff00aa" wireframe />
              </mesh>
            ))}
            {[ -1.2, 1.2].map((bz, bIdx) => (
              <mesh key={`b2-${bIdx}`} position={[0, 0.25, bz]}>
                <boxGeometry args={[0.45, 0.8, 0.45]} />
                <meshBasicMaterial color="#00ffaa" wireframe />
              </mesh>
            ))}
            {/* Orbiting Telemetry Rings */}
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[2.0, 0.03, 8, 32]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
          </group>

          {/* Mezzanine Executive Seating Couches */}
          {[-6, 6].map((cx, cIdx) => (
            <mesh key={`lounge-${cIdx}`} position={[cx, 0.45, 2]} castShadow>
              <boxGeometry args={[3.2, 0.9, 1.8]} />
              <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
            </mesh>
          ))}

          {/* Upper Skylight Atmospheric Spotlights */}
          <spotLight
            position={[0, 4.4, 0]}
            color="#00f0ff"
            intensity={4.0}
            distance={12}
            angle={0.6}
            penumbra={0.4}
          />
        </group>
      )}
    </group>
  );
};
