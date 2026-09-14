import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState, LandmarkDef } from '../map/NavigationSystem';
import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';
import { DistrictGenerator } from '../city/DistrictGenerator';
import { AudioManager } from '../audio/AudioManager';

interface MinimapProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const Minimap: React.FC<MinimapProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );
  const [radarRange, setRadarRange] = useState<number>(120); // 120m or 240m
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [coords, setCoords] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [hoveredBlip, setHoveredBlip] = useState<string | null>(null);

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  // Update position & heading loop with change detection to prevent 60fps React re-renders
  useEffect(() => {
    let animId: number;
    let lastNavUpdate = 0;
    const dir = new THREE.Vector3();

    const tick = (now: number) => {
      const pPos = playerPosRef?.current;
      if (pPos) {
        const rx = Math.round(pPos.x);
        const rz = Math.round(pPos.z);
        setCoords((prev) => (prev.x === rx && prev.z === rz ? prev : { x: rx, z: rz }));

        // Periodically update navigation system
        if (now - lastNavUpdate > 200) {
          NavigationSystem.getInstance().updatePlayerPosition(pPos);
          lastNavUpdate = now;
        }
      }

      // Heading from camera
      const cam = (window as any).__NEXUS_CAMERA__ as THREE.Camera | undefined;
      if (cam) {
        cam.getWorldDirection(dir);
        let deg = Math.round(Math.atan2(dir.x, -dir.z) * (180 / Math.PI));
        if (deg < 0) deg += 360;
        setHeadingDeg((prev) => (Math.abs(prev - deg) >= 1 ? deg : prev));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [playerPosRef]);

  const pPos = playerPosRef?.current || new THREE.Vector3(0, 0, 0);

  // Radar geometry
  const radarSize = 150;
  const cx = radarSize / 2;
  const cy = radarSize / 2;
  const r = (radarSize - 16) / 2; // radius ~67px

  const handleToggleMap = () => {
    AudioManager.getInstance().playUI('click');
    NavigationSystem.getInstance().toggleMap();
  };

  const handleToggleRange = () => {
    AudioManager.getInstance().playUI('click');
    setRadarRange((prev) => (prev === 120 ? 240 : 120));
  };

  // Convert world delta to radar SVG coordinates
  const worldToRadar = (worldX: number, worldZ: number, clampToEdge = false) => {
    const dx = worldX - pPos.x;
    const dz = worldZ - pPos.z; // North is -Z
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= radarRange) {
      return {
        x: cx + (dx / radarRange) * r,
        y: cy + (dz / radarRange) * r,
        isClamped: false,
        dist: Math.round(dist),
      };
    } else if (clampToEdge) {
      return {
        x: cx + (dx / dist) * r,
        y: cy + (dz / dist) * r,
        isClamped: true,
        dist: Math.round(dist),
      };
    }
    return null;
  };

  // Active target blip
  const targetBlip = navState.activeLandmark
    ? worldToRadar(navState.activeLandmark.position.x, navState.activeLandmark.position.z, true)
    : null;

  // Interior portal blips within range
  const interiorBlips = Object.entries(INTERIOR_DESTINATIONS)
    .map(([id, dest]) => {
      const pt = worldToRadar(dest.entrancePosition.x, dest.entrancePosition.z);
      if (!pt) return null;
      return {
        id,
        name: dest.name,
        type: 'INTERIOR',
        x: pt.x,
        y: pt.y,
        dist: pt.dist,
        color: '#00ffaa',
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      type: string;
      x: number;
      y: number;
      dist: number;
      color: string;
    }>;

  // Landmark blips
  const landmarkBlips = NavigationSystem.getInstance()
    .landmarks.map((lm) => {
      // Don't duplicate if active target
      if (navState.activeLandmark?.id === lm.id) return null;
      const pt = worldToRadar(lm.position.x, lm.position.z);
      if (!pt) return null;
      return {
        id: lm.id,
        name: lm.name,
        type: lm.category,
        x: pt.x,
        y: pt.y,
        dist: pt.dist,
        color: lm.category === 'SANCTUARY' ? '#22d3ee' : '#38bdf8',
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      type: string;
      x: number;
      y: number;
      dist: number;
      color: string;
    }>;

  const currentDistrict = DistrictGenerator.getDistrictAt(pPos.x, pPos.z);

  return (
    <div
      data-component="CyberMinimap"
      className="glass-panel"
      style={{
        position: 'absolute',
        top: 60,
        right: 18,
        zIndex: 32,
        padding: '10px 12px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        border: '1px solid rgba(0, 240, 255, 0.35)',
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.12), inset 0 0 14px rgba(0, 240, 255, 0.04)',
        userSelect: 'none',
      }}
    >
      {/* Top Header: Telemetry & Controls */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
        }}
      >
        <span
          style={{
            color: 'var(--neon-cyan)',
            fontWeight: 800,
            letterSpacing: '1px',
            textShadow: '0 0 8px rgba(0, 240, 255, 0.5)',
          }}
        >
          RADAR // {radarRange}M
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleToggleRange}
            className="cyber-btn"
            style={{
              padding: '1px 5px',
              fontSize: '0.62rem',
              borderColor: 'rgba(0, 240, 255, 0.4)',
              color: 'var(--text-secondary)',
            }}
            title="Toggle Radar Zoom Scale"
          >
            {radarRange === 120 ? '2X' : '1X'}
          </button>
          <button
            onClick={handleToggleMap}
            className="cyber-btn"
            style={{
              padding: '1px 7px',
              fontSize: '0.62rem',
              borderColor: 'var(--neon-cyan)',
              color: 'var(--neon-cyan)',
              fontWeight: 700,
            }}
            title="Open Holographic World Map [M]"
          >
            MAP [M]
          </button>
        </div>
      </div>

      {/* Circular Radar Display Area */}
      <div
        style={{
          position: 'relative',
          width: radarSize,
          height: radarSize,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(circle, rgba(5, 20, 36, 0.85) 0%, rgba(2, 8, 18, 0.96) 80%, rgba(0, 4, 10, 0.98) 100%)',
          border: '1.5px solid rgba(0, 240, 255, 0.4)',
          boxShadow: 'inset 0 0 20px rgba(0, 240, 255, 0.2), 0 0 12px rgba(0, 240, 255, 0.2)',
        }}
      >
        {/* Animated Radar Sweep Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(0, 240, 255, 0.3) 0deg, rgba(0, 240, 255, 0.05) 45deg, transparent 90deg, transparent 360deg)',
            animation: 'radar-sweep 3.5s linear infinite',
            transformOrigin: 'center center',
          }}
        />

        {/* SVG Radar Grids & Blips */}
        <svg
          width={radarSize}
          height={radarSize}
          viewBox={`0 0 ${radarSize} ${radarSize}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Outer Distance Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(0, 240, 255, 0.3)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Inner 50% Distance Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r * 0.5}
            fill="none"
            stroke="rgba(0, 240, 255, 0.2)"
            strokeWidth="1"
          />

          {/* Crosshairs */}
          <line
            x1={cx}
            y1={cy - r}
            x2={cx}
            y2={cy + r}
            stroke="rgba(0, 240, 255, 0.18)"
            strokeWidth="1"
          />
          <line
            x1={cx - r}
            y1={cy}
            x2={cx + r}
            y2={cy}
            stroke="rgba(0, 240, 255, 0.18)"
            strokeWidth="1"
          />

          {/* Cardinal Direction Letters */}
          <text
            x={cx}
            y={cy - r + 9}
            textAnchor="middle"
            fill="var(--neon-amber)"
            fontSize="8"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
          >
            N
          </text>
          <text
            x={cx + r - 7}
            y={cy + 3}
            textAnchor="middle"
            fill="rgba(0, 240, 255, 0.6)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            E
          </text>
          <text
            x={cx}
            y={cy + r - 3}
            textAnchor="middle"
            fill="rgba(0, 240, 255, 0.6)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            S
          </text>
          <text
            x={cx - r + 7}
            y={cy + 3}
            textAnchor="middle"
            fill="rgba(0, 240, 255, 0.6)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            W
          </text>

          {/* Landmark Blips */}
          {landmarkBlips.map((lm) => (
            <circle
              key={lm.id}
              cx={lm.x}
              cy={lm.y}
              r="2.5"
              fill={lm.color}
              opacity="0.85"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredBlip(`${lm.name} (${lm.dist}m)`)}
              onMouseLeave={() => setHoveredBlip(null)}
            />
          ))}

          {/* Interior Portal Diamond Blips */}
          {interiorBlips.map((ib) => (
            <rect
              key={ib.id}
              x={ib.x - 2.5}
              y={ib.y - 2.5}
              width="5"
              height="5"
              fill={ib.color}
              transform={`rotate(45 ${ib.x} ${ib.y})`}
              opacity="0.9"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredBlip(`[PORTAL] ${ib.name} (${ib.dist}m)`)}
              onMouseLeave={() => setHoveredBlip(null)}
            />
          ))}

          {/* Active Navigation Guideline & Target Blip */}
          {targetBlip && (
            <>
              {/* Line from player to target */}
              <line
                x1={cx}
                y1={cy}
                x2={targetBlip.x}
                y2={targetBlip.y}
                stroke="var(--neon-amber)"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.75"
              />

              {/* Target Marker */}
              <g
                transform={`translate(${targetBlip.x}, ${targetBlip.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() =>
                  setHoveredBlip(`DEST: ${navState.activeLandmark?.name} (${targetBlip.dist}m)`)
                }
                onMouseLeave={() => setHoveredBlip(null)}
              >
                <circle
                  r={targetBlip.isClamped ? '4.5' : '5'}
                  fill="none"
                  stroke="var(--neon-amber)"
                  strokeWidth="1.5"
                />
                <circle r="2.5" fill="var(--neon-cyan)" />
              </g>
            </>
          )}

          {/* Center Player Chevron Icon */}
          <g transform={`translate(${cx}, ${cy}) rotate(${headingDeg})`}>
            {/* Soft Player Aura */}
            <circle r="6" fill="rgba(0, 240, 255, 0.2)" />
            {/* Directional Triangle Chevron */}
            <polygon
              points="0,-6.5 4,4.5 0,2 -4,4.5"
              fill="var(--neon-cyan)"
              stroke="#ffffff"
              strokeWidth="0.8"
            />
          </g>
        </svg>

        {/* Hover Blip Tooltip Overlay */}
        {hoveredBlip && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              right: 6,
              backgroundColor: 'rgba(3, 7, 18, 0.92)',
              border: '1px solid var(--neon-cyan)',
              padding: '2px 4px',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.58rem',
              color: 'var(--neon-cyan)',
              textAlign: 'center',
              pointerEvents: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hoveredBlip}
          </div>
        )}
      </div>

      {/* GPS Telemetry & Active Sector */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.64rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
          <span>
            X: <strong style={{ color: 'var(--text-primary)' }}>{coords.x >= 0 ? `+${coords.x}` : coords.x}</strong>
          </span>
          <span>
            Z: <strong style={{ color: 'var(--text-primary)' }}>{coords.z >= 0 ? `+${coords.z}` : coords.z}</strong>
          </span>
        </div>

        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.62rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 3,
          }}
          title={currentDistrict.name}
        >
          {currentDistrict.name.toUpperCase()}
        </div>

        {/* Target Destination & Distance Readout */}
        {navState.activeLandmark && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 170, 0, 0.08)',
              border: '1px solid rgba(255, 170, 0, 0.25)',
              padding: '2px 4px',
              borderRadius: 3,
              marginTop: 1,
            }}
          >
            <span
              style={{
                color: 'var(--neon-amber)',
                fontWeight: 700,
                fontSize: '0.62rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 90,
              }}
            >
              ▶ {navState.activeLandmark.name}
            </span>
            <span style={{ color: 'var(--neon-cyan)', fontWeight: 800, fontSize: '0.62rem' }}>
              {navState.distance}m
            </span>
          </div>
        )}
      </div>

      {/* Global CSS animation for radar sweep */}
      <style>{`
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
