import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState, LandmarkDef } from '../map/NavigationSystem';

interface WorldHUDMarkersProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface ProjectedMarker {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  dist: number;
  isTarget: boolean;
  color: string;
  opacity: number;
}

export const WorldHUDMarkers: React.FC<WorldHUDMarkersProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );
  const [markers, setMarkers] = useState<ProjectedMarker[]>([]);

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  useEffect(() => {
    let animId: number;
    const tempVec = new THREE.Vector3();
    const tempPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    const updateProjections = () => {
      const cam = (window as any).__NEXUS_CAMERA__ as THREE.Camera | undefined;
      const pPos = playerPosRef?.current;

      if (!cam || !pPos) {
        animId = requestAnimationFrame(updateProjections);
        return;
      }

      cam.getWorldDirection(camDir);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const projectedList: ProjectedMarker[] = [];

      // 1. Project Active Landmark (if set)
      if (navState.activeLandmark) {
        const target = navState.activeLandmark;
        tempPos.copy(target.position);
        tempPos.y += 3.2;
        const dist = pPos.distanceTo(target.position);

        // Check if in front of camera
        tempVec.subVectors(tempPos, cam.position);
        if (tempVec.dot(camDir) > 0.2) {
          tempVec.copy(tempPos).project(cam);
          // If within screen NDC bounds [-1.1 to 1.1]
          if (tempVec.z < 1.0 && Math.abs(tempVec.x) <= 1.1 && Math.abs(tempVec.y) <= 1.1) {
            const sx = (tempVec.x * 0.5 + 0.5) * width;
            const sy = (-(tempVec.y * 0.5) + 0.5) * height;

            projectedList.push({
              id: target.id,
              name: target.name,
              category: target.category,
              x: sx,
              y: sy,
              dist: Math.round(dist),
              isTarget: true,
              color: 'var(--neon-amber)',
              opacity: 1.0,
            });
          }
        }
      }

      // 2. Project Nearby District Landmarks (within 85m)
      NavigationSystem.getInstance().landmarks.forEach((lm) => {
        if (navState.activeLandmark?.id === lm.id) return;
        const dist = pPos.distanceTo(lm.position);
        if (dist > 85) return;

        tempPos.copy(lm.position);
        tempPos.y += 3.5;
        tempVec.subVectors(tempPos, cam.position);
        if (tempVec.dot(camDir) > 0.3) {
          tempVec.copy(tempPos).project(cam);
          if (tempVec.z < 1.0 && Math.abs(tempVec.x) <= 1.05 && Math.abs(tempVec.y) <= 1.05) {
            const sx = (tempVec.x * 0.5 + 0.5) * width;
            const sy = (-(tempVec.y * 0.5) + 0.5) * height;
            const opacity = dist < 25 ? 0.9 : THREE.MathUtils.lerp(0.9, 0.0, (dist - 25) / 60);

            projectedList.push({
              id: lm.id,
              name: lm.name,
              category: lm.category,
              x: sx,
              y: sy,
              dist: Math.round(dist),
              isTarget: false,
              color: 'var(--neon-cyan)',
              opacity,
            });
          }
        }
      });

      setMarkers(projectedList);
      animId = requestAnimationFrame(updateProjections);
    };

    animId = requestAnimationFrame(updateProjections);
    return () => cancelAnimationFrame(animId);
  }, [playerPosRef, navState.activeLandmark]);

  return (
    <div
      data-component="WorldHUDMarkersOverlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 28,
        overflow: 'hidden',
      }}
    >
      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: 'absolute',
            left: m.x,
            top: m.y,
            transform: 'translate(-50%, -100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: m.opacity,
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
          }}
        >
          {/* Main Badge */}
          <div
            className="glass-panel"
            style={{
              padding: m.isTarget ? '3px 8px' : '2px 6px',
              border: `1.5px solid ${m.color}`,
              boxShadow: m.isTarget
                ? `0 0 16px ${m.color}, inset 0 0 8px ${m.color}`
                : `0 0 10px rgba(0, 240, 255, 0.25)`,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 4,
              backgroundColor: 'rgba(4, 10, 22, 0.88)',
            }}
          >
            {/* Pulsing Icon Diamond */}
            <div
              style={{
                width: m.isTarget ? 8 : 6,
                height: m.isTarget ? 8 : 6,
                backgroundColor: m.color,
                transform: 'rotate(45deg)',
                boxShadow: `0 0 8px ${m.color}`,
                animation: m.isTarget ? 'pulse 1.2s infinite' : undefined,
              }}
            />

            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: m.isTarget ? '0.72rem' : '0.64rem',
                fontWeight: 800,
                letterSpacing: '0.8px',
                color: m.color,
                whiteSpace: 'nowrap',
              }}
            >
              {m.name.toUpperCase()}
            </span>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                color: '#e2e8f0',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                padding: '0 4px',
                borderRadius: 2,
              }}
            >
              {m.dist}m
            </span>
          </div>

          {/* Stem Pointer Downwards */}
          <div
            style={{
              width: 1.5,
              height: m.isTarget ? 14 : 8,
              backgroundColor: m.color,
              boxShadow: `0 0 6px ${m.color}`,
            }}
          />
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: m.color,
            }}
          />
        </div>
      ))}
    </div>
  );
};
