import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicState } from './KinematicController';
import { WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { ProceduralTextures } from '../core/ProceduralTextures';

interface ProceduralProtagonistProps {
  state: KinematicState;
}

const dampRot = (g: THREE.Group | null, axis: 'x' | 'y' | 'z', target: number, lambda: number, dt: number) => {
  if (g) g.rotation[axis] = THREE.MathUtils.damp(g.rotation[axis], target, lambda, dt);
};

export const ProceduralProtagonist: React.FC<ProceduralProtagonistProps> = ({ state }) => {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const coatTailRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const animTime = useRef(0);

  const [weather, setWeather] = useState(() => WeatherSystem.getInstance().getState());
  useEffect(() => WeatherSystem.getInstance().subscribe(setWeather), []);

  const windSystem = WindSystem.getInstance();
  const armorNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const roughness = THREE.MathUtils.lerp(0.24, 0.06, weather.wetnessFactor);
  const metalness = THREE.MathUtils.lerp(0.84, 0.96, weather.wetnessFactor);

  useFrame((_, delta) => {
    if (!rootRef.current) return;
    rootRef.current.position.copy(state.position);
    rootRef.current.rotation.y = state.rotationY;
    rootRef.current.rotation.z = THREE.MathUtils.damp(rootRef.current.rotation.z, state.bankAngle || 0, 12, delta);

    const gait = state.gait;
    const cycleSpeed =
      gait === 'WALK'
        ? THREE.MathUtils.lerp(3.2, 7.5, THREE.MathUtils.clamp(state.speed / 6.8, 0, 1))
        : gait === 'RUN'
        ? THREE.MathUtils.lerp(6.0, 13.0, THREE.MathUtils.clamp(state.speed / 14.2, 0, 1))
        : 2.4;

    animTime.current += delta * cycleSpeed;
    const t = animTime.current;
    const gust = windSystem.getGustFactor();

    if (gait === 'IDLE') {
      const breathe = Math.sin(t) * 0.025;
      if (bodyRef.current) {
        bodyRef.current.position.y = THREE.MathUtils.damp(bodyRef.current.position.y, 0.95 + breathe, 12, delta);
        dampRot(bodyRef.current, 'x', 0, 12, delta);
        dampRot(bodyRef.current, 'y', 0, 12, delta);
      }
      dampRot(headRef.current, 'x', Math.sin(t * 0.5) * 0.03, 10, delta);
      dampRot(headRef.current, 'y', Math.cos(t * 0.35) * 0.04, 8, delta);
      dampRot(leftArmRef.current, 'x', 0.06, 14, delta);
      dampRot(rightArmRef.current, 'x', 0.06, 14, delta);
      dampRot(leftLegRef.current, 'x', 0, 18, delta);
      dampRot(rightLegRef.current, 'x', 0, 18, delta);
      dampRot(leftShinRef.current, 'x', 0, 18, delta);
      dampRot(rightShinRef.current, 'x', 0, 18, delta);
      dampRot(leftForearmRef.current, 'x', -0.14, 14, delta);
      dampRot(rightForearmRef.current, 'x', -0.14, 14, delta);
      dampRot(coatTailRef.current, 'x', 0.08 + Math.sin(t * 1.4) * 0.05 * gust, 10, delta);
    } else if (gait === 'WALK' || gait === 'RUN') {
      const isRun = gait === 'RUN';
      const factor = THREE.MathUtils.clamp(state.speed / (isRun ? 14.2 : 6.8), 0, 1);
      const stride = (isRun ? 0.92 : 0.58) * THREE.MathUtils.lerp(0.3, 1, factor);
      const arm = (isRun ? 1.0 : 0.52) * THREE.MathUtils.lerp(0.35, 1, factor);
      const phase = Math.sin(t);

      if (bodyRef.current) {
        bodyRef.current.position.y = THREE.MathUtils.damp(
          bodyRef.current.position.y,
          0.95 + Math.abs(phase) * (isRun ? 0.09 : 0.045),
          18,
          delta
        );
        dampRot(bodyRef.current, 'x', isRun ? 0.28 : 0.1, 14, delta);
        dampRot(bodyRef.current, 'y', phase * 0.08 * factor, 14, delta);
      }

      dampRot(headRef.current, 'y', -phase * 0.05 * factor, 14, delta);
      dampRot(leftLegRef.current, 'x', phase * stride, 20, delta);
      dampRot(rightLegRef.current, 'x', -phase * stride, 20, delta);
      dampRot(leftShinRef.current, 'x', Math.max(0, -phase) * (isRun ? 1.3 : 0.85), 22, delta);
      dampRot(rightShinRef.current, 'x', Math.max(0, phase) * (isRun ? 1.3 : 0.85), 22, delta);

      dampRot(leftArmRef.current, 'x', -phase * arm, 16, delta);
      dampRot(rightArmRef.current, 'x', phase * arm, 16, delta);
      dampRot(leftForearmRef.current, 'x', isRun ? -0.68 : -0.28, 14, delta);
      dampRot(rightForearmRef.current, 'x', isRun ? -0.68 : -0.28, 14, delta);
      dampRot(
        coatTailRef.current,
        'x',
        (isRun ? 0.52 : 0.24) + Math.abs(phase) * 0.18 + 0.04 * gust,
        14,
        delta
      );
    } else {
      const up = gait === 'JUMP_UP';
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95;
        dampRot(bodyRef.current, 'x', up ? -0.14 : 0.16, 14, delta);
      }
      dampRot(leftArmRef.current, 'x', up ? -1.0 : -0.35, 14, delta);
      dampRot(rightArmRef.current, 'x', up ? -1.0 : -0.35, 14, delta);
      dampRot(leftLegRef.current, 'x', up ? 0.35 : -0.2, 14, delta);
      dampRot(rightLegRef.current, 'x', up ? 0.45 : -0.3, 14, delta);
      dampRot(leftShinRef.current, 'x', up ? 0.75 : 0.3, 14, delta);
      dampRot(rightShinRef.current, 'x', up ? 0.85 : 0.35, 14, delta);
      dampRot(coatTailRef.current, 'x', up ? 0.65 : 0.85, 14, delta);
    }
  });

  const isBoosting = state.gait === 'RUN' || state.gait === 'JUMP_UP';
  const accentColor = isBoosting ? '#f59e0b' : '#38bdf8';

  return (
    <group ref={rootRef} name="ProceduralProtagonist">
      <group ref={bodyRef} position={[0, 0.95, 0]}>
        {/* 1. Articulated Pelvis, Tactical Utility Belt & Holstered Data-Blade */}
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.15, 0.23]} />
          <meshStandardMaterial color="#0b0f19" metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.39, 0.055, 0.26]} />
          <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
        </mesh>
        {/* Glowing Belt Buckle Node */}
        <mesh position={[0, 0.08, 0.135]}>
          <boxGeometry args={[0.09, 0.035, 0.015]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        {/* Left Hip Utility Pouch & Right Hip Data-Blade Scabbard */}
        <mesh position={[-0.21, 0.04, 0.02]} castShadow>
          <boxGeometry args={[0.05, 0.11, 0.12]} />
          <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.3} />
        </mesh>
        <group position={[0.21, 0.02, -0.02]} rotation={[0.45, 0, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.035, 0.38, 0.065]} />
            <meshStandardMaterial color="#111827" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.042, 0.08, 0.072]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>

        {/* Dynamic Articulated Split Cyber-Trench Coat Tail */}
        <group ref={coatTailRef} position={[0, 0.05, -0.12]}>
          <mesh position={[-0.095, -0.22, -0.02]} rotation={[0, 0, 0.08]} castShadow>
            <boxGeometry args={[0.16, 0.42, 0.025]} />
            <meshStandardMaterial color="#0b1120" metalness={0.65} roughness={0.42} />
          </mesh>
          <mesh position={[0.095, -0.22, -0.02]} rotation={[0, 0, -0.08]} castShadow>
            <boxGeometry args={[0.16, 0.42, 0.025]} />
            <meshStandardMaterial color="#0b1120" metalness={0.65} roughness={0.42} />
          </mesh>
          {/* Emissive Coat Hem Trim */}
          <mesh position={[-0.095, -0.42, -0.02]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.162, 0.022, 0.03]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.095, -0.42, -0.02]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.162, 0.022, 0.03]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>

        {/* 2. Armored Exosuit Torso, High Tech-Collar, Chest Core & Dorsal Jet-Pack */}
        <group position={[0, 0.28, 0]}>
          {/* Core Chest Chassis */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.43, 0.42, 0.25]} />
            <meshStandardMaterial
              color="#0f172a"
              normalMap={armorNormal}
              normalScale={new THREE.Vector2(0.35, 0.35)}
              metalness={metalness}
              roughness={roughness}
            />
          </mesh>
          {/* Sculpted Left/Right Pectoral Armor Plates */}
          <mesh position={[-0.1, 0.08, 0.13]} rotation={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.17, 0.16, 0.03]} />
            <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
          </mesh>
          <mesh position={[0.1, 0.08, 0.13]} rotation={[0, -0.12, 0]} castShadow>
            <boxGeometry args={[0.17, 0.16, 0.03]} />
            <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Central Reactor Core & Outer Ring Bezel */}
          <mesh position={[0, 0.06, 0.142]}>
            <circleGeometry args={[0.052, 16]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, 0.06, 0.145]}>
            <ringGeometry args={[0.055, 0.072, 16]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* High Armored Cyber-Collar */}
          <mesh position={[0, 0.23, -0.02]} castShadow>
            <cylinderGeometry args={[0.14, 0.16, 0.09, 12, 1, true, Math.PI * 0.25, Math.PI * 1.5]} />
            <meshStandardMaterial color="#0b1120" metalness={0.9} roughness={0.22} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.275, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.01, 6, 16]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>

          {/* Dorsal Jump-Pack, Vertebral Spine Column & Dual Vernier Thrusters */}
          <mesh position={[0, 0.05, -0.16]} castShadow>
            <boxGeometry args={[0.27, 0.32, 0.11]} />
            <meshStandardMaterial color="#090d16" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Illuminated Spine Telemetry Nodes */}
          {([-0.07, 0.01, 0.09] as const).map((sy, sIdx) => (
            <mesh key={sIdx} position={[0, sy, -0.22]}>
              <boxGeometry args={[0.06, 0.022, 0.015]} />
              <meshBasicMaterial color={sIdx === 1 ? '#f59e0b' : '#38bdf8'} />
            </mesh>
          ))}
          {/* Dual Angled Thruster Nozzles & Plasma Plumes */}
          {([-0.085, 0.085] as const).map((tx, tIdx) => (
            <group key={tIdx} position={[tx, -0.13, -0.17]} rotation={[0.18, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.032, 0.045, 0.08, 10]} />
                <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.065, 0]}>
                <coneGeometry args={[0.034, isBoosting ? 0.16 : 0.06, 8]} />
                <meshBasicMaterial color={accentColor} transparent opacity={isBoosting ? 0.9 : 0.55} />
              </mesh>
            </group>
          ))}
        </group>

        {/* 3. Sculpted Cyber-Helmet, Wrap-Around Visor, Crest & Comms Pods */}
        <group ref={headRef} position={[0, 0.63, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.158, 18, 18]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.92} roughness={0.16} />
          </mesh>
          {/* Forehead Aero Crest */}
          <mesh position={[0, 0.11, 0.03]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.065, 0.06, 0.18]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Wrap-Around Illuminated Visor */}
          <mesh position={[0, 0.018, 0.112]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.22, 0.068, 0.095]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Dual Optical Sensor Pupils inside Visor */}
          <mesh position={[-0.05, 0.02, 0.162]}>
            <boxGeometry args={[0.032, 0.016, 0.01]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.05, 0.02, 0.162]}>
            <boxGeometry args={[0.032, 0.016, 0.01]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Side Comms Ear Pods & Right Micro-Antenna */}
          <mesh position={[-0.155, 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.038, 0.038, 0.03, 10]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.155, 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.038, 0.038, 0.03, 10]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.165, 0.1, -0.02]}>
            <cylinderGeometry args={[0.006, 0.01, 0.15, 6]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>

        {/* 4. Left Arm (Pauldron, Upper Arm, Elbow Servo, Holo-Bracer Gauntlet & Hand) */}
        <group ref={leftArmRef} position={[-0.255, 0.44, 0]}>
          {/* Shoulder Pauldron */}
          <mesh position={[-0.03, -0.02, 0]} rotation={[0, 0, 0.22]} castShadow>
            <boxGeometry args={[0.13, 0.12, 0.15]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[-0.095, -0.02, 0]} rotation={[0, 0, 0.22]}>
            <boxGeometry args={[0.015, 0.09, 0.13]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          {/* Upper Arm */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.045, 0.24, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          {/* Forearm & Holographic Wrist Terminal */}
          <group ref={leftForearmRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.088, 0.23, 0.088]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            {/* Glowing Wrist-Comms Display */}
            <mesh position={[-0.048, -0.12, 0.01]}>
              <boxGeometry args={[0.012, 0.11, 0.05]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            {/* Gloved Hand */}
            <mesh position={[0, -0.265, 0.01]} castShadow>
              <boxGeometry args={[0.068, 0.07, 0.075]} />
              <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.22} />
            </mesh>
          </group>
        </group>

        {/* 5. Right Arm (Pauldron, Upper Arm, Elbow Servo, Gauntlet & Hand) */}
        <group ref={rightArmRef} position={[0.255, 0.44, 0]}>
          {/* Shoulder Pauldron */}
          <mesh position={[0.03, -0.02, 0]} rotation={[0, 0, -0.22]} castShadow>
            <boxGeometry args={[0.13, 0.12, 0.15]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.095, -0.02, 0]} rotation={[0, 0, -0.22]}>
            <boxGeometry args={[0.015, 0.09, 0.13]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Upper Arm */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.045, 0.24, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          {/* Forearm & Gauntlet */}
          <group ref={rightForearmRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.088, 0.23, 0.088]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0.048, -0.12, 0.01]}>
              <boxGeometry args={[0.012, 0.11, 0.045]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
            {/* Gloved Hand */}
            <mesh position={[0, -0.265, 0.01]} castShadow>
              <boxGeometry args={[0.068, 0.07, 0.075]} />
              <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.22} />
            </mesh>
          </group>
        </group>

        {/* 6. Left Leg (Thigh Exo-Plate, Knee Guard, Greave Shin & Thruster Boot) */}
        <group ref={leftLegRef} position={[-0.115, -0.06, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <cylinderGeometry args={[0.078, 0.062, 0.38, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <mesh position={[-0.068, -0.18, 0]}>
            <boxGeometry args={[0.02, 0.24, 0.09]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <group ref={leftShinRef} position={[0, -0.41, 0]}>
            {/* Knee Guard */}
            <mesh position={[0, 0.02, 0.062]} castShadow>
              <boxGeometry args={[0.085, 0.09, 0.035]} />
              <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
            </mesh>
            {/* Greave Shin */}
            <mesh position={[0, -0.19, 0.01]} castShadow>
              <boxGeometry args={[0.1, 0.35, 0.11]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, -0.19, 0.068]}>
              <boxGeometry args={[0.022, 0.24, 0.01]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            {/* Armored Boot & Heel Stabilizer */}
            <mesh position={[0, -0.41, 0.05]} castShadow>
              <boxGeometry args={[0.115, 0.095, 0.24]} />
              <meshStandardMaterial color="#090d16" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, -0.42, -0.075]}>
              <boxGeometry args={[0.08, 0.04, 0.02]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </group>
        </group>

        {/* 7. Right Leg (Thigh Exo-Plate, Knee Guard, Greave Shin & Thruster Boot) */}
        <group ref={rightLegRef} position={[0.115, -0.06, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <cylinderGeometry args={[0.078, 0.062, 0.38, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <mesh position={[0.068, -0.18, 0]}>
            <boxGeometry args={[0.02, 0.24, 0.09]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <group ref={rightShinRef} position={[0, -0.41, 0]}>
            {/* Knee Guard */}
            <mesh position={[0, 0.02, 0.062]} castShadow>
              <boxGeometry args={[0.085, 0.09, 0.035]} />
              <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
            </mesh>
            {/* Greave Shin */}
            <mesh position={[0, -0.19, 0.01]} castShadow>
              <boxGeometry args={[0.1, 0.35, 0.11]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, -0.19, 0.068]}>
              <boxGeometry args={[0.022, 0.24, 0.01]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            {/* Armored Boot & Heel Stabilizer */}
            <mesh position={[0, -0.41, 0.05]} castShadow>
              <boxGeometry args={[0.115, 0.095, 0.24]} />
              <meshStandardMaterial color="#090d16" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, -0.42, -0.075]}>
              <boxGeometry args={[0.08, 0.04, 0.02]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};
