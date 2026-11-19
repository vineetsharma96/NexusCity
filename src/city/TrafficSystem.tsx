import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import { WorldPhysicsEngine } from '../world/WorldPhysicsEngine';

interface TrafficSystemProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface VehicleAgent {
  axis: 'NS' | 'EW';
  avenueCoord: number;
  laneOffset: number;
  coord: number;
  dir: 1 | -1;
  speed: number;
  maxSpeed: number;
  altitude: number;
  color: string;
  trimColor: string;
  phase: number;
}

const VEHICLE_COUNT = 128;
const SKY_VEHICLE_COUNT = 56;

const NS_AVENUES = [0, 0, -75, -165, 165, -180, 180, -300, 300, -420, 420];
const EW_AVENUES = [0, 0, -75, 75, -165, 165, -180, 180, -300, 300, -420, 420];

export const TrafficSystem: React.FC<TrafficSystemProps> = ({ playerPosRef }) => {
  const groundBodyRef = useRef<THREE.InstancedMesh>(null);
  const groundCabinRef = useRef<THREE.InstancedMesh>(null);
  const groundFenderRef = useRef<THREE.InstancedMesh>(null);
  const groundLightBarRef = useRef<THREE.InstancedMesh>(null);
  const groundTailLightRef = useRef<THREE.InstancedMesh>(null);
  const groundThrusterRef = useRef<THREE.InstancedMesh>(null);
  const groundWingRef = useRef<THREE.InstancedMesh>(null);

  const skyBodyRef = useRef<THREE.InstancedMesh>(null);
  const skyCabinRef = useRef<THREE.InstancedMesh>(null);
  const skyThrusterRef = useRef<THREE.InstancedMesh>(null);
  const skyWingRef = useRef<THREE.InstancedMesh>(null);

  const groundLightBarMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const groundTailLightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const groundWingMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const skyThrusterMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  const groundAgents = useMemo<VehicleAgent[]>(() => {
    const palette = ['#0b1120', '#111827', '#1e293b', '#172554', '#0f172a', '#1e1b4b'];
    const trims = ['#e0f2fe', '#38bdf8', '#fef3c7', '#67e8f9'];
    const list: VehicleAgent[] = [];
    for (let i = 0; i < VEHICLE_COUNT; i++) {
      const axis = i % 2 === 0 ? 'NS' : 'EW';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const avenuePool = axis === 'NS' ? NS_AVENUES : EW_AVENUES;
      const avenueCoord = avenuePool[Math.floor(i / 2) % avenuePool.length];
      // Multi-lane boulevard distribution: 2 distinct lanes per direction on widened roads
      const isOuterLane = Math.floor(i / 4) % 2 === 1;
      const absLane = avenueCoord === 0 ? (isOuterLane ? 6.8 : 3.2) : isOuterLane ? 5.6 : 2.7;
      const laneOffset = dir === 1 ? absLane : -absLane;
      const coord = ((i * 53) % 880) - 440;
      const maxSpeed = (isOuterLane ? 12.5 : 16.5) + (i % 5) * 2.2;
      list.push({
        axis,
        avenueCoord,
        laneOffset,
        coord,
        dir,
        speed: maxSpeed,
        maxSpeed,
        altitude: 0.46,
        color: palette[i % palette.length],
        trimColor: trims[i % trims.length],
        phase: i * 0.77,
      });
    }
    return list;
  }, []);

  const skyAgents = useMemo<VehicleAgent[]>(() => {
    const list: VehicleAgent[] = [];
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
        maxSpeed: 28 + (i % 5) * 5.5,
        altitude: 36 + (i % 6) * 12,
        color: '#0f172a',
        trimColor: i % 3 === 0 ? '#10b981' : i % 2 === 0 ? '#38bdf8' : '#f59e0b',
        phase: i * 1.15,
      });
    }
    return list;
  }, []);

  // Multi-part aerodynamic vehicle geometries
  const chassisGeo = useMemo(() => new THREE.BoxGeometry(1.88, 0.44, 4.15), []);
  const cabinGeo = useMemo(() => new THREE.BoxGeometry(1.42, 0.36, 2.15), []);
  const fenderGeo = useMemo(() => new THREE.BoxGeometry(2.14, 0.24, 3.35), []);
  const thrusterCrossGeo = useMemo(() => new THREE.BoxGeometry(2.26, 0.14, 1.85), []);
  const headLightBarGeo = useMemo(() => new THREE.BoxGeometry(1.78, 0.11, 0.18), []);
  const tailLightBarGeo = useMemo(() => new THREE.BoxGeometry(1.82, 0.12, 0.16), []);
  const spoilerWingGeo = useMemo(() => new THREE.BoxGeometry(1.86, 0.08, 0.36), []);

  const skyGeo = useMemo(() => new THREE.BoxGeometry(1.75, 0.38, 4.6), []);
  const skyCabinGeo = useMemo(() => new THREE.BoxGeometry(1.26, 0.28, 2.25), []);
  const skyThrusterGeo = useMemo(() => new THREE.BoxGeometry(2.45, 0.12, 3.8), []);
  const skyWingGeo = useMemo(() => new THREE.BoxGeometry(3.2, 0.08, 1.15), []);

  // Upload static vehicle colors once on mount instead of every frame
  React.useEffect(() => {
    for (let i = 0; i < groundAgents.length; i++) {
      const v = groundAgents[i];
      groundBodyRef.current?.setColorAt(i, colorObj.set(v.color));
      groundLightBarRef.current?.setColorAt(i, colorObj.set(v.trimColor));
      groundWingRef.current?.setColorAt(i, colorObj.set(i % 2 === 0 ? '#38bdf8' : '#f59e0b'));
    }
    if (groundBodyRef.current?.instanceColor) groundBodyRef.current.instanceColor.needsUpdate = true;
    if (groundLightBarRef.current?.instanceColor) groundLightBarRef.current.instanceColor.needsUpdate = true;
    if (groundWingRef.current?.instanceColor) groundWingRef.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < skyAgents.length; i++) {
      const s = skyAgents[i];
      skyThrusterRef.current?.setColorAt(i, colorObj.set(s.trimColor));
    }
    if (skyThrusterRef.current?.instanceColor) skyThrusterRef.current.instanceColor.needsUpdate = true;
  }, [groundAgents, skyAgents, colorObj]);

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
    const vehicleHdrGain = 1.05 + nightFactor * 1.65;
    if (groundLightBarMatRef.current) groundLightBarMatRef.current.color.setScalar(vehicleHdrGain * 1.1);
    if (groundTailLightMatRef.current) groundTailLightMatRef.current.color.set('#f43f5e').multiplyScalar(vehicleHdrGain * 1.15);
    if (groundWingMatRef.current) groundWingMatRef.current.color.setScalar(vehicleHdrGain * 0.85);
    if (skyThrusterMatRef.current) skyThrusterMatRef.current.color.setScalar(vehicleHdrGain * 1.15);

    const pPos = playerPosRef?.current;
    const playerX = pPos ? pPos.x : 0;
    const playerZ = pPos ? pPos.z : 0;
    const lod = QualityManager.current.LODQuality;
    const activeGroundCount = lod === 'LOW' ? 44 : lod === 'MEDIUM' ? 84 : groundAgents.length;
    const activeSkyCount = lod === 'LOW' ? 20 : lod === 'MEDIUM' ? 38 : skyAgents.length;

    if (
      groundBodyRef.current &&
      groundCabinRef.current &&
      groundFenderRef.current &&
      groundLightBarRef.current &&
      groundTailLightRef.current &&
      groundThrusterRef.current &&
      groundWingRef.current
    ) {
      const wrapSpan = 460;
      const trafficLerp = Math.min(1, dt * 5.0 * roadGripScale);
      const weatherSpeedCap = (0.76 + 0.24 * roadGripScale) * aeroAirScale;
      for (let i = 0; i < activeGroundCount; i++) {
        const v = groundAgents[i];
        const canGo = v.avenueCoord === 0 ? lights.canProceed(v.axis, v.coord, v.dir) : true;
        const targetSpeed = canGo ? v.maxSpeed * speedScale * weatherSpeedCap : 0;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, trafficLerp);
        v.coord += v.speed * v.dir * dt;

        const anchorAlong = v.axis === 'NS' ? playerZ : playerX;
        const anchorPerp = v.axis === 'NS' ? playerX : playerZ;

        // Secondary central avenues (±75, ±165) terminate at the Central Ring Perimeter [-162..162]
        const isCentralBounded = Math.abs(v.avenueCoord) === 75 || Math.abs(v.avenueCoord) === 165;
        if (isCentralBounded) {
          if (v.coord > 162) v.coord = -162;
          else if (v.coord < -162) v.coord = 162;
        } else {
          if (v.coord > anchorAlong + wrapSpan) {
            v.coord = anchorAlong - wrapSpan;
          } else if (v.coord < anchorAlong - wrapSpan) {
            v.coord = anchorAlong + wrapSpan;
          }
        }

        // Keep outer-fleet vehicles streamed onto real chunk avenues (±180, ±300, ±420...) near the player
        if (!isCentralBounded && i >= 40 && Math.abs(v.avenueCoord - anchorPerp) > 420) {
          const baseChunk = Math.floor(anchorPerp / 120);
          const ringOffset = (i % 5) - 2;
          let candidateAve = (baseChunk + ringOffset + 0.5) * 120;
          if (Math.abs(candidateAve) < 175) {
            candidateAve = candidateAve >= 0 ? 180 : -180;
          }
          v.avenueCoord = candidateAve;
        }

        // Strictly prevent vehicles from entering either car-free Park Sanctuary:
        // 1) (0, 240) Park Sanctuary: x in [-38..38], z in [202..278]
        if (v.axis === 'NS' && Math.abs(v.avenueCoord) < 38 && v.coord > 198 && v.coord < 282) {
          v.coord = v.dir === 1 ? 284 : 196;
        }
        // 2) (75, 75) Park Sanctuary: x in [38..112], z in [38..112]
        if (Math.abs(v.avenueCoord - 75) < 38 && v.coord > 36 && v.coord < 114) {
          v.coord = v.dir === 1 ? 116 : 34;
        }

        const rotY =
          v.axis === 'NS'
            ? v.dir === 1
              ? 0
              : Math.PI
            : v.dir === 1
            ? Math.PI / 2
            : -Math.PI / 2;
        const sinY = Math.sin(rotY);
        const cosY = Math.cos(rotY);
        const roadLine = v.avenueCoord + v.laneOffset;
        const px = v.axis === 'NS' ? roadLine : v.coord;
        const pz = v.axis === 'NS' ? v.coord : roadLine;
        const hoverY = v.altitude + Math.sin(t * 3.2 + v.phase) * 0.025;

        // 1. Lower Aerodynamic Monocoque Chassis
        dummy.position.set(px, hoverY, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        groundBodyRef.current.setMatrixAt(i, dummy.matrix);

        // 2. Sculpted Wheel-Arch Fender Pontoons & Side Skirts
        dummy.position.set(px, hoverY - 0.08, pz);
        dummy.updateMatrix();
        groundFenderRef.current.setMatrixAt(i, dummy.matrix);

        // 3. Recessed Glazed Cockpit Canopy (slightly aft for sports-coupe proportion)
        dummy.position.set(px - sinY * 0.16, hoverY + 0.36, pz - cosY * 0.16);
        dummy.updateMatrix();
        groundCabinRef.current.setMatrixAt(i, dummy.matrix);

        // 4. Outboard Mag-Lev Thruster Nacelle Frame
        dummy.position.set(px, hoverY - 0.16, pz);
        dummy.updateMatrix();
        groundThrusterRef.current.setMatrixAt(i, dummy.matrix);

        // 5. Crisp Front HDR Headlamp Bar (+Z local)
        dummy.position.set(px + sinY * 2.04, hoverY + 0.02, pz + cosY * 2.04);
        dummy.updateMatrix();
        groundLightBarRef.current.setMatrixAt(i, dummy.matrix);

        // 6. Dedicated Crimson HDR Rear Taillight Blade (-Z local)
        dummy.position.set(px - sinY * 2.05, hoverY + 0.06, pz - cosY * 2.05);
        dummy.updateMatrix();
        groundTailLightRef.current.setMatrixAt(i, dummy.matrix);

        // 7. Elevated Rear Aero Wing
        dummy.position.set(px - sinY * 1.72, hoverY + 0.36, pz - cosY * 1.72);
        dummy.updateMatrix();
        groundWingRef.current.setMatrixAt(i, dummy.matrix);
      }
      groundBodyRef.current.count = activeGroundCount;
      groundCabinRef.current.count = activeGroundCount;
      groundFenderRef.current.count = activeGroundCount;
      groundThrusterRef.current.count = activeGroundCount;
      groundLightBarRef.current.count = activeGroundCount;
      groundTailLightRef.current.count = activeGroundCount;
      groundWingRef.current.count = activeGroundCount;
      groundBodyRef.current.instanceMatrix.needsUpdate = true;
      groundCabinRef.current.instanceMatrix.needsUpdate = true;
      groundFenderRef.current.instanceMatrix.needsUpdate = true;
      groundThrusterRef.current.instanceMatrix.needsUpdate = true;
      groundLightBarRef.current.instanceMatrix.needsUpdate = true;
      groundTailLightRef.current.instanceMatrix.needsUpdate = true;
      groundWingRef.current.instanceMatrix.needsUpdate = true;
    }

    if (skyBodyRef.current && skyCabinRef.current && skyThrusterRef.current && skyWingRef.current) {
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
        const sinY = Math.sin(rotY);
        const cosY = Math.cos(rotY);
        const skyLine = s.avenueCoord + s.laneOffset;
        const px = s.axis === 'NS' ? skyLine : s.coord;
        const pz = s.axis === 'NS' ? s.coord : skyLine;
        const skyY = s.altitude + Math.sin(t * 2.4 + s.phase) * 0.25;

        dummy.position.set(px, skyY, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        skyBodyRef.current.setMatrixAt(i, dummy.matrix);
        skyThrusterRef.current.setMatrixAt(i, dummy.matrix);

        dummy.position.set(px + sinY * 0.2, skyY + 0.3, pz + cosY * 0.2);
        dummy.updateMatrix();
        skyCabinRef.current.setMatrixAt(i, dummy.matrix);

        dummy.position.set(px - sinY * 1.1, skyY + 0.06, pz - cosY * 1.1);
        dummy.updateMatrix();
        skyWingRef.current.setMatrixAt(i, dummy.matrix);
      }
      skyBodyRef.current.count = activeSkyCount;
      skyCabinRef.current.count = activeSkyCount;
      skyThrusterRef.current.count = activeSkyCount;
      skyWingRef.current.count = activeSkyCount;
      skyBodyRef.current.instanceMatrix.needsUpdate = true;
      skyCabinRef.current.instanceMatrix.needsUpdate = true;
      skyThrusterRef.current.instanceMatrix.needsUpdate = true;
      skyWingRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="TrafficSystemLayer">
      <instancedMesh ref={groundBodyRef} args={[chassisGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" metalness={0.92} roughness={0.16} />
      </instancedMesh>
      <instancedMesh ref={groundFenderRef} args={[fenderGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#111827" metalness={0.88} roughness={0.26} />
      </instancedMesh>
      <instancedMesh ref={groundCabinRef} args={[cabinGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#090d16" metalness={0.96} roughness={0.08} />
      </instancedMesh>
      <instancedMesh ref={groundThrusterRef} args={[thrusterCrossGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
      </instancedMesh>
      <instancedMesh ref={groundLightBarRef} args={[headLightBarGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={groundLightBarMatRef} color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={groundTailLightRef} args={[tailLightBarGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={groundTailLightMatRef} color="#f43f5e" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={groundWingRef} args={[spoilerWingGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={groundWingMatRef} color="#ffffff" toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={skyBodyRef} args={[skyGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
      </instancedMesh>
      <instancedMesh ref={skyCabinRef} args={[skyCabinGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#090d16" metalness={0.95} roughness={0.1} />
      </instancedMesh>
      <instancedMesh ref={skyWingRef} args={[skyWingGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.24} />
      </instancedMesh>
      <instancedMesh ref={skyThrusterRef} args={[skyThrusterGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial ref={skyThrusterMatRef} color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
