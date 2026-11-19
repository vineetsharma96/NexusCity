import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';

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

  const headLightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const brakeLightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const reverseLightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const exhaustGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRailMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const underglowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const system = VehicleInteractionSystem.getInstance();
  const shadows = QualityManager.current.shadows;

  // Shared procedural geometries for 4 articulated wheels & sculpted body details
  const wheelGeos = useMemo(() => {
    const tire = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 24);
    tire.rotateZ(Math.PI / 2);

    const rimBarrel = new THREE.CylinderGeometry(0.245, 0.245, WHEEL_WIDTH + 0.014, 18);
    rimBarrel.rotateZ(Math.PI / 2);

    const rimLip = new THREE.TorusGeometry(0.245, 0.018, 8, 22);
    rimLip.rotateY(Math.PI / 2);

    const tireBeadRing = new THREE.TorusGeometry(0.325, 0.022, 8, 22);
    tireBeadRing.rotateY(Math.PI / 2);

    const hubCore = new THREE.CylinderGeometry(0.068, 0.074, WHEEL_WIDTH + 0.032, 12);
    hubCore.rotateZ(Math.PI / 2);

    const spoke = new THREE.BoxGeometry(0.032, 0.22, 0.044);
    const treadTick = new THREE.BoxGeometry(WHEEL_WIDTH + 0.008, 0.024, 0.035);

    const brakeDisc = new THREE.CylinderGeometry(0.195, 0.195, 0.036, 18);
    brakeDisc.rotateZ(Math.PI / 2);

    const caliper = new THREE.BoxGeometry(0.085, 0.14, 0.09);

    return { tire, rimBarrel, rimLip, tireBeadRing, hubCore, spoke, treadTick, brakeDisc, caliper };
  }, []);

  // Shared sculpted carbon/metallic/glass/rubber PBR materials with wide roughness contrast
  const mats = useMemo(() => {
    const bodyPaint = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.88,
      roughness: 0.16,
    });
    const bodySecondary = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.86,
      roughness: 0.24,
    });
    const forgedCarbon = new THREE.MeshStandardMaterial({
      color: '#181e29',
      metalness: 0.28,
      roughness: 0.56,
    });
    const brushedTitanium = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.94,
      roughness: 0.26,
    });
    const alloyRim = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.95,
      roughness: 0.18,
    });
    const tireRubber = new THREE.MeshStandardMaterial({
      color: '#11141a',
      metalness: 0.06,
      roughness: 0.86,
    });
    const tireWallAccent = new THREE.MeshStandardMaterial({
      color: '#252c38',
      metalness: 0.12,
      roughness: 0.72,
    });
    const brakeRotor = new THREE.MeshStandardMaterial({
      color: '#64748b',
      metalness: 0.88,
      roughness: 0.34,
    });
    const brakeCaliper = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      metalness: 0.65,
      roughness: 0.28,
    });
    const canopyGlass = new THREE.MeshStandardMaterial({
      color: '#09111f',
      metalness: 0.96,
      roughness: 0.06,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const interiorLeather = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.15,
      roughness: 0.68,
    });
    const contactShadow = new THREE.MeshBasicMaterial({
      color: '#020617',
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
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
      contactShadow,
    };
  }, []);

  // Dispose procedural resources on unmount
  useEffect(() => {
    return () => {
      Object.values(wheelGeos).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [wheelGeos, mats]);

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
  const smoothWingRef = useRef(0.08);
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

    // Ackermann steering angle (inner wheel turns slightly sharper than outer wheel)
    const innerBias = 1.12;
    const outerBias = 0.92;
    const leftSteer = steerAngle > 0 ? steerAngle * innerBias : steerAngle * outerBias;
    const rightSteer = steerAngle < 0 ? steerAngle * innerBias : steerAngle * outerBias;

    if (frontLeftSteerRef.current) frontLeftSteerRef.current.rotation.y = leftSteer;
    if (frontRightSteerRef.current) frontRightSteerRef.current.rotation.y = rightSteer;

    // Spin all 4 wheels forward (+) or backward (-) proportional to true ground distance
    for (let i = 0; i < 4; i++) {
      const spinGroup = wheelSpinRefs.current[i];
      if (spinGroup) {
        spinGroup.rotation.x = wheelSpin;
      }
    }

    // Cockpit steering yoke follows steering input
    if (steeringYokeRef.current) {
      steeringYokeRef.current.rotation.z = -steerAngle * 2.35;
    }

    // Dynamic chassis suspension pitch (squat back on accel, nose-dive on braking) and cornering body roll
    const targetPitch = telemetry ? THREE.MathUtils.clamp(-telemetry.longitudinalAccelG * 0.022, -0.055, 0.055) : 0;
    const targetRoll = telemetry ? THREE.MathUtils.clamp(telemetry.lateralAccelG * 0.032, -0.06, 0.06) : 0;
    const suspDamp = 1 - Math.exp(-10 * dt);
    smoothPitchRef.current = THREE.MathUtils.lerp(smoothPitchRef.current, targetPitch, suspDamp);
    smoothRollRef.current = THREE.MathUtils.lerp(smoothRollRef.current, targetRoll, suspDamp);

    if (chassisRef.current) {
      const engineIdleVib = isActive ? Math.sin(t * 28) * 0.002 : 0;
      chassisRef.current.rotation.x = smoothPitchRef.current;
      chassisRef.current.rotation.z = smoothRollRef.current;
      chassisRef.current.position.y = engineIdleVib;
    }

    // Active GT Aero Wing: deploys upward as an airbrake under braking, trims flat during boost
    const targetWingTilt = telemetry
      ? telemetry.isBraking && telemetry.speedMs > 2.5
        ? -0.46
        : telemetry.isBoosting
        ? 0.02
        : -0.08 - Math.min(0.12, telemetry.speedMs * 0.003)
      : -0.08;
    smoothWingRef.current = THREE.MathUtils.lerp(smoothWingRef.current, targetWingTilt, 1 - Math.exp(-9 * dt));
    if (rearWingBladeRef.current) {
      rearWingBladeRef.current.rotation.x = smoothWingRef.current;
    }

    // Dynamic HDR Lighting (headlights, brake light bar, reverse lamps, exhaust flare)
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const headGain = 1.25 + nightFactor * 1.9 + (isActive ? 0.35 : 0);
    if (headLightMatRef.current) {
      headLightMatRef.current.color.set('#f0f9ff').multiplyScalar(headGain);
    }

    const isBraking = telemetry?.isBraking ?? false;
    const isReversing = telemetry ? telemetry.isReversing || telemetry.gear === 'R' : false;
    const isBoosting = telemetry?.isBoosting ?? false;

    if (brakeLightMatRef.current) {
      const brakeGain = isBraking ? 4.2 : 1.05 + nightFactor * 1.1;
      brakeLightMatRef.current.color.set('#f43f5e').multiplyScalar(brakeGain);
    }

    if (reverseLightMatRef.current) {
      if (isReversing) {
        reverseLightMatRef.current.color.set('#ffffff').multiplyScalar(2.9 + nightFactor * 0.8);
      } else {
        reverseLightMatRef.current.color.set('#1e293b');
      }
    }

    if (exhaustGlowMatRef.current) {
      const throttleGlow = isBoosting
        ? 3.6 + Math.sin(t * 40) * 0.4
        : telemetry && telemetry.longitudinalAccelG > 0.25
        ? 1.9
        : 0.45;
      exhaustGlowMatRef.current.color
        .set(isBoosting ? '#38bdf8' : '#f59e0b')
        .multiplyScalar(throttleGlow);
    }

    if (coreRailMatRef.current) {
      const pulse = 1.25 + Math.sin(t * (isBoosting ? 12 : 3.2)) * 0.25 + (isBoosting ? 1.4 : 0);
      coreRailMatRef.current.color.set(isReversing ? '#f8fafc' : '#38bdf8').multiplyScalar(pulse);
    }

    if (underglowMatRef.current) {
      underglowMatRef.current.opacity = isActive ? (isBoosting ? 0.42 : 0.24) : 0.14;
      underglowMatRef.current.color.set(isBraking ? '#f43f5e' : isReversing ? '#e2e8f0' : '#38bdf8');
    }
  }, -1);

  return (
    <group ref={rootRef} name="ExperimentalCar_VX01">
      {/* Grounded Contact Shadow & Kinetic Underglow Projection (above EW road plane to avoid Z-fighting) */}
      <mesh position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.contactShadow}>
        <planeGeometry args={[2.55, 5.1]} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.15, 4.4]} />
        <meshBasicMaterial
          ref={underglowMatRef}
          color="#38bdf8"
          transparent
          opacity={0.18}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      {/* ==================== 4 ARTICULATED MOVING WHEELS ==================== */}
      {WHEEL_MOUNTS.map((w, idx) => {
        const steerRef = w.key === 'FL' ? frontLeftSteerRef : w.key === 'FR' ? frontRightSteerRef : undefined;
        const outerSign = w.isLeft ? 1 : -1;
        return (
          <group key={w.key} position={[w.x, WHEEL_RADIUS, w.z]}>
            {/* Steering Knuckle Pivot (front wheels steer cleanly left/right; rear wheels stay aligned) */}
            <group ref={steerRef}>
              {/* Stationary Ventilated Brake Rotor & Crimson 6-Piston Brake Caliper */}
              <mesh position={[-outerSign * 0.04, 0, 0]} geometry={wheelGeos.brakeDisc} material={mats.brakeRotor} />
              <mesh
                position={[-outerSign * 0.03, 0.04, w.isFront ? -0.14 : 0.14]}
                geometry={wheelGeos.caliper}
                material={mats.brakeCaliper}
              />

              {/* Spinning Tire & 5-Spoke Alloy Rim Assembly (rotates around X forward/backward!) */}
              <group
                ref={(el) => {
                  wheelSpinRefs.current[idx] = el;
                }}
              >
                {/* Wide Performance Rubber Tire */}
                <mesh geometry={wheelGeos.tire} material={mats.tireRubber} castShadow={shadows} />
                {/* Sidewall Bead Ring */}
                <mesh
                  position={[outerSign * (WHEEL_WIDTH * 0.48), 0, 0]}
                  geometry={wheelGeos.tireBeadRing}
                  material={mats.tireWallAccent}
                />
                {/* Recessed Brushed Alloy Rim Barrel & Outer Rim Lip */}
                <mesh geometry={wheelGeos.rimBarrel} material={mats.bodySecondary} />
                <mesh
                  position={[outerSign * (WHEEL_WIDTH * 0.49), 0, 0]}
                  geometry={wheelGeos.rimLip}
                  material={mats.alloyRim}
                />
                {/* Center-Lock Hub */}
                <mesh geometry={wheelGeos.hubCore} material={mats.brushedTitanium} />
                <mesh position={[outerSign * (WHEEL_WIDTH * 0.54), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.038, 0.038, 0.025, 6]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>

                {/* 5 Distinct Radial Alloy Spokes + Tire Shoulder Ticks (makes forward/reverse spin unmistakable) */}
                {SPOKE_ANGLES.map((angle, sIdx) => {
                  const sinA = Math.sin(angle);
                  const cosA = Math.cos(angle);
                  return (
                    <React.Fragment key={sIdx}>
                      <mesh
                        position={[outerSign * (WHEEL_WIDTH * 0.43), cosA * 0.125, sinA * 0.125]}
                        rotation={[angle, 0, 0]}
                        geometry={wheelGeos.spoke}
                        material={mats.alloyRim}
                      />
                      <mesh
                        position={[0, cosA * (WHEEL_RADIUS - 0.008), sinA * (WHEEL_RADIUS - 0.008)]}
                        rotation={[angle, 0, 0]}
                        geometry={wheelGeos.treadTick}
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

      {/* ==================== SUSPENDED COMPOSITE CHASSIS BODY ==================== */}
      <group ref={chassisRef}>
        {/* 1. Carbon Undertray Floorpan (narrowed at front/rear axles for full wheel-turn clearance) & Side Skirts */}
        <mesh position={[0, 0.21, 0]} material={mats.forgedCarbon} castShadow={shadows}>
          <boxGeometry args={[1.66, 0.11, 1.92]} />
        </mesh>
        <mesh position={[0, 0.21, 1.56]} material={mats.forgedCarbon} castShadow={shadows}>
          <boxGeometry args={[1.14, 0.11, 1.32]} />
        </mesh>
        <mesh position={[0, 0.21, -1.56]} material={mats.forgedCarbon} castShadow={shadows}>
          <boxGeometry args={[1.2, 0.11, 1.32]} />
        </mesh>
        {([-0.99, 0.99] as const).map((sx, idx) => (
          <group key={`skirt-${idx}`} position={[sx, 0.24, 0]}>
            {/* Sculpted Carbon Side Skirt Blade */}
            <mesh material={mats.forgedCarbon} castShadow={shadows}>
              <boxGeometry args={[0.2, 0.14, 1.82]} />
            </mesh>
            {/* Lower Body Door Sill & Side Intake Scoop */}
            <mesh position={[sx > 0 ? -0.05 : 0.05, 0.24, -0.02]} material={mats.bodyPaint} castShadow={shadows}>
              <boxGeometry args={[0.24, 0.36, 1.76]} />
            </mesh>
            {/* Dark Recessed Mid-Engine Side Air Intake Vent */}
            <mesh position={[sx > 0 ? 0.06 : -0.06, 0.28, -0.54]} material={mats.bodySecondary}>
              <boxGeometry args={[0.09, 0.26, 0.58]} />
            </mesh>
            {/* Side Sill Cyan Aero Accent Strip */}
            <mesh position={[sx > 0 ? 0.105 : -0.105, -0.02, 0]}>
              <boxGeometry args={[0.015, 0.025, 1.72]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        ))}

        {/* 2. Central Monocoque Tub (full-width cabin + narrow front/rear wheel-well bulkheads so turned tires never clip) */}
        <mesh position={[0, 0.44, 0]} material={mats.bodyPaint} castShadow={shadows} receiveShadow>
          <boxGeometry args={[1.56, 0.38, 1.88]} />
        </mesh>
        <mesh position={[0, 0.44, 1.48]} material={mats.bodyPaint} castShadow={shadows}>
          <boxGeometry args={[1.14, 0.36, 1.16]} />
        </mesh>
        <mesh position={[0, 0.44, -1.5]} material={mats.bodyPaint} castShadow={shadows}>
          <boxGeometry args={[1.22, 0.36, 1.2]} />
        </mesh>

        {/* 3. Sculpted Wedge Front Hood, Aero Nose & Front Splitter */}
        <mesh position={[0, 0.62, 1.48]} rotation={[0.14, 0, 0]} material={mats.bodyPaint} castShadow={shadows}>
          <boxGeometry args={[1.38, 0.16, 1.42]} />
        </mesh>
        {/* Recessed Carbon Hood Aero Vent */}
        <mesh position={[0, 0.68, 1.38]} rotation={[0.14, 0, 0]} material={mats.forgedCarbon}>
          <boxGeometry args={[0.72, 0.07, 0.78]} />
        </mesh>
        {/* Front Nose Cone & Wide Carbon Splitter Lip */}
        <mesh position={[0, 0.36, 2.2]} rotation={[0.12, 0, 0]} material={mats.bodySecondary} castShadow={shadows}>
          <boxGeometry args={[1.88, 0.24, 0.36]} />
        </mesh>
        <mesh position={[0, 0.18, 2.34]} material={mats.forgedCarbon}>
          <boxGeometry args={[2.06, 0.055, 0.34]} />
        </mesh>
        {/* Front Vertical Aero Dive-Plane Canards */}
        {([-1.01, 1.01] as const).map((cx, idx) => (
          <mesh key={`canard-${idx}`} position={[cx, 0.27, 2.24]} material={mats.forgedCarbon}>
            <boxGeometry args={[0.04, 0.18, 0.28]} />
          </mesh>
        ))}
        {/* Front Twin Radiator Grille Cavity & Cyan Fin */}
        <mesh position={[0, 0.29, 2.37]} material={mats.forgedCarbon}>
          <boxGeometry args={[1.54, 0.14, 0.06]} />
        </mesh>
        <mesh position={[0, 0.29, 2.39]}>
          <boxGeometry args={[1.38, 0.025, 0.03]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* 4. Flared Front & Rear Wheel-Arch Fenders (high & clear of full-lock wheel steering sweep) */}
        {([-0.94, 0.94] as const).map((fx, fIdx) => (
          <React.Fragment key={`fenders-${fIdx}`}>
            {/* Front Flared Fender Arch Crown & Haunch */}
            <mesh position={[fx, 0.78, 1.43]} material={mats.bodyPaint} castShadow={shadows}>
              <boxGeometry args={[0.42, 0.11, 0.9]} />
            </mesh>
            <mesh position={[fx, 0.56, 2.04]} rotation={[0.28, 0, 0]} material={mats.bodyPaint}>
              <boxGeometry args={[0.38, 0.22, 0.28]} />
            </mesh>
            <mesh position={[fx, 0.56, 0.84]} rotation={[-0.22, 0, 0]} material={mats.bodyPaint}>
              <boxGeometry args={[0.38, 0.22, 0.24]} />
            </mesh>

            {/* Rear Wide-Body Flared Fender Arch & Buttress */}
            <mesh position={[fx, 0.8, -1.43]} material={mats.bodyPaint} castShadow={shadows}>
              <boxGeometry args={[0.44, 0.12, 0.96]} />
            </mesh>
            <mesh position={[fx, 0.58, -2.02]} rotation={[-0.25, 0, 0]} material={mats.bodyPaint}>
              <boxGeometry args={[0.38, 0.28, 0.3]} />
            </mesh>
            {/* Sculpted Flying Aero Buttress Connecting Roof to Rear Fender */}
            <mesh
              position={[fx * 0.72, 0.9, -1.06]}
              rotation={[-0.28, 0, fx > 0 ? 0.16 : -0.16]}
              material={mats.bodyPaint}
              castShadow={shadows}
            >
              <boxGeometry args={[0.16, 0.14, 1.24]} />
            </mesh>
          </React.Fragment>
        ))}

        {/* 5. Panoramic Teardrop Glass Canopy, Pillars & Roof Intake Scoop */}
        {/* Sloped Windshield */}
        <mesh position={[0, 0.88, 0.56]} rotation={[-0.95, 0, 0]} material={mats.canopyGlass}>
          <boxGeometry args={[1.38, 0.94, 0.06]} />
        </mesh>
        {/* Main Tinted Glass Greenhouse Roof Dome */}
        <mesh position={[0, 1.07, -0.22]} material={mats.canopyGlass}>
          <boxGeometry args={[1.3, 0.24, 1.24]} />
        </mesh>
        {/* Carbon Center Roof Spine & Air Intake Scoop */}
        <mesh position={[0, 1.19, -0.34]} material={mats.forgedCarbon} castShadow={shadows}>
          <boxGeometry args={[0.42, 0.09, 1.12]} />
        </mesh>
        <mesh position={[0, 1.21, 0.18]} material={mats.bodySecondary}>
          <boxGeometry args={[0.28, 0.08, 0.14]} />
        </mesh>
        {/* Structural A-Pillars & B-Pillars */}
        {([-0.68, 0.68] as const).map((px, pIdx) => (
          <React.Fragment key={`pillar-${pIdx}`}>
            <mesh position={[px, 0.89, 0.55]} rotation={[-0.95, 0, px > 0 ? 0.12 : -0.12]} material={mats.bodySecondary}>
              <boxGeometry args={[0.07, 0.92, 0.08]} />
            </mesh>
            <mesh position={[px * 0.96, 0.94, -0.78]} rotation={[0.45, 0, 0]} material={mats.bodySecondary}>
              <boxGeometry args={[0.09, 0.52, 0.12]} />
            </mesh>
            {/* Brushed Titanium Aerodynamic Side Mirror */}
            <group position={[px * 1.38, 0.78, 0.66]}>
              <mesh position={[px > 0 ? -0.1 : 0.1, -0.05, 0]} rotation={[0, 0, px > 0 ? 0.45 : -0.45]} material={mats.forgedCarbon}>
                <boxGeometry args={[0.22, 0.035, 0.05]} />
              </mesh>
              <mesh material={mats.brushedTitanium}>
                <boxGeometry args={[0.18, 0.08, 0.11]} />
              </mesh>
            </group>
          </React.Fragment>
        ))}

        {/* 6. Visible Cockpit Interior (Bucket Seats, Dashboard HUD, Articulated Steering Yoke) */}
        <mesh position={[0, 0.68, 0.54]} rotation={[-0.22, 0, 0]} material={mats.forgedCarbon}>
          <boxGeometry args={[1.28, 0.14, 0.34]} />
        </mesh>
        {/* Glowing Cockpit Telemetry Strip */}
        <mesh position={[0, 0.75, 0.42]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.08, 0.05, 0.025]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Articulated F1/GT Steering Yoke (left-hand drive at +X = 0.34, rotates with steeringAngle!) */}
        <group position={[0.34, 0.76, 0.28]} rotation={[-0.28, 0, 0]}>
          <group ref={steeringYokeRef}>
            <mesh material={mats.forgedCarbon}>
              <boxGeometry args={[0.3, 0.055, 0.04]} />
            </mesh>
            <mesh position={[-0.14, 0.03, 0]} material={mats.brushedTitanium}>
              <boxGeometry args={[0.04, 0.14, 0.045]} />
            </mesh>
            <mesh position={[0.14, 0.03, 0]} material={mats.brushedTitanium}>
              <boxGeometry args={[0.04, 0.14, 0.045]} />
            </mesh>
            <mesh position={[0, 0.025, -0.024]}>
              <boxGeometry args={[0.11, 0.04, 0.01]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>
        {/* Twin Bolstered Bucket Seats */}
        {([-0.34, 0.34] as const).map((sx, sIdx) => (
          <group key={`seat-${sIdx}`} position={[sx, 0.58, -0.22]}>
            <mesh material={mats.interiorLeather}>
              <boxGeometry args={[0.4, 0.14, 0.44]} />
            </mesh>
            <mesh position={[0, 0.24, -0.18]} rotation={[-0.22, 0, 0]} material={mats.interiorLeather}>
              <boxGeometry args={[0.38, 0.46, 0.12]} />
            </mesh>
          </group>
        ))}

        {/* 7. Mid-Engine Louvered Glass Deck & Luminous Experimental Kinetic Core Rails */}
        <mesh position={[0, 0.72, -1.32]} rotation={[-0.14, 0, 0]} material={mats.forgedCarbon}>
          <boxGeometry args={[1.06, 0.18, 1.38]} />
        </mesh>
        {([-0.24, 0.24] as const).map((rx, rIdx) => (
          <mesh key={`rail-${rIdx}`} position={[rx, 0.83, -1.32]} rotation={[-0.14, 0, 0]}>
            <boxGeometry args={[0.07, 0.05, 1.2]} />
            <meshBasicMaterial ref={rIdx === 0 ? coreRailMatRef : undefined} color="#38bdf8" toneMapped={false} />
          </mesh>
        ))}
        {/* Hood Center Spine Kinetic Strip */}
        <mesh position={[0, 0.69, 1.38]} rotation={[0.16, 0, 0]}>
          <boxGeometry args={[0.06, 0.025, 0.74]} />
          <meshBasicMaterial color="#38bdf8" toneMapped={false} />
        </mesh>
        {/* Engine Cooling Louver Slats */}
        {[-0.95, -1.2, -1.45, -1.7].map((lz, lIdx) => (
          <mesh key={`louver-${lIdx}`} position={[0, 0.86 - lIdx * 0.035, lz]} rotation={[0.25, 0, 0]} material={mats.brushedTitanium}>
            <boxGeometry args={[0.92, 0.025, 0.12]} />
          </mesh>
        ))}

        {/* 8. Rear Fascia, Multi-Fin Venturi Diffuser & Twin Titanium Exhausts */}
        <mesh position={[0, 0.46, -2.18]} material={mats.bodySecondary} castShadow={shadows}>
          <boxGeometry args={[1.92, 0.42, 0.22]} />
        </mesh>
        {/* Venturi Rear Diffuser Plate & 5 Vertical Aero Strakes */}
        <mesh position={[0, 0.2, -2.24]} rotation={[0.18, 0, 0]} material={mats.forgedCarbon}>
          <boxGeometry args={[1.82, 0.14, 0.34]} />
        </mesh>
        {[-0.68, -0.34, 0, 0.34, 0.68].map((dx, dIdx) => (
          <mesh key={`fin-${dIdx}`} position={[dx, 0.21, -2.31]} material={mats.forgedCarbon}>
            <boxGeometry args={[0.035, 0.18, 0.26]} />
          </mesh>
        ))}
        {/* Twin Brushed Titanium Exhaust Pipes with Dynamic Afterburner Glow */}
        {([-0.38, 0.38] as const).map((ex, eIdx) => (
          <group key={`exhaust-${eIdx}`} position={[ex, 0.32, -2.3]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={mats.brushedTitanium}>
              <cylinderGeometry args={[0.095, 0.105, 0.16, 12]} />
            </mesh>
            <mesh position={[0, -0.075, 0]}>
              <cylinderGeometry args={[0.072, 0.072, 0.04, 12]} />
              <meshBasicMaterial
                ref={eIdx === 0 ? exhaustGlowMatRef : undefined}
                color="#f59e0b"
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {/* 9. Active Swan-Neck Rear GT Aero Wing (tilts forward as airbrake on braking!) */}
        <group position={[0, 0.88, -2.06]}>
          {/* Twin Swan-Neck Pylons */}
          {([-0.52, 0.52] as const).map((px, pIdx) => (
            <mesh key={`wing-pylon-${pIdx}`} position={[px, -0.1, 0.05]} rotation={[-0.22, 0, 0]} material={mats.forgedCarbon}>
              <boxGeometry args={[0.06, 0.36, 0.2]} />
            </mesh>
          ))}
          {/* Articulated Airfoil Wing Blade & Endplates */}
          <group ref={rearWingBladeRef} position={[0, 0.12, -0.02]}>
            <mesh material={mats.forgedCarbon} castShadow={shadows}>
              <boxGeometry args={[2.06, 0.055, 0.36]} />
            </mesh>
            <mesh position={[0, 0.032, -0.15]}>
              <boxGeometry args={[1.98, 0.018, 0.03]} />
              <meshBasicMaterial color="#38bdf8" toneMapped={false} />
            </mesh>
            {([-1.04, 1.04] as const).map((ex, eIdx) => (
              <mesh key={`endplate-${eIdx}`} position={[ex, -0.02, 0]} material={mats.bodyPaint}>
                <boxGeometry args={[0.04, 0.24, 0.44]} />
              </mesh>
            ))}
          </group>
        </group>

        {/* 10. Dynamic HDR Headlamps, Brake Light Blade & White Reverse Lamps */}
        {/* Dual Slim Front Laser Headlights (+Z nose) */}
        {([-0.68, 0.68] as const).map((hx, hIdx) => (
          <mesh key={`headlight-${hIdx}`} position={[hx, 0.46, 2.24]} rotation={[0, hx > 0 ? 0.16 : -0.16, 0]}>
            <boxGeometry args={[0.48, 0.065, 0.08]} />
            <meshBasicMaterial
              ref={hIdx === 0 ? headLightMatRef : undefined}
              color="#f0f9ff"
              toneMapped={false}
            />
          </mesh>
        ))}
        {/* Full-Width Rear Crimson Taillight & Dynamic Brake Light Blade (-Z tail) */}
        <mesh position={[0, 0.56, -2.3]}>
          <boxGeometry args={[1.82, 0.075, 0.04]} />
          <meshBasicMaterial ref={brakeLightMatRef} color="#f43f5e" toneMapped={false} />
        </mesh>
        {/* Dedicated Twin Crisp White HDR Reverse Lamps (illuminate bright white in Reverse gear!) */}
        {([-0.62, 0.62] as const).map((rx, rIdx) => (
          <mesh key={`revlamp-${rIdx}`} position={[rx, 0.45, -2.3]}>
            <boxGeometry args={[0.28, 0.055, 0.04]} />
            <meshBasicMaterial
              ref={rIdx === 0 ? reverseLightMatRef : undefined}
              color="#1e293b"
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};
