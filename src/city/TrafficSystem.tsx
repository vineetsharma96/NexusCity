import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

import { TrafficLightSystem } from './TrafficLightSystem';
import { AudioManager } from '../audio/AudioManager';
import { NPCManager } from '../npc/NPCManager';
import { TrafficIncidentSystem } from '../vehicle/TrafficIncidentSystem';

interface TrafficSystemProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

interface VehicleSim {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  pitch: number;
  roll: number;
  wheelSpin: number;
  lastSpeed: number;
  speed: number;
  cruisingSpeed: number;
  isBraking: boolean;
  type: 'GROUND' | 'AERIAL';
  color: string;
  boundMin: number;
  boundMax: number;
  axis: 'x' | 'z';
  direction: number; // 1 or -1
  vehicleClass: VehicleClass;
  laneCenter: number;
  curveBias: number;
}

type VehicleClass = 'POLICE' | 'CARGO' | 'TAXI' | 'EMERGENCY' | 'CORPORATE';

const GROUND_COUNT = 32;
const AERIAL_COUNT = 24;

export const TrafficSystem: React.FC<TrafficSystemProps> = ({ playerPosRef }) => {
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    const unsubQuality = QualityManager.subscribe(setQuality);
    return () => {
      unsubQuality();
    };
  }, []);

  // Meshes for instanced rendering
  const groundBodyMesh = useRef<THREE.InstancedMesh>(null);
  const groundShadowMesh = useRef<THREE.InstancedMesh>(null);
  const groundGlassMesh = useRef<THREE.InstancedMesh>(null);
  const groundHeadlightMesh = useRef<THREE.InstancedMesh>(null);
  const groundTaillightMesh = useRef<THREE.InstancedMesh>(null);
  const groundWheelMesh = useRef<THREE.InstancedMesh>(null);
  const accidentMarkerRef = useRef<THREE.Group>(null);
  const groundEmergencyLightMesh = useRef<THREE.InstancedMesh>(null);

  const aerialBodyMesh = useRef<THREE.InstancedMesh>(null);
  const aerialTrailMesh = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize procedural vehicle simulation state
  const vehicles = useMemo(() => {
    const list: VehicleSim[] = [];
    const classes: VehicleClass[] = ['POLICE', 'CARGO', 'TAXI', 'EMERGENCY', 'CORPORATE'];
    const colors: Record<VehicleClass, string> = {
      POLICE: '#172554',
      CARGO: '#78350f',
      TAXI: '#ca8a04',
      EMERGENCY: '#991b1b',
      CORPORATE: '#312e81',
    };

    // 1. Ground Hover-Cruisers
    for (let i = 0; i < GROUND_COUNT; i++) {
      const isNorthSouth = i % 2 === 0;
      const laneDirection = i % 4 < 2 ? 1 : -1;
      const speed = 14 + (i % 6) * 2.5;
      // Corporate vehicles travel in deterministic three-car platoons.
      const vehicleClass = i % 10 < 3 ? 'CORPORATE' : classes[(i + 1) % 4];
      const color = colors[vehicleClass];
      const curveBias = i % 2 === 0 ? 1 : -1;

      if (isNorthSouth) {
        const laneX = laneDirection === 1 ? 4.5 : -4.5;
        const zStart = -420 + (i * 28) % 840;
        list.push({
          position: new THREE.Vector3(laneX, 0.45, zStart),
          velocity: new THREE.Vector3(0, 0, laneDirection * speed),
          rotationY: laneDirection === 1 ? 0 : Math.PI,
          pitch: 0,
          roll: 0,
          wheelSpin: 0,
          lastSpeed: speed,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'GROUND',
          color,
          boundMin: -440,
          boundMax: 440,
           axis: 'z',
           direction: laneDirection,
           vehicleClass,
           laneCenter: laneX,
           curveBias,
        });
      } else {
        const laneZ = laneDirection === 1 ? 4.5 : -4.5;
        const xStart = -420 + (i * 28) % 840;
        list.push({
          position: new THREE.Vector3(xStart, 0.45, laneZ),
          velocity: new THREE.Vector3(laneDirection * speed, 0, 0),
          rotationY: laneDirection === 1 ? Math.PI / 2 : -Math.PI / 2,
            pitch: 0,
            roll: 0,
            wheelSpin: 0,
          lastSpeed: speed,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'GROUND',
          color,
          boundMin: -440,
          boundMax: 440,
           axis: 'x',
           direction: laneDirection,
            vehicleClass,
           laneCenter: laneZ,
           curveBias,
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
          pitch: 0,
          roll: 0,
          wheelSpin: 0,
          lastSpeed: speed,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'AERIAL',
          color: '#38bdf8',
          boundMin: -550,
          boundMax: 550,
           axis: 'x',
           direction: laneDirection,
           vehicleClass: 'CORPORATE',
           laneCenter: offsetLane,
           curveBias: 0,
         });
      } else {
        const zStart = -500 + (i * 45) % 1000;
        list.push({
          position: new THREE.Vector3(offsetLane, altitude, zStart),
          velocity: new THREE.Vector3(0, 0, laneDirection * speed),
          rotationY: laneDirection === 1 ? 0 : Math.PI,
          pitch: 0,
          roll: 0,
          wheelSpin: 0,
          lastSpeed: speed,
          speed,
          cruisingSpeed: speed,
          isBraking: false,
          type: 'AERIAL',
          color: '#a855f7',
          boundMin: -550,
          boundMax: 550,
           axis: 'z',
           direction: laneDirection,
           vehicleClass: 'CORPORATE',
           laneCenter: offsetLane,
           curveBias: 0,
        });
      }
    }

    return list;
  }, []);

  // Shared Base Geometries
  const groundBodyGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.65, 4.2), []);
  const groundShadowGeo = useMemo(() => new THREE.PlaneGeometry(2.2, 4.5), []);
  const groundGlassGeo = useMemo(() => new THREE.BoxGeometry(1.4, 0.45, 1.8), []);
  const headlightGeo = useMemo(() => new THREE.BoxGeometry(0.35, 0.12, 0.08), []);
  const taillightGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.12, 0.08), []);
  const groundWheelGeo = useMemo(() => new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), []);
  const groundEmergencyLightGeo = useMemo(() => new THREE.BoxGeometry(0.72, 0.11, 0.28), []);

  const aerialBodyGeo = useMemo(() => new THREE.ConeGeometry(1.2, 5.0, 4), []);
  const aerialTrailGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.6, 3.5, 6), []);

  const lastHornTimeRef = useRef(0);
  const lastFlybyTimeRef = useRef(0);
  const lastBrakeSoundTimeRef = useRef(0);
  const lastClassSoundTimeRef = useRef(0);
  const trafficTimeRef = useRef(0);
  const disruptionNotifiedRef = useRef(false);

  useEffect(() => {
    if (!groundBodyMesh.current) return;
    const color = new THREE.Color();
    vehicles.forEach((vehicle, index) => {
      if (vehicle.type !== 'GROUND') return;
      color.set(vehicle.color);
      groundBodyMesh.current?.setColorAt(index, color);
    });
    vehicles.forEach((vehicle, index) => {
      if (vehicle.type === 'GROUND' && (vehicle.vehicleClass === 'POLICE' || vehicle.vehicleClass === 'EMERGENCY')) {
        const lightColor = new THREE.Color(vehicle.vehicleClass === 'POLICE' ? '#2563eb' : '#ef4444');
        groundEmergencyLightMesh.current?.setColorAt(index, lightColor);
      }
    });
    if (groundBodyMesh.current.instanceColor) {
      groundBodyMesh.current.instanceColor.needsUpdate = true;
    }
    if (groundEmergencyLightMesh.current?.instanceColor) {
      groundEmergencyLightMesh.current.instanceColor.needsUpdate = true;
    }
  }, [vehicles]);

  // Update loop
  useFrame((_, delta) => {
    delta = Math.min(delta, 0.1);
    let groundIdx = 0;
    let aerialIdx = 0;
    const maxGround = Math.max(6, Math.round(GROUND_COUNT * quality.vehicleDensity));
    const maxAerial = Math.max(4, Math.round(AERIAL_COUNT * quality.vehicleDensity));
    const pPos = playerPosRef.current;
    const npcs = NPCManager.getInstance().getRenderedNpcs();
    const now = performance.now();
    trafficTimeRef.current += delta;
    const disruptionCycle = trafficTimeRef.current % 96;
    const disruptionActive = disruptionCycle >= 24 && disruptionCycle < 42;
    if (disruptionActive && !disruptionNotifiedRef.current && typeof window !== 'undefined') {
      disruptionNotifiedRef.current = true;
      window.dispatchEvent(new CustomEvent('nexus:notification', {
        detail: {
          title: 'TRAFFIC CONTROL // INCIDENT DETECTED',
          message: 'Central intersection disruption active. Selected lanes are slowing for emergency clearance.',
          type: 'warning',
          duration: 4200,
        },
      }));
      AudioManager.getInstance().playVehicleHorn();
    } else if (!disruptionActive) {
      disruptionNotifiedRef.current = false;
    }
    if (accidentMarkerRef.current) {
      accidentMarkerRef.current.visible = disruptionActive;
      accidentMarkerRef.current.rotation.y += delta * 1.4;
    }

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];

      // Handle ground vehicle intersection deceleration, headway & obstacle avoidance
      if (v.type === 'GROUND') {
        if (groundIdx >= maxGround) continue;

        const signal = TrafficLightSystem.getInstance().getVehicleSignal(v.axis);
        let targetSpeed = v.cruisingSpeed;
        v.isBraking = false;

        // A deterministic, low-frequency incident affects selected vehicles only.
        const incidentVehicle = i % 5 === 1 || i % 7 === 0;
        const incidentCoordinate = v.axis === 'z' ? v.position.z : v.position.x;
        const laneBlocked = TrafficIncidentSystem.getInstance().isLaneBlocked(v.axis, v.laneCenter, incidentCoordinate);
        if (laneBlocked) {
          targetSpeed = v.vehicleClass === 'EMERGENCY' || v.vehicleClass === 'POLICE' ? v.cruisingSpeed * 0.2 : 0;
          v.isBraking = true;
        }
        if (disruptionActive && incidentVehicle && Math.abs(incidentCoordinate) < 34) {
          targetSpeed = v.vehicleClass === 'EMERGENCY' || v.vehicleClass === 'POLICE' ? v.cruisingSpeed * 0.35 : 0;
          v.isBraking = true;
        }

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
          if (i === j || j >= maxGround) continue;
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

          // 3b. Physical Collision Hull Separation (push player out if contacting vehicle)
          if (Math.abs(pPos.y - v.position.y) < 2.0) {
            const dx = pPos.x - v.position.x;
            const dz = pPos.z - v.position.z;
            const halfW = 1.35;
            const halfL = 2.45;
            if (Math.abs(dx) < halfW && Math.abs(dz) < halfL) {
              const pushX = dx > 0 ? (halfW - dx) : -(halfW + dx);
              const pushZ = dz > 0 ? (halfL - dz) : -(halfL + dz);
              if (Math.abs(pushX) < Math.abs(pushZ)) {
                pPos.x += pushX * 1.15;
              } else {
                pPos.z += pushZ * 1.15;
              }
            }
          }
        }

        // 4. NPC Pedestrian Crosswalk Avoidance (only needed when approaching central crosswalk area)
        if (Math.abs(v.position.x) < 28 && Math.abs(v.position.z) < 28) {
          for (let n = 0; n < npcs.length; n++) {
            const npc = npcs[n];
            const nLatDiff = v.axis === 'z' ? Math.abs(npc.position.x - v.position.x) : Math.abs(npc.position.z - v.position.z);
            if (nLatDiff > 2.4) continue;
            const nLongDist = (v.axis === 'z' ? npc.position.z - v.position.z : npc.position.x - v.position.x) * v.direction;
            if (nLongDist > 0 && nLongDist < 14.0) {
              targetSpeed = 0;
              v.isBraking = true;
              break;
            }
          }
        }

        // Smooth acceleration/braking transition with suspension pitch response
        const accelRate = targetSpeed === 0 ? 5.5 : 2.2;
        const prevSpeed = v.speed;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, delta * accelRate);
        const accelDelta = (v.speed - prevSpeed) / Math.max(0.001, delta);
        v.lastSpeed = v.speed;

        // Suspension pitch: dips on braking, lifts on acceleration, gentle idle hover bobbing
        const hoverBob = Math.sin(now * 0.003 + i * 1.3) * 0.012;
        const targetPitch = v.isBraking ? -0.065 : accelDelta > 1.0 ? 0.032 : hoverBob;
        v.pitch = THREE.MathUtils.damp(v.pitch, targetPitch, 7.5, delta);
        const damaged = TrafficIncidentSystem.getInstance().getIncidents().some((incident) => incident.axis === v.axis &&
          Math.abs(incident.laneCenter - v.laneCenter) < 1.8 && Math.abs(incidentCoordinate - (v.axis === 'x' ? incident.position.x : incident.position.z)) < incident.radius * 0.7 && incidentVehicle);
        v.roll = THREE.MathUtils.damp(v.roll, damaged ? Math.sin(i * 4.1) * 0.12 : 0, 8, delta);
        v.wheelSpin += (v.speed * v.direction * delta) / 0.28;

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
        if (v.type === 'GROUND' && distToPlayer < 12 && now - lastClassSoundTimeRef.current > 5000) {
          lastClassSoundTimeRef.current = now;
          AudioManager.getInstance().playVehicleClassFeedback(v.vehicleClass);
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

      // Ease a small, deterministic S-curve through the central junction. The
      // simulation remains axis-based for signals and following; this only
      // adjusts the rendered lane position and yaw near the intersection.
      if (v.type === 'GROUND') {
        const longitudinal = v.axis === 'z' ? v.position.z : v.position.x;
        const progress = THREE.MathUtils.clamp((longitudinal * v.direction + 44) / 88, 0, 1);
        const curve = Math.sin(progress * Math.PI) * 1.15 * v.curveBias;
        const curveSlope = Math.cos(progress * Math.PI) * Math.PI * 1.15 / 88 * v.direction;
        if (v.axis === 'z') v.position.x = v.laneCenter + curve;
        else v.position.z = v.laneCenter + curve;
        v.rotationY = (v.direction > 0 ? (v.axis === 'z' ? 0 : Math.PI / 2) : (v.axis === 'z' ? Math.PI : -Math.PI / 2))
          + (v.axis === 'z' ? curveSlope : -curveSlope);
      }

      // Pre-calculate yaw orientation trigonometry without allocating Vector3
      const sinY = Math.sin(v.rotationY);
      const cosY = Math.cos(v.rotationY);

      if (v.type === 'GROUND' && groundBodyMesh.current) {
        // Ground Contact Shadow on road
        if (groundShadowMesh.current) {
          dummy.position.set(v.position.x, 0.018, v.position.z);
          dummy.rotation.set(-Math.PI / 2, 0, v.rotationY);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          groundShadowMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        // Ground Cruiser Chassis with Suspension Pitch
        dummy.position.copy(v.position);
        dummy.rotation.set(v.pitch, v.rotationY, v.roll);
        const bodyScale = v.vehicleClass === 'CARGO' ? [1.2, 1.08, 1.35] : v.vehicleClass === 'TAXI' ? [0.92, 0.9, 1.02] : v.vehicleClass === 'CORPORATE' ? [1.04, 1, 1.08] : [1, 1, 1];
        dummy.scale.set(bodyScale[0], bodyScale[1], bodyScale[2]);
        dummy.updateMatrix();
        groundBodyMesh.current.setMatrixAt(groundIdx, dummy.matrix);

        // Canopy Cabin
        if (groundGlassMesh.current) {
          dummy.position.set(v.position.x, v.position.y + 0.45, v.position.z);
          dummy.rotation.set(v.pitch, v.rotationY, v.roll);
          dummy.updateMatrix();
          groundGlassMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        // Headlights (forward relative offset, zero allocation)
        if (groundHeadlightMesh.current) {
          dummy.position.copy(v.position);
          dummy.rotation.set(v.pitch, v.rotationY, v.roll);
          dummy.translateZ(2.05);
          dummy.translateY(0.05);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          groundHeadlightMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        // Taillights (rear relative offset, zero allocation): flare brighter/taller when braking or stopped
        if (groundTaillightMesh.current) {
          dummy.position.copy(v.position);
          dummy.rotation.set(v.pitch, v.rotationY, v.roll);
          dummy.translateZ(-2.05);
          dummy.translateY(0.05);
          const brakeScale = v.isBraking || v.speed < 2.0 ? 1.8 : 1.0;
          dummy.scale.set(v.vehicleClass === 'CARGO' ? 1.15 : 1, brakeScale, 1);
          dummy.updateMatrix();
          groundTaillightMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        if (groundEmergencyLightMesh.current) {
          const hasBeacon = v.vehicleClass === 'POLICE' || v.vehicleClass === 'EMERGENCY';
          const beaconPulse = hasBeacon ? (0.72 + 0.28 * Math.sin(now * 0.014 + i)) : 0;
          dummy.position.copy(v.position);
          dummy.rotation.set(v.pitch, v.rotationY, v.roll);
          dummy.translateY(0.42);
          dummy.scale.set(beaconPulse, beaconPulse, beaconPulse);
          dummy.updateMatrix();
          groundEmergencyLightMesh.current.setMatrixAt(groundIdx, dummy.matrix);
        }

        if (groundWheelMesh.current) {
          const wheelOffsets: Array<[number, number]> = [
            [-0.82, 1.28],
            [0.82, 1.28],
            [-0.82, -1.28],
            [0.82, -1.28],
          ];
          wheelOffsets.forEach(([x, z], wheelIndex) => {
            dummy.position.copy(v.position);
            dummy.rotation.set(v.pitch, v.rotationY, v.roll);
            dummy.translateX(x);
            dummy.translateY(-0.18);
            dummy.translateZ(z);
            dummy.rotateZ(Math.PI / 2);
            dummy.rotateX(v.wheelSpin);
            dummy.updateMatrix();
            groundWheelMesh.current?.setMatrixAt(groundIdx * 4 + wheelIndex, dummy.matrix);
          });
        }

        groundIdx++;
      } else if (v.type === 'AERIAL' && aerialBodyMesh.current) {
        if (aerialIdx >= maxAerial) continue;

        // Aerial Skyway Commuter
        dummy.position.copy(v.position);
        dummy.rotation.set(Math.PI / 2, v.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        aerialBodyMesh.current.setMatrixAt(aerialIdx, dummy.matrix);

        // Plasma Exhaust Trail (zero allocation)
        if (aerialTrailMesh.current) {
          const trailX = -sinY * 3.2;
          const trailZ = -cosY * 3.2;
          dummy.position.set(v.position.x + trailX, v.position.y, v.position.z + trailZ);
          dummy.rotation.set(Math.PI / 2, v.rotationY, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          aerialTrailMesh.current.setMatrixAt(aerialIdx, dummy.matrix);
        }

        aerialIdx++;
      }
    }

    if (groundShadowMesh.current) {
      groundShadowMesh.current.count = groundIdx;
      groundShadowMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundBodyMesh.current) {
      groundBodyMesh.current.count = groundIdx;
      groundBodyMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundGlassMesh.current) {
      groundGlassMesh.current.count = groundIdx;
      groundGlassMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundHeadlightMesh.current) {
      groundHeadlightMesh.current.count = groundIdx;
      groundHeadlightMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundTaillightMesh.current) {
      groundTaillightMesh.current.count = groundIdx;
      groundTaillightMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundWheelMesh.current) {
      groundWheelMesh.current.count = groundIdx * 4;
      groundWheelMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (groundEmergencyLightMesh.current) {
      groundEmergencyLightMesh.current.count = groundIdx;
      groundEmergencyLightMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (aerialBodyMesh.current) {
      aerialBodyMesh.current.count = aerialIdx;
      aerialBodyMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (aerialTrailMesh.current) {
      aerialTrailMesh.current.count = aerialIdx;
      aerialTrailMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="TrafficSystemLayer">
      {/* Temporary accident marker: a visible, reusable disruption prop */}
      <group ref={accidentMarkerRef} position={[0, 0.02, 0]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.2, 32]} />
          <meshBasicMaterial color="#ff1744" transparent opacity={0.18} />
        </mesh>
        {[-2.2, 2.2].map((x) => (
          <mesh key={x} position={[x, 0.35, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.16, 0.7, 0.16]} />
            <meshStandardMaterial color="#f59e0b" emissive="#ff1744" emissiveIntensity={1.2} />
          </mesh>
        ))}
        <pointLight position={[0, 2.2, 0]} color="#ff1744" intensity={2.2} distance={14} />
      </group>
      {TrafficIncidentSystem.getInstance().getIncidents().map((incident) => (
        <group key={incident.id} position={[incident.position.x, incident.position.y, incident.position.z]} rotation={[0, incident.damageSeed, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[incident.radius * 1.5, 1.4]} /><meshBasicMaterial color="#f97316" transparent opacity={0.22} /></mesh>
          <mesh position={[0, 0.18, 0]} rotation={[0.2, 0.4, 0.15]}><boxGeometry args={[1.2, 0.35, 0.7]} /><meshStandardMaterial color="#475569" metalness={0.65} roughness={0.6} /></mesh>
          <mesh position={[1.1, 0.12, -0.35]} rotation={[0, 0.2, 0.5]}><boxGeometry args={[0.5, 0.22, 0.35]} /><meshStandardMaterial color="#991b1b" emissive="#450a0a" emissiveIntensity={0.6} /></mesh>
          <pointLight position={[0, 1.2, 0]} color="#f97316" intensity={0.9} distance={7} />
        </group>
      ))}
      {/* 0. Ground Cruiser Contact Occlusion Shadow */}
      <instancedMesh
        frustumCulled={false}
        ref={groundShadowMesh}
        args={[groundShadowGeo, undefined, GROUND_COUNT]}
      >
        <meshBasicMaterial color="#000000" transparent opacity={0.62} depthWrite={false} />
      </instancedMesh>

      {/* 1. Ground Cruiser Chassis */}
      <instancedMesh
        frustumCulled={false}
        ref={groundBodyMesh}
        args={[groundBodyGeo, undefined, GROUND_COUNT]}
        castShadow={quality.shadows}
        receiveShadow={quality.shadows}
      >
        <meshStandardMaterial vertexColors color="#1e293b" roughness={0.25} metalness={0.85} />
      </instancedMesh>

      {/* 1b. Procedural rubber wheels with signed spin */}
      <instancedMesh frustumCulled={false} ref={groundWheelMesh} args={[groundWheelGeo, undefined, GROUND_COUNT * 4]} castShadow={quality.shadows}>
        <meshStandardMaterial color="#050914" roughness={0.72} metalness={0.35} />
      </instancedMesh>

      {/* 1c. Deterministic emergency beacons (police and response vehicles) */}
      <instancedMesh frustumCulled={false} ref={groundEmergencyLightMesh} args={[groundEmergencyLightGeo, undefined, GROUND_COUNT]}>
        <meshBasicMaterial vertexColors color="#ef4444" toneMapped={false} />
      </instancedMesh>

      {/* 2. Ground Cruiser Cockpit Glass */}
      <instancedMesh
        frustumCulled={false}
        ref={groundGlassMesh}
        args={[groundGlassGeo, undefined, GROUND_COUNT]}
      >
        <meshStandardMaterial color="#00f0ff" roughness={0.1} metalness={0.9} transparent opacity={0.65} />
      </instancedMesh>

      {/* 3. Glowing LED Headlights */}
      <instancedMesh
        frustumCulled={false}
        ref={groundHeadlightMesh}
        args={[headlightGeo, undefined, GROUND_COUNT]}
      >
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      {/* 4. Glowing Red LED Taillight Bar */}
      <instancedMesh
        frustumCulled={false}
        ref={groundTaillightMesh}
        args={[taillightGeo, undefined, GROUND_COUNT]}
      >
        <meshBasicMaterial color="#ff0044" />
      </instancedMesh>

      {/* 5. Aerial Skyway Commuters */}
      <instancedMesh
        frustumCulled={false}
        ref={aerialBodyMesh}
        args={[aerialBodyGeo, undefined, AERIAL_COUNT]}
      >
        <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.9} emissive="#0284c7" emissiveIntensity={0.6} />
      </instancedMesh>

      {/* 6. Aerial Plasma Exhaust Jet Trails */}
      <instancedMesh
        frustumCulled={false}
        ref={aerialTrailMesh}
        args={[aerialTrailGeo, undefined, AERIAL_COUNT]}
      >
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.75} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
};
