import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { QualityManager } from '../rendering/QualityManager';

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

const VEHICLE_COUNT = 112;
const SKY_VEHICLE_COUNT = 56;

const NS_AVENUES = [0, 0, -75, -165, 165, -180, 180, -300, 300, -420, 420];
const EW_AVENUES = [0, 0, -75, 75, -165, 165, -180, 180, -300, 300, -420, 420];

export const TrafficSystem: React.FC<TrafficSystemProps> = ({ playerPosRef }) => {
  const groundBodyRef = useRef<THREE.InstancedMesh>(null);
  const groundCabinRef = useRef<THREE.InstancedMesh>(null);
  const groundLightBarRef = useRef<THREE.InstancedMesh>(null);
  const groundThrusterRef = useRef<THREE.InstancedMesh>(null);
  const groundWingRef = useRef<THREE.InstancedMesh>(null);

  const skyBodyRef = useRef<THREE.InstancedMesh>(null);
  const skyCabinRef = useRef<THREE.InstancedMesh>(null);
  const skyThrusterRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  const groundAgents = useMemo<VehicleAgent[]>(() => {
    const palette = ['#0b1120', '#111827', '#1e293b', '#172554', '#0f172a'];
    const trims = ['#38bdf8', '#f59e0b', '#10b981', '#f43f5e'];
    const list: VehicleAgent[] = [];
    for (let i = 0; i < VEHICLE_COUNT; i++) {
      const axis = i % 2 === 0 ? 'NS' : 'EW';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const avenuePool = axis === 'NS' ? NS_AVENUES : EW_AVENUES;
      const avenueCoord = avenuePool[Math.floor(i / 2) % avenuePool.length];
      const laneOffset = dir === 1 ? 3.4 : -3.4;
      const coord = ((i * 53) % 880) - 440;
      const maxSpeed = 14 + (i % 6) * 2.4;
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

  const chassisGeo = useMemo(() => new THREE.BoxGeometry(1.86, 0.46, 3.95), []);
  const cabinGeo = useMemo(() => new THREE.BoxGeometry(1.44, 0.34, 2.05), []);
  const lightBarGeo = useMemo(() => new THREE.BoxGeometry(1.7, 0.1, 4.06), []);
  const thrusterCrossGeo = useMemo(() => new THREE.BoxGeometry(2.18, 0.16, 2.65), []);
  const spoilerWingGeo = useMemo(() => new THREE.BoxGeometry(1.76, 0.08, 0.34), []);

  const skyGeo = useMemo(() => new THREE.BoxGeometry(1.75, 0.38, 4.5), []);
  const skyCabinGeo = useMemo(() => new THREE.BoxGeometry(1.28, 0.28, 2.2), []);
  const skyThrusterGeo = useMemo(() => new THREE.BoxGeometry(2.35, 0.12, 3.9), []);

  // Upload static vehicle colors once on mount instead of every frame
  React.useEffect(() => {
    for (let i = 0; i < groundAgents.length; i++) {
      const v = groundAgents[i];
      groundBodyRef.current?.setColorAt(i, colorObj.set(v.color));
      groundLightBarRef.current?.setColorAt(i, colorObj.set(v.trimColor));
      groundWingRef.current?.setColorAt(i, colorObj.set(v.trimColor));
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
    const pPos = playerPosRef?.current;
    const playerX = pPos ? pPos.x : 0;
    const playerZ = pPos ? pPos.z : 0;
    const lod = QualityManager.current.LODQuality;
    const activeGroundCount = lod === 'LOW' ? 40 : lod === 'MEDIUM' ? 76 : groundAgents.length;
    const activeSkyCount = lod === 'LOW' ? 20 : lod === 'MEDIUM' ? 38 : skyAgents.length;

    if (
      groundBodyRef.current &&
      groundCabinRef.current &&
      groundLightBarRef.current &&
      groundThrusterRef.current &&
      groundWingRef.current
    ) {
      const wrapSpan = 460;
      for (let i = 0; i < activeGroundCount; i++) {
        const v = groundAgents[i];
        const canGo = v.avenueCoord === 0 ? lights.canProceed(v.axis, v.coord, v.dir) : true;
        const targetSpeed = canGo ? v.maxSpeed * speedScale : 0;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, dt * 5);
        v.coord += v.speed * v.dir * dt;

        const anchorAlong = v.axis === 'NS' ? playerZ : playerX;
        const anchorPerp = v.axis === 'NS' ? playerX : playerZ;

        if (v.coord > anchorAlong + wrapSpan) {
          v.coord = anchorAlong - wrapSpan;
        } else if (v.coord < anchorAlong - wrapSpan) {
          v.coord = anchorAlong + wrapSpan;
        }

        // Keep outer-fleet vehicles streamed onto chunk avenues near the player when exploring outer districts
        if (i >= 36 && Math.abs(v.avenueCoord - anchorPerp) > 420) {
          const baseChunk = Math.floor(anchorPerp / 120);
          const ringOffset = (i % 5) - 2;
          let candidateAve = (baseChunk + ringOffset + 0.5) * 120;
          if (v.axis === 'NS' && Math.abs(candidateAve - 75) < 40) {
            candidateAve = -60;
          }
          v.avenueCoord = candidateAve;
        }

        const rotY =
          v.axis === 'NS'
            ? v.dir === 1
              ? 0
              : Math.PI
            : v.dir === 1
            ? Math.PI / 2
            : -Math.PI / 2;
        const roadLine = v.avenueCoord + v.laneOffset;
        const px = v.axis === 'NS' ? roadLine : v.coord;
        const pz = v.axis === 'NS' ? v.coord : roadLine;
        const hoverY = v.altitude + Math.sin(t * 3.2 + v.phase) * 0.025;

        // 1. Lower Aerodynamic Monocoque Chassis
        dummy.position.set(px, hoverY, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        groundBodyRef.current.setMatrixAt(i, dummy.matrix);

        // 2. Glazed Cockpit Canopy
        dummy.position.set(px, hoverY + 0.35, pz);
        dummy.updateMatrix();
        groundCabinRef.current.setMatrixAt(i, dummy.matrix);

        // 3. Outboard Mag-Lev Thruster Nacelle Pod Frame
        dummy.position.set(px, hoverY - 0.1, pz);
        dummy.updateMatrix();
        groundThrusterRef.current.setMatrixAt(i, dummy.matrix);

        // 4. Full-Perimeter Neon Underglow & Headlamp/Taillight Blade
        dummy.position.set(px, hoverY - 0.05, pz);
        dummy.updateMatrix();
        groundLightBarRef.current.setMatrixAt(i, dummy.matrix);

        // 5. Elevated Rear Aero Wing
        const rearOffsetX = Math.sin(rotY) * -1.65;
        const rearOffsetZ = Math.cos(rotY) * -1.65;
        dummy.position.set(px + rearOffsetX, hoverY + 0.34, pz + rearOffsetZ);
        dummy.updateMatrix();
        groundWingRef.current.setMatrixAt(i, dummy.matrix);
      }
      groundBodyRef.current.count = activeGroundCount;
      groundCabinRef.current.count = activeGroundCount;
      groundThrusterRef.current.count = activeGroundCount;
      groundLightBarRef.current.count = activeGroundCount;
      groundWingRef.current.count = activeGroundCount;
      groundBodyRef.current.instanceMatrix.needsUpdate = true;
      groundCabinRef.current.instanceMatrix.needsUpdate = true;
      groundThrusterRef.current.instanceMatrix.needsUpdate = true;
      groundLightBarRef.current.instanceMatrix.needsUpdate = true;
      groundWingRef.current.instanceMatrix.needsUpdate = true;
    }

    if (skyBodyRef.current && skyCabinRef.current && skyThrusterRef.current) {
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
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        skyBodyRef.current.setMatrixAt(i, dummy.matrix);
        skyThrusterRef.current.setMatrixAt(i, dummy.matrix);

        dummy.position.set(px, skyY + 0.3, pz);
        dummy.updateMatrix();
        skyCabinRef.current.setMatrixAt(i, dummy.matrix);
      }
      skyBodyRef.current.count = activeSkyCount;
      skyCabinRef.current.count = activeSkyCount;
      skyThrusterRef.current.count = activeSkyCount;
      skyBodyRef.current.instanceMatrix.needsUpdate = true;
      skyCabinRef.current.instanceMatrix.needsUpdate = true;
      skyThrusterRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="TrafficSystemLayer">
      <instancedMesh ref={groundBodyRef} args={[chassisGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" metalness={0.92} roughness={0.16} />
      </instancedMesh>
      <instancedMesh ref={groundCabinRef} args={[cabinGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#090d16" metalness={0.96} roughness={0.08} />
      </instancedMesh>
      <instancedMesh ref={groundThrusterRef} args={[thrusterCrossGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
      </instancedMesh>
      <instancedMesh ref={groundLightBarRef} args={[lightBarGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={groundWingRef} args={[spoilerWingGeo, undefined, VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      <instancedMesh ref={skyBodyRef} args={[skyGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
      </instancedMesh>
      <instancedMesh ref={skyCabinRef} args={[skyCabinGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#090d16" metalness={0.95} roughness={0.1} />
      </instancedMesh>
      <instancedMesh ref={skyThrusterRef} args={[skyThrusterGeo, undefined, SKY_VEHICLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  );
};
