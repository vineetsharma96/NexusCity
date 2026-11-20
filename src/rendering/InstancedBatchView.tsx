import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { BuiltInstanceBucket } from './StaticInstanceBatcher';

export interface InstanceBucketSpec {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
}

const SingleBucketMesh: React.FC<{
  bucket: BuiltInstanceBucket;
  spec: InstanceBucketSpec;
}> = React.memo(({ bucket, spec }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.count = bucket.count;
    mesh.instanceMatrix.array.set(bucket.matrices);
    mesh.instanceMatrix.needsUpdate = true;

    if (bucket.colors) {
      if (!mesh.instanceColor || mesh.instanceColor.count < bucket.count) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bucket.colors), 3);
      } else {
        mesh.instanceColor.array.set(bucket.colors);
        mesh.instanceColor.needsUpdate = true;
      }
    }

    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [bucket]);

  return (
    <instancedMesh
      key={`${spec.key}_${bucket.count}`}
      ref={meshRef}
      args={[spec.geometry, spec.material, bucket.count]}
      dispose={null}
      castShadow={Boolean(spec.castShadow)}
      receiveShadow={Boolean(spec.receiveShadow)}
      frustumCulled={spec.frustumCulled ?? false}
    />
  );
});

export const InstancedBatchLayer: React.FC<{
  buckets: Map<string, BuiltInstanceBucket>;
  specs: readonly InstanceBucketSpec[];
  name?: string;
}> = React.memo(({ buckets, specs, name }) => {
  return (
    <group name={name}>
      {specs.map((spec) => {
        const bucket = buckets.get(spec.key);
        if (!bucket || bucket.count === 0) return null;
        return <SingleBucketMesh key={spec.key} bucket={bucket} spec={spec} />;
      })}
    </group>
  );
});
