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
  const holoRefs = useRef<(THREE.Mesh | null)[]>([]);

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
    holoRefs.current.forEach((mesh, idx) => {
      if (mesh) {
        mesh.rotation.y = t * 1.4 + idx;
        mesh.position.y = 2.25 + Math.sin(t * 2.2 + idx) * 0.1;
      }
    });
  });

  return (
    <group name="InteractiveTerminalsAndLifts">
      {TERMINALS.map((term, idx) => (
        <group key={term.id} position={term.position}>
          <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 1.8, 0.48]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.35, 0.25]} rotation={[-0.2, 0, 0]}>
            <planeGeometry args={[0.56, 0.42]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <mesh
            ref={(el) => {
              holoRefs.current[idx] = el;
            }}
            position={[0, 2.25, 0]}
          >
            <octahedronGeometry args={[0.24, 0]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        </group>
      ))}

      {ROOFTOP_LIFTS.map((lift) => (
        <group key={lift.id} position={lift.ground}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.45, 0.55, 2.8, 12]} />
            <meshStandardMaterial color="#111827" metalness={0.85} roughness={0.2} emissive="#f59e0b" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <torusGeometry args={[0.52, 0.04, 8, 24]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
