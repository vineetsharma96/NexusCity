import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TerminalSystem, TerminalNode } from '../interaction/TerminalSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioManager } from '../audio/AudioManager';

interface InteractiveTerminalsProps {
  teleportRef?: React.MutableRefObject<((pos: THREE.Vector3) => void) | null>;
}

const TERMINALS: TerminalNode[] = [
  {
    id: 'term_plaza_core',
    name: 'Civic Telemetry Node 01',
    position: new THREE.Vector3(10, 0, -10),
    district: 'CENTRAL PLAZA',
    objective: {
      id: 'obj_plaza_core',
      title: 'CENTRAL AXIS ARCHIVE',
      detail: 'Central Plaza coordinates the 3km metropolitan transit and power distribution grid.',
      kind: 'LORE',
    },
  },
  {
    id: 'term_apex_south',
    name: 'Apex Tower Data Pylon',
    position: new THREE.Vector3(24, 0, 24),
    district: 'CENTRAL CORE',
    objective: {
      id: 'obj_apex_south',
      title: 'MONOLITH STRUCTURAL SCAN',
      detail: 'Apex Tower foundation anchors 130m of titanium-composite curtain wall.',
      kind: 'SCAN',
    },
  },
  {
    id: 'term_helix_north',
    name: 'Helix Uplink Terminal',
    position: new THREE.Vector3(-24, 0, -24),
    district: 'NEURAL CORRIDOR',
    objective: {
      id: 'obj_helix_north',
      title: 'NEURAL BANDWIDTH LOG',
      detail: 'Sub-millisecond optical relays link the Northern Crossing to Helix Citadel.',
      kind: 'MISSION',
    },
  },
  {
    id: 'term_sanctuary_gate',
    name: 'Biosphere Hydro-Sensor',
    position: new THREE.Vector3(52, 0, 52),
    district: 'BIOSPHERE SANCTUARY',
    objective: {
      id: 'obj_sanctuary_gate',
      title: 'HYDROLOGICAL PURITY 99.4%',
      detail: 'Recirculating botanical filtration maintains the reflective sanctuary pond.',
      kind: 'LORE',
    },
  },
];

const ROOFTOP_LIFTS = [
  {
    id: 'lift-apex-plaza',
    name: 'Apex Skybridge Lift',
    ground: new THREE.Vector3(24, 0.2, 16),
    roof: new THREE.Vector3(0, 0.2, -52),
  },
  {
    id: 'lift-sanctuary-core',
    name: 'Sanctuary Express Lift',
    ground: new THREE.Vector3(44, 0.2, 54),
    roof: new THREE.Vector3(0, 0.2, 10),
  },
];

export const InteractiveTerminals: React.FC<InteractiveTerminalsProps> = ({ teleportRef }) => {
  const holoRefs = useRef<(THREE.Group | null)[]>([]);
  const liftRingRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(() => {
    const sys = TerminalSystem.getInstance();
    const interactions = InteractionSystem.getInstance();

    TERMINALS.forEach((t) => sys.register(t));
    ROOFTOP_LIFTS.forEach((lift) => {
      interactions.register({
        id: lift.id,
        name: lift.name,
        actionText: `ASCEND // ${lift.name.toUpperCase()}`,
        position: lift.ground,
        radius: 3.2,
        onInteract: () => {
          teleportRef?.current?.(lift.roof);
          AudioManager.getInstance().playUI('waypoint');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('nexus:notification', {
                detail: {
                  title: 'EXPRESS TRANSIT LINK',
                  message: `${lift.name} transferred operative across sector corridor.`,
                  type: 'system',
                  duration: 2600,
                },
              })
            );
          }
        },
      });
    });

    return () => {
      TERMINALS.forEach((t) => sys.unregister(t.id));
      ROOFTOP_LIFTS.forEach((lift) => interactions.unregister(lift.id));
    };
  }, [teleportRef]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    holoRefs.current.forEach((grp, idx) => {
      if (grp) {
        grp.rotation.y = t * 1.4 + idx;
        grp.position.y = 2.45 + Math.sin(t * 2.2 + idx) * 0.08;
      }
    });
    liftRingRefs.current.forEach((ring, idx) => {
      if (ring) {
        ring.position.y = 0.6 + ((t * 1.1 + idx * 0.9) % 2.2);
      }
    });
  });

  return (
    <group name="InteractiveTerminalsAndLifts">
      {/* Multi-Part Architectural Civic Telemetry Kiosks */}
      {TERMINALS.map((term, idx) => (
        <group key={term.id} position={term.position}>
          {/* Stepped Octagonal Base Plinth & Glowing Perimeter Ring */}
          <mesh position={[0, 0.06, 0]} receiveShadow>
            <cylinderGeometry args={[0.92, 1.05, 0.12, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.78, 0.88, 8]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#38bdf8' : '#f59e0b'} />
          </mesh>

          {/* Main Armored Console Monolith */}
          <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.76, 1.85, 0.48]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Side Protective Rib Wings */}
          {([-0.42, 0.42] as const).map((wx, wIdx) => (
            <mesh key={wIdx} position={[wx, 1.08, 0.06]} castShadow>
              <boxGeometry args={[0.08, 1.65, 0.56]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
          {/* Cantilevered Overhead Visor Hood */}
          <mesh position={[0, 1.98, 0.12]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.92, 0.1, 0.68]} />
            <meshStandardMaterial color="#111827" metalness={0.92} roughness={0.18} />
          </mesh>

          {/* Primary Upper Display & Angled Tactile Input Deck */}
          <mesh position={[0, 1.42, 0.25]} rotation={[-0.18, 0, 0]}>
            <planeGeometry args={[0.62, 0.44]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, 0.98, 0.32]} rotation={[-0.65, 0, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.26]} />
            <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={0.45} metalness={0.85} roughness={0.2} />
          </mesh>

          {/* Floating Multi-Ring Holographic Gyroscope Beacon */}
          <group
            ref={(el) => {
              holoRefs.current[idx] = el;
            }}
            position={[0, 2.45, 0]}
          >
            <mesh>
              <octahedronGeometry args={[0.24, 0]} />
              <meshBasicMaterial color="#38bdf8" wireframe />
            </mesh>
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[0.38, 0.018, 8, 24]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </group>
        </group>
      ))}

      {/* Express Skybridge Lift Portals */}
      {ROOFTOP_LIFTS.map((lift, idx) => (
        <group key={lift.id} position={lift.ground}>
          {/* Base Platform */}
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[0.95, 1.08, 0.1, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glazed Lift Core Cylinder */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.48, 0.54, 2.9, 14]} />
            <meshStandardMaterial
              color="#111827"
              metalness={0.88}
              roughness={0.16}
              emissive="#f59e0b"
              emissiveIntensity={0.32}
            />
          </mesh>
          {/* Twin Structural Guide-Rail Columns */}
          {([-0.68, 0.68] as const).map((gx, gIdx) => (
            <mesh key={gIdx} position={[gx, 1.55, 0]}>
              <boxGeometry args={[0.14, 3.0, 0.22]} />
              <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.2} />
            </mesh>
          ))}
          {/* Overhead Portal Crown Header */}
          <mesh position={[0, 3.05, 0]}>
            <boxGeometry args={[1.65, 0.22, 0.48]} />
            <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Animated Ascending Energy Ring */}
          <mesh
            ref={(el) => {
              liftRingRefs.current[idx] = el;
            }}
            position={[0, 1.4, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.58, 0.035, 8, 24]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.04, 8, 24]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
