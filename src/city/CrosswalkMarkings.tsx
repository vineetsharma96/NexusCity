import React from 'react';
import * as THREE from 'three';

interface CrosswalkMarkingsProps {
  position?: [number, number, number];
}

export const CrosswalkMarkings: React.FC<CrosswalkMarkingsProps> = ({ position = [0, 0, 0] }) => {
  // 4 crosswalk locations around the central avenue intersection
  // Avenue width is ~14m (from -7 to +7), crosswalk is 3.5m wide stripe zone
  const crosswalks = [
    // North Crosswalk (across Z-axis road at z = -14)
    { pos: [0, 0.05, -14], rot: 0, width: 13, depth: 3.2, stripes: 10, axis: 'x' },
    // South Crosswalk (across Z-axis road at z = 14)
    { pos: [0, 0.05, 14], rot: 0, width: 13, depth: 3.2, stripes: 10, axis: 'x' },
    // East Crosswalk (across X-axis road at x = 14)
    { pos: [14, 0.05, 0], rot: Math.PI / 2, width: 13, depth: 3.2, stripes: 10, axis: 'z' },
    // West Crosswalk (across X-axis road at x = -14)
    { pos: [-14, 0.05, 0], rot: Math.PI / 2, width: 13, depth: 3.2, stripes: 10, axis: 'z' },
  ];

  return (
    <group position={position}>
      {crosswalks.map((cw, idx) => (
        <group key={`cw-${idx}`} position={cw.pos as [number, number, number]} rotation={[0, cw.rot, 0]}>
          {/* Stop Line Bar for Vehicles (just ahead of crosswalk) */}
          <mesh position={[0, 0.04, cw.depth / 2 + 0.6]}>
            <planeGeometry args={[cw.width, 0.45]} />
            <meshStandardMaterial
              color="#00f0ff"
              emissive="#00f0ff"
              emissiveIntensity={0.6}
              roughness={0.3}
            />
          </mesh>

          {/* Zebra Stripes */}
          {Array.from({ length: cw.stripes }).map((_, sIdx) => {
            const stripeW = 0.7;
            const gap = (cw.width - cw.stripes * stripeW) / (cw.stripes - 1);
            const xOffset = -cw.width / 2 + stripeW / 2 + sIdx * (stripeW + gap);
            return (
              <mesh
                key={`stripe-${sIdx}`}
                position={[xOffset, 0.03, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[stripeW, cw.depth]} />
                <meshStandardMaterial
                  color="#e2e8f0"
                  emissive="#00f0ff"
                  emissiveIntensity={0.15}
                  roughness={0.4}
                />
              </mesh>
            );
          })}

          {/* Glowing Lateral Curb Ramp Edges */}
          <mesh position={[-cw.width / 2 - 0.2, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.2, cw.depth]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
          <mesh position={[cw.width / 2 + 0.2, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.2, cw.depth]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
