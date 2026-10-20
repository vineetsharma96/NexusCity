import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';

interface TrafficLightGantryProps {
  position?: [number, number, number];
}

/**
 * 4-way intersection crosswalks positioned cleanly at ±15.2m outside the intersection box,
 * elevated above the asphalt surface (y = 0.062m) using 3D thermoplastic slab geometry
 * and polygonOffset to eliminate any depth buffer Z-fighting or collapsing artifacts.
 */
const CROSSWALKS: { pos: [number, number, number]; rot: number }[] = [
  { pos: [0, 0.062, -15.2], rot: 0 },
  { pos: [0, 0.062, 15.2], rot: Math.PI },
  { pos: [-15.2, 0.062, 0], rot: Math.PI / 2 },
  { pos: [15.2, 0.062, 0], rot: -Math.PI / 2 },
];

const STRIPE_OFFSETS = [-5.25, -3.75, -2.25, -0.75, 0.75, 2.25, 3.75, 5.25];

export const TrafficLightGantry: React.FC<TrafficLightGantryProps> = ({ position = [0, 0, 0] }) => {
  const nsMatNorthRef = useRef<THREE.MeshBasicMaterial>(null);
  const nsMatSouthRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatWestRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatEastRef = useRef<THREE.MeshBasicMaterial>(null);
  const system = TrafficLightSystem.getInstance();

  useFrame((_, delta) => {
    system.update(delta);
    const st = system.getState();

    const getColor = (sig: 'GREEN' | 'YELLOW' | 'RED') =>
      sig === 'GREEN' ? '#10b981' : sig === 'YELLOW' ? '#f59e0b' : '#f43f5e';

    const nsCol = getColor(st.nsSignal);
    const ewCol = getColor(st.ewSignal);

    if (nsMatNorthRef.current) nsMatNorthRef.current.color.set(nsCol);
    if (nsMatSouthRef.current) nsMatSouthRef.current.color.set(nsCol);
    if (ewMatWestRef.current) ewMatWestRef.current.color.set(ewCol);
    if (ewMatEastRef.current) ewMatEastRef.current.color.set(ewCol);
  });

  const gantries = [
    { pos: [0, 0, -12.6] as [number, number, number], rot: 0, ref: nsMatNorthRef, defaultColor: '#10b981' },
    { pos: [0, 0, 12.6] as [number, number, number], rot: Math.PI, ref: nsMatSouthRef, defaultColor: '#10b981' },
    { pos: [-12.6, 0, 0] as [number, number, number], rot: Math.PI / 2, ref: ewMatWestRef, defaultColor: '#f43f5e' },
    { pos: [12.6, 0, 0] as [number, number, number], rot: -Math.PI / 2, ref: ewMatEastRef, defaultColor: '#f43f5e' },
  ];

  return (
    <group position={position} name="IntersectionGantriesAndCrosswalks">
      {/* Overhead Signal Gantries */}
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
            <meshBasicMaterial ref={g.ref} color={g.defaultColor} />
          </mesh>
        </group>
      ))}

      {/* Zebra Crosswalks with Anti-Z-Fight 3D Thermoplastic Slabs */}
      {CROSSWALKS.map((cw, idx) => (
        <group key={`cw-${idx}`} position={cw.pos} rotation={[0, cw.rot, 0]}>
          {/* Dark Recessed Crosswalk Bed Pad */}
          <mesh position={[0, -0.004, 0]} receiveShadow>
            <boxGeometry args={[13.2, 0.008, 3.6]} />
            <meshStandardMaterial
              color="#070b14"
              roughness={0.55}
              metalness={0.4}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>

          {/* Vehicle Stop Line Bar (Facing approaching traffic) */}
          <mesh position={[0, 0.006, -2.2]}>
            <boxGeometry args={[12.6, 0.014, 0.32]} />
            <meshBasicMaterial
              color="#f59e0b"
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Pedestrian Edge Guide Lines */}
          <mesh position={[0, 0.005, -1.65]}>
            <boxGeometry args={[12.6, 0.012, 0.1]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0, 0.005, 1.65]}>
            <boxGeometry args={[12.6, 0.012, 0.1]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>

          {/* Zebra Crossing High-Contrast Thermoplastic Bars */}
          {STRIPE_OFFSETS.map((x, sIdx) => (
            <mesh key={sIdx} position={[x, 0.008, 0]} receiveShadow>
              <boxGeometry args={[0.76, 0.016, 2.85]} />
              <meshStandardMaterial
                color="#e2e8f0"
                emissive="#38bdf8"
                emissiveIntensity={0.14}
                roughness={0.35}
                metalness={0.2}
                polygonOffset
                polygonOffsetFactor={-3}
                polygonOffsetUnits={-3}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Extended Secondary Intersection Crosswalks & Signal Archway Nodes */}
      {(
        [
          [0, 0, -75],
          [0, 0, 75],
          [-75, 0, 0],
          [75, 0, 0],
          [0, 0, -165],
          [0, 0, 165],
        ] as [number, number, number][]
      ).map(([ix, iy, iz], nodeIdx) => (
        <group key={`outer-int-${nodeIdx}`} position={[ix, iy, iz]}>
          {CROSSWALKS.map((cw, cwIdx) => (
            <group key={`ocw-${cwIdx}`} position={cw.pos} rotation={[0, cw.rot, 0]}>
              <mesh position={[0, -0.004, 0]} receiveShadow>
                <boxGeometry args={[12.4, 0.008, 3.2]} />
                <meshStandardMaterial
                  color="#070b14"
                  roughness={0.55}
                  metalness={0.4}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
              <mesh position={[0, 0.006, -2.0]}>
                <boxGeometry args={[11.8, 0.014, 0.28]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
              {STRIPE_OFFSETS.map((x, sIdx) => (
                <mesh key={sIdx} position={[x, 0.008, 0]} receiveShadow>
                  <boxGeometry args={[0.72, 0.016, 2.5]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    emissive="#38bdf8"
                    emissiveIntensity={0.14}
                    roughness={0.35}
                    metalness={0.2}
                    polygonOffset
                    polygonOffsetFactor={-3}
                    polygonOffsetUnits={-3}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};
