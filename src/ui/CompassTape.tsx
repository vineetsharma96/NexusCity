import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState } from '../map/NavigationSystem';
import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';

interface CompassTapeProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const CompassTape: React.FC<CompassTapeProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );
  const [headingDeg, setHeadingDeg] = useState(0);

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  // Update heading from player/camera orientation
  useEffect(() => {
    let animId: number;
    const updateHeading = () => {
      // Find active camera in DOM or window
      const cam = (window as any).__NEXUS_CAMERA__ as THREE.Camera | undefined;
      if (cam) {
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        // Angle in degrees (0 = North / -Z in standard Three.js)
        let deg = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
        if (deg < 0) deg += 360;
        setHeadingDeg(deg);
      }
      animId = requestAnimationFrame(updateHeading);
    };
    animId = requestAnimationFrame(updateHeading);
    return () => cancelAnimationFrame(animId);
  }, []);

  const pPos = playerPosRef?.current || new THREE.Vector3(0, 0, 0);

  // Cardinal milestones
  const cardinals = [
    { deg: 0, label: 'N' },
    { deg: 45, label: 'NE' },
    { deg: 90, label: 'E' },
    { deg: 135, label: 'SE' },
    { deg: 180, label: 'S' },
    { deg: 225, label: 'SW' },
    { deg: 270, label: 'W' },
    { deg: 315, label: 'NW' },
  ];

  // Calculate relative angle on the tape (tape spans ±60 degrees from center)
  const getTapeXPercent = (targetDeg: number): number | null => {
    let diff = targetDeg - headingDeg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    // Visible span is ±55 degrees
    if (Math.abs(diff) > 55) return null;
    return 50 + (diff / 55) * 45; // 5% to 95%
  };

  // Active objective marker angle
  let targetAngle: number | null = null;
  let targetDistance = 0;
  if (navState.activeLandmark) {
    const tPos = navState.activeLandmark.position;
    const dx = tPos.x - pPos.x;
    const dz = tPos.z - pPos.z;
    let angle = Math.atan2(dx, -dz) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    targetAngle = angle;
    targetDistance = Math.round(pPos.distanceTo(tPos));
  }

  const targetTapeX = targetAngle !== null ? getTapeXPercent(targetAngle) : null;

  // Nearby interior portals within 120m
  const nearbyPortals = Object.entries(INTERIOR_DESTINATIONS)
    .map(([id, dest]) => {
      const dist = pPos.distanceTo(dest.entrancePosition);
      if (dist > 140) return null;
      const dx = dest.entrancePosition.x - pPos.x;
      const dz = dest.entrancePosition.z - pPos.z;
      let angle = Math.atan2(dx, -dz) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      const tapeX = getTapeXPercent(angle);
      if (tapeX === null) return null;
      return { id, name: dest.name, tapeX, dist: Math.round(dist) };
    })
    .filter(Boolean) as { id: string; name: string; tapeX: number; dist: number }[];

  const roundedHeading = Math.round(headingDeg);
  const headingPadded = roundedHeading.toString().padStart(3, '0');

  return (
    <div
      data-component="CompassTape"
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 'min(360px, 85vw)',
      }}
    >
      {/* Compass Bar Frame */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          height: 34,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
          border: '1px solid rgba(0, 240, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(6, 12, 24, 0.85) 0%, rgba(3, 6, 14, 0.95) 100%)',
          boxShadow: '0 0 16px rgba(0, 240, 255, 0.15)',
        }}
      >
        {/* Top edge glow line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, var(--neon-cyan) 50%, transparent 100%)',
          }}
        />

        {/* Center reticle hairline */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 2,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--neon-cyan)',
            boxShadow: '0 0 8px var(--neon-cyan)',
            zIndex: 10,
          }}
        />

        {/* Center pointer notch */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid var(--neon-amber)',
            zIndex: 12,
          }}
        />

        {/* Cardinal Ticks */}
        {cardinals.map((c) => {
          const tapeX = getTapeXPercent(c.deg);
          if (tapeX === null) return null;
          const isMajor = c.label.length === 1;

          return (
            <div
              key={c.label}
              style={{
                position: 'absolute',
                left: `${tapeX}%`,
                top: 0,
                bottom: 0,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 3,
                transition: 'left 0.05s linear',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: isMajor ? '0.72rem' : '0.62rem',
                  fontWeight: isMajor ? 900 : 600,
                  color: c.label === 'N' ? 'var(--neon-amber)' : isMajor ? '#e2e8f0' : '#64748b',
                }}
              >
                {c.label}
              </span>
              <div
                style={{
                  width: 1,
                  height: isMajor ? 8 : 4,
                  backgroundColor: isMajor ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                  marginTop: 2,
                }}
              />
            </div>
          );
        })}

        {/* Nearby Interior Portal Diamond Markers */}
        {nearbyPortals.map((portal) => (
          <div
            key={portal.id}
            style={{
              position: 'absolute',
              left: `${portal.tapeX}%`,
              bottom: 4,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 8,
            }}
            title={`${portal.name} (${portal.dist}m)`}
          >
            <div
              style={{
                width: 6,
                height: 6,
                backgroundColor: '#00ffaa',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 6px #00ffaa',
              }}
            />
          </div>
        ))}

        {/* Active Navigation Landmark Marker */}
        {targetTapeX !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${targetTapeX}%`,
              bottom: 3,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 15,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                backgroundColor: 'var(--neon-cyan)',
                borderRadius: '50%',
                boxShadow: '0 0 10px var(--neon-cyan)',
                border: '1.5px solid #ffffff',
              }}
            />
          </div>
        )}
      </div>

      {/* Numerical Heading & Active Destination Sub-Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
        }}
      >
        <span
          style={{
            color: 'var(--neon-cyan)',
            backgroundColor: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            padding: '1px 6px',
            borderRadius: 3,
            fontWeight: 700,
          }}
        >
          {headingPadded}°
        </span>

        {navState.activeLandmark && (
          <span
            style={{
              color: 'var(--neon-amber)',
              backgroundColor: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.35)',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 700,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ◆ {navState.activeLandmark.name.toUpperCase()} [{targetDistance}m]
          </span>
        )}
      </div>
    </div>
  );
};
