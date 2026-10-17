import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictGenerator } from './DistrictGenerator';

export const SkylineSilhouettes: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const beaconMeshRef = useRef<THREE.InstancedMesh>(null);
  const count = 240;
  const instances = useMemo(() => {
    const rng = new SeedRandom(847291 + 777);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.05, 0.05);
      const distance = rng.range(850, 2200);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const district = DistrictGenerator.getDistrictAt(x, z);
      return {
        x, z,
        height: rng.range(district.buildingHeightRange[0] * 1.5, district.buildingHeightRange[1] * 2.2),
        width: rng.range(35, 75), depth: rng.range(35, 75),
        color: new THREE.Color(district.accentColor).multiplyScalar(0.18),
        beaconColor: new THREE.Color(district.primaryLightColor),
      };
    });
  }, []);

  useLayoutEffect(() => {
    const buildings = meshRef.current;
    const beacons = beaconMeshRef.current;
    if (!buildings || !beacons) return;
    const dummy = new THREE.Object3D();
    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.height / 2, instance.z);
      dummy.scale.set(instance.width, instance.height, instance.depth);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, instance.color);
      dummy.position.y = instance.height + 2;
      dummy.scale.setScalar(4);
      dummy.updateMatrix();
      beacons.setMatrixAt(index, dummy.matrix);
      beacons.setColorAt(index, instance.beaconColor);
    });
    for (const mesh of [buildings, beacons]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [instances]);

  return <group name="SkylineSilhouettesLayer">
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#0b1122" roughness={0.4} metalness={0.8} />
    </instancedMesh>
    <instancedMesh ref={beaconMeshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffffff" />
    </instancedMesh>
  </group>;
};
