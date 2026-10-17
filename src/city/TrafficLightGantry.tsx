import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';

interface TrafficLightGantryProps {
  position?: [number, number, number];
}

const CROSSWALKS = [
  { pos: [0, 0.04, -14] as [number, number, number], rot: 0 },
  { pos: [0, 0.04, 14] as [number, number, number], rot: 0 },
  { pos: [14, 0.04, 0] as [number, number, number], rot: Math.PI / 2 },
  { pos: [-14, 0.04, 0] as [number, number, number], rot: Math.PI / 2 },
];

export const TrafficLightGantry: React.FC<TrafficLightGantryProps> = ({ position = [0, 0, 0] }) => {
  const nsMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const system = TrafficLightSystem.getInstance();

  useFrame((_, delta) => {
    system.update(delta);
    const st = system.getState();

    const getColor = (sig: 'GREEN' | 'YELLOW' | 'RED') =>
      sig === 'GREEN' ? '#10b981' : sig === 'YELLOW' ? '#f59e0b' : '#f43f5e';

    if (nsMatRef.current) nsMatRef.current.color.set(getColor(st.nsSignal));
    if (ewMatRef.current) ewMatRef.current.color.set(getColor(st.ewSignal));
  });

  const gantries = [
    { pos: [0, 0, -14] as [number, number, number], rot: 0, isNS: true },
    { pos: [0, 0, 14] as [number, number, number], rot: Math.PI, isNS: true },
    { pos: [-14, 0, 0] as [number, number, number], rot: Math.PI / 2, isNS: false },
    { pos: [14, 0, 0] as [number, number, number], rot: -Math.PI / 2, isNS: false },
  ];

  return (
    <group position={position} name="IntersectionGantriesAndCrosswalks">
      {gantries.map((g, idx) => (
        <group key={idx} position={g.pos} rotation={[0, g.rot, 0]}>
          <mesh position={[-7.8, 3.4, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 6.8, 8]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[7.8, 3.4, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 6.8, 8]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 6.6, 0]} castShadow>
            <boxGeometry args={[16.0, 0.28, 0.28]} />
            <meshStandardMaterial color="#111827" metalness={0.88} roughness={0.25} />
          </mesh>
          <mesh position={[0, 6.45, 0.18]}>
            <boxGeometry args={[3.6, 0.22, 0.08]} />
            <meshBasicMaterial ref={g.isNS ? (idx === 0 ? nsMatRef : undefined) : idx === 2 ? ewMatRef : undefined} color={g.isNS ? '#10b981' : '#f43f5e'} />
          </mesh>
        </group>
      ))}

      {CROSSWALKS.map((cw, idx) => (
        <group key={`cw-${idx}`} position={cw.pos} rotation={[0, cw.rot, 0]}>
          <mesh position={[0, 0.01, 2.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[12.8, 0.35]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {Array.from({ length: 9 }).map((_, sIdx) => {
            const x = -5.6 + sIdx * 1.4;
            return (
              <mesh key={sIdx} position={[x, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.68, 3.0]} />
                <meshStandardMaterial color="#cbd5e1" emissive="#38bdf8" emissiveIntensity={0.12} roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
};
