import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem, VehicleState } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TransitScheduleSystem } from './TransitScheduleSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioManager } from '../audio/AudioManager';

interface RideableTransitLayerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

const REPAIR_BAYS = [
  { id: 'repair-central', name: 'Central Maintenance Bay', position: new THREE.Vector3(9, 0.4, 10) },
  { id: 'repair-west', name: 'West Avenue Service Bay', position: new THREE.Vector3(-34, 0.4, -8) },
];

const THRUSTER_POD_OFFSETS: [number, number, number][] = [
  [-1.02, -0.06, 1.25],
  [1.02, -0.06, 1.25],
  [-1.04, -0.06, -1.25],
  [1.04, -0.06, -1.25],
];

export const RideableTransitLayer: React.FC<RideableTransitLayerProps> = () => {
  const [vehicleState, setVehicleState] = useState<VehicleState>(() => VehicleInteractionSystem.getInstance().getState());
  const vehicleRef = useRef<THREE.Group>(null);
  const shuttleRef = useRef<THREE.Group>(null);
  const beaconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const stopIdxRef = useRef(0);
  const dwellRef = useRef(0);

  const system = VehicleInteractionSystem.getInstance();
  const initialHoverPos = useMemo(() => system.getVehiclePosition(), [system]);
  const initialTransitPos = useMemo(() => new THREE.Vector3(-7, 0.2, 10), []);

  useEffect(() => {
    system.registerRideable('nexus-hover-01', 'Solaris Hover-Coupe', initialHoverPos, 'vehicle');
    system.registerRideable('central-transit-node', 'Autonomous Mag-Shuttle', initialTransitPos, 'transit');

    const interactions = InteractionSystem.getInstance();
    REPAIR_BAYS.forEach((bay) => {
      interactions.register({
        id: bay.id,
        name: bay.name,
        actionText: `CALIBRATE CHASSIS // ${bay.name.toUpperCase()}`,
        position: bay.position,
        radius: 3.5,
        onInteract: () => {
          AudioManager.getInstance().playRepairComplete();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('nexus:notification', {
                detail: {
                  title: 'CHASSIS CALIBRATION COMPLETE',
                  message: `${bay.name}: magnetic suspension and turbine alignment restored.`,
                  type: 'system',
                  duration: 2500,
                },
              })
            );
          }
        },
      });
    });

    return () => {
      system.unregisterRideable('nexus-hover-01');
      system.unregisterRideable('central-transit-node');
      REPAIR_BAYS.forEach((bay) => interactions.unregister(bay.id));
    };
  }, [system, initialHoverPos, initialTransitPos]);

  useEffect(() => system.subscribe(setVehicleState), [system]);

  useFrame(({ clock }, delta) => {
    const live = system.getState();
    const t = clock.getElapsedTime();

    if (vehicleRef.current) {
      vehicleRef.current.position.copy(system.getVehiclePosition());
      vehicleRef.current.rotation.y = live.vehicleRotationY;
      vehicleRef.current.position.y += Math.sin(performance.now() * 0.0025) * 0.03;
    }

    beaconRefs.current.forEach((b, idx) => {
      if (b) {
        b.rotation.y = t * 1.6 + idx;
        b.position.y = 2.65 + Math.sin(t * 2.2 + idx) * 0.08;
      }
    });

    if (shuttleRef.current) {
      const stops = TransitScheduleSystem.getInstance().getStops();
      const next = stops[(stopIdxRef.current + 1) % stops.length];
      const target = new THREE.Vector3(...next.position);
      const dist = Math.hypot(target.x - shuttleRef.current.position.x, target.z - shuttleRef.current.position.z);
      const dt = Math.min(delta, 0.1);

      if (dwellRef.current > 0) {
        dwellRef.current -= dt;
      } else if (dist < 1.2) {
        dwellRef.current = next.dwellSeconds;
        stopIdxRef.current = (stopIdxRef.current + 1) % stops.length;
        AudioManager.getInstance().playTransitArrival();
      } else {
        shuttleRef.current.position.lerp(target, Math.min(1, (8.5 * dt) / dist));
      }

      shuttleRef.current.position.y = 0.62 + Math.sin(performance.now() * 0.002) * 0.025;
      shuttleRef.current.rotation.y = Math.atan2(
        target.x - shuttleRef.current.position.x,
        target.z - shuttleRef.current.position.z
      );
      system.syncTransitPosition(shuttleRef.current.position, shuttleRef.current.rotation.y);
      if (live.mode !== 'TRANSIT_LINKED') {
        system.syncRideablePosition('central-transit-node', initialTransitPos);
      }
    }
  });

  const neon = vehicleState.upgrades.neon > 0;
  const accent = neon ? '#f59e0b' : '#38bdf8';
  const shadows = QualityManager.current.shadows;
  const stops = TransitScheduleSystem.getInstance().getStops();

  return (
    <group name="RideableTransitAndServiceLayer">
      {/* 1. Player Rideable Solaris Hover-Coupe (Multi-Part Composite Aerodynamic Chassis) */}
      <group ref={vehicleRef} position={initialHoverPos}>
        {/* Primary Lower Monocoque Body */}
        <mesh castShadow={shadows}>
          <boxGeometry args={[1.82, 0.44, 3.65]} />
          <meshStandardMaterial
            color="#0b0f19"
            metalness={0.94}
            roughness={0.15}
            emissive={accent}
            emissiveIntensity={neon ? 0.38 : 0.1}
          />
        </mesh>

        {/* Sculpted Upper Hood & Side Vent Intake Shoulders */}
        <mesh position={[0, 0.18, 0.65]} castShadow={shadows}>
          <boxGeometry args={[1.56, 0.18, 1.85]} />
          <meshStandardMaterial color="#111827" metalness={0.92} roughness={0.18} />
        </mesh>
        {/* Front Carbon Aero Splitter Chin */}
        <mesh position={[0, -0.18, 1.88]}>
          <boxGeometry args={[1.88, 0.08, 0.28]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
        </mesh>

        {/* Panoramic Gullwing Glass Canopy & Interior Cockpit */}
        <mesh position={[0, 0.39, -0.12]}>
          <boxGeometry args={[1.38, 0.35, 1.82]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.78} metalness={0.94} roughness={0.08} />
        </mesh>
        {/* Interior Illuminated HUD Dashboard & Bucket Seats */}
        <mesh position={[0, 0.32, 0.48]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[1.1, 0.14, 0.04]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        {([-0.34, 0.34] as const).map((sx, sIdx) => (
          <mesh key={sIdx} position={[sx, 0.3, -0.25]}>
            <boxGeometry args={[0.38, 0.32, 0.42]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
          </mesh>
        ))}

        {/* 4 Outboard Articulated Mag-Lev Thruster Nacelles with Glowing Turbine Rings */}
        {THRUSTER_POD_OFFSETS.map(([tx, ty, tz], idx) => (
          <group key={`pod-${idx}`} position={[tx, ty, tz]}>
            {/* Strut Arm */}
            <mesh position={[tx > 0 ? -0.12 : 0.12, 0.04, 0]}>
              <boxGeometry args={[0.24, 0.09, 0.32]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
            </mesh>
            {/* Outer Turbine Shroud */}
            <mesh castShadow={shadows}>
              <cylinderGeometry args={[0.28, 0.32, 0.24, 14]} />
              <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
            </mesh>
            {/* Glowing Downward Plasma Ring */}
            <mesh position={[0, -0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.14, 0.26, 14]} />
              <meshBasicMaterial color={accent} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* Rear Active Aero Wing & Dual Plasma Exhaust Diffuser */}
        <group position={[0, 0.42, -1.68]}>
          <mesh position={[-0.58, -0.12, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.26]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.58, -0.12, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.26]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh castShadow={shadows}>
            <boxGeometry args={[1.76, 0.06, 0.36]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.94} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.035, -0.14]}>
            <boxGeometry args={[1.72, 0.02, 0.04]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        </group>

        {/* Dual Rear Jet Exhaust Cones */}
        {([-0.42, 0.42] as const).map((ex, eIdx) => (
          <group key={eIdx} position={[ex, -0.04, -1.85]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.14, 0.14, 10]} />
              <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.09, 0]}>
              <coneGeometry args={[0.09, 0.22, 10]} />
              <meshBasicMaterial color={accent} transparent opacity={0.85} />
            </mesh>
          </group>
        ))}

        {/* Full-Width Laser Headlamp Matrix & Rear Taillight Blade */}
        <mesh position={[0, 0.06, 1.84]}>
          <boxGeometry args={[1.62, 0.085, 0.04]} />
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
        <mesh position={[0, 0.08, -1.84]}>
          <boxGeometry args={[1.66, 0.09, 0.04]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>

        {/* Ground Underglow Projection */}
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 4.2]} />
          <meshBasicMaterial color={accent} transparent opacity={neon ? 0.38 : 0.18} depthWrite={false} />
        </mesh>
      </group>

      {/* 2. Transit Stops with Cantilevered Canopy & Rotating Holographic Route Beacons */}
      {stops.map((stop, idx) => (
        <group key={stop.id} position={stop.position}>
          {/* Platform Base Pad */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[1.25, 1.35, 0.08, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.08, 1.2, 16]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Main Pylon Mast */}
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.14, 0.22, 2.4, 10]} />
            <meshStandardMaterial color="#111827" metalness={0.88} roughness={0.2} />
          </mesh>
          {/* Halo Ring */}
          <mesh position={[0, 2.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.03, 8, 24]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Rotating Holographic Crystal */}
          <mesh
            ref={(el) => {
              beaconRefs.current[idx] = el;
            }}
            position={[0, 2.65, 0]}
          >
            <octahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        </group>
      ))}

      {/* 3. Autonomous Multi-Window Mag-Shuttle */}
      <group ref={shuttleRef} position={[-7, 0.62, 10]}>
        {/* Lower Mag-Lev Chassis */}
        <mesh castShadow={shadows}>
          <boxGeometry args={[2.16, 0.68, 5.1]} />
          <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.2} emissive="#38bdf8" emissiveIntensity={0.2} />
        </mesh>
        {/* Panoramic Passenger Cabin Glazing */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.88, 0.42, 3.6]} />
          <meshStandardMaterial color="#1e293b" transparent opacity={0.82} metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Warm Interior Cabin Illumination Core */}
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[1.55, 0.26, 3.2]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.35} />
        </mesh>
        {/* Rooftop Cryo-HVAC Unit & Telemetry Fin */}
        <mesh position={[0, 0.78, -0.4]}>
          <boxGeometry args={[1.2, 0.18, 1.8]} />
          <meshStandardMaterial color="#0b1120" metalness={0.9} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.88, 0.9]}>
          <boxGeometry args={[0.08, 0.24, 0.55]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Side Boarding Door Frames */}
        {([-1.09, 1.09] as const).map((dx, dIdx) => (
          <mesh key={dIdx} position={[dx, 0.12, 0]}>
            <boxGeometry args={[0.03, 0.75, 1.25]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        ))}
        {/* Front & Rear Light Matrices */}
        <mesh position={[0, 0.05, 2.56]}>
          <boxGeometry args={[1.85, 0.12, 0.04]} />
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
        <mesh position={[0, 0.05, -2.56]}>
          <boxGeometry args={[1.85, 0.12, 0.04]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
        {/* Underbody Mag-Lev Skids */}
        {([-0.78, 0.78] as const).map((sx, sIdx) => (
          <mesh key={sIdx} position={[sx, -0.36, 0]}>
            <boxGeometry args={[0.26, 0.08, 4.4]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        ))}
      </group>

      {/* 4. Robotic Chassis Calibration & Maintenance Bays */}
      {REPAIR_BAYS.map((bay) => (
        <group key={bay.id} position={bay.position}>
          {/* Diagnostic Deck Platform */}
          <mesh receiveShadow>
            <boxGeometry args={[2.8, 0.45, 1.9]} />
            <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[2.2, 0.05, 1.3]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Twin Diagnostic Gantry Arch */}
          <mesh position={[-1.25, 1.15, 0]}>
            <boxGeometry args={[0.18, 1.9, 0.28]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[1.25, 1.15, 0]}>
            <boxGeometry args={[0.18, 1.9, 0.28]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <boxGeometry args={[2.68, 0.16, 0.32]} />
            <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.18} />
          </mesh>
          <mesh position={[0, 1.94, 0]}>
            <boxGeometry args={[2.1, 0.04, 0.14]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
