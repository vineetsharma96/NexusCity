import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LivingCityEventState, LivingCityEventSystem } from './LivingCityEventSystem';

export const LivingCityEventDisplay: React.FC = () => {
  const [event, setEvent] = useState<LivingCityEventState>(() => LivingCityEventSystem.getInstance().getState());
  const ringRef = useRef<THREE.Mesh>(null);
  useEffect(() => LivingCityEventSystem.getInstance().subscribe(setEvent), []);
  useFrame((_, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y += delta * (event.phase === 'ACTIVE' ? 1.8 : 0.4);
    const pulse = event.phase === 'IDLE' ? 0.7 : 1 + Math.sin(performance.now() * 0.006) * 0.12;
    ringRef.current.scale.setScalar(pulse);
  });
  const color = event.type === 'POWER_OUTAGE' ? '#ffb000' : event.type === 'CORPORATE_LOCKDOWN' ? '#ff176b' : event.type === 'INFRASTRUCTURE_FAILURE' ? '#ff5c35' : '#00f0ff';
  return <group position={[0, 0.08, 0]}>
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[9, 0.12, 6, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.3 + event.intensity * 0.45} />
    </mesh>
    {event.phase !== 'IDLE' && <pointLight color={color} intensity={event.intensity * 2} distance={32} />}
  </group>;
};
