import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WindSystem } from '../world/WindSystem';

interface DirtParticlesProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  count?: number;
}

interface ParticleData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Euler;
  scale: number;
  type: number; // 0: dust speck, 1: cyber grit, 2: paper flyer
  life: number;
  swirlPhase: number;
}

export const DirtParticles: React.FC<DirtParticlesProps> = ({ playerPosRef, count = 650 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const windSystem = WindSystem.getInstance();

  // Create instanced particle data
  const particles = useMemo(() => {
    const data: ParticleData[] = [];
    const pPos = playerPosRef.current;

    for (let i = 0; i < count; i++) {
      const type = Math.random() < 0.7 ? 0 : Math.random() < 0.6 ? 1 : 2;
      const spreadX = (Math.random() - 0.5) * 80;
      const spreadZ = (Math.random() - 0.5) * 80;
      const spreadY = Math.random() * 20 + 0.1;

      data.push({
        pos: new THREE.Vector3(pPos.x + spreadX, spreadY, pPos.z + spreadZ),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotVel: new THREE.Euler(
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0
        ),
        scale: type === 0 ? 0.06 + Math.random() * 0.08 : type === 1 ? 0.12 + Math.random() * 0.12 : 0.22 + Math.random() * 0.18,
        type,
        life: Math.random() * 10,
        swirlPhase: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, [count, playerPosRef]);

  // Shared geometry: mix of small tetrahedrons, diamond quads
  const geometry = useMemo(() => {
    const geom = new THREE.DodecahedronGeometry(0.5, 0);
    return geom;
  }, []);

  // Material with warm dust / cyber amber & neon hues
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#c99665',
      roughness: 0.85,
      metalness: 0.15,
      emissive: '#442812',
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
  }, []);

  // Reusable dummy matrix and color
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  // Initial colors per instance
  useMemo(() => {
    // will be set on first frames
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Update global wind
    windSystem.update(delta);
    const windVec = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const pPos = playerPosRef.current;
    const boundedRadius = 45; // 90m total field centered on player

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.life += delta;

      // 1. Wind influence + turbulence
      const swirl = Math.sin(p.life * 2.5 + p.swirlPhase) * (0.8 * gust);
      const updraft = Math.sin(p.pos.x * 0.1 + p.pos.z * 0.1 + p.life * 3.0) * (0.5 * gust);

      // Accelerate towards wind vector
      const targetVx = windVec.x * (0.4 + p.scale * 0.5);
      const targetVz = windVec.z * (0.4 + p.scale * 0.5);
      const targetVy = (windVec.y * 0.2) + updraft + (gust > 1.4 ? (gust - 1.0) * 1.5 : -0.2);

      p.vel.x = THREE.MathUtils.lerp(p.vel.x, targetVx + swirl, delta * 3.0);
      p.vel.y = THREE.MathUtils.lerp(p.vel.y, targetVy, delta * 2.5);
      p.vel.z = THREE.MathUtils.lerp(p.vel.z, targetVz - swirl, delta * 3.0);

      // Apply velocity
      p.pos.x += p.vel.x * delta;
      p.pos.y += p.vel.y * delta;
      p.pos.z += p.vel.z * delta;

      // Tumbling rotation
      p.rot.x += p.rotVel.x * delta * gust;
      p.rot.y += p.rotVel.y * delta * gust;
      p.rot.z += p.rotVel.z * delta * gust;

      // Floor bounce / ceiling clamp
      if (p.pos.y < 0.08) {
        p.pos.y = 0.08;
        p.vel.y = Math.abs(p.vel.y) * 0.3 + 0.1 * gust; // slight ground bounce
      } else if (p.pos.y > 22.0) {
        p.pos.y = 22.0;
        p.vel.y = -0.5;
      }

      // Cyclic wrapping around player
      const dx = p.pos.x - pPos.x;
      const dz = p.pos.z - pPos.z;

      if (dx > boundedRadius) p.pos.x -= boundedRadius * 2;
      else if (dx < -boundedRadius) p.pos.x += boundedRadius * 2;

      if (dz > boundedRadius) p.pos.z -= boundedRadius * 2;
      else if (dz < -boundedRadius) p.pos.z += boundedRadius * 2;

      // Setup transform
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);

      // Flatten papers slightly
      if (p.type === 2) {
        dummy.scale.set(p.scale * 1.2, p.scale * 0.15, p.scale * 1.5);
      } else {
        dummy.scale.setScalar(p.scale);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Dynamic color depending on type
      if (p.type === 0) {
        // earthy dust speck
        color.set('#c49a6c');
      } else if (p.type === 1) {
        // cyber metallic grit / sparks
        color.set(gust > 1.5 ? '#ffaa44' : '#8899aa');
      } else {
        // flyer / debris paper
        color.set('#00f0ff');
      }
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
};
