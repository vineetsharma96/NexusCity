import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicState } from './KinematicController';

interface ProceduralProtagonistProps {
  state: KinematicState;
}

export const ProceduralProtagonist: React.FC<ProceduralProtagonistProps> = ({ state }) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);

  // Limb hierarchy refs
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);

  // Thruster lights
  const leftThrusterRef = useRef<THREE.PointLight>(null);
  const rightThrusterRef = useRef<THREE.PointLight>(null);

  // Continuous animation cycle timer
  const animTime = useRef(0);

  useFrame((_, delta) => {
    if (!rootGroupRef.current) return;

    // 1. Sync Root Position, Facing Yaw and Banking Lean
    rootGroupRef.current.position.copy(state.position);
    rootGroupRef.current.rotation.y = state.rotationY;
    rootGroupRef.current.rotation.z = THREE.MathUtils.lerp(
      rootGroupRef.current.rotation.z,
      state.bankAngle || 0,
      delta * 12
    );

    // 2. Advance Animation Cycle based on current gait
    const gait = state.gait;
    let cycleSpeed = 0;
    if (gait === 'WALK') cycleSpeed = 7.5;
    else if (gait === 'RUN') cycleSpeed = 13.0;
    else if (gait === 'IDLE') cycleSpeed = 2.5;

    animTime.current += delta * cycleSpeed;
    const t = animTime.current;

    // Procedural Poses & Forward Kinematics
    if (gait === 'IDLE') {
      // Gentle breathing & weight shifting
      const breathe = Math.sin(t) * 0.03;
      if (bodyGroupRef.current) {
        bodyGroupRef.current.position.y = 0.95 + breathe * 0.5;
        bodyGroupRef.current.rotation.x = 0;
        bodyGroupRef.current.rotation.z = Math.sin(t * 0.5) * 0.02;
      }
      if (torsoRef.current) torsoRef.current.scale.set(1 + breathe * 0.3, 1, 1 + breathe * 0.3);
      if (headRef.current) headRef.current.rotation.x = Math.sin(t * 0.5) * 0.03;

      // Relaxed arms
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0.08, 0.15);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, 0.12, 0.15);
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.08, 0.15);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.12, 0.15);
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.2);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.2);
      if (leftShinRef.current) leftShinRef.current.rotation.x = THREE.MathUtils.lerp(leftShinRef.current.rotation.x, 0, 0.2);
      if (rightShinRef.current) rightShinRef.current.rotation.x = THREE.MathUtils.lerp(rightShinRef.current.rotation.x, 0, 0.2);

      if (leftThrusterRef.current) leftThrusterRef.current.intensity = 0.2;
      if (rightThrusterRef.current) rightThrusterRef.current.intensity = 0.2;
    } else if (gait === 'WALK' || gait === 'RUN') {
      const isRunning = gait === 'RUN';
      const strideAmp = isRunning ? 0.95 : 0.6;
      const armAmp = isRunning ? 1.05 : 0.55;
      const forwardLean = isRunning ? 0.32 : 0.12;

      // Torso lean and vertical hip bounce (two bounces per full stride cycle)
      const hipBounce = Math.abs(Math.sin(t)) * (isRunning ? 0.1 : 0.05);
      if (bodyGroupRef.current) {
        bodyGroupRef.current.position.y = 0.95 + hipBounce;
        bodyGroupRef.current.rotation.x = forwardLean;
        bodyGroupRef.current.rotation.y = Math.sin(t) * 0.08; // Torso counter-rotation
        bodyGroupRef.current.rotation.z = Math.cos(t) * 0.04;
      }

      // Legs swing (opposite phases)
      const legPhase = Math.sin(t);
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = legPhase * strideAmp;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -legPhase * strideAmp;
      }

      // Knees bend on backward stroke
      if (leftShinRef.current) {
        leftShinRef.current.rotation.x = legPhase < 0 ? Math.abs(legPhase) * (isRunning ? 1.4 : 0.9) : 0.05;
      }
      if (rightShinRef.current) {
        rightShinRef.current.rotation.x = legPhase > 0 ? Math.abs(legPhase) * (isRunning ? 1.4 : 0.9) : 0.05;
      }

      // Arms swing opposite to legs
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -legPhase * armAmp;
        leftArmRef.current.rotation.z = 0.15;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = legPhase * armAmp;
        rightArmRef.current.rotation.z = -0.15;
      }
      if (leftForearmRef.current) {
        leftForearmRef.current.rotation.x = isRunning ? -0.7 : -0.3;
      }
      if (rightForearmRef.current) {
        rightForearmRef.current.rotation.x = isRunning ? -0.7 : -0.3;
      }

      // Thruster pulse on running
      const thrusterGlow = isRunning ? 1.2 + Math.sin(t * 2) * 0.6 : 0.4;
      if (leftThrusterRef.current) leftThrusterRef.current.intensity = thrusterGlow;
      if (rightThrusterRef.current) rightThrusterRef.current.intensity = thrusterGlow;
    } else if (gait === 'JUMP_UP' || gait === 'FALL') {
      const isAscending = gait === 'JUMP_UP';
      if (bodyGroupRef.current) {
        bodyGroupRef.current.position.y = 0.95;
        bodyGroupRef.current.rotation.x = isAscending ? -0.15 : 0.18;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = isAscending ? -1.1 : -0.4;
        leftArmRef.current.rotation.z = 0.35;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = isAscending ? -1.1 : -0.4;
        rightArmRef.current.rotation.z = -0.35;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = isAscending ? 0.35 : -0.2;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = isAscending ? 0.45 : -0.3;
      }
      if (leftShinRef.current) leftShinRef.current.rotation.x = isAscending ? 0.8 : 0.3;
      if (rightShinRef.current) rightShinRef.current.rotation.x = isAscending ? 0.9 : 0.4;

      // Bright thruster boost during jump
      const boost = isAscending ? 2.8 : 0.8;
      if (leftThrusterRef.current) leftThrusterRef.current.intensity = boost;
      if (rightThrusterRef.current) rightThrusterRef.current.intensity = boost;
    }
  });

  return (
    <group ref={rootGroupRef} name="ProceduralProtagonist">
      <group ref={bodyGroupRef}>
        {/* ================= HIPS / PELVIS & TACTICAL BELT ================= */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.16, 0.24]} />
          <meshStandardMaterial color="#0c1424" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Tactical Utility Belt */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.40, 0.06, 0.28]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Glowing Power Canisters on Belt */}
        <mesh position={[-0.14, 0.08, 0.14]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <mesh position={[0.14, 0.08, 0.14]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <mesh position={[0.18, 0.08, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.1]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.18, 0.08, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.1]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>

        {/* ================= TORSO & CHEST ================= */}
        <group ref={torsoRef} position={[0, 0.28, 0]}>
          {/* Main armored chestplate */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.44, 0.42, 0.26]} />
            <meshStandardMaterial color="#0d182e" metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Core Arc Reactor (Chest) */}
          <mesh position={[0, 0.05, 0.14]}>
            <circleGeometry args={[0.065, 16]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          {/* Dual Jump-Jet Thruster Pack (Back) */}
          <mesh position={[0, 0.04, -0.18]} castShadow>
            <boxGeometry args={[0.26, 0.32, 0.12]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Left Thruster Nozzle */}
          <mesh position={[-0.08, -0.14, -0.18]}>
            <cylinderGeometry args={[0.035, 0.045, 0.08, 8]} />
            <meshBasicMaterial color={state.gait === 'JUMP_UP' || state.gait === 'RUN' ? '#00f0ff' : '#0369a1'} />
          </mesh>
          {/* Right Thruster Nozzle */}
          <mesh position={[0.08, -0.14, -0.18]}>
            <cylinderGeometry args={[0.035, 0.045, 0.08, 8]} />
            <meshBasicMaterial color={state.gait === 'JUMP_UP' || state.gait === 'RUN' ? '#00f0ff' : '#0369a1'} />
          </mesh>
          {/* Spinal Neon Conduit (Back) */}
          <mesh position={[0, 0, -0.135]}>
            <boxGeometry args={[0.05, 0.38, 0.02]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          {/* Heavy Armored Shoulder Pauldrons */}
          <mesh position={[-0.26, 0.18, 0]} castShadow>
            <boxGeometry args={[0.14, 0.1, 0.24]} />
            <meshStandardMaterial color="#111f38" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[-0.26, 0.24, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.18]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          <mesh position={[0.26, 0.18, 0]} castShadow>
            <boxGeometry args={[0.14, 0.1, 0.24]} />
            <meshStandardMaterial color="#111f38" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.26, 0.24, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.18]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>

        {/* ================= HEAD & HELMET ================= */}
        <group ref={headRef} position={[0, 0.62, 0]}>
          {/* Neck */}
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.08, 8]} />
            <meshStandardMaterial color="#080e1a" metalness={0.7} />
          </mesh>
          {/* Helmet Dome */}
          <mesh castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#0b1322" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Cyber Visor (Glowing Amber Display) */}
          <mesh position={[0, 0.02, 0.11]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.22, 0.07, 0.1]} />
            <meshStandardMaterial
              color="#ffaa00"
              emissive="#ffaa00"
              emissiveIntensity={1.8}
              roughness={0.1}
            />
          </mesh>
          {/* Ear Antenna Fin */}
          <mesh position={[0.16, 0.04, -0.02]}>
            <boxGeometry args={[0.02, 0.14, 0.06]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>

        {/* ================= LEFT ARM ================= */}
        <group ref={leftArmRef} position={[-0.26, 0.44, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.05, 0.26, 8]} />
            <meshStandardMaterial color="#0e172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Elbow Joint */}
          <mesh position={[0, -0.27, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
          {/* Forearm */}
          <group ref={leftForearmRef} position={[0, -0.27, 0]}>
            <mesh position={[0, -0.14, 0]} castShadow>
              <boxGeometry args={[0.09, 0.24, 0.09]} />
              <meshStandardMaterial color="#111f38" metalness={0.85} roughness={0.25} />
            </mesh>
            {/* Gauntlet Neon Strip */}
            <mesh position={[-0.048, -0.12, 0]}>
              <boxGeometry args={[0.01, 0.18, 0.04]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
          </group>
        </group>

        {/* ================= RIGHT ARM ================= */}
        <group ref={rightArmRef} position={[0.26, 0.44, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.05, 0.26, 8]} />
            <meshStandardMaterial color="#0e172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Elbow Joint */}
          <mesh position={[0, -0.27, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
          {/* Forearm */}
          <group ref={rightForearmRef} position={[0, -0.27, 0]}>
            <mesh position={[0, -0.14, 0]} castShadow>
              <boxGeometry args={[0.09, 0.24, 0.09]} />
              <meshStandardMaterial color="#111f38" metalness={0.85} roughness={0.25} />
            </mesh>
            {/* Gauntlet Neon Strip */}
            <mesh position={[0.048, -0.12, 0]}>
              <boxGeometry args={[0.01, 0.18, 0.04]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
          </group>
        </group>

        {/* ================= LEFT LEG ================= */}
        <group ref={leftLegRef} position={[-0.12, -0.06, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.065, 0.38, 8]} />
            <meshStandardMaterial color="#0e172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Knee Joint */}
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
          {/* Shin & Boot */}
          <group ref={leftShinRef} position={[0, -0.42, 0]}>
            <mesh position={[0, -0.2, 0.01]} castShadow>
              <boxGeometry args={[0.11, 0.36, 0.12]} />
              <meshStandardMaterial color="#111f38" metalness={0.85} roughness={0.25} />
            </mesh>
            {/* High-Tech Boot Foot */}
            <mesh position={[0, -0.42, 0.06]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 0.1, 0.24]} />
              <meshStandardMaterial color="#091222" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Heel Thruster Nozzle */}
            <mesh position={[0, -0.4, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 0.05, 8]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
            <pointLight ref={leftThrusterRef} position={[0, -0.4, -0.12]} color="#00f0ff" distance={3} decay={2} intensity={0.2} />
          </group>
        </group>

        {/* ================= RIGHT LEG ================= */}
        <group ref={rightLegRef} position={[0.12, -0.06, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.065, 0.38, 8]} />
            <meshStandardMaterial color="#0e172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Knee Joint */}
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
          {/* Shin & Boot */}
          <group ref={rightShinRef} position={[0, -0.42, 0]}>
            <mesh position={[0, -0.2, 0.01]} castShadow>
              <boxGeometry args={[0.11, 0.36, 0.12]} />
              <meshStandardMaterial color="#111f38" metalness={0.85} roughness={0.25} />
            </mesh>
            {/* High-Tech Boot Foot */}
            <mesh position={[0, -0.42, 0.06]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 0.1, 0.24]} />
              <meshStandardMaterial color="#091222" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Heel Thruster Nozzle */}
            <mesh position={[0, -0.4, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 0.05, 8]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
            <pointLight ref={rightThrusterRef} position={[0, -0.4, -0.12]} color="#00f0ff" distance={3} decay={2} intensity={0.2} />
          </group>
        </group>
      </group>
    </group>
  );
};
