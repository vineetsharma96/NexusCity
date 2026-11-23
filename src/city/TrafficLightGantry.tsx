import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LightSignal, TrafficLightSystem } from './TrafficLightSystem';
import { TimeSystem } from '../world/TimeSystem';
import { InstanceBatchBuilder } from '../rendering/StaticInstanceBatcher';
import { InstanceBucketSpec, InstancedBatchLayer } from '../rendering/InstancedBatchView';
import { QualityManager } from '../rendering/QualityManager';

interface TrafficLightGantryProps {
  position?: [number, number, number];
}

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.16, 0.24, 1, 10);
const SHARED_LENS = (() => {
  const g = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
  g.rotateX(Math.PI / 2);
  return g;
})();

// Single-sided upward-facing decal plane for crosswalk pads, zebra bars, guide lines & stop lines
// Eliminates thin-box bottom-face bleeding and interpenetrating slab Z-fighting completely.
const SHARED_MARKING_PLANE = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
})();

const CONCRETE_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.25, roughness: 0.78 });
const STEEL_DARK_MAT = new THREE.MeshStandardMaterial({ color: '#0b0f19', metalness: 0.92, roughness: 0.22 });
const STEEL_MID_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.88, roughness: 0.24 });
const HOOD_MAT = new THREE.MeshStandardMaterial({ color: '#070b14', metalness: 0.85, roughness: 0.3 });
const BLADE_MAT = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.78, roughness: 0.28 });

// Strict monotonic polygonOffset + renderOrder stack for zero zebra crossing flicker at any camera angle
const CROSSWALK_PAD_MAT = new THREE.MeshStandardMaterial({
  color: '#070b14',
  roughness: 0.62,
  metalness: 0.32,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -4,
});
const STOP_LINE_MAT = new THREE.MeshBasicMaterial({
  color: '#f59e0b',
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -6,
});
const GUIDE_LINE_MAT = new THREE.MeshBasicMaterial({
  color: '#38bdf8',
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -8,
});
const STRIPE_MAT = new THREE.MeshStandardMaterial({
  color: '#e2e8f0',
  emissive: '#38bdf8',
  emissiveIntensity: 0.14,
  roughness: 0.38,
  metalness: 0.18,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -8,
});

// Exact top-surface heights of underlying NS (0.040) and EW (0.065) road decks
const NS_ROAD_TOP = 0.04;
const EW_ROAD_TOP = 0.065;

// 12 crisp zebra stripes across the 22m Grand Boulevard (-9.35m to +9.35m)
const GRAND_STRIPE_OFFSETS = [-9.35, -7.65, -5.95, -4.25, -2.55, -0.85, 0.85, 2.55, 4.25, 5.95, 7.65, 9.35];
// 10 crisp zebra stripes across the 18m Secondary & Ring Avenues (-7.65m to +7.65m)
const SECONDARY_STRIPE_OFFSETS = [-7.65, -5.95, -4.25, -2.55, -0.85, 0.85, 2.55, 4.25, 5.95, 7.65];

const TRUSS_WEB_XS = [-10.2, -7.2, -4.2, -1.4, 1.4, 4.2, 7.2, 10.2] as const;
const SIGNAL_POD_XS = [-5.2, 5.2] as const;

interface CrosswalkSpec {
  x: number;
  z: number;
  rot: number;
  isEwRoad: boolean;
  span: number;
  padDepth: number;
  stripeDepth: number;
  stripeWidth: number;
  stopOffset: number;
  hasGuideLines: boolean;
  stripes: number[];
}

// All 23 signalized secondary intersections across the Central District grid (excluding (0,0) plaza & (75,75) park)
const SECONDARY_INTERSECTIONS: readonly [number, number][] = (() => {
  const coords = [-165, -75, 0, 75, 165];
  const pts: [number, number][] = [];
  for (const ix of coords) {
    for (const iz of coords) {
      if (ix === 0 && iz === 0) continue;
      if (ix === 75 && iz === 75) continue;
      pts.push([ix, iz]);
    }
  }
  return pts;
})();

