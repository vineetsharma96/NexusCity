import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';
import { TimeSystem } from '../world/TimeSystem';

interface TrafficLightGantryProps {
  position?: [number, number, number];
}

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.16, 0.24, 1, 10);

const CONCRETE_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.25, roughness: 0.78 });
const STEEL_DARK_MAT = new THREE.MeshStandardMaterial({ color: '#0b0f19', metalness: 0.92, roughness: 0.22 });
const STEEL_MID_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.88, roughness: 0.24 });
const HOOD_MAT = new THREE.MeshStandardMaterial({ color: '#070b14', metalness: 0.85, roughness: 0.3 });
const BLADE_MAT = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.78, roughness: 0.28 });
const CROSSWALK_PAD_MAT = new THREE.MeshStandardMaterial({
  color: '#070b14',
  roughness: 0.55,
  metalness: 0.4,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
const STRIPE_MAT = new THREE.MeshStandardMaterial({
  color: '#e2e8f0',
  emissive: '#38bdf8',
  emissiveIntensity: 0.14,
  roughness: 0.35,
  metalness: 0.2,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
});
const STOP_LINE_MAT = new THREE.MeshBasicMaterial({
  color: '#f59e0b',
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const GUIDE_LINE_MAT = new THREE.MeshBasicMaterial({
  color: '#38bdf8',
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

/**
 * Wide 4-lane Grand Boulevard crosswalks positioned cleanly at ±15.2m outside the 22m intersection box,
 * elevated above the asphalt surface (y = 0.095m) using 3D thermoplastic slab geometry
 * and polygonOffset to eliminate any depth buffer Z-fighting or collapsing artifacts.
 */
const CENTRAL_CROSSWALKS: { pos: [number, number, number]; rot: number }[] = [
  { pos: [0, 0.095, -15.2], rot: 0 },
  { pos: [0, 0.095, 15.2], rot: Math.PI },
  { pos: [-15.2, 0.095, 0], rot: Math.PI / 2 },
  { pos: [15.2, 0.095, 0], rot: -Math.PI / 2 },
];

// 12 crisp zebra stripes across the 22m Grand Boulevard (-9.35m to +9.35m)
const GRAND_STRIPE_OFFSETS = [-9.35, -7.65, -5.95, -4.25, -2.55, -0.85, 0.85, 2.55, 4.25, 5.95, 7.65, 9.35];
// 10 crisp zebra stripes across the 18m Secondary & Ring Avenues (-7.65m to +7.65m)
const SECONDARY_STRIPE_OFFSETS = [-7.65, -5.95, -4.25, -2.55, -0.85, 0.85, 2.55, 4.25, 5.95, 7.65];

const TRUSS_WEB_XS = [-10.2, -7.2, -4.2, -1.4, 1.4, 4.2, 7.2, 10.2] as const;
const SIGNAL_POD_XS = [-5.2, 5.2] as const;

export const TrafficLightGantry: React.FC<TrafficLightGantryProps> = ({ position = [0, 0, 0] }) => {
  const nsMatNorthRef = useRef<THREE.MeshBasicMaterial>(null);
  const nsMatSouthRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatWestRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatEastRef = useRef<THREE.MeshBasicMaterial>(null);
  const system = TrafficLightSystem.getInstance();

  useFrame((_, delta) => {
    system.update(delta);
    const st = system.getState();
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const hdrGain = 1.2 + nightFactor * 1.45;

    const getColor = (sig: 'GREEN' | 'YELLOW' | 'RED') =>
      sig === 'GREEN' ? '#10b981' : sig === 'YELLOW' ? '#f59e0b' : '#f43f5e';

    const nsCol = getColor(st.nsSignal);
    const ewCol = getColor(st.ewSignal);

    if (nsMatNorthRef.current) nsMatNorthRef.current.color.set(nsCol).multiplyScalar(hdrGain);
    if (nsMatSouthRef.current) nsMatSouthRef.current.color.set(nsCol).multiplyScalar(hdrGain);
    if (ewMatWestRef.current) ewMatWestRef.current.color.set(ewCol).multiplyScalar(hdrGain);
    if (ewMatEastRef.current) ewMatEastRef.current.color.set(ewCol).multiplyScalar(hdrGain);
  });

  const gantries = [
    { pos: [0, 0, -12.6] as [number, number, number], rot: 0, ref: nsMatNorthRef, defaultColor: '#10b981' },
    { pos: [0, 0, 12.6] as [number, number, number], rot: Math.PI, ref: nsMatSouthRef, defaultColor: '#10b981' },
    { pos: [-12.6, 0, 0] as [number, number, number], rot: Math.PI / 2, ref: ewMatWestRef, defaultColor: '#f43f5e' },
    { pos: [12.6, 0, 0] as [number, number, number], rot: -Math.PI / 2, ref: ewMatEastRef, defaultColor: '#f43f5e' },
  ];

  const secondaryIntersections: [number, number, number][] = [
    [0, 0, -75],
    [0, 0, 75],
    [-75, 0, 0],
    [75, 0, 0],
    [0, 0, -165],
    [0, 0, 165],
  ];

  return (
    <group position={position} name="IntersectionGantriesAndCrosswalks">
      {/* Wide-Span Structural Truss Overhead Signal Gantries (Straddling 22m Grand Boulevards) */}
      {gantries.map((g, idx) => (
        <group key={idx} position={g.pos} rotation={[0, g.rot, 0]}>
          {/* Twin Curbside Support Columns with Concrete Protection Plinths & Telemetry Cabinets */}
          {([-12.2, 12.2] as const).map((px, pIdx) => (
            <group key={`mast-${pIdx}`} position={[px, 0, 0]}>
              {/* Stepped Concrete Protection Pedestal */}
              <mesh position={[0, 0.35, 0]} geometry={SHARED_BOX} material={CONCRETE_MAT} scale={[0.92, 0.7, 0.92]} receiveShadow />
              {/* Bolted Base Flange */}
              <mesh position={[0, 0.76, 0]} geometry={SHARED_CYLINDER} material={STEEL_MID_MAT} scale={[0.62, 0.14, 0.62]} />
              {/* Main Tapered Structural Mast */}
              <mesh position={[0, 4.15, 0]} geometry={SHARED_TAPER_POLE} material={STEEL_DARK_MAT} scale={[1, 6.9, 1]} castShadow />
              {/* Mid-Height Signal Controller Cabinet */}
              <mesh position={[px < 0 ? -0.34 : 0.34, 2.2, 0]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[0.42, 0.95, 0.46]} />
              {/* Upper Corner Gusset Haunch */}
              <mesh
                position={[px < 0 ? 0.55 : -0.55, 6.25, 0]}
                rotation={[0, 0, px < 0 ? -0.65 : 0.65]}
                geometry={SHARED_BOX}
                material={STEEL_MID_MAT}
                scale={[0.16, 1.45, 0.24]}
              />
            </group>
          ))}

          {/* Twin-Chord Overhead Bridge Truss (25.0m Span) */}
          <mesh position={[0, 6.7, 0]} geometry={SHARED_BOX} material={STEEL_DARK_MAT} scale={[25.0, 0.24, 0.32]} castShadow />
          <mesh position={[0, 7.32, 0]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[25.0, 0.18, 0.26]} castShadow />

          {/* Vertical Truss Web Struts */}
          {TRUSS_WEB_XS.map((wx, wIdx) => (
            <mesh key={`web-${wIdx}`} position={[wx, 7.01, 0]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[0.1, 0.62, 0.22]} />
          ))}

          {/* Central Illuminated Street-Name Blade & Telemetry Bar */}
          <mesh position={[0, 7.02, 0.2]} geometry={SHARED_BOX} material={BLADE_MAT} scale={[5.6, 0.52, 0.12]} />
          <mesh position={[0, 6.56, 0.2]}>
            <boxGeometry args={[4.4, 0.18, 0.08]} />
            <meshBasicMaterial ref={g.ref} color={g.defaultColor} toneMapped={false} />
          </mesh>

          {/* Dual Hooded 3-Lens Traffic Signal Pods Centered Over Approaching Lanes */}
          {SIGNAL_POD_XS.map((sx, sIdx) => (
            <group key={`sigpod-${sIdx}`} position={[sx, 6.25, 0.24]}>
              {/* Backplate Frame */}
              <mesh geometry={SHARED_BOX} material={HOOD_MAT} scale={[1.45, 0.62, 0.24]} />
              {/* Sun Visor Hood */}
              <mesh position={[0, 0.26, 0.18]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[1.48, 0.07, 0.34]} />
              {/* Three Signal Lens Bays */}
              {([-0.42, 0, 0.42] as const).map((lx, lIdx) => (
                <mesh
                  key={`lens-${lIdx}`}
                  position={[lx, 0, 0.14]}
                  rotation={[Math.PI / 2, 0, 0]}
                  geometry={SHARED_CYLINDER}
                  scale={[0.24, 0.06, 0.24]}
                >
                  <meshBasicMaterial
                    color={lIdx === 0 ? '#f43f5e' : lIdx === 1 ? '#f59e0b' : '#10b981'}
                    toneMapped={false}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* Central Grand Boulevard Zebra Crosswalks (21.2m Wide Across 22m Roadways) */}
      {CENTRAL_CROSSWALKS.map((cw, idx) => (
        <group key={`cw-${idx}`} position={cw.pos} rotation={[0, cw.rot, 0]}>
          {/* Dark Recessed Crosswalk Bed Pad */}
          <mesh position={[0, -0.004, 0]} geometry={SHARED_BOX} material={CROSSWALK_PAD_MAT} scale={[21.2, 0.008, 3.8]} receiveShadow />

          {/* Vehicle Stop Line Bar (Facing approaching traffic) */}
          <mesh position={[0, 0.006, -2.35]} geometry={SHARED_BOX} material={STOP_LINE_MAT} scale={[20.4, 0.014, 0.34]} />

          {/* Pedestrian Edge Guide Lines */}
          <mesh position={[0, 0.005, -1.75]} geometry={SHARED_BOX} material={GUIDE_LINE_MAT} scale={[20.4, 0.012, 0.1]} />
          <mesh position={[0, 0.005, 1.75]} geometry={SHARED_BOX} material={GUIDE_LINE_MAT} scale={[20.4, 0.012, 0.1]} />

          {/* 12 High-Contrast Thermoplastic Zebra Bars */}
          {GRAND_STRIPE_OFFSETS.map((x, sIdx) => (
            <mesh
              key={sIdx}
              position={[x, 0.008, 0]}
              geometry={SHARED_BOX}
              material={STRIPE_MAT}
              scale={[0.82, 0.016, 2.95]}
              receiveShadow
            />
          ))}
        </group>
      ))}

      {/* Secondary & Ring Intersection Crosswalks Scaled Precisely to 22m Grand vs 18m Secondary Avenues */}
      {secondaryIntersections.map(([ix, iy, iz], nodeIdx) => {
        const nsWidth = ix === 0 ? 22 : 18;
        const ewWidth = iz === 0 ? 22 : 18;
        const nsOffset = ewWidth / 2 + 3.2; // 14.2m or 12.2m
        const ewOffset = nsWidth / 2 + 3.2; // 14.2m or 12.2m
        const arms: { pos: [number, number, number]; rot: number; span: number; stripes: number[] }[] = [
          {
            pos: [0, 0.095, -nsOffset],
            rot: 0,
            span: nsWidth - 0.8,
            stripes: nsWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
          },
          {
            pos: [0, 0.095, nsOffset],
            rot: Math.PI,
            span: nsWidth - 0.8,
            stripes: nsWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
          },
          {
            pos: [-ewOffset, 0.095, 0],
            rot: Math.PI / 2,
            span: ewWidth - 0.8,
            stripes: ewWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
          },
          {
            pos: [ewOffset, 0.095, 0],
            rot: -Math.PI / 2,
            span: ewWidth - 0.8,
            stripes: ewWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
          },
        ];

        return (
          <group key={`outer-int-${nodeIdx}`} position={[ix, iy, iz]}>
            {arms.map((cw, cwIdx) => (
              <group key={`ocw-${cwIdx}`} position={cw.pos} rotation={[0, cw.rot, 0]}>
                <mesh
                  position={[0, -0.004, 0]}
                  geometry={SHARED_BOX}
                  material={CROSSWALK_PAD_MAT}
                  scale={[cw.span, 0.008, 3.4]}
                  receiveShadow
                />
                <mesh
                  position={[0, 0.006, -2.1]}
                  geometry={SHARED_BOX}
                  material={STOP_LINE_MAT}
                  scale={[cw.span - 0.6, 0.014, 0.3]}
                />
                {cw.stripes.map((x, sIdx) => (
                  <mesh
                    key={sIdx}
                    position={[x, 0.008, 0]}
                    geometry={SHARED_BOX}
                    material={STRIPE_MAT}
                    scale={[0.78, 0.016, 2.6]}
                    receiveShadow
                  />
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
};
