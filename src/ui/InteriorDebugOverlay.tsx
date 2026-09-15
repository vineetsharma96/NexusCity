import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { InteriorManager, InteriorState } from '../world/InteriorManager';
import { INTERIOR_DESTINATIONS, InteriorDestination } from '../world/InteriorDestinations';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

interface InteriorDebugOverlayProps {
  interiorState: InteriorState;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const InteriorDebugOverlay: React.FC<InteriorDebugOverlayProps> = ({
  interiorState,
  playerPosRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [boxCount, setBoxCount] = useState(0);

  useEffect(() => {
    const handleToggle = (e: KeyboardEvent) => {
      // Toggle debug panel with F8 or Shift+I
      if (e.code === 'F8' || (e.shiftKey && e.code === 'KeyI')) {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleToggle);
    return () => window.removeEventListener('keydown', handleToggle);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (playerPosRef.current) {
        setPos({
          x: Math.round(playerPosRef.current.x * 10) / 10,
          y: Math.round(playerPosRef.current.y * 10) / 10,
          z: Math.round(playerPosRef.current.z * 10) / 10,
        });
      }
      setBoxCount(KinematicCollisionSolver.getAllBoxes().length);
    }, 200);
    return () => clearInterval(interval);
  }, [isOpen, playerPosRef]);

  const modeColor =
    interiorState.worldMode === 'WORLD_ACTIVE'
      ? '#00ffaa'
      : interiorState.worldMode === 'INTERIOR_ACTIVE'
      ? '#00f0ff'
      : '#ffaa00';

  const destinationList = Object.entries(INTERIOR_DESTINATIONS);

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 80,
        zIndex: 9900,
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.72rem',
      }}
    >
      {/* Toggle Pill Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: 'rgba(5, 12, 24, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          color: isOpen ? '#00f0ff' : 'rgba(224, 242, 254, 0.6)',
          padding: '4px 8px',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        }}
        title="Toggle Interior Debug Panel (F8)"
      >
        <span style={{ color: modeColor }}>●</span>
        <span>DEBUG: {interiorState.worldMode}</span>
        <span style={{ opacity: 0.5 }}>[F8]</span>
      </button>

      {/* Expanded Debug Panel */}
      {isOpen && (
        <div
          style={{
            marginTop: 6,
            background: 'rgba(4, 8, 18, 0.95)',
            border: '1px solid rgba(0, 240, 255, 0.5)',
            borderRadius: 6,
            padding: '12px 16px',
            width: 320,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
            color: '#e0f2fe',
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
              paddingBottom: 6,
              marginBottom: 8,
              fontWeight: 800,
              color: '#00f0ff',
            }}
          >
            <span>INTERIOR SYSTEM MONITOR</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ff0055',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 8px' }}>
            <span style={{ opacity: 0.6 }}>WORLD MODE:</span>
            <strong style={{ color: modeColor }}>{interiorState.worldMode}</strong>

            <span style={{ opacity: 0.6 }}>INTERIOR ID:</span>
            <span>{interiorState.current}</span>

            <span style={{ opacity: 0.6 }}>NAME:</span>
            <span style={{ color: '#fff' }}>{interiorState.name || 'None (Exterior)'}</span>

            <span style={{ opacity: 0.6 }}>FLOOR:</span>
            <span>{interiorState.currentFloor} / 2</span>

            <span style={{ opacity: 0.6 }}>PLAYER POS:</span>
            <span>{pos.x}, {pos.y}, {pos.z}</span>

            <span style={{ opacity: 0.6 }}>COLLIDERS:</span>
            <span>{boxCount} active</span>

            <span style={{ opacity: 0.6 }}>MINIMAP:</span>
            <span style={{ color: interiorState.worldMode === 'WORLD_ACTIVE' ? '#00ffaa' : '#ff0055' }}>
              {interiorState.worldMode === 'WORLD_ACTIVE' ? 'ACTIVE' : 'HIDDEN'}
            </span>

            <span style={{ opacity: 0.6 }}>EXTERIOR GRID:</span>
            <span style={{ color: interiorState.worldMode === 'WORLD_ACTIVE' ? '#00ffaa' : '#ffaa00' }}>
              {interiorState.worldMode === 'WORLD_ACTIVE' ? 'STREAMING' : 'SUSPENDED'}
            </span>
          </div>

          {/* Quick Teleport Tester */}
          <div style={{ marginTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 8 }}>
            <div style={{ fontSize: '0.68rem', opacity: 0.6, marginBottom: 4 }}>TEST TELEPORT:</div>
            <select
              style={{
                width: '100%',
                background: '#071020',
                border: '1px solid #00f0ff',
                color: '#e0f2fe',
                padding: '4px 6px',
                borderRadius: 4,
                fontSize: '0.7rem',
                marginBottom: 6,
              }}
              onChange={(e) => {
                const targetKey = e.target.value;
                if (!targetKey) return;
                const dest = INTERIOR_DESTINATIONS[targetKey];
                if (dest) {
                  InteriorManager.getInstance().enterDestination(
                    targetKey,
                    playerPosRef.current.clone(),
                    (spawnPos) => {
                      if (playerPosRef.current) {
                        playerPosRef.current.copy(spawnPos);
                      }
                    }
                  );
                }
              }}
              value=""
            >
              <option value="" disabled>-- Warp to Facility --</option>
              {destinationList.map(([key, dest]: [string, InteriorDestination]) => (
                <option key={key} value={key}>
                  {dest.name} ({dest.district})
                </option>
              ))}
            </select>

            {interiorState.worldMode !== 'WORLD_ACTIVE' && (
              <button
                onClick={() => {
                  InteriorManager.getInstance().exit((exitPos) => {
                    if (playerPosRef.current) {
                      playerPosRef.current.copy(exitPos);
                    }
                  });
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255, 0, 85, 0.2)',
                  border: '1px solid #ff0055',
                  color: '#ff0055',
                  padding: '4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              >
                FORCED EXIT TO STREET
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
