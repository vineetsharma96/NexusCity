import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import {
  createAirfoilWingGeometry,
  createAlloySpokeGeometry,
  createAPillarGeometry,
  createBrakeCaliperGeometry,
  createBucketSeatGeometry,
  createCanardWingletGeometry,
  createDiffuserFinGeometry,
  createEngineLouverGeometry,
  createExhaustNozzleGeometry,
  createFlyingButtressGeometry,
  createForgedRimBarrelGeometry,
  createFrontAccentLightGeometry,
  createFrontHeadlightGeometry,
  createFrontSplitterGeometry,
  createKineticRailGeometry,
  createMirrorStalkGeometry,
  createRearDiffuserGeometry,
  createRearTaillightBladeGeometry,
  createReverseLightGeometry,
  createRoofSpineGeometry,
  createSculptedHypercarBodyGeometry,
  createSculptedTireGeometry,
  createSideSillLightGeometry,
  createSideSkirtGeometry,
  createSteeringYokeGeometry,
  createSwanNeckPylonGeometry,
  createTeardropCanopyGeometry,
  createWingEndplateGeometry,
} from './ExperimentalCarGeometry';

const CAR_ID = 'vx-01-experimental';
const CAR_LABEL = 'VX-01 Apex Prototype';
// Parked cleanly on the widened 22m Grand Boulevard shoulder right in front-left of spawn (0, 0.2, 10), facing north (-Z)
const INITIAL_CAR_POS: [number, number, number] = [-8.8, 0.02, 5.5];
const INITIAL_CAR_ROT_Y = Math.PI;

const WHEEL_RADIUS = 0.37;
const WHEEL_WIDTH = 0.29;
const SPOKE_ANGLES = [0, (Math.PI * 2) / 5, (Math.PI * 4) / 5, (Math.PI * 6) / 5, (Math.PI * 8) / 5];

interface WheelMount {
  key: string;
  x: number;
  z: number;
  isFront: boolean;
  isLeft: boolean;
}

const WHEEL_MOUNTS: WheelMount[] = [
  { key: 'FL', x: 0.96, z: 1.43, isFront: true, isLeft: true },
  { key: 'FR', x: -0.96, z: 1.43, isFront: true, isLeft: false },
  { key: 'RL', x: 0.98, z: -1.43, isFront: false, isLeft: true },
  { key: 'RR', x: -0.98, z: -1.43, isFront: false, isLeft: false },
];

