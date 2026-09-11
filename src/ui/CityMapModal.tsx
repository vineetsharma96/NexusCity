import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState, LandmarkDef } from '../map/NavigationSystem';

interface CityMapModalProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const CityMapModal: React.FC<CityMapModalProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkDef | null>(
    navState.activeLandmark || NavigationSystem.getInstance().landmarks[0]
  );
  const [zoom, setZoom] = useState(1.0);
  const [playerCoord, setPlayerCoord] = useState<{ x: number; z: number }>({ x: 0, z: 0 });

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe((state) => {
      setNavState(state);
      if (state.activeLandmark) {
        setSelectedLandmark(state.activeLandmark);
      }
    });
  }, []);

  // Update player coordinates while map is open
  useEffect(() => {
    if (!navState.isMapOpen) return;
    const interval = setInterval(() => {
      setPlayerCoord({
        x: Math.round(playerPosRef.current.x),
        z: Math.round(playerPosRef.current.z),
      });
    }, 100);
    return () => clearInterval(interval);
  }, [navState.isMapOpen, playerPosRef]);

  if (!navState.isMapOpen) return null;

  const handleClose = () => {
    NavigationSystem.getInstance().setMapOpen(false);
  };

  const handleSelectDestination = (landmark: LandmarkDef) => {
    NavigationSystem.getInstance().setDestination(landmark.id, playerPosRef.current);
  };

  const handleClearDestination = () => {
    NavigationSystem.getInstance().setDestination(null);
  };

  // Map coordinate mapping: world (-150 .. 150) -> SVG (0 .. 600)
  const worldToSvg = (x: number, z: number) => {
    const svgSize = 600;
    const worldExtent = 300;
    const sx = ((x + 150) / worldExtent) * svgSize;
    const sz = ((z + 150) / worldExtent) * svgSize;
    return { x: sx, y: sz };
  };

  const playerSvg = worldToSvg(playerPosRef.current.x, playerPosRef.current.z);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 9, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '16px 28px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              letterSpacing: '2.5px',
              color: 'var(--neon-cyan)',
              textShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
            }}
          >
            HOLOGRAPHIC DISTRICT MAP
          </h2>
          <span className="cyber-badge" style={{ color: 'var(--neon-amber)' }}>
            SECTOR 1 // SEED #847291
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            GRID POS: [{playerCoord.x}, {playerCoord.z}]
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))}
              className="cyber-btn"
              style={{ padding: '4px 10px' }}
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
              className="cyber-btn"
              style={{ padding: '4px 10px' }}
            >
              -
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="cyber-btn"
              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            >
              RESET
            </button>
          </div>
          <button
            onClick={handleClose}
            className="cyber-btn"
            style={{ borderColor: 'var(--neon-magenta)', color: 'var(--neon-magenta)' }}
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>

      {/* 2. Main Body: Vector Map + Details Side Panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Interactive SVG Map Container */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 600,
              height: 600,
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s ease',
              position: 'relative',
              backgroundColor: '#080d1a',
              border: '2px solid rgba(0, 240, 255, 0.3)',
              borderRadius: 8,
              boxShadow: '0 0 32px rgba(0, 0, 0, 0.8), inset 0 0 40px rgba(0, 240, 255, 0.05)',
            }}
          >
            <svg width="600" height="600" viewBox="0 0 600 600" style={{ display: 'block' }}>
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Background Grid */}
              <rect width="600" height="600" fill="url(#grid)" />

              {/* 8 Macro Blocks */}
              {/* West Side Blocks */}
              <rect x="40" y="40" width="220" height="96" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="40" y="164" width="220" height="112" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="40" y="324" width="220" height="112" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="40" y="464" width="220" height="96" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />

              {/* East Side Blocks */}
              <rect x="340" y="40" width="220" height="96" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="340" y="164" width="220" height="112" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="340" y="324" width="220" height="112" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />
              <rect x="340" y="464" width="220" height="96" fill="#0d162c" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" rx="4" />

              {/* Main North-South Boulevard (20m wide -> 40px) */}
              <rect x="280" y="0" width="40" height="600" fill="#060b17" stroke="rgba(255, 170, 0, 0.3)" strokeWidth="1" />
              {/* Central Divider Dash */}
              <line x1="300" y1="0" x2="300" y2="600" stroke="#ffaa00" strokeWidth="2" strokeDasharray="8 6" />

              {/* East-West Cross Boulevards */}
              {/* Central Cross Boulevard (z = 0 -> y = 300) */}
              <rect x="0" y="284" width="600" height="32" fill="#060b17" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="1" />
              {/* North Crossway (z = -75 -> y = 150) */}
              <rect x="0" y="136" width="600" height="28" fill="#060b17" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" />
              {/* South Crossway (z = 75 -> y = 450) */}
              <rect x="0" y="436" width="600" height="28" fill="#060b17" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" />

              {/* Central Plaza Intersection Hub */}
              <rect x="272" y="272" width="56" height="56" fill="#0a152e" stroke="#00f0ff" strokeWidth="2" rx="4" />
              <circle cx="300" cy="300" r="16" fill="none" stroke="#ffaa00" strokeWidth="2" strokeDasharray="4 4" />

              {/* Active Navigation Route Line */}
              {navState.routeWaypoints.length > 1 && (
                <polyline
                  points={navState.routeWaypoints
                    .map((wp) => {
                      const p = worldToSvg(wp.x, wp.z);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="4"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 6px #00f0ff)' }}
                />
              )}

              {/* Landmark Marker Pins */}
              {NavigationSystem.getInstance().landmarks.map((lm) => {
                const lp = worldToSvg(lm.position.x, lm.position.z);
                const isSelected = selectedLandmark?.id === lm.id;
                const isTarget = navState.activeLandmark?.id === lm.id;

                return (
                  <g
                    key={lm.id}
                    onClick={() => setSelectedLandmark(lm)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Pulsing ring if targeted */}
                    {isTarget && (
                      <circle
                        cx={lp.x}
                        cy={lp.y}
                        r="18"
                        fill="none"
                        stroke="#ffaa00"
                        strokeWidth="2"
                        opacity="0.8"
                      />
                    )}
                    {/* Pin Circle */}
                    <circle
                      cx={lp.x}
                      cy={lp.y}
                      r={isSelected ? 10 : 8}
                      fill={isTarget ? '#ffaa00' : isSelected ? '#00f0ff' : '#38bdf8'}
                      stroke="#050914"
                      strokeWidth="2"
                      style={{ filter: isSelected || isTarget ? 'drop-shadow(0 0 6px #00f0ff)' : 'none' }}
                    />
                    {/* Label */}
                    <text
                      x={lp.x}
                      y={lp.y - 12}
                      textAnchor="middle"
                      fill={isSelected ? '#00f0ff' : '#94a3b8'}
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      fontWeight="bold"
                    >
                      {lm.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Player Current Location Indicator */}
              <g transform={`translate(${playerSvg.x}, ${playerSvg.y})`}>
                <circle r="12" fill="none" stroke="#00f0ff" strokeWidth="2" opacity="0.6">
                  <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r="6" fill="#00f0ff" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
        </div>

        {/* Right Side: Landmark Inspector & Action Card */}
        <div
          className="glass-panel"
          style={{
            width: 340,
            margin: '20px 24px 20px 0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: 8,
          }}
        >
          {selectedLandmark ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span className="cyber-badge" style={{ color: 'var(--neon-cyan)' }}>
                  {selectedLandmark.category}
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.2rem',
                    color: 'var(--text-primary)',
                    marginTop: 8,
                    letterSpacing: '1px',
                  }}
                >
                  {selectedLandmark.name}
                </h3>
                {selectedLandmark.isEnterable && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: '#00ffaa',
                      marginTop: 4,
                    }}
                  >
                    ● ENTERABLE INTERIOR
                  </span>
                )}
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(5, 10, 20, 0.5)',
                  padding: '12px',
                  borderRadius: 6,
                  borderLeft: '2px solid var(--neon-cyan)',
                }}
              >
                {selectedLandmark.description}
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  COORDINATES: [{selectedLandmark.position.x.toFixed(0)}, {selectedLandmark.position.z.toFixed(0)}]
                </div>
                {navState.activeLandmark?.id === selectedLandmark.id && (
                  <div style={{ color: 'var(--neon-amber)', marginTop: 6, fontWeight: 700 }}>
                    DISTANCE: {navState.distance} METERS
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              CLICK ANY LANDMARK ON THE MAP TO INSPECT.
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedLandmark && (
              <button
                onClick={() => handleSelectDestination(selectedLandmark)}
                className="cyber-btn"
                style={{ padding: '10px', fontSize: '0.85rem' }}
              >
                SET AS DESTINATION
              </button>
            )}
            {navState.activeLandmark && (
              <button
                onClick={handleClearDestination}
                className="cyber-btn"
                style={{ borderColor: '#ff0055', color: '#ff0055', padding: '8px', fontSize: '0.78rem' }}
              >
                CLEAR ROUTE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
