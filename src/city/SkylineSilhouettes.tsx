import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictGenerator } from './DistrictGenerator';

export const SkylineSilhouettes: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const beaconMeshRef = useRef<THREE.InstancedMesh>(null);

  const count = 120; // 120 distant skyline skyscrapers

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate distant skyscraper transforms deterministically
  useMemo(() => {
    const rng = new SeedRandom(847291 + 777);
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const sphereGeometry = new THREE.SphereGeometry(1, 6, 6);

    // Instances generated in outer ring: radius 180m to 550m
    const instances: {
      position: THREE.Vector3;
      scale: THREE.Vector3;
      color: THREE.Color;
      beaconPos: THREE.Vector3;
      beaconColor: THREE.Color;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.05, 0.05);
      const dist = rng.range(190, 520);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Consult district profile for height and theme color
      const district = DistrictGenerator.getDistrictAt(x, z);
      const height = rng.range(district.buildingHeightRange[0], district.buildingHeightRange[1]);
      const width = rng.range(18, 38);
      const depth = rng.range(18, 38);

      const color = new THREE.Color(district.accentColor).multiplyScalar(0.25);
      const beaconColor = new THREE.Color(district.primaryLightColor);

      instances.push({
        position: new THREE.Vector3(x, height / 2, z),
        scale: new THREE.Vector3(width, height, depth),
        color,
        beaconPos: new THREE.Vector3(x, height + 2, z),
        beaconColor,
      });
    }

    return { instances, boxGeometry, sphereGeometry };
  }, [count]);

  return (
    <group name="SkylineSilhouettesLayer">
      {/* 1. Low-Poly Distant Skyscraper Massing Volumes */}
      <instancedMesh
        ref={(m) => {
          if (m && !meshRef.current) {
            meshRef.current = m;
            const rng = new SeedRandom(847291 + 777);
            for (let i = 0; i < count; i++) {
              const angle = (i / count) * Math.PI * 2 + rng.range(-0.05, 0.05);
              const dist = rng.range(190, 520);
              const x = Math.cos(angle) * dist;
              const z = Math.sin(angle) * dist;
              const district = DistrictGenerator.getDistrictAt(x, z);
              const h = rng.range(district.buildingHeightRange[0], district.buildingHeightRange[1]);
              const w = rng.range(18, 38);
              const d = rng.range(18, 38);

              dummy.position.set(x, h / 2, z);
              dummy.scale.set(w, h, d);
              dummy.updateMatrix();
              m.setMatrixAt(i, dummy.matrix);

              const col = new THREE.Color(district.accentColor).multiplyScalar(0.18);
              m.setColorAt(i, col);
            }
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
          }
        }}
        args={[undefined, undefined, count]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b1122" roughness={0.4} metalness={0.8} />
      </instancedMesh>

      {/* 2. Rooftop Warning Beacons / Spire Tips on Distant Skylines */}
      <instancedMesh
        ref={(bm) => {
          if (bm && !beaconMeshRef.current) {
            beaconMeshRef.current = bm;
            const rng = new SeedRandom(847291 + 777);
            for (let i = 0; i < count; i++) {
              const angle = (i / count) * Math.PI * 2 + rng.range(-0.05, 0.05);
              const dist = rng.range(190, 520);
              const x = Math.cos(angle) * dist;
              const z = Math.sin(angle) * dist;
              const district = DistrictGenerator.getDistrictAt(x, z);
              const h = rng.range(district.buildingHeightRange[0], district.buildingHeightRange[1]);

              dummy.position.set(x, h + 2, z);
              dummy.scale.set(2.5, 2.5, 2.5);
              dummy.updateMatrix();
              bm.setMatrixAt(i, dummy.matrix);

              const bCol = new THREE.Color(district.primaryLightColor);
              bm.setColorAt(i, bCol);
            }
            bm.instanceMatrix.needsUpdate = true;
            if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
          }
        }}
        args={[undefined, undefined, count]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#00f0ff" />
      </instancedMesh>
    </group>
  );
};
