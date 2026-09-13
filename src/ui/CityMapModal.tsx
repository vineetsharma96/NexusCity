import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState, LandmarkDef } from '../map/NavigationSystem';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { DistrictGenerator, DistrictInfo } from '../city/DistrictGenerator';
import { AudioManager } from '../audio/AudioManager';

interface CityMapModalProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

type CategoryFilter = 'ALL' | 'INTERIORS' | 'LANDMARKS' | 'TRANSIT';

export const CityMapModal: React.FC<CityMapModalProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );
  const [chunkState, setChunkState] = useState<ChunkManagerState>(() =>
    ChunkManager.getInstance().getState()
  );
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkDef | null>(
    navState.activeLandmark || NavigationSystem.getInstance().landmarks[0]
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  // Map viewport transform (Pan & Zoom)
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [playerCoord, setPlayerCoord] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [headingDeg, setHeadingDeg] = useState(0);

  useEffect(() => {
    const unsubNav = NavigationSystem.getInstance().subscribe((state) => {
      setNavState(state);
      if (state.activeLandmark) {
        setSelectedLandmark(state.activeLandmark);
      }
    });
    const unsubChunks = ChunkManager.getInstance().subscribe(setChunkState);

    return () => {
      unsubNav();
      unsubChunks();
    };
  }, []);

  // Update telemetry and camera heading while map is open
  useEffect(() => {
    if (!navState.isMapOpen) return;

    const interval = setInterval(() => {
      if (playerPosRef?.current) {
        setPlayerCoord({
          x: Math.round(playerPosRef.current.x),
          z: Math.round(playerPosRef.current.z),
        });
      }

      const cam = (window as any).__NEXUS_CAMERA__ as THREE.Camera | undefined;
      if (cam) {
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        let deg = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
        if (deg < 0) deg += 360;
        setHeadingDeg(deg);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [navState.isMapOpen, playerPosRef]);

  if (!navState.isMapOpen) return null;

  // City scale: 24x24 grid, 120m per chunk -> 2880m total world (-1440 to +1440)
  const WORLD_EXTENT = 2880;
  const SVG_SIZE = 2400; // 100 SVG units per chunk
  const CHUNK_SVG_SIZE = SVG_SIZE / 24; // 100 units

  const worldToSvg = (x: number, z: number) => {
    const sx = ((x + 1440) / WORLD_EXTENT) * SVG_SIZE;
    const sy = ((z + 1440) / WORLD_EXTENT) * SVG_SIZE;
    return { x: sx, y: sy };
  };

  const pPos = playerPosRef.current;
  const playerSvg = worldToSvg(pPos.x, pPos.z);

  const handleClose = () => {
    AudioManager.getInstance().playUI('click');
    NavigationSystem.getInstance().setMapOpen(false);
  };

  const handleSelectDestination = (landmark: LandmarkDef) => {
    AudioManager.getInstance().playUI('click');
    NavigationSystem.getInstance().setDestination(landmark.id, playerPosRef.current);
  };

  const handleClearDestination = () => {
    AudioManager.getInstance().playUI('click');
    NavigationSystem.getInstance().setDestination(null);
  };

  const handleFastTravel = (landmark: LandmarkDef) => {
    AudioManager.getInstance().playDiscoveryChime();
    window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: landmark.position.clone() }));
    handleClose();
  };

  const handleCenterOnPlayer = () => {
    AudioManager.getInstance().playUI('click');
    // Center SVG around player
    const centerOffset = SVG_SIZE / 2;
    setPan({
      x: (centerOffset - playerSvg.x) * zoom,
      y: (centerOffset - playerSvg.y) * zoom,
    });
    setZoom(1.1);
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev + zoomDelta)));
  };

  // Filter landmarks
  const allLandmarks = NavigationSystem.getInstance().landmarks;
  const filteredLandmarks = allLandmarks.filter((lm) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'INTERIORS') {
      return (
        lm.category === 'INTERIOR' ||
        lm.category === 'LAB' ||
        lm.category === 'LOUNGE' ||
        lm.isEnterable
      );
    }
    if (categoryFilter === 'TRANSIT') {
      return lm.category === 'TRANSIT' || lm.category === 'CROSSWAY';
    }
    if (categoryFilter === 'LANDMARKS') {
      return lm.category === 'TOWER' || lm.category === 'PLAZA' || lm.category === 'SANCTUARY';
    }
    return true;
  });

  const selectedDist = selectedLandmark
    ? Math.round(pPos.distanceTo(selectedLandmark.position))
    : 0;
  const selectedEta = Math.round(selectedDist / 5.5);

  const exploredPercent = chunkState.exploredPercent || 5.2;
  const totalChunks = 576;
  const exploredCount = chunkState.discoveredChunks?.size || 30;

  // Render 24x24 chunk grid tiles
  const chunkTiles: React.ReactNode[] = [];
  const r = ChunkManager.GRID_RADIUS; // 12
  for (let cx = -r; cx < r; cx++) {
    for (let cz = -r; cz < r; cz++) {
      const tileX = (cx + r) * CHUNK_SVG_SIZE;
      const tileY = (cz + r) * CHUNK_SVG_SIZE;
      const key = `${cx}_${cz}`;
      const isExplored = ChunkManager.getInstance().isChunkExplored(cx, cz);
      const district = DistrictGenerator.getDistrictAt((cx + 0.5) * 120, (cz + 0.5) * 120);

      chunkTiles.push(
        <g key={key}>
          {isExplored ? (
            // Explored Sector: Detailed district background with clear road grids
            <>
              <rect
                x={tileX}
                y={tileY}
                width={CHUNK_SVG_SIZE}
                height={CHUNK_SVG_SIZE}
                fill={district.accentColor}
                fillOpacity="0.08"
                stroke="rgba(0, 240, 255, 0.12)"
                strokeWidth="0.8"
              />
              {/* Intra-chunk secondary road cross lines */}
              <line
                x1={tileX}
                y1={tileY + CHUNK_SVG_SIZE / 2}
                x2={tileX + CHUNK_SVG_SIZE}
                y2={tileY + CHUNK_SVG_SIZE / 2}
                stroke="rgba(0, 240, 255, 0.09)"
                strokeWidth="0.7"
                strokeDasharray="2 2"
              />
              <line
                x1={tileX + CHUNK_SVG_SIZE / 2}
                y1={tileY}
                x2={tileX + CHUNK_SVG_SIZE / 2}
                y2={tileY + CHUNK_SVG_SIZE}
                stroke="rgba(0, 240, 255, 0.09)"
                strokeWidth="0.7"
                strokeDasharray="2 2"
              />
            </>
          ) : (
            // Unexplored Sector: Dark "Fog of War" hexagonal shrouded grid
            <>
              <rect
                x={tileX}
                y={tileY}
                width={CHUNK_SVG_SIZE}
                height={CHUNK_SVG_SIZE}
                fill="#020612"
                fillOpacity="0.88"
                stroke="rgba(0, 240, 255, 0.05)"
                strokeWidth="0.6"
              />
              {/* Encrypted Sector Hex Icon */}
              <text
                x={tileX + CHUNK_SVG_SIZE / 2}
                y={tileY + CHUNK_SVG_SIZE / 2 + 3}
                fill="rgba(255, 255, 255, 0.12)"
                fontSize="8"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                ⬡
              </text>
            </>
          )}
        </g>
      );
    }
  }

  return (
    <div
      data-component="CityMapModalContainer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(3, 7, 18, 0.94)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Header Bar with Exploration Progress Bar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          backgroundColor: 'rgba(6, 12, 28, 0.9)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                letterSpacing: '2.5px',
                color: 'var(--neon-cyan)',
                textShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
                margin: 0,
              }}
            >
              HOLOGRAPHIC METROPOLIS BLUEPRINT
            </h2>
            <span
              className="cyber-badge"
              style={{
                color: 'var(--neon-amber)',
                borderColor: 'rgba(255, 170, 0, 0.4)',
                backgroundColor: 'rgba(255, 170, 0, 0.08)',
              }}
            >
              3KM GRID // SECTOR MATRIX 24×24
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8' }}>
              OPERATIVE GPS: [{playerCoord.x >= 0 ? `+${playerCoord.x}` : playerCoord.x},{' '}
              {playerCoord.z >= 0 ? `+${playerCoord.z}` : playerCoord.z}]
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Viewport Zoom & Center Controls */}
            <button
              onClick={handleCenterOnPlayer}
              className="cyber-btn"
              style={{
                fontSize: '0.7rem',
                padding: '4px 10px',
                color: 'var(--neon-cyan)',
                borderColor: 'var(--neon-cyan)',
              }}
              title="Recenter Map on Player"
            >
              ◎ RECENTER ON OPERATIVE
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                className="cyber-btn"
                style={{ padding: '3px 9px', fontSize: '0.8rem' }}
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                className="cyber-btn"
                style={{ padding: '3px 9px', fontSize: '0.8rem' }}
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => {
                  setZoom(0.85);
                  setPan({ x: 0, y: 0 });
                }}
                className="cyber-btn"
                style={{ padding: '3px 8px', fontSize: '0.68rem' }}
                title="Reset View"
              >
                RESET
              </button>
            </div>
            <button
              onClick={handleClose}
              className="cyber-btn"
              style={{
                borderColor: 'var(--neon-magenta)',
                color: 'var(--neon-magenta)',
                fontWeight: 800,
              }}
            >
              CLOSE [ESC]
            </button>
          </div>
        </div>

        {/* Exploration Metric & Glowing Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--neon-cyan)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              EXPLORATION: <strong>{exploredPercent}%</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              ({exploredCount} / {totalChunks} SECTORS REVEALED)
            </span>
          </div>

          <div
            style={{
              flex: 1,
              height: 4,
              backgroundColor: 'rgba(0, 240, 255, 0.12)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(2, exploredPercent))}%`,
                height: '100%',
                backgroundColor: 'var(--neon-cyan)',
                boxShadow: '0 0 10px var(--neon-cyan)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['ALL', 'INTERIORS', 'LANDMARKS', 'TRANSIT'] as CategoryFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setCategoryFilter(tab);
                  AudioManager.getInstance().playUI('click');
                }}
                className="cyber-btn"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.65rem',
                  borderColor: categoryFilter === tab ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.15)',
                  backgroundColor: categoryFilter === tab ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                  color: categoryFilter === tab ? 'var(--neon-cyan)' : 'var(--text-muted)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Main Body: Vector Map + Details Side Panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Interactive SVG Map Container */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: '#040714',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        >
          {/* Transforming SVG Viewport */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              width: SVG_SIZE,
              height: SVG_SIZE,
              transition: isDragging ? 'none' : 'transform 0.08s ease-out',
            }}
          >
            <svg
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              style={{ display: 'block' }}
            >
              <defs>
                {/* Subtle Hexagon Pattern */}
                <pattern id="hexPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 40 10 L 40 30 L 20 40 L 0 30 L 0 10 Z"
                    fill="none"
                    stroke="rgba(0, 240, 255, 0.05)"
                    strokeWidth="0.8"
                  />
                </pattern>
                {/* Linear Glow for Active Route */}
                <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* 1. Render All 576 Chunks (Explored vs Shrouded Fog-of-War) */}
              {chunkTiles}

              {/* 2. Primary Arterial Avenues (Across entire 2.88km city) */}
              {/* North-South Central Spine (x = 0 -> svgX = 1200) */}
              <rect
                x={1192}
                y={0}
                width={16}
                height={SVG_SIZE}
                fill="#070c18"
                stroke="rgba(255, 170, 0, 0.4)"
                strokeWidth="1"
              />
              <line
                x1={1200}
                y1={0}
                x2={1200}
                y2={SVG_SIZE}
                stroke="#ffaa00"
                strokeWidth="1.5"
                strokeDasharray="8 6"
              />

              {/* East-West Cross Boulevard (z = 0 -> svgY = 1200) */}
              <rect
                x={0}
                y={1192}
                width={SVG_SIZE}
                height={16}
                fill="#070c18"
                stroke="rgba(0, 240, 255, 0.35)"
                strokeWidth="1"
              />
              <line
                x1={0}
                y1={1200}
                x2={SVG_SIZE}
                y2={1200}
                stroke="#00f0ff"
                strokeWidth="1.2"
                strokeDasharray="8 6"
              />

              {/* Central Plaza Monument Square (x: -90..90, z: -90..90) */}
              <rect
                x={1200 - 75}
                y={1200 - 75}
                width={150}
                height={150}
                fill="#0a152e"
                stroke="var(--neon-cyan)"
                strokeWidth="2"
                rx="6"
              />
              <circle
                cx={1200}
                cy={1200}
                r={40}
                fill="none"
                stroke="#ffaa00"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />

              {/* 3. Active Waypoint Route Line */}
              {navState.routeWaypoints.length > 1 && (
                <polyline
                  points={navState.routeWaypoints
                    .map((wp) => {
                      const p = worldToSvg(wp.x, wp.z);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="var(--neon-amber)"
                  strokeWidth="4"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#routeGlow)"
                />
              )}

              {/* 4. Landmark & Interior Destination Markers */}
              {filteredLandmarks.map((lm) => {
                const lp = worldToSvg(lm.position.x, lm.position.z);
                const isSelected = selectedLandmark?.id === lm.id;
                const isTarget = navState.activeLandmark?.id === lm.id;
                const isInterior =
                  lm.category === 'INTERIOR' ||
                  lm.category === 'LAB' ||
                  lm.category === 'LOUNGE' ||
                  lm.isEnterable;

                return (
                  <g
                    key={lm.id}
                    onClick={() => {
                      setSelectedLandmark(lm);
                      AudioManager.getInstance().playUI('click');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Pulsing Target Ring */}
                    {isTarget && (
                      <circle
                        cx={lp.x}
                        cy={lp.y}
                        r="24"
                        fill="none"
                        stroke="var(--neon-amber)"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Outer Selection Highlight Ring */}
                    {isSelected && (
                      <circle
                        cx={lp.x}
                        cy={lp.y}
                        r="18"
                        fill="none"
                        stroke="var(--neon-cyan)"
                        strokeWidth="2"
                      />
                    )}

                    {/* Distinct Pin Shape: Diamond for Interiors, Circle for Landmarks */}
                    {isInterior ? (
                      <rect
                        x={lp.x - 7}
                        y={lp.y - 7}
                        width="14"
                        height="14"
                        fill={isTarget ? 'var(--neon-amber)' : '#00ffaa'}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        transform={`rotate(45 ${lp.x} ${lp.y})`}
                      />
                    ) : (
                      <circle
                        cx={lp.x}
                        cy={lp.y}
                        r="8"
                        fill={isTarget ? 'var(--neon-amber)' : isSelected ? 'var(--neon-cyan)' : '#38bdf8'}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                    )}

                    {/* Landmark Name Label */}
                    <text
                      x={lp.x}
                      y={lp.y + 19}
                      textAnchor="middle"
                      fill={isTarget ? 'var(--neon-amber)' : '#ffffff'}
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      fontWeight="700"
                      stroke="#050811"
                      strokeWidth="2.5"
                      paintOrder="stroke"
                    >
                      {lm.name}
                    </text>
                  </g>
                );
              })}

              {/* 5. Player Operative Marker & Heading FOV Cone */}
              <g transform={`translate(${playerSvg.x}, ${playerSvg.y})`}>
                {/* Heading FOV Cone */}
                <g transform={`rotate(${headingDeg})`}>
                  <path
                    d="M 0 0 L -35 -85 A 90 90 0 0 1 35 -85 Z"
                    fill="rgba(0, 240, 255, 0.22)"
                    stroke="rgba(0, 240, 255, 0.4)"
                    strokeWidth="1"
                  />
                  <line x1="0" y1="0" x2="0" y2="-90" stroke="var(--neon-cyan)" strokeWidth="1.5" strokeDasharray="3 3" />
                </g>

                {/* Player Radar Aura Ring */}
                <circle r="22" fill="none" stroke="var(--neon-cyan)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                <circle r="12" fill="rgba(0, 240, 255, 0.3)" />

                {/* Player Directional Chevron */}
                <polygon
                  points="0,-10 6,7 0,3 -6,7"
                  fill="var(--neon-cyan)"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  transform={`rotate(${headingDeg})`}
                />

                <text
                  x="0"
                  y="24"
                  textAnchor="middle"
                  fill="var(--neon-cyan)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                  stroke="#050811"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  YOU [OPERATIVE]
                </text>
              </g>
            </svg>
          </div>

          {/* Minimap Compass Rose Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              backgroundColor: 'rgba(5, 10, 24, 0.85)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: 6,
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div>
              HEADING: <strong style={{ color: 'var(--neon-cyan)' }}>{Math.round(headingDeg)}°</strong>
            </div>
            <div>
              MAP ZOOM: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(zoom * 100)}%</strong>
            </div>
            <div style={{ color: 'var(--neon-amber)' }}>DRAG TO PAN • SCROLL TO ZOOM</div>
          </div>
        </div>

        {/* Right Side: Landmark Inspector & Action Card */}
        <div
          style={{
            width: 380,
            borderLeft: '1px solid rgba(0, 240, 255, 0.2)',
            backgroundColor: 'rgba(5, 10, 24, 0.96)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
          }}
        >
          {selectedLandmark ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Category & Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    backgroundColor:
                      selectedLandmark.category === 'INTERIOR' || selectedLandmark.isEnterable
                        ? 'rgba(0, 255, 170, 0.15)'
                        : 'rgba(0, 240, 255, 0.15)',
                    color:
                      selectedLandmark.category === 'INTERIOR' || selectedLandmark.isEnterable
                        ? '#00ffaa'
                        : 'var(--neon-cyan)',
                    padding: '2px 8px',
                    borderRadius: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {selectedLandmark.category}
                </span>

                {selectedLandmark.isEnterable && (
                  <span style={{ color: '#00ffaa', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    ● ENTERABLE INTERIOR
                  </span>
                )}
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.3rem',
                  letterSpacing: '1px',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {selectedLandmark.name}
              </h3>

              {/* Distance & Traversal ETA */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    DISTANCE
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>
                    {selectedDist}m
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    EST. TRAVERSAL
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--neon-amber)', fontWeight: 800 }}>
                    ~{selectedEta}s
                  </div>
                </div>
              </div>

              {/* Description */}
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {selectedLandmark.description}
              </p>

              {/* Coordinates Readout */}
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: 8,
                }}
              >
                COORDINATES: [{selectedLandmark.position.x.toFixed(0)}, {selectedLandmark.position.z.toFixed(0)}]
              </div>

              {/* Active Route Notice */}
              {navState.activeLandmark?.id === selectedLandmark.id && (
                <div
                  style={{
                    backgroundColor: 'rgba(255, 170, 0, 0.12)',
                    border: '1px solid rgba(255, 170, 0, 0.4)',
                    padding: '8px 12px',
                    borderRadius: 4,
                    color: 'var(--neon-amber)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  ▶ ACTIVE GUIDANCE ROUTE ENGAGED
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                textAlign: 'center',
              }}
            >
              CLICK ANY LANDMARK OR INTERIOR ON THE BLUEPRINT TO INSPECT
            </div>
          )}

          {/* Action Buttons: Set Route, Fast Travel, Clear */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {selectedLandmark && (
              <>
                <button
                  onClick={() => handleSelectDestination(selectedLandmark)}
                  className="cyber-btn cyber-btn-primary"
                  style={{ padding: '10px 14px', fontSize: '0.82rem', width: '100%', fontWeight: 800 }}
                >
                  {navState.activeLandmark?.id === selectedLandmark.id
                    ? '✓ ROUTE WAYPOINT ACTIVE'
                    : 'SET WAYPOINT GUIDANCE ROUTE'}
                </button>

                <button
                  onClick={() => handleFastTravel(selectedLandmark)}
                  className="cyber-btn"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    width: '100%',
                    color: '#00ffaa',
                    borderColor: 'rgba(0, 255, 170, 0.5)',
                  }}
                  title="Instantly Teleport to Destination"
                >
                  ⚡ FAST TRAVEL // WARP TO LOCATION
                </button>
              </>
            )}

            {navState.activeLandmark && (
              <button
                onClick={handleClearDestination}
                className="cyber-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.72rem',
                  width: '100%',
                  borderColor: 'var(--neon-magenta)',
                  color: 'var(--neon-magenta)',
                }}
              >
                CANCEL NAVIGATION ROUTE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
