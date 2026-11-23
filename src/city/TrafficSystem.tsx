import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import { WorldPhysicsEngine } from '../world/WorldPhysicsEngine';
import {
  createSkyCruiserGeometry,
  createTrafficCarModelSet,
  TrafficCarArchetype,
  TrafficCarModelSet,
} from './TrafficCarGeometry';
import { createInitialTrafficFleet, stepTrafficFleet, TrafficCarAgent } from './TrafficNavigation';

interface TrafficSystemProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface SkyAgent {
  axis: 'NS' | 'EW';
  avenueCoord: number;
  laneOffset: number;
  coord: number;
  dir: 1 | -1;
  speed: number;
  altitude: number;
  trimColor: string;
  phase: number;
}

const ARCHETYPES: readonly TrafficCarArchetype[] = ['SEDAN', 'SUV', 'COUPE', 'VAN'];
const GROUND_CAR_COUNT = 88; // 22 per distinct sculpted car archetype
const PER_ARCHETYPE_MAX = Math.ceil(GROUND_CAR_COUNT / ARCHETYPES.length);
const SKY_VEHICLE_COUNT = 44;

// Seated flush on road top surface (EW road top = 0.065, NS = 0.040, junction = 0.080)
const ROAD_CONTACT_Y = 0.068;

