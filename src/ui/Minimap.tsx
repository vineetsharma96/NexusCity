import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { NavigationSystem, NavigationState } from '../map/NavigationSystem';

interface MinimapProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const Minimap: React.FC<MinimapProps> = ({ playerPosRef }) => {
  const [navState, setNavState] = useState<NavigationState>(() =>
    NavigationSystem.getInstance().getState()
  );

  useEffect(() => {
    return NavigationSystem.getInstance().subscribe(setNavState);
  }, []);

  // Sync player position with NavigationSystem periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerPosRef?.current) {
        NavigationSystem.getInstance().updatePlayerPosition(playerPosRef.current);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [playerPosRef]);

  const handleToggleMap = () => {
    NavigationSystem.getInstance().toggleMap();
  };

  return (
    <div
      className="glass-panel minimap-panel"
      style={{
        position: 'absolute',
        top: 80,
        right: 20,
        zIndex: 30,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 200,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          NAVIGATION RADAR
        </span>
        <button
          onClick={handleToggleMap}
          className="cyber-btn"
          style={{ padding: '2px 8px', fontSize: '0.68rem' }}
        >
          MAP [M]
        </button>
      </div>

      {/* Target Destination & Distance Readout */}
      {navState.activeLandmark ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.82rem',
              color: 'var(--neon-cyan)',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: 'var(--neon-amber)' }}>▶</span>
            <span>{navState.activeLandmark.name.toUpperCase()}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--neon-amber)', fontWeight: 700 }}>
            DISTANCE: {navState.distance}m
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          NO ACTIVE ROUTE // PRESS [M]
        </div>
      )}
    </div>
  );
};
