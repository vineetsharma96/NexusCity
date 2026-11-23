import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  SOLARIS_CAR_PERFORMANCE_SPEC,
  VehicleInteractionSystem,
} from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import {
  createSolarisAirbrakeFlapGeometry,
  createSolarisBrakeCaliperGeometry,
  createSolarisCanopyGeometry,
  createSolarisDiffuserVaneGeometry,
  createSolarisDorsalFinGeometry,
  createSolarisDorsalGlowGeometry,
  createSolarisFormulaFuselageGeometry,
  createSolarisFrontEndplateGeometry,
  createSolarisFrontWingFlapGeometry,
  createSolarisFrontWingMainGeometry,
  createSolarisHaloArchGeometry,
  createSolarisHaloPillarGeometry,
  createSolarisHeadlightBladeGeometry,
  createSolarisNoseChevronLightGeometry,
  createSolarisNosePylonGeometry,
  createSolarisRearDiffuserGeometry,
  createSolarisRearEndplateGeometry,
  createSolarisRearEndplateLightGeometry,
  createSolarisRearWingMainGeometry,
  createSolarisReverseArcGeometry,
  createSolarisRimBarrelGeometry,
  createSolarisSeatGeometry,
  createSolarisSidepodGeometry,
  createSolarisSidepodIntakeGeometry,
  createSolarisSidepodLightGeometry,
  createSolarisSteeringYokeGeometry,
  createSolarisSuspensionLinkGeometry,
  createSolarisTireGeometry,
  createSolarisTurbineExhaustGeometry,
  createSolarisTurbineSpokeGeometry,
  createSolarisVenturiFloorGeometry,
  createSolarisWheelFairingGeometry,
} from './SolarisCarGeometry';

export const SOLARIS_CAR_ID = 'ax-09-solaris';
export const SOLARIS_CAR_LABEL = 'AX-09 Solaris Prototype';
export { SOLARIS_CAR_PERFORMANCE_SPEC };

// Parked cleanly on the opposite (right) shoulder of the widened 22m Grand Boulevard across from VX-01
const INITIAL_SOLARIS_POS: [number, number, number] = [8.8, 0.02, 4.8];
const INITIAL_SOLARIS_ROT_Y = Math.PI;

const WHEEL_RADIUS = 0.39;
const FRONT_WHEEL_WIDTH = 0.32;
const REAR_WHEEL_WIDTH = 0.38;
// 10-vane directional Formula-X aero-turbofan wheel layout
const TURBINE_VANE_ANGLES = Array.from({ length: 10 }, (_, i) => (i * Math.PI * 2) / 10);

interface WheelMount {
  key: string;
  x: number;
  z: number;
  width: number;
  isFront: boolean;
  isLeft: boolean;
}

const WHEEL_MOUNTS: WheelMount[] = [
  { key: 'FL', x: 1.06, z: 1.52, width: FRONT_WHEEL_WIDTH, isFront: true, isLeft: true },
  { key: 'FR', x: -1.06, z: 1.52, width: FRONT_WHEEL_WIDTH, isFront: true, isLeft: false },
  { key: 'RL', x: 1.1, z: -1.52, width: REAR_WHEEL_WIDTH, isFront: false, isLeft: true },
  { key: 'RR', x: -1.1, z: -1.52, width: REAR_WHEEL_WIDTH, isFront: false, isLeft: false },
];