interface SignalLensInstance {
  ix: number;
  iz: number;
  axis: 'NS' | 'EW';
  colorSlot: LightSignal;
  matrix: THREE.Matrix4;
}

const DIM_RED = new THREE.Color('#280a10');
const DIM_YELLOW = new THREE.Color('#281c06');
const DIM_GREEN = new THREE.Color('#07241a');
const LIT_RED = new THREE.Color('#f43f5e');
const LIT_YELLOW = new THREE.Color('#f59e0b');
const LIT_GREEN = new THREE.Color('#10b981');

export const TrafficLightGantry: React.FC<TrafficLightGantryProps> = ({ position = [0, 0, 0] }) => {
  const nsMatNorthRef = useRef<THREE.MeshBasicMaterial>(null);
  const nsMatSouthRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatWestRef = useRef<THREE.MeshBasicMaterial>(null);
  const ewMatEastRef = useRef<THREE.MeshBasicMaterial>(null);

  // 6 shared live 3-lens materials on Central Plaza (0,0) gantries so ALL 8 pods light ONLY the active lens
  const centralLensMats = useMemo(
    () => ({
      nsRed: new THREE.MeshBasicMaterial({ color: '#280a10', toneMapped: false }),
      nsYellow: new THREE.MeshBasicMaterial({ color: '#281c06', toneMapped: false }),
      nsGreen: new THREE.MeshBasicMaterial({ color: '#07241a', toneMapped: false }),
      ewRed: new THREE.MeshBasicMaterial({ color: '#280a10', toneMapped: false }),
      ewYellow: new THREE.MeshBasicMaterial({ color: '#281c06', toneMapped: false }),
      ewGreen: new THREE.MeshBasicMaterial({ color: '#07241a', toneMapped: false }),
    }),
    [],
  );

  React.useEffect(() => {
    return () => {
      Object.values(centralLensMats).forEach((m) => m.dispose());
    };
  }, [centralLensMats]);

  // Instanced dynamic signal lenses for all 11 secondary Central District intersections
  const secondaryLensRef = useRef<THREE.InstancedMesh>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  const system = TrafficLightSystem.getInstance();
  const shadows = QualityManager.current.shadows;

  // Batch ALL crosswalks (pads, stop lines, guide lines, ~400 stripes) + secondary intersection signal masts
  const { crosswalkBuckets, signalStructureBuckets, secondaryLenses } = useMemo(() => {
    const cwBuilder = new InstanceBatchBuilder();
    const sigBuilder = new InstanceBatchBuilder();
    const lenses: SignalLensInstance[] = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler();

    const specs: CrosswalkSpec[] = [
      // Central Grand Boulevard crosswalks seated cleanly outside the 25.6m plaza pad (±12.8m)
      {
        x: 0,
        z: -15.2,
        rot: 0,
        isEwRoad: false,
        span: 21.2,
        padDepth: 3.6,
        stripeDepth: 2.85,
        stripeWidth: 0.82,
        stopOffset: -2.35,
        hasGuideLines: true,
        stripes: GRAND_STRIPE_OFFSETS,
      },
      {
        x: 0,
        z: 15.2,
        rot: Math.PI,
        isEwRoad: false,
        span: 21.2,
        padDepth: 3.6,
        stripeDepth: 2.85,
        stripeWidth: 0.82,
        stopOffset: -2.35,
        hasGuideLines: true,
        stripes: GRAND_STRIPE_OFFSETS,
      },
      {
        x: -15.2,
        z: 0,
        rot: Math.PI / 2,
        isEwRoad: true,
        span: 21.2,
        padDepth: 3.6,
        stripeDepth: 2.85,
        stripeWidth: 0.82,
        stopOffset: -2.35,
        hasGuideLines: true,
        stripes: GRAND_STRIPE_OFFSETS,
      },
      {
        x: 15.2,
        z: 0,
        rot: -Math.PI / 2,
        isEwRoad: true,
        span: 21.2,
        padDepth: 3.6,
        stripeDepth: 2.85,
        stripeWidth: 0.82,
        stopOffset: -2.35,
        hasGuideLines: true,
        stripes: GRAND_STRIPE_OFFSETS,
      },
    ];

    for (const [ix, iz] of SECONDARY_INTERSECTIONS) {
      const nsWidth = ix === 0 ? 22 : 18;
      const ewWidth = iz === 0 ? 22 : 18;
      const nsOffset = ewWidth / 2 + 3.4;
      const ewOffset = nsWidth / 2 + 3.4;

      specs.push(
        {
          x: ix,
          z: iz - nsOffset,
          rot: 0,
          isEwRoad: false,
          span: nsWidth - 0.8,
          padDepth: 3.3,
          stripeDepth: 2.55,
          stripeWidth: 0.78,
          stopOffset: -2.2,
          hasGuideLines: false,
          stripes: nsWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
        },
        {
          x: ix,
          z: iz + nsOffset,
          rot: Math.PI,
          isEwRoad: false,
          span: nsWidth - 0.8,
          padDepth: 3.3,
          stripeDepth: 2.55,
          stripeWidth: 0.78,
          stopOffset: -2.2,
          hasGuideLines: false,
          stripes: nsWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
        },
        {
          x: ix - ewOffset,
          z: iz,
          rot: Math.PI / 2,
          isEwRoad: true,
          span: ewWidth - 0.8,
          padDepth: 3.3,
          stripeDepth: 2.55,
          stripeWidth: 0.78,
          stopOffset: -2.2,
          hasGuideLines: false,
          stripes: ewWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
        },
        {
          x: ix + ewOffset,
          z: iz,
          rot: -Math.PI / 2,
          isEwRoad: true,
          span: ewWidth - 0.8,
          padDepth: 3.3,
          stripeDepth: 2.55,
          stripeWidth: 0.78,
          stopOffset: -2.2,
          hasGuideLines: false,
          stripes: ewWidth === 22 ? GRAND_STRIPE_OFFSETS : SECONDARY_STRIPE_OFFSETS,
        },
      );

      // Add 4 cantilevered curbside traffic signal poles (2 facing NS traffic, 2 facing EW traffic)
      const cornerX = nsWidth * 0.5 + 1.4;
      const cornerZ = ewWidth * 0.5 + 1.4;
      const armReach = 5.4;

      const cornerMasts: {
        px: number;
        pz: number;
        rotY: number;
        axis: 'NS' | 'EW';
      }[] = [
        { px: ix + cornerX, pz: iz - cornerZ, rotY: 0, axis: 'NS' },
        { px: ix - cornerX, pz: iz + cornerZ, rotY: Math.PI, axis: 'NS' },
        { px: ix + cornerX, pz: iz + cornerZ, rotY: -Math.PI / 2, axis: 'EW' },
        { px: ix - cornerX, pz: iz - cornerZ, rotY: Math.PI / 2, axis: 'EW' },
      ];

      for (const mast of cornerMasts) {
        const c = Math.cos(mast.rotY);
        const sn = Math.sin(mast.rotY);

        sigBuilder.addLocal('sig_plinth', mast.px, 0, mast.pz, mast.rotY, 0, 0.3, 0, 0.72, 0.6, 0.72);
        sigBuilder.addLocal('sig_pole', mast.px, 0, mast.pz, mast.rotY, 0, 3.25, 0, 0.26, 5.9, 0.26);
        sigBuilder.addLocal('sig_arm', mast.px, 0, mast.pz, mast.rotY, -armReach * 0.5, 5.85, 0, armReach, 0.18, 0.22);

        const headLocalX = -armReach * 0.78;
        sigBuilder.addLocal('sig_hood', mast.px, 0, mast.pz, mast.rotY, headLocalX, 5.55, 0.16, 1.32, 0.52, 0.26);

        const lensSpecs: [number, LightSignal][] = [
          [-0.38, 'RED'],
          [0, 'YELLOW'],
          [0.38, 'GREEN'],
        ];
        for (const [lx, colorSlot] of lensSpecs) {
          const localX = headLocalX + lx;
          const localZ = 0.3;
          const wx = mast.px + localX * c + localZ * sn;
          const wz = mast.pz - localX * sn + localZ * c;
          p.set(wx, 5.55, wz);
          euler.set(0, mast.rotY, 0);
          q.setFromEuler(euler);
          m4.compose(p, q, s);
          lenses.push({
            ix,
            iz,
            axis: mast.axis,
            colorSlot,
            matrix: m4.clone(),
          });
        }
      }
    }

    for (let i = 0; i < specs.length; i++) {
      const cw = specs[i];
      const roadTop = cw.isEwRoad ? EW_ROAD_TOP : NS_ROAD_TOP;

      cwBuilder.addLocal('cw_pad', cw.x, roadTop + 0.014, cw.z, cw.rot, 0, 0, 0, cw.span, 1, cw.padDepth);
      cwBuilder.addLocal('cw_stop', cw.x, roadTop + 0.02, cw.z, cw.rot, 0, 0, cw.stopOffset, cw.span - 0.6, 1, 0.32);

      if (cw.hasGuideLines) {
        cwBuilder.addLocal('cw_guide', cw.x, roadTop + 0.028, cw.z, cw.rot, 0, 0, -1.68, cw.span - 0.6, 1, 0.1);
        cwBuilder.addLocal('cw_guide', cw.x, roadTop + 0.028, cw.z, cw.rot, 0, 0, 1.68, cw.span - 0.6, 1, 0.1);
      }
      for (let sIdx = 0; sIdx < cw.stripes.length; sIdx++) {
        cwBuilder.addLocal(
          'cw_stripe',
          cw.x,
          roadTop + 0.028,
          cw.z,
          cw.rot,
          cw.stripes[sIdx],
          0,
          0,
          cw.stripeWidth,
          1,
          cw.stripeDepth,
        );
      }
    }

    return {
      crosswalkBuckets: cwBuilder.build(),
      signalStructureBuckets: sigBuilder.build(),
      secondaryLenses: lenses,
    };
  }, []);

  React.useEffect(() => {
    const mesh = secondaryLensRef.current;
    if (!mesh) return;
    for (let i = 0; i < secondaryLenses.length; i++) {
      mesh.setMatrixAt(i, secondaryLenses[i].matrix);
      mesh.setColorAt(i, DIM_RED);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [secondaryLenses]);

  const crosswalkSpecs = useMemo<InstanceBucketSpec[]>(
    () => [
      { key: 'cw_pad', geometry: SHARED_MARKING_PLANE, material: CROSSWALK_PAD_MAT, receiveShadow: shadows, renderOrder: 4 },
      { key: 'cw_stop', geometry: SHARED_MARKING_PLANE, material: STOP_LINE_MAT, renderOrder: 5 },
      { key: 'cw_guide', geometry: SHARED_MARKING_PLANE, material: GUIDE_LINE_MAT, renderOrder: 6 },
      { key: 'cw_stripe', geometry: SHARED_MARKING_PLANE, material: STRIPE_MAT, receiveShadow: shadows, renderOrder: 6 },
    ],
    [shadows],
  );

  const signalStructureSpecs = useMemo<InstanceBucketSpec[]>(
    () => [
      { key: 'sig_plinth', geometry: SHARED_BOX, material: CONCRETE_MAT, receiveShadow: shadows },
      { key: 'sig_pole', geometry: SHARED_CYLINDER, material: STEEL_DARK_MAT, castShadow: shadows },
      { key: 'sig_arm', geometry: SHARED_BOX, material: STEEL_MID_MAT, castShadow: shadows },
      { key: 'sig_hood', geometry: SHARED_BOX, material: HOOD_MAT },
    ],
    [shadows],
  );

  useFrame((_, delta) => {
    system.update(delta);
    const st = system.getState();
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const hdrGain = 1.3 + nightFactor * 1.65;

    const getColor = (sig: LightSignal) =>
      sig === 'GREEN' ? '#10b981' : sig === 'YELLOW' ? '#f59e0b' : '#f43f5e';

    const nsCol = getColor(st.nsSignal);
    const ewCol = getColor(st.ewSignal);

    if (nsMatNorthRef.current) nsMatNorthRef.current.color.set(nsCol).multiplyScalar(hdrGain);
    if (nsMatSouthRef.current) nsMatSouthRef.current.color.set(nsCol).multiplyScalar(hdrGain);
    if (ewMatWestRef.current) ewMatWestRef.current.color.set(ewCol).multiplyScalar(hdrGain);
    if (ewMatEastRef.current) ewMatEastRef.current.color.set(ewCol).multiplyScalar(hdrGain);

    // Light ONLY the active lens on ALL Central Plaza 3-lens signal pods
    centralLensMats.nsRed.color.copy(st.nsSignal === 'RED' ? LIT_RED : DIM_RED);
    if (st.nsSignal === 'RED') centralLensMats.nsRed.color.multiplyScalar(hdrGain * 1.25);

    centralLensMats.nsYellow.color.copy(st.nsSignal === 'YELLOW' ? LIT_YELLOW : DIM_YELLOW);
    if (st.nsSignal === 'YELLOW') centralLensMats.nsYellow.color.multiplyScalar(hdrGain * 1.25);

    centralLensMats.nsGreen.color.copy(st.nsSignal === 'GREEN' ? LIT_GREEN : DIM_GREEN);
    if (st.nsSignal === 'GREEN') centralLensMats.nsGreen.color.multiplyScalar(hdrGain * 1.25);

    centralLensMats.ewRed.color.copy(st.ewSignal === 'RED' ? LIT_RED : DIM_RED);
    if (st.ewSignal === 'RED') centralLensMats.ewRed.color.multiplyScalar(hdrGain * 1.25);

    centralLensMats.ewYellow.color.copy(st.ewSignal === 'YELLOW' ? LIT_YELLOW : DIM_YELLOW);
    if (st.ewSignal === 'YELLOW') centralLensMats.ewYellow.color.multiplyScalar(hdrGain * 1.25);

    centralLensMats.ewGreen.color.copy(st.ewSignal === 'GREEN' ? LIT_GREEN : DIM_GREEN);
    if (st.ewSignal === 'GREEN') centralLensMats.ewGreen.color.multiplyScalar(hdrGain * 1.25);

    // Update all secondary intersection lenses in lockstep with TrafficLightSystem.getSignalAtIntersection
    const mesh = secondaryLensRef.current;
    if (mesh) {
      for (let i = 0; i < secondaryLenses.length; i++) {
        const l = secondaryLenses[i];
        const sigState = system.getSignalAtIntersection(l.ix, l.iz);
        const activeSig = l.axis === 'NS' ? sigState.nsSignal : sigState.ewSignal;
        const isLit = activeSig === l.colorSlot;
        if (l.colorSlot === 'RED') colorScratch.copy(isLit ? LIT_RED : DIM_RED);
        else if (l.colorSlot === 'YELLOW') colorScratch.copy(isLit ? LIT_YELLOW : DIM_YELLOW);
        else colorScratch.copy(isLit ? LIT_GREEN : DIM_GREEN);

        if (isLit) colorScratch.multiplyScalar(hdrGain * 1.2);
        mesh.setColorAt(i, colorScratch);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  const gantries = [
    { pos: [0, 0, -12.6] as [number, number, number], rot: 0, ref: nsMatNorthRef, axis: 'NS' as const, defaultColor: '#10b981' },
    { pos: [0, 0, 12.6] as [number, number, number], rot: Math.PI, ref: nsMatSouthRef, axis: 'NS' as const, defaultColor: '#10b981' },
    { pos: [-12.6, 0, 0] as [number, number, number], rot: Math.PI / 2, ref: ewMatWestRef, axis: 'EW' as const, defaultColor: '#f43f5e' },
    { pos: [12.6, 0, 0] as [number, number, number], rot: -Math.PI / 2, ref: ewMatEastRef, axis: 'EW' as const, defaultColor: '#f43f5e' },
  ];

  return (
    <group position={position} name="IntersectionGantriesAndCrosswalks">
      {/* Wide-Span Structural Truss Overhead Signal Gantries (Straddling 22m Grand Boulevards at 0,0) */}
      {gantries.map((g, idx) => (
        <group key={idx} position={g.pos} rotation={[0, g.rot, 0]}>
          {([-12.2, 12.2] as const).map((px, pIdx) => (
            <group key={`mast-${pIdx}`} position={[px, 0, 0]}>
              <mesh position={[0, 0.35, 0]} geometry={SHARED_BOX} material={CONCRETE_MAT} scale={[0.92, 0.7, 0.92]} receiveShadow />
              <mesh position={[0, 0.76, 0]} geometry={SHARED_CYLINDER} material={STEEL_MID_MAT} scale={[0.62, 0.14, 0.62]} />
              <mesh position={[0, 4.15, 0]} geometry={SHARED_TAPER_POLE} material={STEEL_DARK_MAT} scale={[1, 6.9, 1]} castShadow />
              <mesh position={[px < 0 ? -0.34 : 0.34, 2.2, 0]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[0.42, 0.95, 0.46]} />
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
              <mesh geometry={SHARED_BOX} material={HOOD_MAT} scale={[1.45, 0.62, 0.24]} />
              <mesh position={[0, 0.26, 0.18]} geometry={SHARED_BOX} material={STEEL_MID_MAT} scale={[1.48, 0.07, 0.34]} />
              {([-0.42, 0, 0.42] as const).map((lx, lIdx) => {
                const lensMat =
                  g.axis === 'NS'
                    ? lIdx === 0
                      ? centralLensMats.nsRed
                      : lIdx === 1
                        ? centralLensMats.nsYellow
                        : centralLensMats.nsGreen
                    : lIdx === 0
                      ? centralLensMats.ewRed
                      : lIdx === 1
                        ? centralLensMats.ewYellow
                        : centralLensMats.ewGreen;
                return (
                  <mesh
                    key={`lens-${lIdx}`}
                    position={[lx, 0, 0.14]}
                    rotation={[Math.PI / 2, 0, 0]}
                    geometry={SHARED_CYLINDER}
                    material={lensMat}
                    scale={[0.24, 0.06, 0.24]}
                  />
                );
              })}
            </group>
          ))}
        </group>
      ))}

      {/* Instanced Signal Masts & Live Synchronized Traffic Light Lenses Across All Secondary Intersections */}
      <InstancedBatchLayer buckets={signalStructureBuckets} specs={signalStructureSpecs} name="SecondaryTrafficSignalMasts" />
      <instancedMesh
        ref={secondaryLensRef}
        args={[SHARED_LENS, undefined, secondaryLenses.length]}
        frustumCulled={false}
      >
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>

      {/* Unified Instanced Zebra Crosswalks (4 draw calls total, zero thin-box Z-fighting) */}
      <InstancedBatchLayer buckets={crosswalkBuckets} specs={crosswalkSpecs} name="BatchedZebraCrosswalks" />
    </group>
  );
};
