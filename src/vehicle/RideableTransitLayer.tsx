import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem, VehicleState } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TransitScheduleSystem } from './TransitScheduleSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioManager } from '../audio/AudioManager';

interface RideableTransitLayerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

const REPAIR_BAYS = [
  { id: 'repair-central', name: 'Central Maintenance Bay', position: new THREE.Vector3(9, 0.4, 10) },
  { id: 'repair-west', name: 'West Avenue Service Bay', position: new THREE.Vector3(-34, 0.4, -8) },
];

export const RideableTransitLayer: React.FC<RideableTransitLayerProps> = () => {
  const [vehicleState, setVehicleState] = useState<VehicleState>(() => VehicleInteractionSystem.getInstance().getState());
  const vehicleRef = useRef<THREE.Group>(null);
  const shuttleRef = useRef<THREE.Group>(null);
  const stopIdxRef = useRef(0);
  const dwellRef = useRef(0);

  const system = VehicleInteractionSystem.getInstance();
  const initialHoverPos = useMemo(() => system.getVehiclePosition(), [system]);
  const initialTransitPos = useMemo(() => new THREE.Vector3(-7, 0.2, 10), []);

  useEffect(() => {
    system.registerRideable('nexus-hover-01', 'Solaris Hover-Coupe', initialHoverPos, 'vehicle');
    system.registerRideable('central-transit-node', 'Autonomous Mag-Shuttle', initialTransitPos, 'transit');

    const interactions = InteractionSystem.getInstance();
    REPAIR_BAYS.forEach((bay) => {
      interactions.register({
        id: bay.id,
        name: bay.name,
        actionText: `CALIBRATE CHASSIS // ${bay.name.toUpperCase()}`,
        position: bay.position,
        radius: 3.5,
        onInteract: () => {
          AudioManager.getInstance().playRepairComplete();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('nexus:notification', {
                detail: {
                  title: 'CHASSIS CALIBRATION COMPLETE',
                  message: `${bay.name}: magnetic suspension and turbine alignment restored.`,
                  type: 'system',
                  duration: 2500,
                },
              })
            );
          }
        },
      });
    });

    return () => {
      system.unregisterRideable('nexus-hover-01');
      system.unregisterRideable('central-transit-node');
      REPAIR_BAYS.forEach((bay) => interactions.unregister(bay.id));
    };
  }, [system, initialHoverPos, initialTransitPos]);

  useEffect(() => system.subscribe(setVehicleState), [system]);

  useFrame((_, delta) => {
    const live = system.getState();
    if (vehicleRef.current) {
      vehicleRef.current.position.copy(system.getVehiclePosition());
      vehicleRef.current.rotation.y = live.vehicleRotationY;
      vehicleRef.current.position.y += Math.sin(performance.now() * 0.0025) * 0.03;
    }

    if (shuttleRef.current) {
      const stops = TransitScheduleSystem.getInstance().getStops();
      const next = stops[(stopIdxRef.current + 1) % stops.length];
      const target = new THREE.Vector3(...next.position);
      const dist = Math.hypot(target.x - shuttleRef.current.position.x, target.z - shuttleRef.current.position.z);
      const dt = Math.min(delta, 0.1);

      if (dwellRef.current > 0) {
        dwellRef.current -= dt;
      } else if (dist < 1.2) {
        dwellRef.current = next.dwellSeconds;
        stopIdxRef.current = (stopIdxRef.current + 1) % stops.length;
        AudioManager.getInstance().playTransitArrival();
      } else {
        shuttleRef.current.position.lerp(target, Math.min(1, (8.5 * dt) / dist));
      }

      shuttleRef.current.position.y = 0.62 + Math.sin(performance.now() * 0.002) * 0.025;
      shuttleRef.current.rotation.y = Math.atan2(
        target.x - shuttleRef.current.position.x,
        target.z - shuttleRef.current.position.z
      );
      system.syncTransitPosition(shuttleRef.current.position, shuttleRef.current.rotation.y);
      if (live.mode !== 'TRANSIT_LINKED') {
        system.syncRideablePosition('central-transit-node', initialTransitPos);
      }
    }
  });

  const neon = vehicleState.upgrades.neon > 0;
  const accent = neon ? '#f59e0b' : '#38bdf8';
  const shadows = QualityManager.current.shadows;
  const stops = TransitScheduleSystem.getInstance().getStops();

  return (
    <group name="RideableTransitAndServiceLayer">
      {/* Player Rideable Hover-Coupe */}
      <group ref={vehicleRef} position={initialHoverPos}>
        <mesh castShadow={shadows}>
          <boxGeometry args={[1.85, 0.52, 3.6]} />
          <meshStandardMaterial
            color="#0b0f19"
            metalness={0.92}
            roughness={0.18}
            emissive={accent}
            emissiveIntensity={neon ? 0.45 : 0.12}
          />
        </mesh>
        <mesh position={[0, 0.38, -0.1]}>
          <boxGeometry args={[1.4, 0.34, 1.75]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.78} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.04, 1.81]}>
          <boxGeometry args={[1.5, 0.08, 0.04]} />
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
        <mesh position={[0, 0.04, -1.81]}>
          <boxGeometry args={[1.5, 0.08, 0.04]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.3, 4.1]} />
          <meshBasicMaterial color={accent} transparent opacity={neon ? 0.38 : 0.16} />
        </mesh>
      </group>

      {/* Transit Stops */}
      {stops.map((stop) => (
        <group key={stop.id} position={stop.position}>
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.14, 0.22, 2.3, 8]} />
            <meshStandardMaterial color="#111827" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.35, 0]}>
            <octahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}

      {/* Autonomous Transit Shuttle */}
      <group ref={shuttleRef} position={[-7, 0.62, 10]}>
        <mesh castShadow={shadows}>
          <boxGeometry args={[2.1, 0.68, 4.8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.22} emissive="#38bdf8" emissiveIntensity={0.22} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[1.7, 0.34, 2.6]} />
          <meshStandardMaterial color="#1e293b" transparent opacity={0.82} metalness={0.8} roughness={0.12} />
        </mesh>
      </group>

      {/* Maintenance & Calibration Bays */}
      {REPAIR_BAYS.map((bay) => (
        <group key={bay.id} position={bay.position}>
          <mesh receiveShadow>
            <boxGeometry args={[2.5, 0.55, 1.5]} />
            <meshStandardMaterial color="#111827" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[1.8, 0.06, 0.25]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