export const TrafficSystem: React.FC<TrafficSystemProps> = ({ playerPosRef }) => {
  // Per-archetype GPU instanced mesh refs (4 distinct sculpted car models × 5 parts = 20 draw calls total)
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const glassRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const wheelRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const headRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);
  const tailRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);

  const headMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([null, null, null, null]);

  // Smooth sculpted aerial sky-cruiser refs
  const skyBodyRef = useRef<THREE.InstancedMesh>(null);
  const skyCanopyRef = useRef<THREE.InstancedMesh>(null);
  const skyWingRef = useRef<THREE.InstancedMesh>(null);
  const skyThrusterRef = useRef<THREE.InstancedMesh>(null);
  const skyThrusterMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  // Build all 4 distinct, 100% smooth compound-curved procedural car models once
  const modelSets = useMemo<TrafficCarModelSet[]>(
    () => ARCHETYPES.map((arch) => createTrafficCarModelSet(arch)),
    [],
  );

  const skyGeos = useMemo(() => createSkyCruiserGeometry(), []);

  // Shared PBR materials across archetypes
  const sharedMats = useMemo(() => {
    const bodyPaint = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0.58,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
    const tintedGlass = new THREE.MeshPhysicalMaterial({
      color: '#0a1322',
      metalness: 0.28,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    const wheelRubber = new THREE.MeshStandardMaterial({
      color: '#1b2029',
      metalness: 0.24,
      roughness: 0.62,
    });
    const tailLightMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
    });
    return { bodyPaint, tintedGlass, wheelRubber, tailLightMat };
  }, []);

  const groundAgents = useMemo<TrafficCarAgent[]>(() => createInitialTrafficFleet(GROUND_CAR_COUNT), []);

  const skyAgents = useMemo<SkyAgent[]>(() => {
    const list: SkyAgent[] = [];
    const skyCorridors = [-420, -300, -180, -90, -24, 24, 90, 180, 300, 420];
    for (let i = 0; i < SKY_VEHICLE_COUNT; i++) {
      const axis = i % 2 === 0 ? 'NS' : 'EW';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const avenueCoord = skyCorridors[Math.floor(i / 2) % skyCorridors.length];
      list.push({
        axis,
        avenueCoord,
        laneOffset: (dir === 1 ? 14 : -14) + (i % 3) * 5,
        coord: ((i * 67) % 1120) - 560,
        dir,
        speed: 28 + (i % 5) * 5.5,
        altitude: 38 + (i % 6) * 12,
        trimColor: i % 3 === 0 ? '#10b981' : i % 2 === 0 ? '#38bdf8' : '#f59e0b',
        phase: i * 1.15,
      });
    }
    return list;
  }, []);

  // Upload static per-car paint colors & headlight tints once on mount, and dispose GPU resources cleanly on unmount
  useEffect(() => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < groundAgents.length; i++) {
      const car = groundAgents[i];
      const aIdx = ARCHETYPES.indexOf(car.archetype);
      const slot = counts[aIdx]++;
      bodyRefs.current[aIdx]?.setColorAt(slot, colorObj.set(car.bodyColor));
      headRefs.current[aIdx]?.setColorAt(slot, colorObj.set(car.trimColor));
      tailRefs.current[aIdx]?.setColorAt(slot, colorObj.set('#e11d48'));
    }
    for (let aIdx = 0; aIdx < ARCHETYPES.length; aIdx++) {
      const b = bodyRefs.current[aIdx];
      const h = headRefs.current[aIdx];
      const tl = tailRefs.current[aIdx];
      if (b?.instanceColor) b.instanceColor.needsUpdate = true;
      if (h?.instanceColor) h.instanceColor.needsUpdate = true;
      if (tl?.instanceColor) tl.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < skyAgents.length; i++) {
      skyThrusterRef.current?.setColorAt(i, colorObj.set(skyAgents[i].trimColor));
    }
    if (skyThrusterRef.current?.instanceColor) skyThrusterRef.current.instanceColor.needsUpdate = true;

    return () => {
      for (const m of modelSets) {
        m.bodyGeo.dispose();
        m.glassGeo.dispose();
        m.wheelsGeo.dispose();
        m.headlightGeo.dispose();
        m.taillightGeo.dispose();
      }
      skyGeos.fuselageGeo.dispose();
      skyGeos.canopyGeo.dispose();
      skyGeos.wingGeo.dispose();
      skyGeos.thrusterGeo.dispose();
      sharedMats.bodyPaint.dispose();
      sharedMats.tintedGlass.dispose();
      sharedMats.wheelRubber.dispose();
      sharedMats.tailLightMat.dispose();
    };
  }, [groundAgents, skyAgents, modelSets, skyGeos, sharedMats, colorObj]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const lights = TrafficLightSystem.getInstance();
    const speedScale = LivingCityEventSystem.getInstance().getState().trafficSpeedMultiplier;
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const physics = WorldPhysicsEngine.getInstance();
    const roadSurface = physics.getSurfaceAt(0, 0);
    const roadGripScale = THREE.MathUtils.clamp(roadSurface.frictionMu / 0.94, 0.42, 1.05);
    const aeroAirScale = THREE.MathUtils.clamp(1.225 / physics.getAirDensity(), 0.9, 1.04);

    const headHdrGain = 1.05 + nightFactor * 1.7;
    for (let aIdx = 0; aIdx < ARCHETYPES.length; aIdx++) {
      const mat = headMatRefs.current[aIdx];
      if (mat) mat.color.setScalar(headHdrGain);
    }
    if (skyThrusterMatRef.current) {
      skyThrusterMatRef.current.color.setScalar(1.05 + nightFactor * 1.65);
    }

    const pPos = playerPosRef?.current;
    const playerX = pPos ? pPos.x : 0;
    const playerZ = pPos ? pPos.z : 0;
    const lod = QualityManager.current.LODQuality;
    const activeGroundCount = lod === 'LOW' ? 36 : lod === 'MEDIUM' ? 60 : groundAgents.length;
    const activeSkyCount = lod === 'LOW' ? 16 : lod === 'MEDIUM' ? 30 : skyAgents.length;

    // 1. Advance all active NPC wheeled cars with smooth turning, traffic lights, and car following
    stepTrafficFleet(groundAgents, {
      dt,
      lights,
      speedScale,
      roadGripScale,
      aeroAirScale,
      playerPos: pPos ? { x: playerX, z: playerZ } : null,
      activeCount: activeGroundCount,
    });

    // 2. Upload transforms & reactive brake-light colors per archetype
    const archCounts = [0, 0, 0, 0];
    const runningTailGain = 0.72 + nightFactor * 0.9;
    const brakingTailGain = 2.65 + nightFactor * 1.9;

    for (let i = 0; i < activeGroundCount; i++) {
      const car = groundAgents[i];
      const aIdx = ARCHETYPES.indexOf(car.archetype);
      const slot = archCounts[aIdx]++;

      const bMesh = bodyRefs.current[aIdx];
      const gMesh = glassRefs.current[aIdx];
      const wMesh = wheelRefs.current[aIdx];
      const hMesh = headRefs.current[aIdx];
      const tMesh = tailRefs.current[aIdx];
      if (!bMesh || !gMesh || !wMesh || !hMesh || !tMesh) continue;

      // Grounded wheel assembly sits flat on road without body roll
      dummy.position.set(car.x, ROAD_CONTACT_Y, car.z);
      dummy.rotation.set(0, car.yaw, 0, 'YXZ');
      dummy.updateMatrix();
      wMesh.setMatrixAt(slot, dummy.matrix);

      // Sprung body, glass & lights carry authentic smooth cornering roll + braking nose-dive pitch
      dummy.rotation.set(car.pitch, car.yaw, car.roll, 'YXZ');
      dummy.updateMatrix();
      bMesh.setMatrixAt(slot, dummy.matrix);
      gMesh.setMatrixAt(slot, dummy.matrix);
      hMesh.setMatrixAt(slot, dummy.matrix);
      tMesh.setMatrixAt(slot, dummy.matrix);

      // Reactive brake lights flare bright HDR crimson whenever stopping at red lights or queuing
      const tailGain = car.isBraking ? brakingTailGain : runningTailGain;
      colorObj.setRGB(1.0 * tailGain, 0.14 * tailGain, 0.18 * tailGain);
      tMesh.setColorAt(slot, colorObj);
    }

    for (let aIdx = 0; aIdx < ARCHETYPES.length; aIdx++) {
      const cnt = archCounts[aIdx];
      const bMesh = bodyRefs.current[aIdx];
      const gMesh = glassRefs.current[aIdx];
      const wMesh = wheelRefs.current[aIdx];
      const hMesh = headRefs.current[aIdx];
      const tMesh = tailRefs.current[aIdx];
      if (!bMesh || !gMesh || !wMesh || !hMesh || !tMesh) continue;

      bMesh.count = cnt;
      gMesh.count = cnt;
      wMesh.count = cnt;
      hMesh.count = cnt;
      tMesh.count = cnt;
      bMesh.instanceMatrix.needsUpdate = true;
      gMesh.instanceMatrix.needsUpdate = true;
      wMesh.instanceMatrix.needsUpdate = true;
      hMesh.instanceMatrix.needsUpdate = true;
      tMesh.instanceMatrix.needsUpdate = true;
      if (tMesh.instanceColor) tMesh.instanceColor.needsUpdate = true;
    }

    // 3. Advance distant aerial sky-cruisers
    if (skyBodyRef.current && skyCanopyRef.current && skyWingRef.current && skyThrusterRef.current) {
      const skyWrap = 580;
      for (let i = 0; i < activeSkyCount; i++) {
        const s = skyAgents[i];
        s.coord += s.speed * s.dir * dt;
        const anchorAlong = s.axis === 'NS' ? playerZ : playerX;
        const anchorPerp = s.axis === 'NS' ? playerX : playerZ;

        if (s.coord > anchorAlong + skyWrap) s.coord = anchorAlong - skyWrap;
        else if (s.coord < anchorAlong - skyWrap) s.coord = anchorAlong + skyWrap;

        if (Math.abs(s.avenueCoord - anchorPerp) > 520) {
          s.avenueCoord = anchorPerp + ((i % 7) - 3) * 120;
        }

        const rotY =
          s.axis === 'NS'
            ? s.dir === 1
              ? 0
              : Math.PI
            : s.dir === 1
              ? Math.PI / 2
              : -Math.PI / 2;
        const skyLine = s.avenueCoord + s.laneOffset;
        const px = s.axis === 'NS' ? skyLine : s.coord;
        const pz = s.axis === 'NS' ? s.coord : skyLine;
        const skyY = s.altitude + Math.sin(t * 2.4 + s.phase) * 0.25;

        dummy.position.set(px, skyY, pz);
        dummy.rotation.set(0, rotY, Math.sin(t * 1.4 + s.phase) * 0.04, 'YXZ');
        dummy.updateMatrix();
        skyBodyRef.current.setMatrixAt(i, dummy.matrix);
        skyCanopyRef.current.setMatrixAt(i, dummy.matrix);
        skyWingRef.current.setMatrixAt(i, dummy.matrix);
        skyThrusterRef.current.setMatrixAt(i, dummy.matrix);
      }
      skyBodyRef.current.count = activeSkyCount;
      skyCanopyRef.current.count = activeSkyCount;
      skyWingRef.current.count = activeSkyCount;
      skyThrusterRef.current.count = activeSkyCount;
      skyBodyRef.current.instanceMatrix.needsUpdate = true;
      skyCanopyRef.current.instanceMatrix.needsUpdate = true;
      skyWingRef.current.instanceMatrix.needsUpdate = true;
      skyThrusterRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="TrafficSystemLayer">
      {/* 4 Distinct Smooth Sculpted Wheeled Car Archetypes (SEDAN, SUV, COUPE, VAN) */}
      {modelSets.map((model, aIdx) => (
        <group key={model.archetype} name={`TrafficArchetype_${model.archetype}`}>
          <instancedMesh
            ref={(el) => {
              bodyRefs.current[aIdx] = el;
            }}
            args={[model.bodyGeo, sharedMats.bodyPaint, PER_ARCHETYPE_MAX]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(el) => {
              glassRefs.current[aIdx] = el;
            }}
            args={[model.glassGeo, sharedMats.tintedGlass, PER_ARCHETYPE_MAX]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(el) => {
              wheelRefs.current[aIdx] = el;
            }}
            args={[model.wheelsGeo, sharedMats.wheelRubber, PER_ARCHETYPE_MAX]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(el) => {
              headRefs.current[aIdx] = el;
            }}
            args={[model.headlightGeo, undefined, PER_ARCHETYPE_MAX]}
            frustumCulled={false}
          >
            <meshBasicMaterial
              ref={(el) => {
                headMatRefs.current[aIdx] = el;
              }}
              color="#ffffff"
              toneMapped={false}
            />
          </instancedMesh>
          <instancedMesh
            ref={(el) => {
              tailRefs.current[aIdx] = el;
            }}
            args={[model.taillightGeo, sharedMats.tailLightMat, PER_ARCHETYPE_MAX]}
            frustumCulled={false}
          />
        </group>
      ))}

      {/* Smooth Sculpted Aerial Sky-Cruisers */}
      <instancedMesh ref={skyBodyRef} args={[skyGeos.fuselageGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
      </instancedMesh>
      <instancedMesh
        ref={skyCanopyRef}
        args={[skyGeos.canopyGeo, undefined, SKY_VEHICLE_COUNT]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#090d16" metalness={0.95} roughness={0.08} />
      </instancedMesh>
      <instancedMesh ref={skyWingRef} args={[skyGeos.wingGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.24} />
      </instancedMesh>
      <instancedMesh
        ref={skyThrusterRef}
        args={[skyGeos.thrusterGeo, undefined, SKY_VEHICLE_COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial ref={skyThrusterMatRef} color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
