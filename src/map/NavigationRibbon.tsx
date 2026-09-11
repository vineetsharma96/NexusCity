import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NavigationSystem, NavigationState } from './NavigationSystem';

export const NavigationRibbon: React.FC = () => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );

  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const beaconRingRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  // Procedural chevron flow texture
  const chevronTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Transparent base
    ctx.clearRect(0, 0, 128, 256);

    // Glowing cyan chevron arrow
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // Draw 3 repeating chevrons
    for (let y = 30; y < 256; y += 80) {
      ctx.beginPath();
      ctx.moveTo(24, y + 25);
      ctx.lineTo(64, y);
      ctx.lineTo(104, y + 25);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    textureRef.current = tex;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (textureRef.current) {
      // Flow texture along the path
      textureRef.current.offset.y -= delta * 1.5;
    }
    if (beaconRingRef.current) {
      beaconRingRef.current.rotation.z += delta * 1.8;
      const s = 1.0 + Math.sin(performance.now() * 0.006) * 0.15;
      beaconRingRef.current.scale.set(s, s, s);
    }
  });

  // Build interconnected ribbon segment geometry
  const ribbonSegments = useMemo(() => {
    const points = navState.routeWaypoints;
    if (!navState.activeLandmark || points.length < 2) return [];

    const segments: { position: THREE.Vector3; rotationY: number; length: number }[] = [];
    const width = 0.9;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = p1.distanceTo(p2);
      if (dist < 0.2) continue;

      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);

      segments.push({
        position: new THREE.Vector3(mid.x, 0.08, mid.z),
        rotationY: angle,
        length: dist,
      });
    }

    return segments;
  }, [navState.routeWaypoints, navState.activeLandmark]);

  if (!navState.activeLandmark || ribbonSegments.length === 0) return null;

  const targetPos = navState.activeLandmark.position;

  return (
    <group name="NavigationRibbonLayer">
      {/* 1. Animated Glowing Ribbon Segments */}
      {ribbonSegments.map((seg, idx) => (
        <mesh
          key={`ribbon-${idx}`}
          position={seg.position}
          rotation={[-Math.PI / 2, 0, -seg.rotationY]}
        >
          <planeGeometry args={[0.9, seg.length]} />
          <meshBasicMaterial
            map={chevronTexture}
            color="#00f0ff"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* 2. Destination Arrival Beacon on Target Landmark */}
      <group position={[targetPos.x, 0.1, targetPos.z]}>
        {/* Pulsating ground ring */}
        <mesh ref={beaconRingRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 2.4, 32]} />
          <meshBasicMaterial color="#ffaa00" side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
        {/* Inner glow disc */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.8, 32]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.2} />
        </mesh>
        {/* Vertical Holographic Light Column */}
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 16, 8]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.65} />
        </mesh>
      </group>
    </group>
  );
};
