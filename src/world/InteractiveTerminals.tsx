import React, { useEffect } from 'react';
import * as THREE from 'three';
import { TerminalSystem } from '../interaction/TerminalSystem';

const TERMINALS = [
  { id: 'central_telemetry', name: 'Central Telemetry Kiosk', position: new THREE.Vector3(0, 0.7, 6), district: 'CENTRAL METROPOLIS' },
  { id: 'reactor_dispatch', name: 'Reactor Dispatch Terminal', position: new THREE.Vector3(42, 0.7, -12), district: 'INDUSTRIAL REACTOR ZONE' },
  { id: 'skyway_beacon', name: 'Skyway Beacon Console', position: new THREE.Vector3(-42, 0.7, -12), district: 'SKY DISTRICT' },
];

export const InteractiveTerminals: React.FC = () => {
  useEffect(() => {
    const system = TerminalSystem.getInstance();
    TERMINALS.forEach((terminal) => system.register(terminal));
    return () => TERMINALS.forEach((terminal) => system.unregister(terminal.id));
  }, []);

  return <group name="InteractiveTerminals">
    {TERMINALS.map((terminal) => <group key={terminal.id} position={terminal.position}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.55, 1.4, 0.35]} />
        <meshStandardMaterial color="#102a43" emissive="#00e5ff" emissiveIntensity={1.4} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.08]} />
        <meshBasicMaterial color="#f5b942" />
      </mesh>
    </group>)}
  </group>;
};
