import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem, VehicleState } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TransitScheduleSystem } from './TransitScheduleSystem';
import { AudioManager } from '../audio/AudioManager';

interface RideableTransitLayerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const RideableTransitLayer: React.FC<RideableTransitLayerProps> = () => {
  const [vehicleState, setVehicleState] = useState<VehicleState>(() => VehicleInteractionSystem.getInstance().getState());
  const vehicleRef = useRef<THREE.Group>(null);
  const transitVehicleRef = useRef<THREE.Group>(null);
  const transitStopIndexRef = useRef(0);
  const transitDwellRef = useRef(0);
  const system = VehicleInteractionSystem.getInstance();
  const vehiclePosition = useMemo(() => system.getVehiclePosition(), [system]);
  const transitPosition = useMemo(() => new THREE.Vector3(-7, 0.2, 10), []);

  useEffect(() => {
    system.registerRideable('nexus-hover-01', 'Nexus Hovercraft', vehiclePosition, 'vehicle');
    system.registerRideable('central-transit-node', 'Central Transit Node', transitPosition, 'transit');
    return () => {
      system.unregisterRideable('nexus-hover-01');
      system.unregisterRideable('central-transit-node');
    };
  }, [system, transitPosition, vehiclePosition]);

  useEffect(() => system.subscribe(setVehicleState), [system]);

  useFrame((_, delta) => {
    const liveState = system.getState();
    if (vehicleRef.current) {
      vehicleRef.current.position.copy(system.getVehiclePosition());
      vehicleRef.current.rotation.y = liveState.vehicleRotationY;
      vehicleRef.current.position.y += Math.sin(performance.now() * 0.002) * 0.035;
    }
    if (transitVehicleRef.current) {
      const stops = TransitScheduleSystem.getInstance().getStops();
      const next = stops[(transitStopIndexRef.current + 1) % stops.length];
      const target = new THREE.Vector3(...next.position);
      const distance = Math.hypot(target.x - transitVehicleRef.current.position.x, target.z - transitVehicleRef.current.position.z);
      const step = Math.min(delta, 0.1);
      if (transitDwellRef.current > 0) transitDwellRef.current -= step;
      else if (distance < 1.2) {
        transitDwellRef.current = next.dwellSeconds;
        transitStopIndexRef.current = (transitStopIndexRef.current + 1) % stops.length;
        AudioManager.getInstance().playTransitArrival();
      } else {
        transitVehicleRef.current.position.lerp(target, Math.min(1, (8 * step) / distance));
      }
      transitVehicleRef.current.position.y = 0.62 + Math.sin(performance.now() * 0.002) * 0.025;
      transitVehicleRef.current.rotation.y = Math.atan2(target.x - transitVehicleRef.current.position.x, target.z - transitVehicleRef.current.position.z);
      system.syncTransitPosition(transitVehicleRef.current.position, transitVehicleRef.current.rotation.y);
      if (liveState.mode !== 'TRANSIT_LINKED') system.syncRideablePosition('central-transit-node', transitPosition);
    }
  });

  const neon = vehicleState.upgrades.neon > 0;
  const accent = neon ? '#ff35d4' : '#00f0ff';
  const quality = QualityManager.current;
  const stops = TransitScheduleSystem.getInstance().getStops();

  return (
    <group name="RideableTransitLayer">
      <group ref={vehicleRef} position={vehiclePosition}>
        <mesh castShadow={quality.shadows}>
          <boxGeometry args={[1.8, 0.55, 3.5]} />
          <meshStandardMaterial color="#111827" metalness={0.9} roughness={0.2} emissive={accent} emissiveIntensity={neon ? 0.55 : 0.12} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.35, 0.35, 1.65]} />
          <meshStandardMaterial color="#164e63" transparent opacity={0.72} metalness={0.8} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5, 4.3]} />
          <meshBasicMaterial color={accent} transparent opacity={neon ? 0.45 : 0.18} />
        </mesh>
      </group>
      {stops.map((stop) => <group key={stop.id} position={stop.position}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.18, 0.28, 2.2, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} emissive="#00f0ff" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 2.25, 0]}>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <pointLight position={[0, 2.25, 0]} color="#00f0ff" intensity={0.45} distance={7} />
      </group>)}
      <group ref={transitVehicleRef} position={[-7, 0.62, 10]}>
        <mesh castShadow={quality.shadows}>
          <boxGeometry args={[2.1, 0.65, 4.6]} />
          <meshStandardMaterial color="#0f766e" metalness={0.75} roughness={0.25} emissive="#14b8a6" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.6, 0.32, 2.2]} />
          <meshStandardMaterial color="#164e63" transparent opacity={0.8} metalness={0.7} roughness={0.12} />
        </mesh>
        <pointLight position={[0, 1.1, 0]} color="#2dd4bf" intensity={0.7} distance={10} />
      </group>
    </group>
  );
};
