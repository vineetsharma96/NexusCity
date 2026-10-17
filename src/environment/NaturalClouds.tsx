import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';

interface CloudPuff {
  localOffset: THREE.Vector3;
  scale: THREE.Vector3;
}

interface CloudFormation {
  basePos: THREE.Vector3;
  speedMult: number;
  puffs: CloudPuff[];
}

export const NaturalClouds: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const windSystem = WindSystem.getInstance();
  const timeStateRef = useRef(TimeSystem.getInstance().getState());
  const weatherStateRef = useRef(WeatherSystem.getInstance().getState());

  useEffect(() => {
    const uTime = TimeSystem.getInstance().subscribe((s) => {
      timeStateRef.current = s;
    });
    const uWea = WeatherSystem.getInstance().subscribe((w) => {
      weatherStateRef.current = w;
    });
    return () => {
      uTime();
      uWea();
    };
  }, []);

  const { formations, totalPuffs } = useMemo(() => {
    const list: CloudFormation[] = [];
    let count = 0;

    for (let c = 0; c < 28; c++) {
      const cx = ((c * 197) % 1000) - 500;
      const cz = ((c * 353) % 1000) - 500;
      const cy = 175 + ((c * 43) % 55);
      const puffs: CloudPuff[] = [];
      const puffCount = 5 + (c % 4);

      for (let p = 0; p < puffCount; p++) {
        const angle = (p / puffCount) * Math.PI * 2;
        const dist = p === 0 ? 0 : 12 + (p % 3) * 8;
        puffs.push({
          localOffset: new THREE.Vector3(Math.cos(angle) * dist, p === 0 ? 4 : -1.5, Math.sin(angle) * dist * 0.7),
          scale: new THREE.Vector3(20 + (p % 3) * 8, 9 + (p % 2) * 5, 18 + (p % 3) * 6),
        });
        count++;
      }

      list.push({
        basePos: new THREE.Vector3(cx, cy, cz),
        speedMult: 0.75 + (c % 5) * 0.12,
        puffs,
      });
    }
    return { formations: list, totalPuffs: count };
  }, []);

  const puffGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);
  const colTarget = useMemo(() => new THREE.Color(), []);
  const colEmissive = useMemo(() => new THREE.Color(), []);
  const colStorm = useMemo(() => new THREE.Color('#0f172a'), []);

  useFrame((_, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const tState = timeStateRef.current;
    const wState = weatherStateRef.current;

    colTarget.set(tState.cloudColor);
    if (wState.rainIntensity > 0.05) {
      colTarget.lerp(colStorm, wState.rainIntensity * 0.75);
    }
    materialRef.current.color.lerp(colTarget, delta * 3);

    colEmissive.set(tState.isNight ? '#0b1528' : tState.sunColor);
    materialRef.current.emissive.lerp(colEmissive, delta * 3);
    materialRef.current.emissiveIntensity = tState.isNight ? 0.15 : 0.22;

    let idx = 0;
    const BOUND = 520;
    for (let i = 0; i < formations.length; i++) {
      const f = formations[i];
      f.basePos.x += wind.x * 0.4 * f.speedMult * gust * delta;
      f.basePos.z += wind.z * 0.4 * f.speedMult * gust * delta;

      if (f.basePos.x > BOUND) f.basePos.x = -BOUND;
      else if (f.basePos.x < -BOUND) f.basePos.x = BOUND;
      if (f.basePos.z > BOUND) f.basePos.z = -BOUND;
      else if (f.basePos.z < -BOUND) f.basePos.z = BOUND;

      for (let j = 0; j < f.puffs.length; j++) {
        const puff = f.puffs[j];
        dummy.position.set(
          f.basePos.x + puff.localOffset.x,
          f.basePos.y + puff.localOffset.y,
          f.basePos.z + puff.localOffset.z
        );
        dummy.scale.copy(puff.scale);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[puffGeo, undefined, totalPuffs]} frustumCulled={false}>
      <meshStandardMaterial ref={materialRef} color="#f8fafc" roughness={0.92} metalness={0.04} transparent opacity={0.84} />
    </instancedMesh>
  );
};
