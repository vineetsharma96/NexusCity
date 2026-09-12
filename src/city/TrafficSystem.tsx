import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';

import { TrafficLightSystem } from './TrafficLightSystem';

interface TrafficSystemProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

interface VehicleSim {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  speed: number;
  cruisingSpeed: number;
  isBraking: boolean;
  type: 'GROUND' | 'AERIAL';
  color: string;
  boundMin: number;
  boundMax: number;
  axis: 'x' | 'z';
  direction: number; // 1 or -1
}

const GROUND_COUNT = 32;
const AERIAL_COUNT = 24;

export const TrafficSystem: React.FC<TrafficSystemProps> = ({ playerPosRef }) => {
  const [timeState, setTimeState] = useState<TimeLightingState>(() =>
    TimeSystem.getInstance().getState()
  );

  useEffect(() => {
    return TimeSystem.getInstance().subscribe(setTimeState);
  }, []);

  // Meshes for instanced rendering
  const groundBodyMesh = useRef<THREE.InstancedMesh>(null);
  const groundGlassMesh = useRef<THREE.InstancedMesh>(null);
  const groundHeadlightMesh = useRef<THREE.InstancedMesh>(null);
  const groundTaillightMesh = useRef<THREE.InstancedMesh>(null);

  const aerialBodyMesh = useRef<THREE.InstancedMesh>(null);
  const aerialTrailMesh = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize procedural vehicle simulation state
  const vehicles = useMemo(() => {
    const list: VehicleSim[] = [];
    const colors = ['#0f172a', '#1e293b', '#334155', '#475569', '#1e1b4b', '#312e81', '#581c87', '#14532d', '#7f1d1d'];

    // 1. Ground Hover-Cruisers
    for (let i = 0; i < GROUND_COUNT; i++) {
      const isNorthSouth = i % 2 === 0;
      const laneDirection = i % 4 < 2 ? 1 : -1;
      const speed = 14 + (i % 6) * 2.5;
      const color = colors[i % colors.length];

      if (isNorthSouth) {
        const laneX = laneDirection === 1 ? 4.5 : -4.5;
        const zStart = -420 + (i * 28) % 840;
        list.push({
          position: new THREE.Vector3(laneX, 0.45, zStart),
          velocity: new THREE.Vector3(0, 0, laneDirection * speed),
          rotationY: laneDirection === 1 ? 0 : Math.PI,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'GROUND',
          color,
          boundMin: -440,
          boundMax: 440,
          axis: 'z',
          direction: laneDirection,
        });
      } else {
        const laneZ = laneDirection === 1 ? 4.5 : -4.5;
        const xStart = -420 + (i * 28) % 840;
        list.push({
          position: new THREE.Vector3(xStart, 0.45, laneZ),
          velocity: new THREE.Vector3(laneDirection * speed, 0, 0),
          rotationY: laneDirection === 1 ? Math.PI / 2 : -Math.PI / 2,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'GROUND',
          color,
          boundMin: -440,
          boundMax: 440,
          axis: 'x',
          direction: laneDirection,
        });
      }
    }

    // 2. High-Altitude Skyway Commuters
    for (let i = 0; i < AERIAL_COUNT; i++) {
      const isEastWest = i % 2 === 0;
      const laneDirection = i % 4 < 2 ? 1 : -1;
      const speed = 26 + (i % 5) * 4.0;
      const altitude = (i % 3 === 0) ? 22 : (i % 3 === 1) ? 36 : 48;
      const offsetLane = -40 + (i % 4) * 26;

      if (isEastWest) {
        const xStart = -500 + (i * 45) % 1000;
        list.push({
          position: new THREE.Vector3(xStart, altitude, offsetLane),
          velocity: new THREE.Vector3(laneDirection * speed, 0, 0),
          rotationY: laneDirection === 1 ? Math.PI / 2 : -Math.PI / 2,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'AERIAL',
          color: '#38bdf8',
          boundMin: -550,
          boundMax: 550,
          axis: 'x',
          direction: laneDirection,
        });
      } else {
        const zStart = -500 + (i * 45) % 1000;
        list.push({
          position: new THREE.Vector3(offsetLane, altitude, zStart),
          velocity: new THREE.Vector3(0, 0, laneDirection * speed),
          rotationY: laneDirection === 1 ? 0 : Math.PI,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'AERIAL',
          color: '#a855f7',
          boundMin: -550,
          boundMax: 550,
          axis: 'z',
          direction: laneDirection,
        });
      }
    }

    return list;
  }, []);

  // Shared Base Geometries
  const groundBodyGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.65, 4.2), []);
  const groundGlassGeo = useMemo(() => new THREE.BoxGeometry(1.4, 0.45, 1.8), []);
  const headlightGeo = useMemo(() => new THREE.BoxGeometry(0.35, 0.12, 0.08), []);
  const taillightGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.12, 0.08), []);

  const aerialBodyGeo = useMemo(() => new THREE.ConeGeometry(1.2, 5.0, 4), []);
  const aerialTrailGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.6, 3.5, 6), []);

  // Update loop
  useFrame((_, delta) => {
    let groundIdx = 0;
    let aerialIdx = 0;

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];

      // Handle ground vehicle intersection deceleration & traffic light rules
      if (v.type === 'GROUND') {
        const signal = TrafficLightSystem.getInstance().getVehicleSignal(v.axis);
        let targetSpeed = v.cruisingSpeed;
        v.isBraking = false;

        // Check central intersection approach (-18m stop line)
        if (v.axis === 'z') {
          // NS Avenue
          if (v.direction > 0 && v.position.z > -45 && v.position.z <= -16) {
            // Approaching from North heading South
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          } else if (v.direction < 0 && v.position.z < 45 && v.position.z >= 16) {
            // Approaching from South heading North
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          }
        } else {
          // EW Avenue
          if (v.direction > 0 && v.position.x > -45 && v.position.x <= -16) {
            // Approaching from West heading East
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          } else if (v.direction < 0 && v.position.x < 45 && v.position.x >= 16) {
            // Approaching from East heading West
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          }
        }

        // Smooth acceleration/braking transition
        const accelRate = targetSpeed === 0 ? 4.5 : 2.0;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, delta * accelRate);
        if (v.axis === 'z') {
          v.velocity.z = v.direction * v.speed;
        } else {
          v.velocity.x = v.direction * v.speed;
        }
      }

      // Integrate motion
      v.position.addScaledVector(v.velocity, delta);

      // Wrap boundaries along active axis
      if (v.axis === 'z') {
        if (v.velocity.z > 0 && v.position.z > v.boundMax) {
          v.position.z = v.boundMin;
        } else if (v.velocity.z < 0 && v.position.z < v.boundMin) {
          v.position.z = v.boundMax;
        }
      } else {
        if (v.velocity.x > 0 && v.position.x > v.boundMax) {
          v.position.x = v.boundMin;
        } else if (v.velocity.x < 0 && v.position.x < v.boundMin) {
          v.position.x = v.boundMax;
        }
      }

      if (v.type === 'GROUND' && groundBodyMesh.current) {
        // Ground Cruiser Chassis
        dummy.position.copy(v.position);
        dummy.rotation.set(0, v.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        groundBodyMesh.current.setMatrixAt(groundIdx, dummy.matrix);

        // Canopy Cabin
        if (groundGlassMesh.current) {
          dummy.position.set(v.position.x, v.position.y + 0.45, v.position.z);
          dummy.updateMatrix();
          groundGlassMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        // Headlights (forward relative offset)
        if (groundHeadlightMesh.current) {
          const forward = new THREE.Vector3(0, 0, 2.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.rotationY);
          dummy.position.copy(v.position).add(forward);
          dummy.position.y += 0.05;
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          groundHeadlightMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        // Taillights (rear relative offset): flare brighter/taller when braking or stopped
        if (groundTaillightMesh.current) {
          const rear = new THREE.Vector3(0, 0, -2.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.rotationY);
          dummy.position.copy(v.position).add(rear);
          dummy.position.y += 0.05;
          const brakeScale = v.isBraking || v.speed < 2.0 ? 1.8 : 1.0;
          dummy.scale.set(1, brakeScale, 1);
          dummy.updateMatrix();
          groundTaillightMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        groundIdx++;
      } else if (v.type === 'AERIAL' && aerialBodyMesh.current) {
        // Aerial Skyway Commuter
        dummy.position.copy(v.position);
        dummy.rotation.set(Math.PI / 2, v.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        aerialBodyMesh.current.setMatrixAt(aerialIdx, dummy.matrix);

        // Plasma Exhaust Trail
        if (aerialTrailMesh.current) {
          const rearOffset = new THREE.Vector3(0, 0, -3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.rotationY);
          dummy.position.copy(v.position).add(rearOffset);
          dummy.rotation.set(Math.PI / 2, v.rotationY, 0);
          dummy.updateMatrix();
          aerialTrailMesh.current.setMatrixAt(aerialIdx, dummy.matrix);
        }

        aerialIdx++;
      }
    }

    if (groundBodyMesh.current) groundBodyMesh.current.instanceMatrix.needsUpdate = true;
    if (groundGlassMesh.current) groundGlassMesh.current.instanceMatrix.needsUpdate = true;
    if (groundHeadlightMesh.current) groundHeadlightMesh.current.instanceMatrix.needsUpdate = true;
    if (groundTaillightMesh.current) groundTaillightMesh.current.instanceMatrix.needsUpdate = true;
    if (aerialBodyMesh.current) aerialBodyMesh.current.instanceMatrix.needsUpdate = true;
    if (aerialTrailMesh.current) aerialTrailMesh.current.instanceMatrix.needsUpdate = true;
  });

  const headlightEmissive = timeState.isNight ? 4.5 : 1.8;
  const taillightEmissive = timeState.isNight ? 5.0 : 2.5;

  return (
    <group name="TrafficSystemLayer">
      {/* 1. Ground Cruiser Chassis */}
      <instancedMesh
        ref={groundBodyMesh}
        args={[groundBodyGeo, undefined, GROUND_COUNT]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1e293b" roughness={0.25} metalness={0.85} />
      </instancedMesh>

      {/* 2. Ground Cruiser Cockpit Glass */}
      <instancedMesh
        ref={groundGlassMesh}
        args={[groundGlassGeo, undefined, GROUND_COUNT]}
      >
        <meshStandardMaterial color="#00f0ff" roughness={0.1} metalness={0.9} transparent opacity={0.65} />
      </instancedMesh>

      {/* 3. Glowing LED Headlights */}
      <instancedMesh
        ref={groundHeadlightMesh}
        args={[headlightGeo, undefined, GROUND_COUNT]}
      >
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      {/* 4. Glowing Red LED Taillight Bar */}
      <instancedMesh
        ref={groundTaillightMesh}
        args={[taillightGeo, undefined, GROUND_COUNT]}
      >
        <meshBasicMaterial color="#ff0044" />
      </instancedMesh>

      {/* 5. Aerial Skyway Commuters */}
      <instancedMesh
        ref={aerialBodyMesh}
        args={[aerialBodyGeo, undefined, AERIAL_COUNT]}
      >
        <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.9} emissive="#0284c7" emissiveIntensity={0.6} />
      </instancedMesh>

      {/* 6. Aerial Plasma Exhaust Jet Trails */}
      <instancedMesh
        ref={aerialTrailMesh}
        args={[aerialTrailGeo, undefined, AERIAL_COUNT]}
      >
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.75} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
};
