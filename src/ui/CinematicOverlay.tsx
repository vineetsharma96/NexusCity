import React, { useState, useEffect } from 'react';
import { CinematicManager, CinematicState } from '../cinematics/CinematicManager';

export const CinematicOverlay: React.FC = () => {
  const [cinematic, setCinematic] = useState<CinematicState>(() =>
    CinematicManager.getInstance().getState()
  );

  useEffect(() => {
    return CinematicManager.getInstance().subscribe(setCinematic);
  }, []);

  if (cinematic.phase !== 'CINEMATIC_INTRO' && cinematic.phase !== 'TRANSITION_TO_PLAYER') {
    return null;
  }

  const isTransitioning = cinematic.phase === 'TRANSITION_TO_PLAYER';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'opacity 0.6s ease',
        opacity: isTransitioning ? 0.6 : 1.0,
      }}
    >
      {/* Top Cinematic Letterbox Bar */}
      <div
        style={{
          height: '75px',
          backgroundColor: '#040711',
          borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 32px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ff0055',
              boxShadow: '0 0 10px #ff0055',
              animation: 'pulse 1.2s infinite ease-in-out',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.82rem',
              letterSpacing: '2px',
              color: '#00f0ff',
              fontWeight: 700,
            }}
          >
            REC // ORBITAL DRONE CAMERA
          </span>
        </div>

        {/* Prominent SKIP INTRO Button */}
        {cinematic.canSkip && (
          <button
            onClick={() => CinematicManager.getInstance().skip()}
            style={{
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid #00f0ff',
              color: '#ffffff',
              padding: '8px 24px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '2px',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(0, 240, 255, 0.4)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.3)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(0, 240, 255, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.4)';
            }}
          >
            <span>SKIP INTRO</span>
            <span style={{ color: '#ff007f' }}>⏭</span>
          </button>
        )}
      </div>

      {/* Center Cinematic Grid Overlay Elements */}
      <div
        style={{
          position: 'relative',
          padding: '0 40px 10px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(4, 8, 20, 0.75)',
            borderLeft: '4px solid #00f0ff',
            padding: '16px 24px',
            borderRadius: '0 8px 8px 0',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.6)',
            maxWidth: '640px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              color: '#ff007f',
              letterSpacing: '2px',
              marginBottom: '6px',
              fontWeight: 700,
            }}
          >
            AUTOMATED RECON // ARCHITECTURE SCAN
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: '1.45rem',
              color: '#ffffff',
              letterSpacing: '3px',
              textShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
              marginBottom: '4px',
            }}
          >
            {cinematic.caption}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.85rem',
              color: '#94a3b8',
              letterSpacing: '1px',
            }}
          >
            {cinematic.subcaption}
          </div>
        </div>
      </div>

      {/* Bottom Cinematic Letterbox Bar */}
      <div
        style={{
          height: '75px',
          backgroundColor: '#040711',
          borderTop: '1px solid rgba(0, 240, 255, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 32px',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.78rem',
            color: '#64748b',
            letterSpacing: '1.5px',
          }}
        >
          COORDINATES // [35°41&apos;N, 139°41&apos;E] • SEED #847291
        </div>

        {/* Progress track */}
        <div
          style={{
            width: '200px',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, cinematic.progress * 100)}%`,
              backgroundColor: '#00f0ff',
              boxShadow: '0 0 8px #00f0ff',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
};
