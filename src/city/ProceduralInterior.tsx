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
  const holoRef = useRef<THREE.Mesh>(null);

  // Register interior colliders and exit interactable
  useEffect(() => {
    if (type === 'NONE') return;

    // Room Dimensions: 22m wide, 4.5m high, 18m deep
    const w = 22;
    const h = 4.5;
    const d = 18;

    // Register 4 perimeter walls in KinematicCollisionSolver
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, h / 2, -d / 2 - 0.5)), new THREE.Vector3(w, h, 1));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, h / 2, d / 2 + 0.5)), new THREE.Vector3(w, h, 1));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-w / 2 - 0.5, h / 2, 0)), new THREE.Vector3(1, h, d));
    KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(w / 2 + 0.5, h / 2, 0)), new THREE.Vector3(1, h, d));

    // Type-specific colliders
    if (type === 'LAB') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(4.5, 3.6, 4.5));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(6, 0.8, -4)), new THREE.Vector3(3.5, 1.6, 2));
    } else if (type === 'LOUNGE' || type === 'RAMEN_DINER') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, -4)), new THREE.Vector3(12, 1.6, 2.5));
    } else if (type === 'CLINIC') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(3, 1.6, 2.5));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-7, 1.2, -4)), new THREE.Vector3(4, 2.4, 2));
    } else if (type === 'NETRUNNER_DEN' || type === 'SERVER_VAULT') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-6, 1.8, 0)), new THREE.Vector3(2.5, 3.6, 10));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(6, 1.8, 0)), new THREE.Vector3(2.5, 3.6, 10));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.2, -5)), new THREE.Vector3(4, 2.4, 3));
    } else if (type === 'DRONE_HANGAR') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(6, 1.0, 6));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-8, 1.0, -3)), new THREE.Vector3(2, 2.0, 5));
    } else if (type === 'PENTHOUSE') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.6, 1)), new THREE.Vector3(5, 1.2, 3));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 1.0, -8)), new THREE.Vector3(8, 2.0, 1.5));
    } else if (type === 'GREENHOUSE') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-5, 1.5, 0)), new THREE.Vector3(3, 3.0, 10));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(5, 1.5, 0)), new THREE.Vector3(3, 3.0, 10));
    } else if (type === 'METRO_STATION') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.8, -4)), new THREE.Vector3(18, 1.6, 1));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, -0.6, -7)), new THREE.Vector3(20, 1.2, 4));
    } else if (type === 'ARCADE') {
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(-7, 1.2, 0)), new THREE.Vector3(2.5, 2.4, 10));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(7, 1.2, 0)), new THREE.Vector3(2.5, 2.4, 10));
      KinematicCollisionSolver.addBox(origin.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(4, 0.6, 4));
    }

    // Register Exit Doorway Interactable
    const exitPos = origin.clone().add(new THREE.Vector3(0, 0.2, 8.2));
    InteractionSystem.getInstance().register({
      id: 'interior_exit_door',
      name: 'Exit Door',
      actionText: 'EXIT TO STREET // METROPOLIS SIDEWALK',
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
    if (holoRef.current) {
      holoRef.current.rotation.y = t * 0.6;
    }
  });

  if (type === 'NONE') return null;

  // Visual Theme Colors
  const themeColors = {
    LAB: { floor: '#0f172a', wall: '#111c33', accent: '#00f0ff', light: '#38bdf8' },
    LOUNGE: { floor: '#1e1b18', wall: '#241a29', accent: '#ec4899', light: '#f43f5e' },
    CLINIC: { floor: '#0e1726', wall: '#11222e', accent: '#06b6d4', light: '#22d3ee' },
    NETRUNNER_DEN: { floor: '#0a0a0f', wall: '#0f1715', accent: '#10b981', light: '#059669' },
    RAMEN_DINER: { floor: '#261815', wall: '#2e1c14', accent: '#f59e0b', light: '#fb923c' },
    DRONE_HANGAR: { floor: '#18181b', wall: '#27272a', accent: '#f97316', light: '#ea580c' },
    PENTHOUSE: { floor: '#1c1917', wall: '#292524', accent: '#e2e8f0', light: '#38bdf8' },
    SERVER_VAULT: { floor: '#051329', wall: '#091e3d', accent: '#3b82f6', light: '#60a5fa' },
    GREENHOUSE: { floor: '#062817', wall: '#0b3820', accent: '#22c55e', light: '#4ade80' },
    METRO_STATION: { floor: '#1e222b', wall: '#2b303c', accent: '#fbbf24', light: '#facc15' },
    ARCADE: { floor: '#180728', wall: '#2a0845', accent: '#d946ef', light: '#a855f7' },
  };

  const currentTheme = themeColors[type] || themeColors.LAB;

  return (
    <group position={origin} name="InteriorContainer">
      {/* 1. Room Envelope: Floor, Ceiling, Walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color={currentTheme.floor} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.5, 0]}>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#070c18" roughness={0.7} />
      </mesh>

      {/* North Wall (Back) */}
      <mesh position={[0, 2.25, -9]} receiveShadow>
        <boxGeometry args={[22, 4.5, 0.2]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* South Wall (Entrance/Exit) */}
      <mesh position={[0, 2.25, 9]} receiveShadow>
        <boxGeometry args={[22, 4.5, 0.2]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* West Wall */}
      <mesh position={[-11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* East Wall */}
      <mesh position={[11, 2.25, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.5, 18]} />
        <meshStandardMaterial color={currentTheme.wall} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Ceiling Neon Recessed Channels */}
      <mesh position={[0, 4.48, -4]}>
        <boxGeometry args={[18, 0.05, 0.3]} />
        <meshBasicMaterial color={currentTheme.accent} />
      </mesh>
      <mesh position={[0, 4.48, 4]}>
        <boxGeometry args={[18, 0.05, 0.3]} />
        <meshBasicMaterial color={currentTheme.accent} />
      </mesh>

      {/* Interior Ambient Lighting */}
      <pointLight position={[0, 3.8, 0]} color={currentTheme.light} distance={18} intensity={2.5} />
      <pointLight position={[0, 2.5, 7.5]} color="#ffffff" distance={6} intensity={1.2} />

      {/* Exit Doorway Frame & Glowing Indicator */}
      <mesh position={[0, 1.8, 8.85]}>
        <boxGeometry args={[3.2, 3.6, 0.2]} />
        <meshStandardMaterial color="#020617" metalness={0.9} />
      </mesh>
      <mesh position={[0, 3.65, 8.88]}>
        <boxGeometry args={[2.8, 0.4, 0.05]} />
        <meshBasicMaterial color="#00ffaa" />
      </mesh>

      {/* =========================================================
          PROPS BY INTERIOR TYPE
          ========================================================= */}

      {/* 1. LAB: Quantum Reactor Core */}
      {type === 'LAB' && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.25, 0]} receiveShadow>
            <cylinderGeometry args={[2.4, 2.6, 0.5, 16]} />
            <meshStandardMaterial color="#0b1324" metalness={0.9} />
          </mesh>
          <mesh ref={coreRef} position={[0, 1.8, 0]}>
            <octahedronGeometry args={[1.1, 0]} />
            <meshBasicMaterial color="#00f0ff" wireframe />
          </mesh>
          <group ref={ringRef} position={[0, 1.8, 0]}>
            <mesh>
              <torusGeometry args={[1.8, 0.08, 8, 24]} />
              <meshBasicMaterial color="#ff00aa" />
            </mesh>
          </group>
          {/* Workstations */}
          <mesh position={[-6, 0.8, -4]}>
            <boxGeometry args={[3.5, 1.6, 2]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[6, 0.8, -4]}>
            <boxGeometry args={[3.5, 1.6, 2]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      )}

      {/* 2. LOUNGE: Curved Cyber Bar */}
      {type === 'LOUNGE' && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.8, -4]} castShadow>
            <boxGeometry args={[12, 1.6, 2.5]} />
            <meshStandardMaterial color="#312e81" metalness={0.7} />
          </mesh>
          <mesh position={[0, 1.65, -4]}>
            <boxGeometry args={[12.2, 0.1, 2.7]} />
            <meshBasicMaterial color="#ec4899" />
          </mesh>
          {/* Bar Shelves */}
          <mesh position={[0, 2.8, -8.8]}>
            <boxGeometry args={[10, 2.2, 0.3]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <pointLight position={[0, 2.2, -4]} color="#ec4899" distance={10} intensity={2.0} />
        </group>
      )}

      {/* 3. CLINIC: Ripperdoc Operating Chair & Cyberware Glass Cases */}
      {type === 'CLINIC' && (
        <group position={[0, 0, 0]}>
          {/* Operating Recliner Chair */}
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[1.8, 0.8, 3.2]} />
            <meshStandardMaterial color="#164e63" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.4, -0.8]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.6, 0.8, 0.2]} />
            <meshStandardMaterial color="#083344" />
          </mesh>
          {/* Articulated Surgical Arm Overhead */}
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 1.8, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
          {/* Cyber-prosthetics Display Cases */}
          <mesh position={[-7, 1.4, -4]} castShadow>
            <boxGeometry args={[4, 2.8, 1.2]} />
            <meshStandardMaterial color="#0284c7" transparent opacity={0.6} roughness={0.1} />
          </mesh>
          <pointLight position={[0, 2.4, 0]} color="#06b6d4" distance={8} intensity={3.0} />
        </group>
      )}

      {/* 4. NETRUNNER_DEN: Towering Server Racks & Matrix Terminals */}
      {type === 'NETRUNNER_DEN' && (
        <group position={[0, 0, 0]}>
          {[-7, 7].map((xPos, idx) => (
            <group key={`racks-${idx}`} position={[xPos, 1.8, 0]}>
              <mesh castShadow>
                <boxGeometry args={[2.2, 3.6, 12]} />
                <meshStandardMaterial color="#052e16" roughness={0.4} metalness={0.8} />
              </mesh>
              {/* Blinking Server LED Lines */}
              <mesh position={[xPos > 0 ? -1.12 : 1.12, 0, 0]}>
                <boxGeometry args={[0.04, 3.2, 11]} />
                <meshBasicMaterial color="#10b981" />
              </mesh>
            </group>
          ))}
          {/* Central Terminal Console */}
          <mesh position={[0, 0.9, -4]} castShadow>
            <boxGeometry args={[3.8, 1.8, 2.4]} />
            <meshStandardMaterial color="#022c22" />
          </mesh>
          <mesh ref={holoRef} position={[0, 2.4, -4]}>
            <cylinderGeometry args={[1.2, 1.2, 0.6, 6]} />
            <meshBasicMaterial color="#22c55e" wireframe />
          </mesh>
        </group>
      )}

      {/* 5. RAMEN_DINER: Wooden Counter & Steaming Broth Pots */}
      {type === 'RAMEN_DINER' && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.8, -3.5]} castShadow>
            <boxGeometry args={[12, 1.6, 2.2]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          {/* Stools */}
          {[-4, -2, 0, 2, 4].map((stX, sIdx) => (
            <mesh key={`stool-${sIdx}`} position={[stX, 0.45, -1.8]}>
              <cylinderGeometry args={[0.35, 0.35, 0.9, 8]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
          ))}
          {/* Japanese Neon Banner */}
          <mesh position={[0, 3.4, -3.5]}>
            <boxGeometry args={[10, 0.6, 0.1]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <pointLight position={[0, 2.5, -3.5]} color="#f59e0b" distance={8} intensity={2.0} />
        </group>
      )}

      {/* 6. DRONE_HANGAR: Hydraulic Repair Dock & Industrial Gantry */}
      {type === 'DRONE_HANGAR' && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.3, 0]} receiveShadow>
            <cylinderGeometry args={[4.2, 4.4, 0.6, 12]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.9} />
          </mesh>
          {/* Quadcopter Drone on Dock */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[2.4, 0.5, 2.4]} />
            <meshStandardMaterial color="#ea580c" metalness={0.8} />
          </mesh>
          {/* Drone Rotors */}
          {[-1.2, 1.2].map((rx) =>
            [-1.2, 1.2].map((rz) => (
              <mesh key={`rotor-${rx}-${rz}`} position={[rx, 1.6, rz]}>
                <cylinderGeometry args={[0.7, 0.7, 0.04, 8]} />
                <meshBasicMaterial color="#38bdf8" wireframe />
              </mesh>
            ))
          )}
          <pointLight position={[0, 3.5, 0]} color="#f97316" distance={12} intensity={2.5} />
        </group>
      )}

      {/* 7. PENTHOUSE: Skyline Panoramic Glass & Luxury Lounge */}
      {type === 'PENTHOUSE' && (
        <group position={[0, 0, 0]}>
          {/* North Wall: Floor-to-Ceiling Glass Window */}
          <mesh position={[0, 2.25, -8.9]}>
            <planeGeometry args={[21.8, 4.4]} />
            <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Luxury Sectional Couch */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[6.5, 0.9, 2.8]} />
            <meshStandardMaterial color="#1c1917" roughness={0.4} />
          </mesh>
          {/* Glass Coffee Table */}
          <mesh position={[0, 0.35, -2.5]}>
            <boxGeometry args={[3.5, 0.6, 1.8]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} roughness={0.1} />
          </mesh>
          <pointLight position={[0, 3.0, 0]} color="#60a5fa" distance={10} intensity={2.0} />
        </group>
      )}

      {/* 8. SERVER_VAULT: Optical Hex Data Core & Security Lasers */}
      {type === 'SERVER_VAULT' && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 1.8, -3]} castShadow>
            <cylinderGeometry args={[2.2, 2.2, 3.6, 6]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh ref={holoRef} position={[0, 1.8, -3]}>
            <cylinderGeometry args={[2.4, 2.4, 3.8, 6]} />
            <meshBasicMaterial color="#3b82f6" wireframe />
          </mesh>
          {/* Horizontal Red Security Laser Lines */}
          <mesh position={[0, 1.2, 1]}>
            <boxGeometry args={[18, 0.04, 0.04]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 2.4, 1]}>
            <boxGeometry args={[18, 0.04, 0.04]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <pointLight position={[0, 2.5, -3]} color="#3b82f6" distance={12} intensity={3.0} />
        </group>
      )}

      {/* 9. GREENHOUSE: Hydroponic Vertical Flora Racks */}
      {type === 'GREENHOUSE' && (
        <group position={[0, 0, 0]}>
          {[-6, 6].map((gx, idx) => (
            <group key={`green-${idx}`} position={[gx, 1.8, 0]}>
              <mesh castShadow>
                <boxGeometry args={[3.5, 3.6, 12]} />
                <meshStandardMaterial color="#064e3b" roughness={0.7} />
              </mesh>
              {/* Violet Plant Grow Light */}
              <mesh position={[gx > 0 ? -1.8 : 1.8, 1.6, 0]}>
                <boxGeometry args={[0.1, 0.2, 11]} />
                <meshBasicMaterial color="#c084fc" />
              </mesh>
            </group>
          ))}
          <pointLight position={[0, 3.0, 0]} color="#4ade80" distance={10} intensity={2.5} />
        </group>
      )}

      {/* 10. METRO_STATION: Underground Train Platform & Maglev Tracks */}
      {type === 'METRO_STATION' && (
        <group position={[0, 0, 0]}>
          {/* Recessed Track Pit on North side */}
          <mesh position={[0, -0.6, -6]} receiveShadow>
            <boxGeometry args={[22, 1.2, 5]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>
          {/* Twin Electrified Steel Rails */}
          <mesh position={[0, 0.05, -7]}>
            <boxGeometry args={[22, 0.1, 0.15]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.05, -5]}>
            <boxGeometry args={[22, 0.1, 0.15]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>
          {/* Yellow Safety Platform Warning Strip */}
          <mesh position={[0, 0.02, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[22, 0.4]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          {/* Timetable Electronic Screen */}
          <mesh position={[0, 3.2, 0]}>
            <boxGeometry args={[5, 1.5, 0.3]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
          <pointLight position={[0, 3.0, 0]} color="#facc15" distance={12} intensity={2.2} />
        </group>
      )}

      {/* 11. ARCADE: Neon Game Cabinets & Dance Stage */}
      {type === 'ARCADE' && (
        <group position={[0, 0, 0]}>
          {/* Left Wall of Arcade Cabinets */}
          {[-6, -4, -2, 0, 2, 4, 6].map((ax, aIdx) => (
            <group key={`arc-l-${aIdx}`} position={[ax, 1.2, -6]}>
              <mesh castShadow>
                <boxGeometry args={[1.5, 2.4, 1.6]} />
                <meshStandardMaterial color="#3b0764" metalness={0.6} />
              </mesh>
              {/* Glowing Pixel CRT Screen */}
              <mesh position={[0, 0.3, 0.82]}>
                <planeGeometry args={[1.2, 0.9]} />
                <meshBasicMaterial color={aIdx % 2 === 0 ? '#00f0ff' : '#ec4899'} />
              </mesh>
            </group>
          ))}
          {/* Dance Revolution Stage with Flashing Tiles */}
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.5, 0.5, 4.5]} />
            <meshStandardMaterial color="#1e1b4b" />
          </mesh>
          <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4.2, 4.2]} />
            <meshBasicMaterial color="#d946ef" wireframe />
          </mesh>
          <pointLight position={[0, 2.5, 0]} color="#d946ef" distance={10} intensity={3.0} />
        </group>
      )}
    </group>
  );
};