export const ExperimentalCar: React.FC = () => {
  const rootRef = useRef<THREE.Group>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const frontLeftSteerRef = useRef<THREE.Group>(null);
  const frontRightSteerRef = useRef<THREE.Group>(null);
  const wheelSpinRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const steeringYokeRef = useRef<THREE.Group>(null);
  const rearWingBladeRef = useRef<THREE.Group>(null);

  const headLightLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const headLightRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const brakeLightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const reverseLightLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const reverseLightRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const exhaustGlowLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const exhaustGlowRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRailLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRailRightMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const system = VehicleInteractionSystem.getInstance();
  const shadows = QualityManager.current.shadows;

  // Sculpted, compound-curved procedural hypercar & wheel geometries (zero blocky cubes)
  const geos = useMemo(() => {
    const bodyMonocoque = createSculptedHypercarBodyGeometry();
    const canopyGlass = createTeardropCanopyGeometry();
    const frontSplitter = createFrontSplitterGeometry();
    const canardWinglet = createCanardWingletGeometry();
    const sideSkirt = createSideSkirtGeometry();
    const wingAirfoil = createAirfoilWingGeometry(2.02);
    const wingEndplate = createWingEndplateGeometry();
    const wingPylon = createSwanNeckPylonGeometry();
    const rearDiffuser = createRearDiffuserGeometry();
    const diffuserFin = createDiffuserFinGeometry();
    const buttressLeft = createFlyingButtressGeometry(1);
    const buttressRight = createFlyingButtressGeometry(-1);
    const aPillarLeft = createAPillarGeometry(1);
    const aPillarRight = createAPillarGeometry(-1);
    const roofSpine = createRoofSpineGeometry();
    const headlightLeft = createFrontHeadlightGeometry(1);
    const headlightRight = createFrontHeadlightGeometry(-1);
    const frontAccentLight = createFrontAccentLightGeometry();
    const rearTaillight = createRearTaillightBladeGeometry();
    const reverseLightLeft = createReverseLightGeometry(1);
    const reverseLightRight = createReverseLightGeometry(-1);
    const mirrorStalkLeft = createMirrorStalkGeometry(1);
    const mirrorStalkRight = createMirrorStalkGeometry(-1);
    const mirrorPod = new THREE.SphereGeometry(0.068, 16, 12);
    mirrorPod.scale(1.25, 0.58, 1.6);

    const engineLouver = createEngineLouverGeometry();
    const kineticRailLeft = createKineticRailGeometry(1);
    const kineticRailRight = createKineticRailGeometry(-1);
    const sideSillLightLeft = createSideSillLightGeometry(1);
    const sideSillLightRight = createSideSillLightGeometry(-1);
    const bucketSeat = createBucketSeatGeometry();
    const steeringYoke = createSteeringYokeGeometry();
    const exhaustNozzle = createExhaustNozzleGeometry();

    // Sculpted wheel & brake assemblies
    const tire = createSculptedTireGeometry(WHEEL_RADIUS, WHEEL_WIDTH);
    const rimBarrel = createForgedRimBarrelGeometry(WHEEL_RADIUS, WHEEL_WIDTH);
    const rimLip = new THREE.TorusGeometry(0.246, 0.015, 10, 28);
    rimLip.rotateY(Math.PI / 2);
    const tireBeadRing = new THREE.TorusGeometry(0.322, 0.018, 10, 28);
    tireBeadRing.rotateY(Math.PI / 2);
    const hubCore = new THREE.CylinderGeometry(0.066, 0.072, WHEEL_WIDTH + 0.026, 16);
    hubCore.rotateZ(Math.PI / 2);
    const spoke = createAlloySpokeGeometry();
    const treadLug = new THREE.CapsuleGeometry(0.011, WHEEL_WIDTH * 0.72, 4, 8);
    treadLug.rotateZ(Math.PI / 2);
    const brakeDisc = new THREE.CylinderGeometry(0.195, 0.195, 0.032, 24);
    brakeDisc.rotateZ(Math.PI / 2);
    const caliper = createBrakeCaliperGeometry();

    // Curved cockpit dashboard cowl
    const dashCowl = new THREE.CylinderGeometry(0.09, 0.11, 1.18, 16, 1, false, 0, Math.PI);
    dashCowl.rotateZ(Math.PI / 2);
    dashCowl.scale(1, 0.72, 1.35);

    return {
      bodyMonocoque,
      canopyGlass,
      frontSplitter,
      canardWinglet,
      sideSkirt,
      wingAirfoil,
      wingEndplate,
      wingPylon,
      rearDiffuser,
      diffuserFin,
      buttressLeft,
      buttressRight,
      aPillarLeft,
      aPillarRight,
      roofSpine,
      headlightLeft,
      headlightRight,
      frontAccentLight,
      rearTaillight,
      reverseLightLeft,
      reverseLightRight,
      mirrorStalkLeft,
      mirrorStalkRight,
      mirrorPod,
      engineLouver,
      kineticRailLeft,
      kineticRailRight,
      sideSillLightLeft,
      sideSillLightRight,
      bucketSeat,
      steeringYoke,
      exhaustNozzle,
      tire,
      rimBarrel,
      rimLip,
      tireBeadRing,
      hubCore,
      spoke,
      treadLug,
      brakeDisc,
      caliper,
      dashCowl,
    };
  }, []);

  // Automotive clearcoat metallic paint, satin carbon, obsidian glass & matte tire PBR materials
  const mats = useMemo(() => {
    const bodyPaint = new THREE.MeshPhysicalMaterial({
      color: '#dce4ef',
      metalness: 0.82,
      roughness: 0.17,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const bodySecondary = new THREE.MeshPhysicalMaterial({
      color: '#0e1627',
      metalness: 0.78,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    const forgedCarbon = new THREE.MeshPhysicalMaterial({
      color: '#171d27',
      metalness: 0.26,
      roughness: 0.48,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
    });
    const brushedTitanium = new THREE.MeshStandardMaterial({
      color: '#9fb0c5',
      metalness: 0.94,
      roughness: 0.24,
    });
    const alloyRim = new THREE.MeshStandardMaterial({
      color: '#d8e1ec',
      metalness: 0.95,
      roughness: 0.16,
    });
    const tireRubber = new THREE.MeshStandardMaterial({
      color: '#11141a',
      metalness: 0.05,
      roughness: 0.88,
    });
    const tireWallAccent = new THREE.MeshStandardMaterial({
      color: '#232a36',
      metalness: 0.1,
      roughness: 0.74,
    });
    const brakeRotor = new THREE.MeshStandardMaterial({
      color: '#64748b',
      metalness: 0.88,
      roughness: 0.34,
    });
    const brakeCaliper = new THREE.MeshPhysicalMaterial({
      color: '#ef4444',
      metalness: 0.55,
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    const canopyGlass = new THREE.MeshPhysicalMaterial({
      color: '#07101f',
      metalness: 0.86,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const interiorLeather = new THREE.MeshStandardMaterial({
      color: '#1d2638',
      metalness: 0.12,
      roughness: 0.72,
    });

    return {
      bodyPaint,
      bodySecondary,
      forgedCarbon,
      brushedTitanium,
      alloyRim,
      tireRubber,
      tireWallAccent,
      brakeRotor,
      brakeCaliper,
      canopyGlass,
      interiorLeather,
    };
  }, []);

  // Dispose all procedural GPU geometries and PBR materials cleanly on unmount
  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [geos, mats]);

  // Register controllable experimental wheeled car with VehicleInteractionSystem and set initial transform once
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.position.set(...INITIAL_CAR_POS);
      rootRef.current.rotation.set(0, INITIAL_CAR_ROT_Y, 0);
    }
    system.registerRideable(
      CAR_ID,
      CAR_LABEL,
      new THREE.Vector3(...INITIAL_CAR_POS),
      'vehicle',
      INITIAL_CAR_ROT_Y,
      'car'
    );
    return () => {
      system.unregisterRideable(CAR_ID);
    };
  }, [system]);

  const smoothPitchRef = useRef(0);
  const smoothRollRef = useRef(0);
  const smoothWingRef = useRef(-0.08);
  const parkedSpinRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const state = system.getState();
    const isActive = state.mode === 'RIDING' && state.activeId === CAR_ID;

    if (rootRef.current) {
      const pos = system.getRideablePosition(CAR_ID);
      const rotY = system.getRideableRotationY(CAR_ID);
      rootRef.current.position.set(pos.x, 0.02, pos.z);
      rootRef.current.rotation.y = rotY;
    }

    const telemetry = isActive ? state.telemetry : null;
    const steerAngle = telemetry ? telemetry.steeringAngle : 0;
    const wheelSpin = telemetry ? telemetry.wheelSpinRad : parkedSpinRef.current;
    if (telemetry) {
      parkedSpinRef.current = telemetry.wheelSpinRad;
    }

    // Ackermann front steering (inner wheel turns sharper than outer wheel)
    const innerBias = 1.12;
    const outerBias = 0.92;
    const leftSteer = steerAngle > 0 ? steerAngle * innerBias : steerAngle * outerBias;
    const rightSteer = steerAngle < 0 ? steerAngle * innerBias : steerAngle * outerBias;

    if (frontLeftSteerRef.current) frontLeftSteerRef.current.rotation.y = leftSteer;
    if (frontRightSteerRef.current) frontRightSteerRef.current.rotation.y = rightSteer;

    // Spin all 4 wheels forward (+) or backward (-) proportional to ground displacement
    for (let i = 0; i < 4; i++) {
      const spinGroup = wheelSpinRefs.current[i];
      if (spinGroup) {
        spinGroup.rotation.x = wheelSpin;
      }
    }

    // Articulated cockpit steering yoke rotates smoothly with steering input
    if (steeringYokeRef.current) {
      steeringYokeRef.current.rotation.z = -steerAngle * 2.35;
    }

    // Dynamic chassis suspension pitch (accel squat / brake dive) and cornering roll
    const targetPitch = telemetry ? THREE.MathUtils.clamp(-telemetry.longitudinalAccelG * 0.022, -0.055, 0.055) : 0;
    const targetRoll = telemetry ? THREE.MathUtils.clamp(telemetry.lateralAccelG * 0.032, -0.06, 0.06) : 0;
    const suspDamp = 1 - Math.exp(-10 * dt);
    smoothPitchRef.current = THREE.MathUtils.lerp(smoothPitchRef.current, targetPitch, suspDamp);
    smoothRollRef.current = THREE.MathUtils.lerp(smoothRollRef.current, targetRoll, suspDamp);

    if (chassisRef.current) {
      const engineIdleVib = isActive ? Math.sin(t * 28) * 0.0018 : 0;
      chassisRef.current.rotation.x = smoothPitchRef.current;
      chassisRef.current.rotation.z = smoothRollRef.current;
      chassisRef.current.position.y = engineIdleVib;
    }

    // Active swan-neck airfoil wing: deploys as airbrake on braking, flattens during boost
    const targetWingTilt = telemetry
      ? telemetry.isBraking && telemetry.speedMs > 2.5
        ? -0.44
        : telemetry.isBoosting
        ? 0.02
        : -0.08 - Math.min(0.12, telemetry.speedMs * 0.003)
      : -0.08;
    smoothWingRef.current = THREE.MathUtils.lerp(smoothWingRef.current, targetWingTilt, 1 - Math.exp(-9 * dt));
    if (rearWingBladeRef.current) {
      rearWingBladeRef.current.rotation.x = smoothWingRef.current;
    }

    // Dynamic HDR Lighting (curved laser headlamps, full-width brake blade, reverse lamps, exhaust flare)
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const headGain = 1.25 + nightFactor * 1.9 + (isActive ? 0.35 : 0);
    if (headLightLeftMatRef.current) {
      headLightLeftMatRef.current.color.set('#f0f9ff').multiplyScalar(headGain);
    }
    if (headLightRightMatRef.current) {
      headLightRightMatRef.current.color.set('#f0f9ff').multiplyScalar(headGain);
    }

    const isBraking = telemetry?.isBraking ?? false;
    const isReversing = telemetry ? telemetry.isReversing || telemetry.gear === 'R' : false;
    const isBoosting = telemetry?.isBoosting ?? false;

    if (brakeLightMatRef.current) {
      const brakeGain = isBraking ? 4.2 : 1.05 + nightFactor * 1.1;
      brakeLightMatRef.current.color.set('#f43f5e').multiplyScalar(brakeGain);
    }

    const revColor = isReversing ? '#ffffff' : '#1e293b';
    const revScale = isReversing ? 2.9 + nightFactor * 0.8 : 1.0;
    if (reverseLightLeftMatRef.current) {
      reverseLightLeftMatRef.current.color.set(revColor).multiplyScalar(revScale);
    }
    if (reverseLightRightMatRef.current) {
      reverseLightRightMatRef.current.color.set(revColor).multiplyScalar(revScale);
    }

    const throttleGlow = isBoosting
      ? 3.6 + Math.sin(t * 40) * 0.4
      : telemetry && telemetry.longitudinalAccelG > 0.25
      ? 1.9
      : 0.45;
    const exhaustHex = isBoosting ? '#38bdf8' : '#f59e0b';
    if (exhaustGlowLeftMatRef.current) {
      exhaustGlowLeftMatRef.current.color.set(exhaustHex).multiplyScalar(throttleGlow);
    }
    if (exhaustGlowRightMatRef.current) {
      exhaustGlowRightMatRef.current.color.set(exhaustHex).multiplyScalar(throttleGlow);
    }

    const railPulse = 1.25 + Math.sin(t * (isBoosting ? 12 : 3.2)) * 0.25 + (isBoosting ? 1.4 : 0);
    const railHex = isReversing ? '#f8fafc' : '#38bdf8';
    if (coreRailLeftMatRef.current) {
      coreRailLeftMatRef.current.color.set(railHex).multiplyScalar(railPulse);
    }
    if (coreRailRightMatRef.current) {
      coreRailRightMatRef.current.color.set(railHex).multiplyScalar(railPulse);
    }
  }, -1);

  return (
    <group ref={rootRef} name="ExperimentalCar_VX01">
      {/* ==================== 4 ARTICULATED SCULPTED WHEELS ==================== */}
      {WHEEL_MOUNTS.map((w, idx) => {
        const steerRef = w.key === 'FL' ? frontLeftSteerRef : w.key === 'FR' ? frontRightSteerRef : undefined;
        const outerSign = w.isLeft ? 1 : -1;
        return (
          <group key={w.key} position={[w.x, WHEEL_RADIUS, w.z]}>
            {/* Steering Knuckle Pivot */}
            <group ref={steerRef}>
              {/* Ventilated Brake Rotor & Curved Crimson 6-Piston Brake Caliper */}
              <mesh position={[-outerSign * 0.04, 0, 0]} geometry={geos.brakeDisc} material={mats.brakeRotor} />
              <mesh
                position={[-outerSign * 0.03, 0, 0]}
                rotation={[w.isFront ? Math.PI : 0, 0, 0]}
                geometry={geos.caliper}
                material={mats.brakeCaliper}
              />

              {/* Spinning Sculpted Tire & Forged 5-Spoke Alloy Wheel */}
              <group
                ref={(el) => {
                  wheelSpinRefs.current[idx] = el;
                }}
              >
                <mesh geometry={geos.tire} material={mats.tireRubber} castShadow={shadows} />
                <mesh
                  position={[outerSign * (WHEEL_WIDTH * 0.46), 0, 0]}
                  geometry={geos.tireBeadRing}
                  material={mats.tireWallAccent}
                />
                <mesh geometry={geos.rimBarrel} material={mats.bodySecondary} />
                <mesh
                  position={[outerSign * (WHEEL_WIDTH * 0.48), 0, 0]}
                  geometry={geos.rimLip}
                  material={mats.alloyRim}
                />
                <mesh geometry={geos.hubCore} material={mats.brushedTitanium} />
                <mesh position={[outerSign * (WHEEL_WIDTH * 0.53), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.038, 0.038, 0.024, 6]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>

                {/* 5 Tapered Beveled Alloy Spokes + Smooth Capsule Shoulder Lugs */}
                {SPOKE_ANGLES.map((angle, sIdx) => {
                  const sinA = Math.sin(angle);
                  const cosA = Math.cos(angle);
                  return (
                    <React.Fragment key={sIdx}>
                      <mesh
                        position={[outerSign * (WHEEL_WIDTH * 0.36), 0, 0]}
                        rotation={[angle, 0, 0]}
                        geometry={geos.spoke}
                        material={mats.alloyRim}
                      />
                      <mesh
                        position={[0, cosA * (WHEEL_RADIUS - 0.005), sinA * (WHEEL_RADIUS - 0.005)]}
                        geometry={geos.treadLug}
                        material={mats.tireWallAccent}
                      />
                    </React.Fragment>
                  );
                })}
              </group>
            </group>
          </group>
        );
      })}

      {/* ==================== SMOOTH SCULPTED HYPERCAR MONOCOQUE CHASSIS ==================== */}
      <group ref={chassisRef}>
        {/* 1. Primary Compound-Curved Lofted Monocoque Body Shell (Clearcoat Silver-Pearl) */}
        <mesh
          geometry={geos.bodyMonocoque}
          material={mats.bodyPaint}
          castShadow={shadows}
          receiveShadow
        />

        {/* 2. Panoramic Compound-Curved Teardrop Glass Canopy, A-Pillars & Dorsal Roof Intake */}
        <mesh geometry={geos.canopyGlass} material={mats.canopyGlass} renderOrder={2} />
        <mesh geometry={geos.aPillarLeft} material={mats.bodySecondary} />
        <mesh geometry={geos.aPillarRight} material={mats.bodySecondary} />
        <mesh geometry={geos.roofSpine} material={mats.forgedCarbon} castShadow={shadows} />

        {/* 3. Sculpted Swept Flying Aero Buttresses (C-Pillar to Muscular Rear Haunches) */}
        <mesh geometry={geos.buttressLeft} material={mats.bodyPaint} castShadow={shadows} />
        <mesh geometry={geos.buttressRight} material={mats.bodyPaint} castShadow={shadows} />

        {/* 4. Teardrop Aerodynamic Side Mirrors on Curved Stalks */}
        <mesh geometry={geos.mirrorStalkLeft} material={mats.forgedCarbon} />
        <mesh geometry={geos.mirrorStalkRight} material={mats.forgedCarbon} />
        <mesh position={[0.99, 0.84, 0.59]} rotation={[0, -0.18, 0]} geometry={geos.mirrorPod} material={mats.brushedTitanium} />
        <mesh position={[-0.99, 0.84, 0.59]} rotation={[0, 0.18, 0]} geometry={geos.mirrorPod} material={mats.brushedTitanium} />

        {/* 5. Curved Carbon Crescent Front Aero Splitter, Canards & Accent Light Bar */}
        <mesh position={[0, 0.215, 0]} geometry={geos.frontSplitter} material={mats.forgedCarbon} castShadow={shadows} />
        <mesh position={[0.98, 0.29, 2.08]} rotation={[0, 0.14, 0]} geometry={geos.canardWinglet} material={mats.forgedCarbon} />
        <mesh position={[-0.98, 0.29, 2.08]} rotation={[0, -0.14, 0]} geometry={geos.canardWinglet} material={mats.forgedCarbon} />
        <mesh geometry={geos.frontAccentLight}>
          <meshBasicMaterial color="#38bdf8" toneMapped={false} />
        </mesh>

        {/* 6. Contoured Carbon Side Skirts & Curved Cyan Sill Light Pipes */}
        <mesh position={[0.92, 0.22, 0]} geometry={geos.sideSkirt} material={mats.forgedCarbon} castShadow={shadows} />
        <mesh position={[-0.92, 0.22, 0]} geometry={geos.sideSkirt} material={mats.forgedCarbon} castShadow={shadows} />
        <mesh geometry={geos.sideSillLightLeft}>
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh geometry={geos.sideSillLightRight}>
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* 7. Visible Sculpted Cockpit Interior (Curved Dash, Bucket Seats & Articulated Steering Yoke) */}
        <mesh position={[0, 0.72, 0.52]} geometry={geos.dashCowl} material={mats.forgedCarbon} />
        <group position={[0.32, 0.78, 0.28]} rotation={[-0.28, 0, 0]}>
          <group ref={steeringYokeRef}>
            <mesh geometry={geos.steeringYoke} material={mats.brushedTitanium} />
            <mesh position={[0, -0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.03, 14]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.015, -0.018]}>
              <cylinderGeometry args={[0.022, 0.022, 0.01, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>
        <mesh position={[0.32, 0.56, -0.16]} geometry={geos.bucketSeat} material={mats.interiorLeather} />
        <mesh position={[-0.32, 0.56, -0.16]} geometry={geos.bucketSeat} material={mats.interiorLeather} />

        {/* 8. Mid-Engine Curved Cooling Louvers & Luminous Twin Kinetic Energy Conduits */}
        <mesh geometry={geos.kineticRailLeft}>
          <meshBasicMaterial ref={coreRailLeftMatRef} color="#38bdf8" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.kineticRailRight}>
          <meshBasicMaterial ref={coreRailRightMatRef} color="#38bdf8" toneMapped={false} />
        </mesh>
        {[-1.08, -1.32, -1.56, -1.8].map((lz, lIdx) => (
          <mesh
            key={`louver-${lIdx}`}
            position={[0, 0.855 - lIdx * 0.032, lz]}
            geometry={geos.engineLouver}
            material={mats.brushedTitanium}
          />
        ))}

        {/* 9. Sculpted Rear Venturi Diffuser, Curved Aero Strakes & Twin Bell Titanium Exhausts */}
        <mesh position={[0, 0.29, -2.14]} rotation={[0.16, 0, 0]} geometry={geos.rearDiffuser} material={mats.forgedCarbon} />
        {[-0.64, -0.32, 0, 0.32, 0.64].map((dx, dIdx) => (
          <mesh
            key={`fin-${dIdx}`}
            position={[dx, 0.27, -2.24]}
            geometry={geos.diffuserFin}
            material={mats.forgedCarbon}
          />
        ))}
        {([-0.36, 0.36] as const).map((ex, eIdx) => (
          <group key={`exhaust-${eIdx}`} position={[ex, 0.39, -2.2]}>
            <mesh geometry={geos.exhaustNozzle} material={mats.brushedTitanium} />
            <mesh position={[0, 0, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.068, 0.068, 0.03, 16]} />
              <meshBasicMaterial
                ref={eIdx === 0 ? exhaustGlowLeftMatRef : exhaustGlowRightMatRef}
                color="#f59e0b"
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {/* 10. Active Swan-Neck Rear GT Airfoil Wing (True Cambered Airfoil Blade + Curved Endplates) */}
        <group position={[0, 0.91, -2.02]}>
          <mesh position={[0.48, -0.02, 0.02]} geometry={geos.wingPylon} material={mats.forgedCarbon} />
          <mesh position={[-0.48, -0.02, 0.02]} geometry={geos.wingPylon} material={mats.forgedCarbon} />
          <group ref={rearWingBladeRef} position={[0, 0.14, -0.02]}>
            <mesh geometry={geos.wingAirfoil} material={mats.forgedCarbon} castShadow={shadows} />
            <mesh position={[1.02, -0.01, 0]} geometry={geos.wingEndplate} material={mats.bodyPaint} />
            <mesh position={[-1.02, -0.01, 0]} geometry={geos.wingEndplate} material={mats.bodyPaint} />
          </group>
        </group>

        {/* 11. Curved Wraparound HDR Headlamps, Full-Width Brake Blade & Twin Reverse Lenses */}
        <mesh geometry={geos.headlightLeft}>
          <meshBasicMaterial ref={headLightLeftMatRef} color="#f0f9ff" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.headlightRight}>
          <meshBasicMaterial ref={headLightRightMatRef} color="#f0f9ff" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.rearTaillight}>
          <meshBasicMaterial ref={brakeLightMatRef} color="#f43f5e" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.reverseLightLeft}>
          <meshBasicMaterial ref={reverseLightLeftMatRef} color="#1e293b" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.reverseLightRight}>
          <meshBasicMaterial ref={reverseLightRightMatRef} color="#1e293b" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
};
