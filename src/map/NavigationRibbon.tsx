import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NavigationState, NavigationSystem } from './NavigationSystem';

export const NavigationRibbon: React.FC = () => {
  const [navState, setNavState] = useState<NavigationState>(() => NavigationSystem.getInstance().getState());
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const beaconRingRef = useRef<THREE.Mesh>(null);

  useEffect(() => NavigationSystem.getInstance().subscribe(setNavState), []);

  const chevronTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let y = 32; y < 256; y += 80) {
      ctx.beginPath();
      ctx.moveTo(28, y + 24);
      ctx.lineTo(64, y);
      ctx.lineTo(100, y + 24);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    textureRef.current = tex;
    return tex;
  }, []);

  useEffect(() => () => chevronTexture.dispose(), [chevronTexture]);

  useFrame((_, delta) => {
    if (textureRef.current) {
      textureRef.current.offset.y -= delta * 1.6;
    }
    if (beaconRingRef.current) {
      beaconRingRef.current.rotation.z += delta * 1.5;
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.12;
      beaconRingRef.current.scale.setScalar(pulse);
    }
  });

  const segments = useMemo(() => {
    const pts = navState.routeWaypoints;
    if (!navState.activeLandmark || pts.length < 2) return [];
    const list: { position: THREE.Vector3; rotationY: number; length: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const len = p1.distanceTo(p2);
      if (len < 0.2) continue;
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      list.push({
        position: new THREE.Vector3(mid.x, 0.08, mid.z),
        rotationY: Math.atan2(p2.x - p1.x, p2.z - p1.z),
        length: len,
      });
    }
    return list;
  }, [navState.routeWaypoints, navState.activeLandmark]);

  if (!navState.activeLandmark || segments.length === 0) return null;
  const targetPos = navState.activeLandmark.position;

  return (
    <group name="NavigationRibbonLayer">
      {segments.map((seg, idx) => (
        <mesh key={idx} position={seg.position} rotation={[-Math.PI / 2, 0, -seg.rotationY]}>
          <planeGeometry args={[0.85, seg.length]} />
          <meshBasicMaterial map={chevronTexture} color="#f59e0b" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group position={[targetPos.x, 0.1, targetPos.z]}>
        <mesh ref={beaconRingRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.9, 2.3, 32]} />
          <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 7, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 14, 8]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
};
