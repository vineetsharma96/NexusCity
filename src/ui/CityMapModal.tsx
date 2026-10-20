import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Landmark, NavigationState, NavigationSystem } from '../map/NavigationSystem';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { DistrictGenerator } from '../city/DistrictGenerator';
import { AudioManager } from '../audio/AudioManager';
import { useModalFocus } from './useModalFocus';

interface CityMapModalProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

type CategoryFilter = 'ALL' | 'LANDMARKS' | 'TRANSIT';

export const CityMapModal: React.FC<CityMapModalProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() => NavigationSystem.getInstance().getState());
  const [chunkState, setChunkState] = useState<ChunkManagerState>(() => ChunkManager.getInstance().getState());
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(
    navState.activeLandmark || NavigationSystem.getInstance().landmarks[0]
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const [playerCoord, setPlayerCoord] = useState({ x: 0, z: 0 });
  const [headingDeg, setHeadingDeg] = useState(0);
  const mapRef = useModalFocus(navState.isMapOpen, () => NavigationSystem.getInstance().setMapOpen(false));

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

  useEffect(() => {
    if (!navState.isMapOpen) return;
    const dir = new THREE.Vector3();
    const updateTelemetry = () => {
      if (playerPosRef?.current) {
        const x = Math.round(playerPosRef.current.x);
        const z = Math.round(playerPosRef.current.z);
        setPlayerCoord((prev) => (prev.x === x && prev.z === z ? prev : { x, z }));
      }
      const cam = (window as unknown as { __NEXUS_CAMERA__?: THREE.Camera }).__NEXUS_CAMERA__;
      if (cam) {
        cam.getWorldDirection(dir);
        let deg = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
        if (deg < 0) deg += 360;
        setHeadingDeg((prev) => (Math.abs(prev - deg) < 0.5 ? prev : deg));
      }
    };
    updateTelemetry();
    const interval = setInterval(updateTelemetry, 100);
    return () => clearInterval(interval);
  }, [navState.isMapOpen, playerPosRef]);

  if (!navState.isMapOpen) return null;

  const WORLD_EXTENT = 2880;
  const SVG_SIZE = 2400;
  const CHUNK_SVG_SIZE = SVG_SIZE / 24;

  const worldToSvg = (x: number, z: number) => ({
    x: ((x + 1440) / WORLD_EXTENT) * SVG_SIZE,
    y: ((z + 1440) / WORLD_EXTENT) * SVG_SIZE,
  });

  const pPos = playerPosRef.current;
  const playerSvg = worldToSvg(pPos.x, pPos.z);

  const handleClose = () => {
    AudioManager.getInstance().playUI('close');
    NavigationSystem.getInstance().setMapOpen(false);
  };

  const handleSelectDestination = (landmark: Landmark) => {
    AudioManager.getInstance().playUI('waypoint');
    NavigationSystem.getInstance().setDestination(landmark.id, playerPosRef.current);
  };

  const handleClearDestination = () => {
    AudioManager.getInstance().playUI('click');
    NavigationSystem.getInstance().setDestination(null);
  };

  const handleFastTravel = (landmark: Landmark) => {
    AudioManager.getInstance().playDiscoveryChime();
    window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: landmark.position.clone() }));
    handleClose();
  };

  const handleCenterOnPlayer = () => {
    AudioManager.getInstance().playUI('click');
    const centerOffset = SVG_SIZE / 2;
    setPan({
      x: (centerOffset - playerSvg.x) * 1.1,
      y: (centerOffset - playerSvg.y) * 1.1,
    });
    setZoom(1.1);
  };

  const handleMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('[role="button"]'))) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: panStartRef.current.x + (e.clientX - dragStartRef.current.x),
      y: panStartRef.current.y + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev + zoomDelta)));
  };

  const allLandmarks = NavigationSystem.getInstance().landmarks;
  const filteredLandmarks = allLandmarks.filter((lm) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'TRANSIT') return lm.category === 'TRANSIT' || lm.category === 'INFRASTRUCTURE';
    return lm.category === 'TOWER' || lm.category === 'PLAZA' || lm.category === 'ARCADE';
  });

  const selectedDist = selectedLandmark ? Math.round(pPos.distanceTo(selectedLandmark.position)) : 0;
  const selectedEta = Math.round(selectedDist / 6.8);
  const exploredPercent = chunkState.exploredPercent;
  const exploredCount = chunkState.discoveredChunks.size;

  const chunkTiles: React.ReactNode[] = [];
  const r = ChunkManager.GRID_RADIUS;
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
            <>
              <rect
                x={tileX}
                y={tileY}
                width={CHUNK_SVG_SIZE}
                height={CHUNK_SVG_SIZE}
                fill={district.accentColor}
                fillOpacity="0.09"
                stroke="rgba(56, 189, 248, 0.14)"
                strokeWidth="0.8"
              />
              <line
                x1={tileX}
                y1={tileY + CHUNK_SVG_SIZE / 2}
                x2={tileX + CHUNK_SVG_SIZE}
                y2={tileY + CHUNK_SVG_SIZE / 2}
                stroke="rgba(56, 189, 248, 0.08)"
                strokeWidth="0.7"
                strokeDasharray="2 2"
              />
              <line
                x1={tileX + CHUNK_SVG_SIZE / 2}
                y1={tileY}
                x2={tileX + CHUNK_SVG_SIZE / 2}
                y2={tileY + CHUNK_SVG_SIZE}
                stroke="rgba(56, 189, 248, 0.08)"
                strokeWidth="0.7"
                strokeDasharray="2 2"
              />
            </>
          ) : (
            <rect
              x={tileX}
              y={tileY}
              width={CHUNK_SVG_SIZE}
              height={CHUNK_SVG_SIZE}
              fill="#05070c"
              fillOpacity="0.9"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="0.6"
            />
          )}
        </g>
      );
    }
  }

  return (
    <div
      ref={mapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="city-map-title"
      tabIndex={-1}
      className="city-map"
      data-component="CityMapModalContainer"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 9, 14, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 160,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Top Cartographic Bar */}
      <div
        className="city-map-header"
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          backgroundColor: 'rgba(11, 15, 25, 0.92)',
        }}
      >
        <div
          className="city-map-toolbar"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
        >
          <div className="city-map-title-row" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h2
              id="city-map-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              METROPOLITAN ATLAS
            </h2>
            <span className="cyber-badge">SECTOR MATRIX 24×24</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              COORDINATES [{playerCoord.x >= 0 ? `+${playerCoord.x}` : playerCoord.x},{' '}
              {playerCoord.z >= 0 ? `+${playerCoord.z}` : playerCoord.z}]
            </span>
          </div>

          <div className="city-map-actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={handleCenterOnPlayer} className="cyber-btn" style={{ fontSize: '0.7rem', padding: '5px 10px' }}>
              ◎ RECENTER
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                className="cyber-btn"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                className="cyber-btn"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                aria-label="Zoom out"
              >
                -
              </button>
              <button
                onClick={() => {
                  setZoom(0.85);
                  setPan({ x: 0, y: 0 });
                }}
                className="cyber-btn"
                style={{ padding: '4px 9px', fontSize: '0.68rem' }}
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

        {/* Exploration Progress & Category Filter */}
        <div className="city-map-metrics" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--neon-amber)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              SURVEYED: <strong>{exploredPercent}%</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>({exploredCount} / 576 SECTORS)</span>
          </div>

          <div
            style={{
              flex: 1,
              height: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, exploredPercent))}%`,
                height: '100%',
                backgroundColor: 'var(--neon-amber)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {(['ALL', 'LANDMARKS', 'TRANSIT'] as CategoryFilter[]).map((tab) => (
              <button
                key={tab}
                aria-pressed={categoryFilter === tab}
                onClick={() => {
                  setCategoryFilter(tab);
                  AudioManager.getInstance().playUI('click');
                }}
                className="cyber-btn"
                style={{
                  padding: '3px 9px',
                  fontSize: '0.65rem',
                  borderColor: categoryFilter === tab ? 'var(--neon-cyan)' : 'var(--border-subtle)',
                  color: categoryFilter === tab ? 'var(--neon-cyan)' : 'var(--text-muted)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="city-map-body" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Interactive Vector Canvas */}
        <div
          className="city-map-viewport"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: '#05070c',
            touchAction: 'none',
          }}
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerCancel={handleMouseUp}
          onLostPointerCapture={handleMouseUp}
          onWheel={handleWheel}
        >
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
            <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{ display: 'block' }}>
              {chunkTiles}

              {/* North-South & East-West Arterial Axes */}
              <rect
                x={1192}
                y={0}
                width={16}
                height={SVG_SIZE}
                fill="#090d16"
                stroke="rgba(245, 158, 11, 0.35)"
                strokeWidth="1"
              />
              <rect
                x={0}
                y={1192}
                width={SVG_SIZE}
                height={16}
                fill="#090d16"
                stroke="rgba(56, 189, 248, 0.35)"
                strokeWidth="1"
              />

              {/* Central Civic Core */}
              <rect
                x={1125}
                y={1125}
                width={150}
                height={150}
                fill="rgba(15, 23, 42, 0.65)"
                stroke="var(--neon-cyan)"
                strokeWidth="1.5"
                rx="4"
              />

              {/* Active Wayfinding Polyline */}
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
                  strokeWidth="3.5"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Landmarks */}
              {filteredLandmarks.map((lm) => {
                const lp = worldToSvg(lm.position.x, lm.position.z);
                const isSelected = selectedLandmark?.id === lm.id;
                const isTarget = navState.activeLandmark?.id === lm.id;

                return (
                  <g
                    key={lm.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${lm.name}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedLandmark(lm);
                      }
                    }}
                    onClick={() => {
                      setSelectedLandmark(lm);
                      AudioManager.getInstance().playUI('click');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {isTarget && (
                      <circle
                        cx={lp.x}
                        cy={lp.y}
                        r="22"
                        fill="none"
                        stroke="var(--neon-amber)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )}
                    {isSelected && (
                      <circle cx={lp.x} cy={lp.y} r="16" fill="none" stroke="var(--neon-cyan)" strokeWidth="1.8" />
                    )}
                    <circle
                      cx={lp.x}
                      cy={lp.y}
                      r="7"
                      fill={isTarget ? 'var(--neon-amber)' : isSelected ? 'var(--neon-cyan)' : lm.color}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                    {isSelected && (
                      <text
                        x={lp.x}
                        y={lp.y - 22}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                        fontWeight="600"
                        stroke="#07090e"
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        {lm.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Operative Marker */}
              <g transform={`translate(${playerSvg.x}, ${playerSvg.y})`}>
                <g transform={`rotate(${headingDeg})`}>
                  <path
                    d="M 0 0 L -32 -80 A 85 85 0 0 1 32 -80 Z"
                    fill="rgba(56, 189, 248, 0.18)"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="1"
                  />
                </g>
                <circle r="18" fill="none" stroke="var(--neon-cyan)" strokeWidth="1.2" strokeDasharray="3 3" />
                <polygon
                  points="0,-9 6,7 0,3 -6,7"
                  fill="var(--neon-cyan)"
                  stroke="#ffffff"
                  strokeWidth="1"
                  transform={`rotate(${headingDeg})`}
                />
              </g>
            </svg>
          </div>

          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              padding: '8px 12px',
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
              ZOOM: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(zoom * 100)}%</strong>
            </div>
          </div>
        </div>

        {/* Landmark Inspector Sidebar */}
        <div
          className="city-map-inspector"
          style={{
            width: 340,
            flexShrink: 0,
            borderLeft: '1px solid var(--border-glass)',
            backgroundColor: 'rgba(11, 15, 25, 0.96)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
          }}
        >
          <label className="map-landmark-picker">
            <span className="section-heading">Select sector landmark</span>
            <select
              className="cyber-select"
              value={selectedLandmark?.id ?? ''}
              onChange={(event) =>
                setSelectedLandmark(allLandmarks.find((landmark) => landmark.id === event.target.value) ?? null)
              }
            >
              {allLandmarks.map((landmark) => (
                <option key={landmark.id} value={landmark.id}>
                  {landmark.name}
                </option>
              ))}
            </select>
          </label>

          {selectedLandmark && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="cyber-badge">{selectedLandmark.category}</span>
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {selectedLandmark.name}
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  backgroundColor: 'var(--raised)',
                  padding: '10px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Distance
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      color: 'var(--neon-cyan)',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {selectedDist}m
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Est. walk
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      color: 'var(--neon-amber)',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ~{selectedEta}s
                  </div>
                </div>
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.84rem',
                  lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {selectedLandmark.description}
              </p>

              <div
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 8,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Grid ref: [{selectedLandmark.position.x.toFixed(0)}, {selectedLandmark.position.z.toFixed(0)}]
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
            {selectedLandmark && (
              <>
                <button
                  onClick={() => handleSelectDestination(selectedLandmark)}
                  aria-pressed={navState.activeLandmark?.id === selectedLandmark.id}
                  className="cyber-btn cyber-btn-primary"
                  style={{ padding: '10px 14px', fontSize: '0.76rem', width: '100%' }}
                >
                  {navState.activeLandmark?.id === selectedLandmark.id
                    ? 'WAYFINDING RIBBON ENGAGED'
                    : 'PLOT WAYFINDING RIBBON'}
                </button>

                <button
                  onClick={() => handleFastTravel(selectedLandmark)}
                  className="cyber-btn"
                  style={{
                    padding: '9px 14px',
                    fontSize: '0.74rem',
                    width: '100%',
                    color: 'var(--neon-emerald)',
                    borderColor: 'rgba(16, 185, 129, 0.45)',
                  }}
                >
                  FAST TRAVEL TO SECTOR
                </button>
              </>
            )}

            {navState.activeLandmark && (
              <button
                onClick={handleClearDestination}
                className="cyber-btn"
                style={{
                  padding: '7px 12px',
                  fontSize: '0.7rem',
                  width: '100%',
                  borderColor: 'var(--neon-magenta)',
                  color: 'var(--neon-magenta)',
                }}
              >
                CLEAR ACTIVE ROUTE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
