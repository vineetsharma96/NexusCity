import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrafficLightSystem } from './TrafficLightSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';

interface TrafficSystemProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface VehicleAgent {
  axis: 'NS' | 'EW';
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

const VEHICLE_COUNT = 32;
const SKY_VEHICLE_COUNT = 22;

export const TrafficSystem: React.FC<TrafficSystemProps> = () => {
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
      const laneOffset = dir === 1 ? 3.4 : -3.4;
      const coord = ((i * 27) % 320) - 160;
      const maxSpeed = 13 + (i % 5) * 2.2;
      list.push({
        axis,
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
    for (let i = 0; i < SKY_VEHICLE_COUNT; i++) {
      const axis = i % 2 === 0 ? 'NS' : 'EW';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      list.push({
        axis,
        laneOffset: (dir === 1 ? 18 : -18) + (i % 3) * 5,
        coord: ((i * 43) % 480) - 240,
        dir,
        speed: 28 + (i % 4) * 5,
        maxSpeed: 28 + (i % 4) * 5,
        altitude: 38 + (i % 5) * 13,
        color: '#0f172a',
        trimColor: i % 2 === 0 ? '#38bdf8' : '#f59e0b',
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

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const lights = TrafficLightSystem.getInstance();
    const speedScale = LivingCityEventSystem.getInstance().getState().trafficSpeedMultiplier;

    if (
      groundBodyRef.current &&
      groundCabinRef.current &&
      groundLightBarRef.current &&
      groundThrusterRef.current &&
      groundWingRef.current
    ) {
      for (let i = 0; i < groundAgents.length; i++) {
        const v = groundAgents[i];
        const canGo = lights.canProceed(v.axis, v.coord, v.dir);
        const targetSpeed = canGo ? v.maxSpeed * speedScale : 0;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, dt * 5);
        v.coord += v.speed * v.dir * dt;

        if (v.coord > 175) v.coord = -175;
        else if (v.coord < -175) v.coord = 175;

        const rotY =
          v.axis === 'NS'
            ? v.dir === 1
              ? 0
              : Math.PI
            : v.dir === 1
            ? Math.PI / 2
            : -Math.PI / 2;
        const px = v.axis === 'NS' ? v.laneOffset : v.coord;
        const pz = v.axis === 'NS' ? v.coord : v.laneOffset;
        const hoverY = v.altitude + Math.sin(t * 3.2 + v.phase) * 0.025;

        // 1. Lower Aerodynamic Monocoque Chassis
        dummy.position.set(px, hoverY, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        groundBodyRef.current.setMatrixAt(i, dummy.matrix);
        groundBodyRef.current.setColorAt(i, colorObj.set(v.color));

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
        groundLightBarRef.current.setColorAt(i, colorObj.set(v.trimColor));

        // 5. Elevated Rear Aero Wing
        const rearOffsetX = Math.sin(rotY) * -1.65;
        const rearOffsetZ = Math.cos(rotY) * -1.65;
        dummy.position.set(px + rearOffsetX, hoverY + 0.34, pz + rearOffsetZ);
        dummy.updateMatrix();
        groundWingRef.current.setMatrixAt(i, dummy.matrix);
        groundWingRef.current.setColorAt(i, colorObj.set(v.trimColor));
      }
      groundBodyRef.current.instanceMatrix.needsUpdate = true;
      groundCabinRef.current.instanceMatrix.needsUpdate = true;
      groundThrusterRef.current.instanceMatrix.needsUpdate = true;
      groundLightBarRef.current.instanceMatrix.needsUpdate = true;
      groundWingRef.current.instanceMatrix.needsUpdate = true;
      if (groundBodyRef.current.instanceColor) groundBodyRef.current.instanceColor.needsUpdate = true;
      if (groundLightBarRef.current.instanceColor) groundLightBarRef.current.instanceColor.needsUpdate = true;
      if (groundWingRef.current.instanceColor) groundWingRef.current.instanceColor.needsUpdate = true;
    }

    if (skyBodyRef.current && skyCabinRef.current && skyThrusterRef.current) {
      for (let i = 0; i < skyAgents.length; i++) {
        const s = skyAgents[i];
        s.coord += s.speed * s.dir * dt;
        if (s.coord > 240) s.coord = -240;
        else if (s.coord < -240) s.coord = 240;

        const rotY =
          s.axis === 'NS'
            ? s.dir === 1
              ? 0
              : Math.PI
            : s.dir === 1
            ? Math.PI / 2
            : -Math.PI / 2;
        const px = s.axis === 'NS' ? s.laneOffset : s.coord;
        const pz = s.axis === 'NS' ? s.coord : s.laneOffset;
        const skyY = s.altitude + Math.sin(t * 2.4 + s.phase) * 0.25;

        dummy.position.set(px, skyY, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        skyBodyRef.current.setMatrixAt(i, dummy.matrix);
        skyThrusterRef.current.setMatrixAt(i, dummy.matrix);
        skyThrusterRef.current.setColorAt(i, colorObj.set(s.trimColor));

        dummy.position.set(px, skyY + 0.3, pz);
        dummy.updateMatrix();
        skyCabinRef.current.setMatrixAt(i, dummy.matrix);
      }
      skyBodyRef.current.instanceMatrix.needsUpdate = true;
      skyCabinRef.current.instanceMatrix.needsUpdate = true;
      skyThrusterRef.current.instanceMatrix.needsUpdate = true;
      if (skyThrusterRef.current.instanceColor) skyThrusterRef.current.instanceColor.needsUpdate = true;
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
