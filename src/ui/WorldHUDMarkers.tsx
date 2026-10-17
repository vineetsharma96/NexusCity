import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { NavigationState, NavigationSystem } from '../map/NavigationSystem';

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
  const [navState, setNavState] = useState<NavigationState>(() => NavigationSystem.getInstance().getState());
  const [markers, setMarkers] = useState<ProjectedMarker[]>([]);

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  useEffect(() => {
    let animId: number;
    const tempVec = new THREE.Vector3();
    const tempPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let lastProjection = 0;

    const updateProjections = (now: number) => {
      animId = requestAnimationFrame(updateProjections);
      if (now - lastProjection < 1000 / 30) return;
      lastProjection = now;

      const cam = (window as unknown as { __NEXUS_CAMERA__?: THREE.Camera }).__NEXUS_CAMERA__;
      const pPos = playerPosRef?.current;
      if (!cam || !pPos) return;

      cam.getWorldDirection(camDir);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const projectedList: ProjectedMarker[] = [];

      if (navState.activeLandmark) {
        const target = navState.activeLandmark;
        tempPos.copy(target.position);
        tempPos.y += 3.2;
        const dist = pPos.distanceTo(target.position);

        tempVec.subVectors(tempPos, cam.position);
        if (tempVec.dot(camDir) > 0.2) {
          tempVec.copy(tempPos).project(cam);
          if (tempVec.z < 1.0 && Math.abs(tempVec.x) <= 1.1 && Math.abs(tempVec.y) <= 1.1) {
            projectedList.push({
              id: target.id,
              name: target.name,
              category: target.category,
              x: (tempVec.x * 0.5 + 0.5) * width,
              y: (-(tempVec.y * 0.5) + 0.5) * height,
              dist: Math.round(dist),
              isTarget: true,
              color: 'var(--neon-amber)',
              opacity: 1.0,
            });
          }
        }
      }

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
            const opacity = dist < 25 ? 0.9 : THREE.MathUtils.lerp(0.9, 0.0, (dist - 25) / 60);
            projectedList.push({
              id: lm.id,
              name: lm.name,
              category: lm.category,
              x: (tempVec.x * 0.5 + 0.5) * width,
              y: (-(tempVec.y * 0.5) + 0.5) * height,
              dist: Math.round(dist),
              isTarget: false,
              color: 'var(--neon-cyan)',
              opacity,
            });
          }
        }
      });

      const visible = projectedList
        .sort((a, b) => Number(b.isTarget) - Number(a.isTarget) || a.dist - b.dist)
        .filter(
          (marker, idx, list) =>
            !list
              .slice(0, idx)
              .some((other) => Math.abs(marker.x - other.x) < 200 && Math.abs(marker.y - other.y) < 38)
        )
        .map((marker) => ({
          ...marker,
          x: THREE.MathUtils.clamp(marker.x, 120, width - 120),
          y: THREE.MathUtils.clamp(marker.y, 64, height - 90),
        }));

      setMarkers((prev) =>
        prev.length === visible.length &&
        prev.every((m, idx) => {
          const next = visible[idx];
          return (
            m.id === next.id &&
            m.dist === next.dist &&
            Math.abs(m.x - next.x) < 0.75 &&
            Math.abs(m.y - next.y) < 0.75 &&
            Math.abs(m.opacity - next.opacity) < 0.03
          );
        })
          ? prev
          : visible
      );
    };

    animId = requestAnimationFrame(updateProjections);
    return () => cancelAnimationFrame(animId);
  }, [playerPosRef, navState.activeLandmark]);

  return (
    <div
      data-component="WorldHUDMarkersOverlay"
      style={{
        position: 'absolute',
        inset: 0,
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
          <div
            className="glass-panel"
            style={{
              padding: m.isTarget ? '4px 10px' : '3px 8px',
              border: `1px solid ${m.color}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 4,
              backgroundColor: 'rgba(11, 15, 25, 0.9)',
            }}
          >
            <div
              style={{
                width: m.isTarget ? 7 : 5,
                height: m.isTarget ? 7 : 5,
                backgroundColor: m.color,
                transform: 'rotate(45deg)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: m.isTarget ? '0.7rem' : '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
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
                color: 'var(--text-primary)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '1px 5px',
                borderRadius: 2,
              }}
            >
              {m.dist}m
            </span>
          </div>
          <div
            style={{
              width: 1,
              height: m.isTarget ? 12 : 7,
              backgroundColor: m.color,
            }}
          />
        </div>
      ))}
    </div>
  );
};
