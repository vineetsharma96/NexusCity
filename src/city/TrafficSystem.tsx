import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';

import { TrafficLightSystem } from './TrafficLightSystem';
import { AudioManager } from '../audio/AudioManager';
import { NPCManager } from '../npc/NPCManager';

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

  const lastHornTimeRef = useRef(0);
  const lastFlybyTimeRef = useRef(0);
  const lastBrakeSoundTimeRef = useRef(0);

  // Update loop
  useFrame((_, delta) => {
    let groundIdx = 0;
    let aerialIdx = 0;
    const pPos = playerPosRef.current;
    const npcs = NPCManager.getInstance().npcs;
    const now = performance.now();

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];

      // Handle ground vehicle intersection deceleration, headway & obstacle avoidance
      if (v.type === 'GROUND') {
        const signal = TrafficLightSystem.getInstance().getVehicleSignal(v.axis);
        let targetSpeed = v.cruisingSpeed;
        v.isBraking = false;

        // 1. Check central intersection traffic light approach (-16m stop line)
        if (v.axis === 'z') {
          // NS Avenue
          if (v.direction > 0 && v.position.z > -45 && v.position.z <= -16) {
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          } else if (v.direction < 0 && v.position.z < 45 && v.position.z >= 16) {
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          }
        } else {
          // EW Avenue
          if (v.direction > 0 && v.position.x > -45 && v.position.x <= -16) {
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          } else if (v.direction < 0 && v.position.x < 45 && v.position.x >= 16) {
            if (signal === 'RED' || signal === 'AMBER') {
              targetSpeed = 0;
              v.isBraking = true;
            }
          }
        }

        // 2. Vehicle-to-Vehicle Car-Following Headway (Anti-Clipping & Queuing)
        for (let j = 0; j < vehicles.length; j++) {
          if (i === j) continue;
          const lead = vehicles[j];
          if (lead.type !== 'GROUND' || lead.axis !== v.axis || lead.direction !== v.direction) continue;

          // Check if in the same lane (lateral corridor difference < 1.8m)
          const latDiff = lead.axis === 'z' ? Math.abs(lead.position.x - v.position.x) : Math.abs(lead.position.z - v.position.z);
          if (latDiff > 1.8) continue;

          // Long distance ahead
          const longDist = (lead.axis === 'z' ? lead.position.z - v.position.z : lead.position.x - v.position.x) * v.direction;
          if (longDist > 0 && longDist < 26.0) {
            if (longDist < 7.5) {
              targetSpeed = 0;
              v.isBraking = true;
            } else if (longDist < 15.0) {
              targetSpeed = Math.min(targetSpeed, lead.speed * 0.6);
              v.isBraking = true;
            } else {
              targetSpeed = Math.min(targetSpeed, lead.speed);
            }
          }
        }

        // 3. Pedestrian Player Obstacle Avoidance & Horn
        if (pPos) {
          const pLatDiff = v.axis === 'z' ? Math.abs(pPos.x - v.position.x) : Math.abs(pPos.z - v.position.z);
          const pLongDist = (v.axis === 'z' ? pPos.z - v.position.z : pPos.x - v.position.x) * v.direction;
          if (pLatDiff < 2.6 && Math.abs(pPos.y - v.position.y) < 2.5 && pLongDist > 0 && pLongDist < 18.0) {
            targetSpeed = 0;
            v.isBraking = true;
            if (now - lastHornTimeRef.current > 3500 && pLongDist < 12.0) {
              lastHornTimeRef.current = now;
              AudioManager.getInstance().playVehicleHorn();
            }
          }
        }

        // 4. NPC Pedestrian Crosswalk Avoidance
        for (let n = 0; n < npcs.length; n++) {
          const npc = npcs[n];
          const nLatDiff = v.axis === 'z' ? Math.abs(npc.position.x - v.position.x) : Math.abs(npc.position.z - v.position.z);
          const nLongDist = (v.axis === 'z' ? npc.position.z - v.position.z : npc.position.x - v.position.x) * v.direction;
          if (nLatDiff < 2.4 && nLongDist > 0 && nLongDist < 14.0) {
            targetSpeed = 0;
            v.isBraking = true;
            break;
          }
        }

        // Smooth acceleration/braking transition
        const accelRate = targetSpeed === 0 ? 5.5 : 2.2;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, delta * accelRate);
        if (v.axis === 'z') {
          v.velocity.z = v.direction * v.speed;
        } else {
          v.velocity.x = v.direction * v.speed;
        }
      }

      // Integrate motion
      v.position.addScaledVector(v.velocity, delta);

      // Spatial hover flyby and dynamic brake squeal audio triggers
      if (pPos) {
        const distToPlayer = v.position.distanceTo(pPos);
        // Spatial Hover Flyby whoosh when vehicle rushes past player within 15m
        if (distToPlayer < 15.0 && v.speed > 8.0 && now - lastFlybyTimeRef.current > 1600) {
          lastFlybyTimeRef.current = now;
          const pan = THREE.MathUtils.clamp((v.position.x - pPos.x) / 8, -1, 1);
          AudioManager.getInstance().playHoverFlyby(pan, v.speed / 15);
        }

        // Brake squeal sound when a vehicle brakes hard within hearing distance (24m)
        if (v.isBraking && v.speed > 7.0 && distToPlayer < 24.0 && now - lastBrakeSoundTimeRef.current > 2200) {
          lastBrakeSoundTimeRef.current = now;
          AudioManager.getInstance().playBrakeSqueal();
        }
      }

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
