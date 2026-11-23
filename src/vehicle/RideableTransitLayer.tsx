import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VehicleInteractionSystem } from './VehicleInteractionSystem';
import { QualityManager } from '../rendering/QualityManager';
import { TransitScheduleSystem } from './TransitScheduleSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioManager } from '../audio/AudioManager';
import { ExperimentalCar } from './ExperimentalCar';
import { SolarisExperimentalCar } from './SolarisExperimentalCar';
import {
  createSmoothBeveledBoxGeometry,
  createSmoothHoverCoupeGeometry,
  createSmoothMagShuttleGeometry,
} from '../rendering/SmoothWorldGeometries';

interface RideableTransitLayerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

const REPAIR_BAYS = [
  { id: 'repair-central', name: 'Central Maintenance Bay', position: new THREE.Vector3(14.4, 0.22, 22) },
  { id: 'repair-west', name: 'West Avenue Service Bay', position: new THREE.Vector3(-34, 0.22, -14.4) },
  { id: 'repair-north', name: 'North Crossing Service Bay', position: new THREE.Vector3(14.4, 0.22, -92) },
  { id: 'repair-neural', name: 'Neural Sector Calibration Dock', position: new THREE.Vector3(-148, 0.22, -152) },
  { id: 'repair-foundry', name: 'Foundry Heavy Overhaul Bay', position: new THREE.Vector3(-148, 0.22, 152) },
  { id: 'repair-arboretum', name: 'Arboretum Mag-Service Pad', position: new THREE.Vector3(148, 0.22, 152) },
];

const RIDEABLE_FLEET: {
  id: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  bodyColor: string;
  accentColor: string;
}[] = [
  {
    id: 'nexus-hover-01',
    label: 'Solaris Hover-Coupe',
    position: [13.6, 0.48, 16],
    rotationY: 0,
    bodyColor: '#0b0f19',
    accentColor: '#38bdf8',
  },
  {
    id: 'nexus-hover-02',
    label: 'Apex Executive Speeder',
    position: [26, 0.48, -14],
    rotationY: -Math.PI / 2,
    bodyColor: '#111827',
    accentColor: '#f59e0b',
  },
  {
    id: 'nexus-hover-03',
    label: 'North Crossing Interceptor',
    position: [-13.6, 0.48, -88],
    rotationY: 0,
    bodyColor: '#0f172a',
    accentColor: '#38bdf8',
  },
  {
    id: 'nexus-hover-04',
    label: 'Sanctuary Eco-Skiff',
    position: [42, 0.48, 68],
    rotationY: Math.PI / 2,
    bodyColor: '#064e3b',
    accentColor: '#10b981',
  },
  {
    id: 'nexus-hover-05',
    label: 'Neural Quantum Cruiser',
    position: [-148, 0.48, -148],
    rotationY: Math.PI / 4,
    bodyColor: '#172554',
    accentColor: '#38bdf8',
  },
  {
    id: 'nexus-hover-06',
    label: 'Aerostrata High-Wing Coupe',
    position: [148, 0.48, -148],
    rotationY: -Math.PI / 4,
    bodyColor: '#0f172a',
    accentColor: '#7dd3fc',
  },
  {
    id: 'nexus-hover-07',
    label: 'Arboretum Bio-Glider',
    position: [148, 0.48, 148],
    rotationY: (-3 * Math.PI) / 4,
    bodyColor: '#052e16',
    accentColor: '#10b981',
  },
  {
    id: 'nexus-hover-08',
    label: 'Foundry Heavy Vector',
    position: [-148, 0.48, 148],
    rotationY: (3 * Math.PI) / 4,
    bodyColor: '#1e1b4b',
    accentColor: '#f59e0b',
  },
];

const THRUSTER_POD_OFFSETS: [number, number, number][] = [
  [-1.02, -0.06, 1.25],
  [1.02, -0.06, 1.25],
  [-1.04, -0.06, -1.25],
  [1.04, -0.06, -1.25],
];

const SHARED_HOVER_COUPE = createSmoothHoverCoupeGeometry();
const SHARED_MAG_SHUTTLE = createSmoothMagShuttleGeometry();
const SHARED_BEVEL_UNIT = createSmoothBeveledBoxGeometry(0.075, 2);

