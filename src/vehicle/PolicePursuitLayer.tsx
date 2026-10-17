import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AudioManager } from '../audio/AudioManager';

interface Props { playerPosRef: React.MutableRefObject<THREE.Vector3>; }

export const PolicePursuitLayer: React.FC<Props> = ({ playerPosRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const velocity = useMemo(() => new THREE.Vector3(), []);
  const alertedAt = useRef(0);
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const player = playerPosRef.current;
    const distance = group.position.distanceTo(player);
    const pursuing = distance < 18;
    const now = performance.now();
    if (pursuing) {
      velocity.copy(player).sub(group.position).setY(0).normalize().multiplyScalar(Math.min(Math.max(0, distance - 3), 7 * Math.min(delta, 0.1)));
      group.position.add(velocity);
      group.lookAt(player.x, group.position.y, player.z);
      if (now - alertedAt.current > 5000) {
        alertedAt.current = now;
        AudioManager.getInstance().playPoliceAlert();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title: 'POLICE PURSUIT', message: 'Patrol unit has acquired your position.', type: 'warning', duration: 2600 } }));
      }
    } else {
      group.position.x = THREE.MathUtils.lerp(group.position.x, -18, delta * 0.15);
      group.position.z = THREE.MathUtils.lerp(group.position.z, 18, delta * 0.15);
    }
    group.children.forEach((child, index) => { if (child instanceof THREE.Mesh && index > 0) child.visible = pursuing && (Math.floor(now / 180) % 2 === index - 1); });
  });
  return <group ref={groupRef} name="PolicePursuitLayer" position={[-18, 0.7, 18]}>
    <mesh><boxGeometry args={[1.7, 0.5, 3.2]} /><meshStandardMaterial color="#172554" metalness={0.8} roughness={0.25} /></mesh>
    <mesh position={[-0.2, 0.38, 0]}><boxGeometry args={[0.35, 0.12, 0.3]} /><meshBasicMaterial color="#ef4444" toneMapped={false} /></mesh>
    <mesh position={[0.2, 0.38, 0]}><boxGeometry args={[0.35, 0.12, 0.3]} /><meshBasicMaterial color="#2563eb" toneMapped={false} /></mesh>
  </group>;
};
