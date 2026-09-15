import React, { useEffect, useState } from 'react';
import { InteriorState } from '../world/InteriorManager';

interface InteriorTransitionOverlayProps {
  interiorState: InteriorState;
}

export const InteriorTransitionOverlay: React.FC<InteriorTransitionOverlayProps> = ({ interiorState }) => {
  const isTransitioning =
    interiorState.worldMode === 'INTERIOR_TRANSITION_IN' ||
    interiorState.worldMode === 'INTERIOR_TRANSITION_OUT' ||
    interiorState.isTransitioning;

  const [visible, setVisible] = useState(isTransitioning);
  const [opacity, setOpacity] = useState(isTransitioning ? 1 : 0);

  useEffect(() => {
    if (isTransitioning) {
      setVisible(true);
      // Small timeout to allow DOM insertion before transition
      requestAnimationFrame(() => setOpacity(1));
    } else {
      setOpacity(0);
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  if (!visible) return null;

  const isTransitionIn = interiorState.worldMode === 'INTERIOR_TRANSITION_IN' || interiorState.current !== 'NONE';
  const header = isTransitionIn
    ? 'SYNCHRONIZING INTERIOR ENVIRONMENT'
    : 'DECOUPLING SECTOR MATRIX';
  const subtext = isTransitionIn
    ? (interiorState.name || 'FACILITY PORTAL') + (interiorState.currentFloor ? ` // FLOOR ${interiorState.currentFloor}` : '')
    : 'RETURNING TO METROPOLITAN GRID';
  const detail = isTransitionIn
    ? 'PORTAL LOCK: ACTIVE // KINEMATIC RIG BOUND'
    : 'STREAMING CHUNKS // RESTORING SKYLINE';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#040711',
        zIndex: 9999,
        opacity,
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isTransitioning ? 'all' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        color: '#e0f2fe',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* Cyber Grid Lines Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* Cyber Scanning Bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '40%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #00f0ff, #ff0055, transparent)',
          boxShadow: '0 0 15px #00f0ff',
          opacity: 0.6,
        }}
      />

      {/* Center Modal Block */}
      <div
        style={{
          position: 'relative',
          padding: '28px 48px',
          background: 'rgba(7, 16, 32, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          borderRadius: 4,
          boxShadow: '0 0 35px rgba(0, 240, 255, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          maxWidth: '90vw',
          textAlign: 'center',
        }}
      >
        {/* Hexagonal pulse icon / ring */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '2px solid #00f0ff',
            borderTopColor: '#ff0055',
            animation: 'spin 1s linear infinite',
            boxShadow: '0 0 16px rgba(0, 240, 255, 0.5)',
          }}
        />

        <div
          style={{
            fontSize: '0.75rem',
            letterSpacing: '3px',
            color: '#00f0ff',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          {header}
        </div>

        <div
          style={{
            fontSize: '1.25rem',
            letterSpacing: '2px',
            color: '#ffffff',
            fontWeight: 900,
            fontFamily: 'var(--font-display, sans-serif)',
            textShadow: '0 0 12px rgba(255, 255, 255, 0.5)',
          }}
        >
          {subtext}
        </div>

        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '1.5px',
            color: 'rgba(224, 242, 254, 0.65)',
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
};
