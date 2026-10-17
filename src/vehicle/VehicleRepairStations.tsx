import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioManager } from '../audio/AudioManager';

const stations = [
  { id: 'repair-central', name: 'Central Repair Bay', position: new THREE.Vector3(9, 0.4, 10) },
  { id: 'repair-west', name: 'West Repair Bay', position: new THREE.Vector3(-34, 0.4, -8) },
];

export const VehicleRepairStations: React.FC = () => {
  const positions = useMemo(() => stations, []);
  useEffect(() => {
    const interaction = InteractionSystem.getInstance();
    positions.forEach((station) => interaction.register({ id: station.id, name: station.name, actionText: 'REPAIR VEHICLE', position: station.position, radius: 3.5, onInteract: () => {
      AudioManager.getInstance().playRepairComplete();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title: 'VEHICLE REPAIR', message: `${station.name}: hull integrity restored.`, type: 'system', duration: 2400 } }));
    } }));
    return () => positions.forEach((station) => interaction.unregister(station.id));
  }, [positions]);
  return <group name="VehicleRepairStations">{positions.map((station) => <group key={station.id} position={station.position}>
    <mesh><boxGeometry args={[2.4, 0.7, 1.4]} /><meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.2, 0.08, 0.3]} /><meshBasicMaterial color="#22d3ee" toneMapped={false} /></mesh>
    <pointLight position={[0, 1, 0]} color="#22d3ee" intensity={0.8} distance={6} />
  </group>)}</group>;
};
