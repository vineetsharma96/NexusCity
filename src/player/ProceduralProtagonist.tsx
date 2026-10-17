import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicState } from './KinematicController';
import { WeatherSystem } from '../world/WeatherSystem';
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

  const armorNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const roughness = THREE.MathUtils.lerp(0.26, 0.06, weather.wetnessFactor);
  const metalness = THREE.MathUtils.lerp(0.82, 0.96, weather.wetnessFactor);

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

    if (gait === 'IDLE') {
      const breathe = Math.sin(t) * 0.025;
      if (bodyRef.current) {
        bodyRef.current.position.y = THREE.MathUtils.damp(bodyRef.current.position.y, 0.95 + breathe, 12, delta);
        dampRot(bodyRef.current, 'x', 0, 12, delta);
        dampRot(bodyRef.current, 'y', 0, 12, delta);
      }
      dampRot(headRef.current, 'x', Math.sin(t * 0.5) * 0.03, 10, delta);
      dampRot(leftArmRef.current, 'x', 0.06, 14, delta);
      dampRot(rightArmRef.current, 'x', 0.06, 14, delta);
      dampRot(leftLegRef.current, 'x', 0, 18, delta);
      dampRot(rightLegRef.current, 'x', 0, 18, delta);
      dampRot(leftShinRef.current, 'x', 0, 18, delta);
      dampRot(rightShinRef.current, 'x', 0, 18, delta);
      dampRot(leftForearmRef.current, 'x', -0.1, 14, delta);
      dampRot(rightForearmRef.current, 'x', -0.1, 14, delta);
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
        dampRot(bodyRef.current, 'y', phase * 0.07 * factor, 14, delta);
      }

      dampRot(leftLegRef.current, 'x', phase * stride, 20, delta);
      dampRot(rightLegRef.current, 'x', -phase * stride, 20, delta);
      dampRot(leftShinRef.current, 'x', Math.max(0, -phase) * (isRun ? 1.3 : 0.85), 22, delta);
      dampRot(rightShinRef.current, 'x', Math.max(0, phase) * (isRun ? 1.3 : 0.85), 22, delta);

      dampRot(leftArmRef.current, 'x', -phase * arm, 16, delta);
      dampRot(rightArmRef.current, 'x', phase * arm, 16, delta);
      dampRot(leftForearmRef.current, 'x', isRun ? -0.65 : -0.25, 14, delta);
      dampRot(rightForearmRef.current, 'x', isRun ? -0.65 : -0.25, 14, delta);
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
    }
  });

  const isBoosting = state.gait === 'RUN' || state.gait === 'JUMP_UP';

  return (
    <group ref={rootRef} name="ProceduralProtagonist">
      <group ref={bodyRef} position={[0, 0.95, 0]}>
        {/* Pelvis & Belt */}
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.15, 0.23]} />
          <meshStandardMaterial color="#0b0f19" metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.39, 0.05, 0.26]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Torso */}
        <group position={[0, 0.28, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.43, 0.42, 0.25]} />
            <meshStandardMaterial
              color="#0f172a"
              normalMap={armorNormal}
              normalScale={new THREE.Vector2(0.3, 0.3)}
              metalness={metalness}
              roughness={roughness}
            />
          </mesh>
          <mesh position={[0, 0.05, 0.13]}>
            <circleGeometry args={[0.055, 16]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, 0.04, -0.16]} castShadow>
            <boxGeometry args={[0.25, 0.3, 0.1]} />
            <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[-0.07, -0.13, -0.16]}>
            <cylinderGeometry args={[0.03, 0.04, 0.07, 8]} />
            <meshBasicMaterial color={isBoosting ? '#f59e0b' : '#38bdf8'} />
          </mesh>
          <mesh position={[0.07, -0.13, -0.16]}>
            <cylinderGeometry args={[0.03, 0.04, 0.07, 8]} />
            <meshBasicMaterial color={isBoosting ? '#f59e0b' : '#38bdf8'} />
          </mesh>
        </group>

        {/* Head & Visor */}
        <group ref={headRef} position={[0, 0.62, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.155, 16, 16]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.92} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.02, 0.11]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.21, 0.065, 0.09]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.25, 0.44, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.25, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.085, 0.23, 0.085]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
          </group>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.25, 0.44, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.25, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.085, 0.23, 0.085]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
          </group>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.115, -0.06, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.06, 0.38, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <group ref={leftShinRef} position={[0, -0.41, 0]}>
            <mesh position={[0, -0.19, 0.01]} castShadow>
              <boxGeometry args={[0.1, 0.35, 0.11]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, -0.41, 0.05]} castShadow>
              <boxGeometry args={[0.11, 0.09, 0.23]} />
              <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.115, -0.06, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.06, 0.38, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
          </mesh>
          <group ref={rightShinRef} position={[0, -0.41, 0]}>
            <mesh position={[0, -0.19, 0.01]} castShadow>
              <boxGeometry args={[0.1, 0.35, 0.11]} />
              <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, -0.41, 0.05]} castShadow>
              <boxGeometry args={[0.11, 0.09, 0.23]} />
              <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};