export const SolarisExperimentalCar: React.FC = () => {
  const rootRef = useRef<THREE.Group>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const frontLeftSteerRef = useRef<THREE.Group>(null);
  const frontRightSteerRef = useRef<THREE.Group>(null);
  const wheelSpinRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const steeringYokeRef = useRef<THREE.Group>(null);
  const drsFlapRef = useRef<THREE.Group>(null);

  const noseChevronMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const headLightLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const headLightRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tailLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tailRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const rainBeaconMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const reverseLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const reverseRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const dorsalGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sideLightLeftMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sideLightRightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const afterburnerCoreMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const system = VehicleInteractionSystem.getInstance();
  const shadows = QualityManager.current.shadows;

  // 100% compound-curved procedural Open-Wheel Formula-X geometries (zero BoxGeometry primitives)
  const geos = useMemo(() => {
    const fuselage = createSolarisFormulaFuselageGeometry();
    const sidepodLeft = createSolarisSidepodGeometry(1);
    const sidepodRight = createSolarisSidepodGeometry(-1);
    const sidepodIntakeLeft = createSolarisSidepodIntakeGeometry(1);
    const sidepodIntakeRight = createSolarisSidepodIntakeGeometry(-1);
    const canopyGlass = createSolarisCanopyGeometry();
    const haloArch = createSolarisHaloArchGeometry();
    const haloPillar = createSolarisHaloPillarGeometry();
    const venturiFloor = createSolarisVenturiFloorGeometry();

    // Multi-element Formula-X front wing assembly
    const frontWingMain = createSolarisFrontWingMainGeometry();
    const frontWingFlapLeft = createSolarisFrontWingFlapGeometry(1);
    const frontWingFlapRight = createSolarisFrontWingFlapGeometry(-1);
    const frontEndplateLeft = createSolarisFrontEndplateGeometry(1);
    const frontEndplateRight = createSolarisFrontEndplateGeometry(-1);
    const nosePylonLeft = createSolarisNosePylonGeometry(1);
    const nosePylonRight = createSolarisNosePylonGeometry(-1);

    // Towering twin-plane active DRS rear wing & dorsal shark fin
    const dorsalFin = createSolarisDorsalFinGeometry();
    const dorsalGlow = createSolarisDorsalGlowGeometry();
    const rearWingMain = createSolarisRearWingMainGeometry();
    const drsFlap = createSolarisAirbrakeFlapGeometry(1);
    const rearEndplateLeft = createSolarisRearEndplateGeometry(1);
    const rearEndplateRight = createSolarisRearEndplateGeometry(-1);

    // Rear Venturi diffuser & central jet-turbine afterburner exhaust
    const rearDiffuser = createSolarisRearDiffuserGeometry();
    const diffuserVane = createSolarisDiffuserVaneGeometry();
    const turbineExhaust = createSolarisTurbineExhaustGeometry();
    const afterburnerCore = new THREE.CircleGeometry(0.088, 24);
    afterburnerCore.rotateY(Math.PI);

    // Sculpted overhead ram-air airbox aperture
    const airboxInlet = new THREE.SphereGeometry(0.11, 20, 14);
    airboxInlet.scale(1.15, 0.72, 0.65);

    // Exposed airfoil double-wishbone suspension arms & gold pushrods for all 4 corners
    const suspensionCarbonLinks: THREE.BufferGeometry[] = [];
    const suspensionGoldRods: THREE.BufferGeometry[] = [];
    for (const side of [1, -1] as const) {
      // Front corner wishbones
      suspensionCarbonLinks.push(
        createSolarisSuspensionLinkGeometry([side * 0.24, 0.56, 1.8], [side * 0.9, 0.5, 1.54], 0.019, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.28, 0.56, 1.24], [side * 0.9, 0.5, 1.5], 0.019, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.23, 0.34, 1.78], [side * 0.9, 0.28, 1.54], 0.02, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.27, 0.3, 1.22], [side * 0.9, 0.28, 1.5], 0.02, 0.45),
      );
      suspensionGoldRods.push(
        createSolarisSuspensionLinkGeometry([side * 0.25, 0.62, 1.46], [side * 0.9, 0.3, 1.52], 0.015, 0.85),
      );
      // Rear corner wishbones
      suspensionCarbonLinks.push(
        createSolarisSuspensionLinkGeometry([side * 0.32, 0.54, -1.18], [side * 0.91, 0.5, -1.5], 0.02, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.26, 0.52, -1.86], [side * 0.91, 0.5, -1.54], 0.02, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.32, 0.26, -1.2], [side * 0.91, 0.28, -1.5], 0.022, 0.45),
        createSolarisSuspensionLinkGeometry([side * 0.25, 0.28, -1.84], [side * 0.91, 0.28, -1.54], 0.022, 0.45),
      );
      suspensionGoldRods.push(
        createSolarisSuspensionLinkGeometry([side * 0.28, 0.6, -1.42], [side * 0.91, 0.3, -1.52], 0.015, 0.85),
      );
    }

    // Floating curved aero wheel fairings (front & rear, left & right)
    const frontFairingLeft = createSolarisWheelFairingGeometry(WHEEL_RADIUS, FRONT_WHEEL_WIDTH, 1);
    const frontFairingRight = createSolarisWheelFairingGeometry(WHEEL_RADIUS, FRONT_WHEEL_WIDTH, -1);
    const rearFairingLeft = createSolarisWheelFairingGeometry(WHEEL_RADIUS, REAR_WHEEL_WIDTH, 1);
    const rearFairingRight = createSolarisWheelFairingGeometry(WHEEL_RADIUS, REAR_WHEEL_WIDTH, -1);

    // Distinct racing optics
    const noseChevronLight = createSolarisNoseChevronLightGeometry();
    const headlightLeft = createSolarisHeadlightBladeGeometry(1);
    const headlightRight = createSolarisHeadlightBladeGeometry(-1);
    const tailLightLeft = createSolarisRearEndplateLightGeometry(1);
    const tailLightRight = createSolarisRearEndplateLightGeometry(-1);
    const sideLightLeft = createSolarisSidepodLightGeometry(1);
    const sideLightRight = createSolarisSidepodLightGeometry(-1);
    const reverseLeft = createSolarisReverseArcGeometry(1);
    const reverseRight = createSolarisReverseArcGeometry(-1);
    const rainBeacon = new THREE.CapsuleGeometry(0.018, 0.11, 6, 12);

    // Single-seat cockpit interior
    const seat = createSolarisSeatGeometry();
    const steeringYoke = createSolarisSteeringYokeGeometry();

    // Wide Formula slick tires (front 0.32m, extra-wide rear 0.38m) & 10-vane turbofan wheels
    const frontTire = createSolarisTireGeometry(WHEEL_RADIUS, FRONT_WHEEL_WIDTH);
    const rearTire = createSolarisTireGeometry(WHEEL_RADIUS, REAR_WHEEL_WIDTH);
    const frontRimBarrel = createSolarisRimBarrelGeometry(WHEEL_RADIUS, FRONT_WHEEL_WIDTH);
    const rearRimBarrel = createSolarisRimBarrelGeometry(WHEEL_RADIUS, REAR_WHEEL_WIDTH);
    const turbineVane = createSolarisTurbineSpokeGeometry();
    const rimOuterRing = new THREE.TorusGeometry(0.228, 0.014, 12, 32);
    rimOuterRing.rotateY(Math.PI / 2);
    const tireSidewallRing = new THREE.TorusGeometry(0.315, 0.011, 10, 36);
    tireSidewallRing.rotateY(Math.PI / 2);
    const frontHub = new THREE.CylinderGeometry(0.068, 0.074, FRONT_WHEEL_WIDTH + 0.02, 20);
    frontHub.rotateZ(Math.PI / 2);
    const rearHub = new THREE.CylinderGeometry(0.068, 0.074, REAR_WHEEL_WIDTH + 0.02, 20);
    rearHub.rotateZ(Math.PI / 2);
    const centerLockNut = new THREE.CylinderGeometry(0.036, 0.048, 0.052, 12);
    centerLockNut.rotateZ(Math.PI / 2);
    const brakeDisc = new THREE.CylinderGeometry(0.198, 0.198, 0.034, 24);
    brakeDisc.rotateZ(Math.PI / 2);
    const caliper = createSolarisBrakeCaliperGeometry();

    return {
      fuselage,
      sidepodLeft,
      sidepodRight,
      sidepodIntakeLeft,
      sidepodIntakeRight,
      canopyGlass,
      haloArch,
      haloPillar,
      venturiFloor,
      frontWingMain,
      frontWingFlapLeft,
      frontWingFlapRight,
      frontEndplateLeft,
      frontEndplateRight,
      nosePylonLeft,
      nosePylonRight,
      dorsalFin,
      dorsalGlow,
      rearWingMain,
      drsFlap,
      rearEndplateLeft,
      rearEndplateRight,
      rearDiffuser,
      diffuserVane,
      turbineExhaust,
      afterburnerCore,
      airboxInlet,
      suspensionCarbonLinks,
      suspensionGoldRods,
      frontFairingLeft,
      frontFairingRight,
      rearFairingLeft,
      rearFairingRight,
      noseChevronLight,
      headlightLeft,
      headlightRight,
      tailLightLeft,
      tailLightRight,
      sideLightLeft,
      sideLightRight,
      reverseLeft,
      reverseRight,
      rainBeacon,
      seat,
      steeringYoke,
      frontTire,
      rearTire,
      frontRimBarrel,
      rearRimBarrel,
      turbineVane,
      rimOuterRing,
      tireSidewallRing,
      frontHub,
      rearHub,
      centerLockNut,
      brakeDisc,
      caliper,
    };
  }, []);

  // Distinct Motorsport Livery: Pearl White Ceramic + Satin Obsidian Carbon + Solar-Gold Titanium
  const mats = useMemo(() => {
    const bodyPearlWhite = new THREE.MeshPhysicalMaterial({
      color: '#f1f5f9',
      metalness: 0.24,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
    });
    const forgedCarbon = new THREE.MeshPhysicalMaterial({
      color: '#12161f',
      metalness: 0.36,
      roughness: 0.34,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
    });
    const solarAmberPaint = new THREE.MeshPhysicalMaterial({
      color: '#ea580c',
      metalness: 0.68,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.42,
      iridescenceIOR: 1.38,
    });
    const smokedCanopy = new THREE.MeshPhysicalMaterial({
      color: '#0c1628',
      metalness: 0.22,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const champagneGold = new THREE.MeshStandardMaterial({
      color: '#e6b85c',
      metalness: 0.94,
      roughness: 0.18,
    });
    const crimsonAnodized = new THREE.MeshStandardMaterial({
      color: '#dc2626',
      metalness: 0.85,
      roughness: 0.2,
    });
    const rawTitanium = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.92,
      roughness: 0.22,
    });
    const slickRubber = new THREE.MeshStandardMaterial({
      color: '#17191f',
      metalness: 0.04,
      roughness: 0.72,
    });
    const carbonDisc = new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.78,
      roughness: 0.3,
    });
    const darkCavity = new THREE.MeshStandardMaterial({
      color: '#05070c',
      metalness: 0.2,
      roughness: 0.85,
    });
    const tireRingMat = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      toneMapped: false,
    });
    return {
      bodyPearlWhite,
      forgedCarbon,
      solarAmberPaint,
      smokedCanopy,
      champagneGold,
      crimsonAnodized,
      rawTitanium,
      slickRubber,
      carbonDisc,
      darkCavity,
      tireRingMat,
    };
  }, []);

  useEffect(() => {
    system.registerRideable(
      SOLARIS_CAR_ID,
      SOLARIS_CAR_LABEL,
      new THREE.Vector3(...INITIAL_SOLARIS_POS),
      'vehicle',
      INITIAL_SOLARIS_ROT_Y,
      'car',
      SOLARIS_CAR_PERFORMANCE_SPEC,
    );
    return () => {
      system.unregisterRideable(SOLARIS_CAR_ID);
      Object.values(geos).forEach((entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((g) => g.dispose());
        } else {
          entry.dispose();
        }
      });
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [system, geos, mats]);

  const smoothPitchRef = useRef(0);
  const smoothRollRef = useRef(0);
  const smoothDrsRef = useRef(0.04);
  const parkedSpinRef = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const vehicleState = system.getState();
    const isDrivingThis = vehicleState.mode === 'RIDING' && vehicleState.activeId === SOLARIS_CAR_ID;

    if (rootRef.current) {
      const pos = system.getRideablePosition(SOLARIS_CAR_ID);
      const rotY = system.getRideableRotationY(SOLARIS_CAR_ID);
      rootRef.current.position.set(pos.x, 0.02, pos.z);
      rootRef.current.rotation.set(0, rotY, 0);
    }

    const tel = isDrivingThis ? vehicleState.telemetry : null;
    const steerAngle = tel ? tel.steeringAngle : 0;
    const wheelSpin = tel ? tel.wheelSpinRad : parkedSpinRef.current;
    if (tel) {
      parkedSpinRef.current = tel.wheelSpinRad;
    }
    const longG = tel ? tel.longitudinalAccelG : 0;
    const latG = tel ? tel.lateralAccelG : 0;
    const speedMs = tel ? tel.speedMs : 0;

    // Stiff Formula ground-effect suspension pitch & roll
    const targetPitch = THREE.MathUtils.clamp(-longG * 0.022, -0.045, 0.045);
    const targetRoll = THREE.MathUtils.clamp(latG * 0.036, -0.055, 0.055);
    const damp = 1 - Math.exp(-13 * dt);
    smoothPitchRef.current = THREE.MathUtils.lerp(smoothPitchRef.current, targetPitch, damp);
    smoothRollRef.current = THREE.MathUtils.lerp(smoothRollRef.current, targetRoll, damp);

    if (chassisRef.current) {
      chassisRef.current.rotation.x = smoothPitchRef.current;
      chassisRef.current.rotation.z = smoothRollRef.current;
      const idleThrum = isDrivingThis ? Math.sin(state.clock.elapsedTime * 36) * 0.001 : 0;
      chassisRef.current.position.y = idleThrum;
    }

    // Active DRS / Airbrake rear wing flap:
    // Opens flat (-0.22 rad) during boost / >32 m/s, pitches sharply upright (+0.46 rad) under braking!
    const targetDrs =
      tel && tel.isBraking && speedMs > 2.5
        ? 0.46
        : tel && (tel.isBoosting || speedMs > 32)
          ? -0.22
          : 0.04;
    smoothDrsRef.current = THREE.MathUtils.lerp(smoothDrsRef.current, targetDrs, 1 - Math.exp(-12 * dt));
    if (drsFlapRef.current) {
      drsFlapRef.current.rotation.x = smoothDrsRef.current;
    }

    // Ackermann steering geometry for crisp front-wheel turn-in
    const leftSteer = steerAngle > 0 ? steerAngle * 1.12 : steerAngle * 0.92;
    const rightSteer = steerAngle < 0 ? steerAngle * 1.12 : steerAngle * 0.92;
    if (frontLeftSteerRef.current) frontLeftSteerRef.current.rotation.y = leftSteer;
    if (frontRightSteerRef.current) frontRightSteerRef.current.rotation.y = rightSteer;
    if (steeringYokeRef.current) steeringYokeRef.current.rotation.z = -steerAngle * 1.9;

    for (let i = 0; i < 4; i++) {
      const spinGroup = wheelSpinRefs.current[i];
      if (spinGroup) spinGroup.rotation.x = wheelSpin;
    }

    // Reactive solar-gold & racing optics
    const nightFactor = TimeSystem.getInstance().getState().nightFactor;
    const headIntensity = isDrivingThis ? 2.4 + nightFactor * 2.1 : 1.15 + nightFactor * 1.4;
    const brakeIntensity = tel?.isBraking ? 4.4 : isDrivingThis ? 1.85 : 0.95;
    const reverseIntensity = tel?.isReversing ? 3.8 : 0.05;
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 3.8) * 0.15;
    const accentGlow = isDrivingThis ? (tel?.isBoosting ? 3.8 : 2.3) : 1.05 * pulse;
    const afterburnerGlow = isDrivingThis ? (tel?.isBoosting ? 5.2 : 1.1 + Math.min(2.2, speedMs * 0.06)) : 0.25;
    // Authentic F1 rain/brake center strobe pulse when braking hard
    const beaconBlink = tel?.isBraking
      ? Math.sin(state.clock.elapsedTime * 28) > 0
        ? 5.0
        : 1.4
      : isDrivingThis
        ? 1.5
        : 0.65;

    if (noseChevronMatRef.current) {
      noseChevronMatRef.current.color.setRGB(1.0 * headIntensity, 0.88 * headIntensity, 0.65 * headIntensity);
    }
    if (headLightLeftMatRef.current) {
      headLightLeftMatRef.current.color.setRGB(1.0 * headIntensity, 0.94 * headIntensity, 0.8 * headIntensity);
    }
    if (headLightRightMatRef.current) {
      headLightRightMatRef.current.color.setRGB(1.0 * headIntensity, 0.94 * headIntensity, 0.8 * headIntensity);
    }
    if (tailLeftMatRef.current) {
      tailLeftMatRef.current.color.setRGB(1.0 * brakeIntensity, 0.18 * brakeIntensity, 0.05 * brakeIntensity);
    }
    if (tailRightMatRef.current) {
      tailRightMatRef.current.color.setRGB(1.0 * brakeIntensity, 0.18 * brakeIntensity, 0.05 * brakeIntensity);
    }
    if (rainBeaconMatRef.current) {
      rainBeaconMatRef.current.color.setRGB(1.0 * beaconBlink, 0.12 * beaconBlink, 0.04 * beaconBlink);
    }
    if (reverseLeftMatRef.current) {
      reverseLeftMatRef.current.color.setRGB(1.0 * reverseIntensity, 0.98 * reverseIntensity, 0.95 * reverseIntensity);
    }
    if (reverseRightMatRef.current) {
      reverseRightMatRef.current.color.setRGB(1.0 * reverseIntensity, 0.98 * reverseIntensity, 0.95 * reverseIntensity);
    }
    if (dorsalGlowMatRef.current) {
      dorsalGlowMatRef.current.color.setRGB(1.0 * accentGlow, 0.62 * accentGlow, 0.08 * accentGlow);
    }
    if (sideLightLeftMatRef.current) {
      sideLightLeftMatRef.current.color.setRGB(1.0 * accentGlow, 0.6 * accentGlow, 0.08 * accentGlow);
    }
    if (sideLightRightMatRef.current) {
      sideLightRightMatRef.current.color.setRGB(1.0 * accentGlow, 0.6 * accentGlow, 0.08 * accentGlow);
    }
    if (afterburnerCoreMatRef.current) {
      afterburnerCoreMatRef.current.color.setRGB(1.0 * afterburnerGlow, 0.56 * afterburnerGlow, 0.12 * afterburnerGlow);
    }
    const ringGlow = isDrivingThis ? 1.55 + (tel?.isBoosting ? 1.1 : 0) : 0.85;
    mats.tireRingMat.color.setRGB(1.0 * ringGlow, 0.66 * ringGlow, 0.1 * ringGlow);
  });

  return (
    <group ref={rootRef} position={INITIAL_SOLARIS_POS} rotation={[0, INITIAL_SOLARIS_ROT_Y, 0]}>
      {/* Sprung Formula-X Chassis */}
      <group ref={chassisRef}>
        {/* 1. Slender Central Formula-X Monocoque Fuselage (Elevated Nosecone -> Roll-Hoop Airbox -> Turbine Tail) */}
        <mesh geometry={geos.fuselage} material={mats.bodyPearlWhite} castShadow={shadows} receiveShadow={shadows} />

        {/* 2. Twin Sculpted Coca-Cola Aero Sidepods & Dark Recessed Radiator Scoops */}
        <mesh geometry={geos.sidepodLeft} material={mats.bodyPearlWhite} castShadow={shadows} receiveShadow={shadows} />
        <mesh geometry={geos.sidepodRight} material={mats.bodyPearlWhite} castShadow={shadows} receiveShadow={shadows} />
        <mesh
          geometry={geos.sidepodIntakeLeft}
          material={mats.darkCavity}
          position={[0.64, 0.49, 0.51]}
          rotation={[0, 0.22, 0]}
        />
        <mesh
          geometry={geos.sidepodIntakeRight}
          material={mats.darkCavity}
          position={[-0.64, 0.49, 0.51]}
          rotation={[0, -0.22, 0]}
        />

        {/* 3. Narrow Single-Seat Fighter Canopy + Sculpted Titanium Halo Arch + Overhead Ram-Air Scoop */}
        <mesh geometry={geos.canopyGlass} material={mats.smokedCanopy} renderOrder={4} />
        <mesh geometry={geos.haloArch} material={mats.forgedCarbon} castShadow={shadows} />
        <mesh geometry={geos.haloPillar} material={mats.solarAmberPaint} castShadow={shadows} />
        <mesh geometry={geos.airboxInlet} material={mats.darkCavity} position={[0, 1.13, -0.26]} />

        {/* 4. Sculpted Ground-Effect Venturi Floor Plank (Tucked Strictly Under Sidepods) */}
        <mesh geometry={geos.venturiFloor} material={mats.forgedCarbon} receiveShadow={shadows} />

        {/* 5. Sweeping Multi-Element Curved Formula Front Wing + Nose Pylons + Flared Endplates */}
        <mesh geometry={geos.frontWingMain} material={mats.forgedCarbon} castShadow={shadows} receiveShadow={shadows} />
        <mesh geometry={geos.frontWingFlapLeft} material={mats.solarAmberPaint} castShadow={shadows} />
        <mesh geometry={geos.frontWingFlapRight} material={mats.solarAmberPaint} castShadow={shadows} />
        <mesh geometry={geos.frontEndplateLeft} material={mats.bodyPearlWhite} castShadow={shadows} />
        <mesh geometry={geos.frontEndplateRight} material={mats.bodyPearlWhite} castShadow={shadows} />
        <mesh geometry={geos.nosePylonLeft} material={mats.forgedCarbon} castShadow={shadows} />
        <mesh geometry={geos.nosePylonRight} material={mats.forgedCarbon} castShadow={shadows} />

        {/* 6. Exposed Airfoil Double-Wishbone Suspension Arms & Gold Titanium Pushrods (All 4 Corners!) */}
        {geos.suspensionCarbonLinks.map((geo, idx) => (
          <mesh key={`susp-c-${idx}`} geometry={geo} material={mats.forgedCarbon} castShadow={shadows} />
        ))}
        {geos.suspensionGoldRods.map((geo, idx) => (
          <mesh key={`susp-g-${idx}`} geometry={geo} material={mats.champagneGold} castShadow={shadows} />
        ))}

        {/* 7. Dorsal Shark-Fin Stabilizer + Towering Twin-Plane Active DRS Rear Wing + Sculpted Endplates */}
        <mesh geometry={geos.dorsalFin} material={mats.solarAmberPaint} castShadow={shadows} />
        <mesh geometry={geos.rearWingMain} material={mats.forgedCarbon} castShadow={shadows} receiveShadow={shadows} />
        <mesh geometry={geos.rearEndplateLeft} material={mats.bodyPearlWhite} castShadow={shadows} />
        <mesh geometry={geos.rearEndplateRight} material={mats.bodyPearlWhite} castShadow={shadows} />
        <group ref={drsFlapRef} position={[0, 1.19, -2.32]}>
          <mesh geometry={geos.drsFlap} material={mats.solarAmberPaint} castShadow={shadows} />
        </group>

        {/* 8. Multi-Tunnel Formula Rear Diffuser & Single Massive Central Jet-Turbine Afterburner */}
        <mesh geometry={geos.rearDiffuser} material={mats.forgedCarbon} />
        {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
          <mesh key={`sol-fin-${x}`} geometry={geos.diffuserVane} material={mats.forgedCarbon} position={[x, 0, 0]} />
        ))}
        <group position={[0, 0.48, -2.51]}>
          <mesh geometry={geos.turbineExhaust} material={mats.rawTitanium} />
          <mesh geometry={geos.afterburnerCore} position={[0, 0, -0.02]}>
            <meshBasicMaterial ref={afterburnerCoreMatRef} color="#f59e0b" toneMapped={false} />
          </mesh>
        </group>

        {/* 9. Single-Seat Formula Cockpit Interior (Bucket Tub & Butterfly Steering Yoke) */}
        <mesh geometry={geos.seat} material={mats.forgedCarbon} position={[0, 0.33, 0.04]} />
        <group ref={steeringYokeRef} position={[0, 0.66, 0.6]} rotation={[0.35, 0, 0]}>
          <mesh geometry={geos.steeringYoke} material={mats.champagneGold} />
        </group>

        {/* 10. Signature Formula-X Luminous Optics (Nose Chevron, Endplate Laser Tails, F1 Brake Beacon, Sidepod Ribbons) */}
        <mesh geometry={geos.noseChevronLight}>
          <meshBasicMaterial ref={noseChevronMatRef} color="#fef3c7" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.headlightLeft}>
          <meshBasicMaterial ref={headLightLeftMatRef} color="#fffbeb" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.headlightRight}>
          <meshBasicMaterial ref={headLightRightMatRef} color="#fffbeb" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.tailLightLeft}>
          <meshBasicMaterial ref={tailLeftMatRef} color="#ef4444" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.tailLightRight}>
          <meshBasicMaterial ref={tailRightMatRef} color="#ef4444" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.rainBeacon} position={[0, 0.29, -2.54]}>
          <meshBasicMaterial ref={rainBeaconMatRef} color="#ef4444" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.reverseLeft}>
          <meshBasicMaterial ref={reverseLeftMatRef} color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.reverseRight}>
          <meshBasicMaterial ref={reverseRightMatRef} color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.dorsalGlow}>
          <meshBasicMaterial ref={dorsalGlowMatRef} color="#f59e0b" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.sideLightLeft}>
          <meshBasicMaterial ref={sideLightLeftMatRef} color="#f59e0b" toneMapped={false} />
        </mesh>
        <mesh geometry={geos.sideLightRight}>
          <meshBasicMaterial ref={sideLightRightMatRef} color="#f59e0b" toneMapped={false} />
        </mesh>
      </group>

      {/* 11. Four Exposed Wide Racing Slick Wheels with 10-Vane Gold Turbofan Covers & Floating Aero Shrouds */}
      {WHEEL_MOUNTS.map((wheel, idx) => {
        const steerRef = wheel.isFront
          ? wheel.isLeft
            ? frontLeftSteerRef
            : frontRightSteerRef
          : undefined;
        const outerSign = wheel.isLeft ? 1 : -1;
        const tireGeo = wheel.isFront ? geos.frontTire : geos.rearTire;
        const barrelGeo = wheel.isFront ? geos.frontRimBarrel : geos.rearRimBarrel;
        const hubGeo = wheel.isFront ? geos.frontHub : geos.rearHub;
        const fairingGeo = wheel.isFront
          ? wheel.isLeft
            ? geos.frontFairingLeft
            : geos.frontFairingRight
          : wheel.isLeft
            ? geos.rearFairingLeft
            : geos.rearFairingRight;
        const halfW = wheel.width * 0.5;

        return (
          <group key={wheel.key} position={[wheel.x, WHEEL_RADIUS, wheel.z]}>
            <group ref={steerRef}>
              {/* Floating curved carbon aero wheel shroud (steers smoothly with front wheels!) */}
              <mesh geometry={fairingGeo} material={mats.forgedCarbon} castShadow={shadows} />

              {/* Stationary monoblock champagne-gold brake caliper */}
              <mesh
                geometry={geos.caliper}
                material={mats.champagneGold}
                position={[-outerSign * 0.045, 0, 0]}
                rotation={[wheel.isFront ? Math.PI : 0, 0, 0]}
              />

              {/* Spinning wide slick tire, glowing sidewall racing ring, 10-vane turbofan wheel & red center-lock nut */}
              <group
                ref={(el) => {
                  wheelSpinRefs.current[idx] = el;
                }}
              >
                <mesh geometry={tireGeo} material={mats.slickRubber} castShadow={shadows} />
                <mesh geometry={barrelGeo} material={mats.forgedCarbon} />
                <mesh geometry={geos.brakeDisc} material={mats.carbonDisc} position={[-outerSign * 0.045, 0, 0]} />
                <mesh geometry={hubGeo} material={mats.rawTitanium} />
                <mesh
                  geometry={geos.centerLockNut}
                  material={mats.crimsonAnodized}
                  position={[outerSign * (halfW - 0.01), 0, 0]}
                />
                <mesh
                  geometry={geos.rimOuterRing}
                  material={mats.champagneGold}
                  position={[outerSign * (halfW - 0.042), 0, 0]}
                />
                {/* Luminous solar-amber sidewall racing ring */}
                <mesh
                  geometry={geos.tireSidewallRing}
                  material={mats.tireRingMat}
                  position={[outerSign * (halfW - 0.008), 0, 0]}
                />
                {/* 10-vane directional champagne-gold aero-turbofan wheel spokes */}
                {TURBINE_VANE_ANGLES.map((angle, sIdx) => (
                  <mesh
                    key={sIdx}
                    geometry={geos.turbineVane}
                    material={mats.champagneGold}
                    position={[outerSign * (halfW - 0.045), 0, 0]}
                    rotation={[angle, 0, 0]}
                  />
                ))}
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
};
