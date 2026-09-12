import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem, IntersectionSignalState, SignalColor } from './TrafficLightSystem';

interface TrafficLightGantryProps {
  position: [number, number, number];
}

export const TrafficLightGantry: React.FC<TrafficLightGantryProps> = ({ position }) => {
  const [signalState, setSignalState] = useState<IntersectionSignalState>(() =>
    TrafficLightSystem.getInstance().getState()
  );

  useEffect(() => {
    return TrafficLightSystem.getInstance().subscribe(setSignalState);
  }, []);

  useFrame((_, delta) => {
    // Drive the cycle update
    TrafficLightSystem.getInstance().update(delta);
  });

  const getLensColor = (lightType: 'RED' | 'AMBER' | 'GREEN', activeColor: SignalColor) => {
    if (lightType === activeColor) {
      if (lightType === 'RED') return '#ff1133';
      if (lightType === 'AMBER') return '#ffaa00';
      if (lightType === 'GREEN') return '#00ff66';
    }
    // Inactive dim glass
    if (lightType === 'RED') return '#3a080e';
    if (lightType === 'AMBER') return '#3a2408';
    return '#083318';
  };

  const nsActive = signalState.northSouth;
  const ewActive = signalState.eastWest;

  return (
    <group position={position}>
      {/* 1. North-South Gantry Overhead Mast (Over Z-axis Road) */}
      <group position={[7.5, 0, 16]}>
        {/* Vertical Steel Column */}
        <mesh position={[0, 4.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 8.4, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* Cantilever Horizontal Arm over roadway */}
        <mesh position={[-5.5, 8.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 11, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>

        {/* Traffic Signal Head (Facing North-bound traffic, -Z direction) */}
        <group position={[-5.5, 7.6, 0.3]} rotation={[0, Math.PI, 0]}>
          {/* Signal Housing Box */}
          <mesh castShadow>
            <boxGeometry args={[0.7, 2.2, 0.4]} />
            <meshStandardMaterial color="#030712" metalness={0.8} />
          </mesh>
          {/* Top Visor Hood */}
          <mesh position={[0, 1.15, 0.2]}>
            <boxGeometry args={[0.72, 0.1, 0.35]} />
            <meshStandardMaterial color="#030712" />
          </mesh>

          {/* Red Lens */}
          <mesh position={[0, 0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('RED', nsActive)}
              emissive={getLensColor('RED', nsActive)}
              emissiveIntensity={nsActive === 'RED' ? 2.5 : 0.05}
              roughness={0.2}
            />
          </mesh>
          {/* Amber Lens */}
          <mesh position={[0, 0, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('AMBER', nsActive)}
              emissive={getLensColor('AMBER', nsActive)}
              emissiveIntensity={nsActive === 'AMBER' ? 2.5 : 0.05}
              roughness={0.2}
            />
          </mesh>
          {/* Green Lens */}
          <mesh position={[0, -0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('GREEN', nsActive)}
              emissive={getLensColor('GREEN', nsActive)}
              emissiveIntensity={nsActive === 'GREEN' ? 2.5 : 0.05}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* Pedestrian Crossing Signal Post on Sidewalk */}
        <group position={[0, 2.8, 0]}>
          <mesh position={[0, 0, 0.4]}>
            <boxGeometry args={[0.45, 0.9, 0.35]} />
            <meshStandardMaterial color="#030712" />
          </mesh>
          {/* Pedestrian Symbol */}
          <mesh position={[0, 0, 0.58]}>
            <planeGeometry args={[0.35, 0.7]} />
            <meshBasicMaterial
              color={signalState.pedestrianNorthSouth === 'WALK' ? '#00ffaa' : '#ff2244'}
            />
          </mesh>
        </group>
      </group>

      {/* 2. Opposite North-South Gantry Mast (Facing South-bound traffic, +Z direction) */}
      <group position={[-7.5, 0, -16]}>
        <mesh position={[0, 4.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 8.4, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[5.5, 8.2, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 11, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>

        <group position={[5.5, 7.6, -0.3]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 2.2, 0.4]} />
            <meshStandardMaterial color="#030712" metalness={0.8} />
          </mesh>
          {/* Red Lens */}
          <mesh position={[0, 0.65, -0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('RED', nsActive)}
              emissive={getLensColor('RED', nsActive)}
              emissiveIntensity={nsActive === 'RED' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Amber Lens */}
          <mesh position={[0, 0, -0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('AMBER', nsActive)}
              emissive={getLensColor('AMBER', nsActive)}
              emissiveIntensity={nsActive === 'AMBER' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Green Lens */}
          <mesh position={[0, -0.65, -0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('GREEN', nsActive)}
              emissive={getLensColor('GREEN', nsActive)}
              emissiveIntensity={nsActive === 'GREEN' ? 2.5 : 0.05}
            />
          </mesh>
        </group>
      </group>

      {/* 3. East-West Gantry Mast (Over X-axis Road) */}
      <group position={[16, 0, -7.5]}>
        <mesh position={[0, 4.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 8.4, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 8.2, 5.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 11, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>

        <group position={[0.3, 7.6, 5.5]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 2.2, 0.4]} />
            <meshStandardMaterial color="#030712" metalness={0.8} />
          </mesh>
          {/* Red Lens */}
          <mesh position={[0, 0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('RED', ewActive)}
              emissive={getLensColor('RED', ewActive)}
              emissiveIntensity={ewActive === 'RED' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Amber Lens */}
          <mesh position={[0, 0, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('AMBER', ewActive)}
              emissive={getLensColor('AMBER', ewActive)}
              emissiveIntensity={ewActive === 'AMBER' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Green Lens */}
          <mesh position={[0, -0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('GREEN', ewActive)}
              emissive={getLensColor('GREEN', ewActive)}
              emissiveIntensity={ewActive === 'GREEN' ? 2.5 : 0.05}
            />
          </mesh>
        </group>
      </group>

      {/* 4. Opposite East-West Gantry Mast (Facing West-bound traffic) */}
      <group position={[-16, 0, 7.5]}>
        <mesh position={[0, 4.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 8.4, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 8.2, -5.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 11, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>

        <group position={[-0.3, 7.6, -5.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 2.2, 0.4]} />
            <meshStandardMaterial color="#030712" metalness={0.8} />
          </mesh>
          {/* Red Lens */}
          <mesh position={[0, 0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('RED', ewActive)}
              emissive={getLensColor('RED', ewActive)}
              emissiveIntensity={ewActive === 'RED' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Amber Lens */}
          <mesh position={[0, 0, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('AMBER', ewActive)}
              emissive={getLensColor('AMBER', ewActive)}
              emissiveIntensity={ewActive === 'AMBER' ? 2.5 : 0.05}
            />
          </mesh>
          {/* Green Lens */}
          <mesh position={[0, -0.65, 0.18]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color={getLensColor('GREEN', ewActive)}
              emissive={getLensColor('GREEN', ewActive)}
              emissiveIntensity={ewActive === 'GREEN' ? 2.5 : 0.05}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};