export const RideableTransitLayer: React.FC<RideableTransitLayerProps> = () => {
  const [neonUpgraded, setNeonUpgraded] = useState<boolean>(
    () => VehicleInteractionSystem.getInstance().getState().upgrades.neon > 0
  );
  const fleetRefs = useRef<(THREE.Group | null)[]>([]);
  const shuttleRef = useRef<THREE.Group>(null);
  const beaconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const stopIdxRef = useRef(0);
  const dwellRef = useRef(0);

  const system = VehicleInteractionSystem.getInstance();
  const initialTransitPos = useMemo(() => new THREE.Vector3(-13.8, 0.2, 22), []);
  const shuttleTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    RIDEABLE_FLEET.forEach((v, idx) => {
      const grp = fleetRefs.current[idx];
      if (grp) {
        grp.position.set(...v.position);
        grp.rotation.set(0, v.rotationY, 0);
      }
      system.registerRideable(
        v.id,
        v.label,
        new THREE.Vector3(...v.position),
        'vehicle',
        v.rotationY
      );
    });
    if (shuttleRef.current) {
      shuttleRef.current.position.set(-13.8, 0.62, 22);
    }
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
      RIDEABLE_FLEET.forEach((v) => system.unregisterRideable(v.id));
      system.unregisterRideable('central-transit-node');
      REPAIR_BAYS.forEach((bay) => interactions.unregister(bay.id));
    };
  }, [system, initialTransitPos]);

  useEffect(() => {
    let prevNeon = system.getState().upgrades.neon > 0;
    return system.subscribe((next) => {
      const nextNeon = next.upgrades.neon > 0;
      if (nextNeon !== prevNeon) {
        prevNeon = nextNeon;
        setNeonUpgraded(nextNeon);
      }
    });
  }, [system]);

  useFrame(({ clock, camera }, delta) => {
    const live = system.getState();
    const t = clock.getElapsedTime();
    const camX = camera.position.x;
    const camZ = camera.position.z;

    fleetRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      const def = RIDEABLE_FLEET[idx];
      if (!def) return;
      const pos = system.getRideablePosition(def.id);
      const dx = camX - pos.x;
      const dz = camZ - pos.z;
      const distSq = dx * dx + dz * dz;
      const isMounted = live.mode === 'RIDING' && live.activeId === def.id;
      if (!isMounted && distSq > 260 * 260) {
        grp.visible = false;
        return;
      }
      grp.visible = true;
      const rotY = system.getRideableRotationY(def.id);
      grp.position.copy(pos);
      grp.rotation.y = rotY;
      grp.position.y += Math.sin(t * 2.5 + idx) * 0.03;
    });

    beaconRefs.current.forEach((b, idx) => {
      if (b) {
        b.rotation.y = t * 1.6 + idx;
        b.position.y = 2.65 + Math.sin(t * 2.2 + idx) * 0.08;
      }
    });

    if (shuttleRef.current) {
      const stops = TransitScheduleSystem.getInstance().getStops();
      const next = stops[(stopIdxRef.current + 1) % stops.length];
      const target = shuttleTargetRef.current.set(next.position[0], next.position[1], next.position[2]);
      const dist = Math.hypot(target.x - shuttleRef.current.position.x, target.z - shuttleRef.current.position.z);
      const dt = Math.min(delta, 0.1);

      if (dwellRef.current > 0) {
        dwellRef.current -= dt;
      } else if (dist < 1.2) {
        dwellRef.current = next.dwellSeconds;
        stopIdxRef.current = (stopIdxRef.current + 1) % stops.length;
        AudioManager.getInstance().playTransitArrival();
      } else {
        shuttleRef.current.position.lerp(target, Math.min(1, (16.5 * dt) / dist));
      }

      shuttleRef.current.position.y = 0.62 + Math.sin(t * 2.0) * 0.025;
      shuttleRef.current.rotation.y = Math.atan2(
        target.x - shuttleRef.current.position.x,
        target.z - shuttleRef.current.position.z
      );
      system.syncTransitPosition(shuttleRef.current.position, shuttleRef.current.rotation.y);
      if (live.mode !== 'TRANSIT_LINKED') {
        system.syncRideablePosition('central-transit-node', shuttleRef.current.position);
      }
    }
  }, -1);

  const neon = neonUpgraded;
  const shadows = QualityManager.current.shadows;
  const stops = TransitScheduleSystem.getInstance().getStops();

  return (
    <group name="RideableTransitAndServiceLayer">
      {/* 0. Controllable 4-Wheel Experimental Prototypes (VX-01 Apex & AX-09 Solaris) */}
      <ExperimentalCar />
      <SolarisExperimentalCar />

      {/* 1. City-Wide Fleet of Player Rideable Hover-Coupes (Sculpted Compound-Curved Aero Hull) */}
      {RIDEABLE_FLEET.map((vDef, vIdx) => {
        const accent = neon ? '#f59e0b' : vDef.accentColor;
        return (
          <group
            key={vDef.id}
            ref={(el) => {
              fleetRefs.current[vIdx] = el;
            }}
          >
            {/* Primary Sculpted Compound-Curved Monocoque Body */}
            <mesh geometry={SHARED_HOVER_COUPE.hullGeo} castShadow={shadows}>
              <meshPhysicalMaterial
                color={vDef.bodyColor}
                metalness={0.86}
                roughness={0.18}
                clearcoat={0.85}
                clearcoatRoughness={0.12}
                emissive={accent}
                emissiveIntensity={neon ? 0.36 : 0.1}
              />
            </mesh>

            {/* Front Carbon Aero Splitter Chin */}
            <mesh geometry={SHARED_BEVEL_UNIT} position={[0, -0.17, 1.82]} scale={[1.76, 0.075, 0.28]}>
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
            </mesh>

            {/* Smooth Sculpted Panoramic Bubble Canopy */}
            <mesh geometry={SHARED_HOVER_COUPE.canopyGeo}>
              <meshPhysicalMaterial
                color="#0f172a"
                transparent
                opacity={0.78}
                metalness={0.92}
                roughness={0.08}
                clearcoat={1.0}
                clearcoatRoughness={0.05}
              />
            </mesh>
            {/* Interior Illuminated HUD Dashboard */}
            <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.28, 0.44]} rotation={[-0.35, 0, 0]} scale={[0.98, 0.12, 0.04]}>
              <meshBasicMaterial color={accent} />
            </mesh>

            {/* 4 Outboard Articulated Mag-Lev Thruster Nacelles with Glowing Turbine Rings */}
            {THRUSTER_POD_OFFSETS.map(([tx, ty, tz], idx) => (
              <group key={`pod-${idx}`} position={[tx, ty, tz]}>
                {/* Smooth Strut Arm */}
                <mesh geometry={SHARED_BEVEL_UNIT} position={[tx > 0 ? -0.12 : 0.12, 0.04, 0]} scale={[0.26, 0.09, 0.34]}>
                  <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.22} />
                </mesh>
                {/* Outer Turbine Shroud */}
                <mesh castShadow={shadows}>
                  <cylinderGeometry args={[0.28, 0.32, 0.24, 18]} />
                  <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
                </mesh>
                {/* Glowing Downward Plasma Ring */}
                <mesh position={[0, -0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.14, 0.26, 18]} />
                  <meshBasicMaterial color={accent} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}

            {/* Rear Active Aero Wing & Dual Plasma Exhaust Diffuser */}
            <group position={[0, 0.42, -1.66]}>
              <mesh geometry={SHARED_BEVEL_UNIT} position={[-0.58, -0.12, 0]} scale={[0.08, 0.24, 0.26]}>
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh geometry={SHARED_BEVEL_UNIT} position={[0.58, -0.12, 0]} scale={[0.08, 0.24, 0.26]}>
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh geometry={SHARED_BEVEL_UNIT} scale={[1.72, 0.06, 0.34]} castShadow={shadows}>
                <meshStandardMaterial color="#0b0f19" metalness={0.94} roughness={0.15} />
              </mesh>
              <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.035, -0.14]} scale={[1.66, 0.022, 0.04]}>
                <meshBasicMaterial color={accent} />
              </mesh>
            </group>

            {/* Dual Rear Jet Exhaust Cones */}
            {([-0.42, 0.42] as const).map((ex, eIdx) => (
              <group key={eIdx} position={[ex, -0.04, -1.85]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.11, 0.14, 0.14, 14]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.09, 0]}>
                  <coneGeometry args={[0.09, 0.22, 14]} />
                  <meshBasicMaterial color={accent} transparent opacity={0.85} />
                </mesh>
              </group>
            ))}

            {/* Full-Width Laser Headlamp Matrix & Rear Taillight Blade */}
            <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.04, 1.82]} scale={[1.48, 0.075, 0.045]}>
              <meshBasicMaterial color="#fef3c7" />
            </mesh>
            <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.07, -1.82]} scale={[1.54, 0.08, 0.045]}>
              <meshBasicMaterial color="#f43f5e" />
            </mesh>

            {/* Ground Underglow Projection */}
            <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.4, 4.2]} />
              <meshBasicMaterial color={accent} transparent opacity={neon ? 0.38 : 0.18} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {/* 2. Transit Stops with Smooth Cylindrical Mast & Rotating Holographic Route Beacons */}
      {stops.map((stop, idx) => (
        <group key={stop.id} position={stop.position}>
          {/* Platform Base Pad */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[1.25, 1.35, 0.08, 20]} />
            <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.08, 1.2, 20]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Main Pylon Mast */}
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.14, 0.22, 2.4, 16]} />
            <meshStandardMaterial color="#111827" metalness={0.88} roughness={0.2} />
          </mesh>
          {/* Halo Ring */}
          <mesh position={[0, 2.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.03, 10, 28]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Rotating Holographic Crystal */}
          <mesh
            ref={(el) => {
              beaconRefs.current[idx] = el;
            }}
            position={[0, 2.65, 0]}
          >
            <icosahedronGeometry args={[0.25, 1]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        </group>
      ))}

      {/* 3. Autonomous Streamlined Bullet Mag-Shuttle */}
      <group ref={shuttleRef}>
        {/* Smooth Streamlined Lower Monocoque Hull */}
        <mesh geometry={SHARED_MAG_SHUTTLE.hullGeo} castShadow={shadows}>
          <meshPhysicalMaterial
            color="#0f172a"
            metalness={0.88}
            roughness={0.18}
            clearcoat={0.8}
            clearcoatRoughness={0.12}
            emissive="#38bdf8"
            emissiveIntensity={0.18}
          />
        </mesh>
        {/* Smooth Panoramic Passenger Cabin Glazing */}
        <mesh geometry={SHARED_MAG_SHUTTLE.cabinGeo}>
          <meshPhysicalMaterial
            color="#1e293b"
            transparent
            opacity={0.82}
            metalness={0.92}
            roughness={0.08}
            clearcoat={1.0}
          />
        </mesh>
        {/* Warm Interior Cabin Illumination Core */}
        <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.44, 0]} scale={[1.5, 0.24, 3.1]}>
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.35} />
        </mesh>
        {/* Rooftop Cryo-HVAC Unit & Telemetry Fin */}
        <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.78, -0.4]} scale={[1.18, 0.16, 1.75]}>
          <meshStandardMaterial color="#0b1120" metalness={0.9} roughness={0.22} />
        </mesh>
        <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.88, 0.9]} scale={[0.08, 0.24, 0.55]}>
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Side Boarding Door Accent Strips */}
        {([-1.06, 1.06] as const).map((dx, dIdx) => (
          <mesh key={dIdx} geometry={SHARED_BEVEL_UNIT} position={[dx, 0.12, 0]} scale={[0.035, 0.7, 1.2]}>
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        ))}
        {/* Front & Rear Light Matrices */}
        <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.04, 2.52]} scale={[1.7, 0.11, 0.05]}>
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
        <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.04, -2.52]} scale={[1.7, 0.11, 0.05]}>
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
        {/* Underbody Mag-Lev Skids */}
        {([-0.78, 0.78] as const).map((sx, sIdx) => (
          <mesh key={sIdx} geometry={SHARED_BEVEL_UNIT} position={[sx, -0.36, 0]} scale={[0.26, 0.08, 4.2]}>
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        ))}
      </group>

      {/* 4. Robotic Chassis Calibration & Maintenance Bays (Smooth Beveled Architecture) */}
      {REPAIR_BAYS.map((bay) => (
        <group key={bay.id} position={bay.position}>
          {/* Diagnostic Deck Platform */}
          <mesh geometry={SHARED_BEVEL_UNIT} scale={[2.8, 0.36, 1.9]} receiveShadow>
            <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 0.19, 0]} scale={[2.2, 0.045, 1.3]}>
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {/* Twin Diagnostic Gantry Arch */}
          <mesh geometry={SHARED_BEVEL_UNIT} position={[-1.25, 1.12, 0]} scale={[0.18, 1.9, 0.28]}>
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh geometry={SHARED_BEVEL_UNIT} position={[1.25, 1.12, 0]} scale={[0.18, 1.9, 0.28]}>
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 2.02, 0]} scale={[2.68, 0.16, 0.32]}>
            <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.18} />
          </mesh>
          <mesh geometry={SHARED_BEVEL_UNIT} position={[0, 1.91, 0]} scale={[2.1, 0.04, 0.14]}>
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
