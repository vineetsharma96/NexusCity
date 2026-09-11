import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { InteriorManager, InteriorType } from '../world/InteriorManager';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

interface ProceduralInteriorProps {
  type: InteriorType;
  onExit: () => void;
}

export const ProceduralInterior: React.FC<ProceduralInteriorProps> = ({ type, onExit }) => {
  const origin = InteriorManager.INTERIOR_ORIGIN;
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);

  // Register interior colliders and exit interactable
  useEffect(() => {
    if (type === 'NONE') return;

    // Room Dimensions: 22m wide, 4.5m high, 18m deep
    const w = 22;
    const h = 4.5;
    const d = 18;

    // Register 4 perimeter walls in KinematicCollisionSolver
    // North Wall
    KinematicCollisionSolver.addBox(
      origin.clone().add(new THREE.Vector3(0, h / 2, -d / 2 - 0.5)),
      new THREE.Vector3(w, h, 1)
    );
    // South Wall
    KinematicCollisionSolver.addBox(
      origin.clone().add(new THREE.Vector3(0, h / 2, d / 2 + 0.5)),
      new THREE.Vector3(w, h, 1)
    );
    // West Wall
    KinematicCollisionSolver.addBox(
      origin.clone().add(new THREE.Vector3(-w / 2 - 0.5, h / 2, 0)),
      new THREE.Vector3(1, h, d)
    );
    // East Wall
    KinematicCollisionSolver.addBox(
      origin.clone().add(new THREE.Vector3(w / 2 + 0.5, h / 2, 0)),
      new THREE.Vector3(1, h, d)
    );

    if (type === 'LAB') {
      // Central Containment Chamber Collider
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(4.5, 3.6, 4.5));
      // Workstations
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));
    } else if (type === 'LOUNGE') {
      // Service Counter Bar
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, -5)), new THREE.Vector3(12, 1.6, 2.5));
    }

    // Register Exit Doorway Interactable
    const exitPos = origin.clone().add(new THREE.Vector3(0, 0.2, 8.2));
    InteractionSystem.getInstance().register({
      id: 'interior_exit_door',
      name: 'Exit Door',
      actionText: 'EXIT TO STREET // CENTRAL BOULEVARD',
      position: exitPos,
      radius: 2.6,
      onInteract: () => {
        onExit();
      },
    });

    return () => {
      InteractionSystem.getInstance().unregister('interior_exit_door');
    };
  }, [type, origin, onExit]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 1.2;
      coreRef.current.position.y = 1.8 + Math.sin(t * 2) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.8;
      ringRef.current.rotation.y = t * 0.5;
    }
  });

  if (type === 'NONE') return null;

  return (
    <group position={origin} name="InteriorContainer">
      {/* 1. Room Envelope: Floor, Ceiling, Walls */}
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial
          color={type === 'LAB' ? '#0f172a' : '#1e1b18'}
          roughness={0.25}
          metalness={type === 'LAB' ? 0.8 : 0.4}
        />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.5, 0]} receiveShadow>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#0b1120" roughness={0.7} />
      </mesh>

      {/* Perimeter Walls */}
      {/* North Wall (Back) */}
      <mesh position={[0, 2.25, -9]} receiveShadow>
        <boxGeometry args={[22, 4.5, 0.2]} />
        <meshStandardMaterial color="#111c33" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* South Wall (Entrance/Exit) */}
      <mesh position={[0, 2.25, 9]} receiveShadow>
        <boxGeometry args={[22, 4.5, 0.2]} />
        <meshStandardMaterial color="#111c33" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* West Wall */}
      <mesh position={[-11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color="#111c33" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* East Wall */}
      <mesh position={[11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color="#111c33" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* 2. Recessed Ceiling LED Troffers & Dedicated Interior Light */}
      <pointLight position={[0, 4.0, 0]} color={type === 'LAB' ? '#00f0ff' : '#ffeed0'} intensity={2.6} distance={20} decay={2} castShadow />
      <pointLight position={[-6, 3.8, -4]} color="#00f0ff" intensity={1.2} distance={12} decay={2} />
      <pointLight position={[6, 3.8, -4]} color="#00f0ff" intensity={1.2} distance={12} decay={2} />

      {/* 4 Ceiling Fluorescent Panels */}
      {[-5, 5].map((x, xi) =>
        [-4, 4].map((z, zi) => (
          <mesh key={`troffer-${xi}-${zi}`} position={[x, 4.45, z]}>
            <boxGeometry args={[3.5, 0.05, 1.8]} />
            <meshBasicMaterial color={type === 'LAB' ? '#e0f2fe' : '#fef3c7'} />
          </mesh>
        ))
      )}

      {/* 3. Exit Door Frame & Glowing Sign */}
      <group position={[0, 0, 8.8]}>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[2.8, 2.8, 0.3]} />
          <meshStandardMaterial color="#080e1a" metalness={0.9} />
        </mesh>
        {/* Glowing EXIT Sign Header */}
        <mesh position={[0, 2.9, 0.16]}>
          <boxGeometry args={[1.4, 0.35, 0.05]} />
          <meshBasicMaterial color="#00ffaa" />
        </mesh>
      </group>

      {/* 4. Type-Specific Interior Props */}
      {type === 'LAB' ? (
        <group name="LabProps">
          {/* Central Quantum Reactor Chamber */}
          <group position={[0, 0, 0]}>
            {/* Base Pedestal */}
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[2.2, 2.5, 0.8, 16]} />
              <meshStandardMaterial color="#0a1224" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Glass Containment Tube */}
            <mesh position={[0, 1.8, 0]}>
              <cylinderGeometry args={[1.8, 1.8, 2.0, 16]} />
              <meshPhysicalMaterial color="#00f0ff" transparent opacity={0.35} transmission={0.8} roughness={0.1} />
            </mesh>
            {/* Top Cap */}
            <mesh position={[0, 3.1, 0]} castShadow>
              <cylinderGeometry args={[2.0, 2.2, 0.6, 16]} />
              <meshStandardMaterial color="#0a1224" metalness={0.9} />
            </mesh>
            {/* Floating Core */}
            <mesh ref={coreRef} position={[0, 1.8, 0]}>
              <octahedronGeometry args={[0.7, 0]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
            {/* Orbiting Ring */}
            <group ref={ringRef} position={[0, 1.8, 0]}>
              <mesh>
                <torusGeometry args={[1.2, 0.03, 12, 32]} />
                <meshBasicMaterial color="#ff0077" />
              </mesh>
            </group>
          </group>

          {/* West Research Desk & Screens */}
          <group position={[-6, 0, -4]}>
            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
              <boxGeometry args={[3.6, 0.9, 1.8]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Computer Monitors */}
            {[-0.9, 0.9].map((mx, mi) => (
              <mesh key={`mon-w-${mi}`} position={[mx, 1.25, -0.3]} rotation={[0.1, 0, 0]}>
                <boxGeometry args={[1.1, 0.6, 0.05]} />
                <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.8} />
              </mesh>
            ))}
            {/* Server Rack behind desk */}
            <mesh position={[0, 1.5, -3.2]} castShadow receiveShadow>
              <boxGeometry args={[2.4, 3.0, 0.9]} />
              <meshStandardMaterial color="#09101d" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>

          {/* East Research Desk & Screens */}
          <group position={[6, 0, -4]}>
            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
              <boxGeometry args={[3.6, 0.9, 1.8]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            {[-0.9, 0.9].map((mx, mi) => (
              <mesh key={`mon-e-${mi}`} position={[mx, 1.25, -0.3]} rotation={[0.1, 0, 0]}>
                <boxGeometry args={[1.1, 0.6, 0.05]} />
                <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.8} />
              </mesh>
            ))}
            {/* Server Rack behind desk */}
            <mesh position={[0, 1.5, -3.2]} castShadow receiveShadow>
              <boxGeometry args={[2.4, 3.0, 0.9]} />
              <meshStandardMaterial color="#09101d" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      ) : (
        <group name="LoungeProps">
          {/* Service Counter Bar */}
          <group position={[0, 0, -5]}>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <boxGeometry args={[11, 1.1, 1.8]} />
              <meshStandardMaterial color="#1c1917" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Countertop Neon Edge Strip */}
            <mesh position={[0, 1.12, 0.88]}>
              <boxGeometry args={[11, 0.04, 0.04]} />
              <meshBasicMaterial color="#ff0077" />
            </mesh>
            {/* Holographic Menu Screen */}
            <mesh position={[0, 2.5, -0.8]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[7, 1.4, 0.06]} />
              <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.9} />
            </mesh>
          </group>

          {/* Dining Booth Tables */}
          {[-5, 5].map((bx, bi) =>
            [1, -1].map((bz, bzi) => (
              <group key={`booth-${bi}-${bzi}`} position={[bx, 0, bz * 3.5]}>
                {/* Table Top */}
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[1.1, 1.1, 0.08, 16]} />
                  <meshStandardMaterial color="#292524" metalness={0.7} />
                </mesh>
                {/* Pedestal */}
                <mesh position={[0, 0.36, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.72, 8]} />
                  <meshStandardMaterial color="#09090b" metalness={0.9} />
                </mesh>
                {/* Table Lamp */}
                <mesh position={[0, 0.9, 0]}>
                  <cylinderGeometry args={[0.12, 0.16, 0.22, 8]} />
                  <meshBasicMaterial color="#ffaa00" />
                </mesh>
              </group>
            ))
          )}
        </group>
      )}
    </group>
  );
};
