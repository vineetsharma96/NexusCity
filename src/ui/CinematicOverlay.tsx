import React, { useEffect, useState } from 'react';
import { CinematicManager, CinematicState } from '../cinematics/CinematicManager';

export const CinematicOverlay: React.FC = () => {
  const [cinematic, setCinematic] = useState<CinematicState>(() => CinematicManager.getInstance().getState());

  useEffect(() => {
    return CinematicManager.getInstance().subscribe(setCinematic);
  }, []);

  if (
    cinematic.phase !== 'CINEMATIC_INTRO' &&
    cinematic.phase !== 'TRANSITION_TO_PLAYER' &&
    cinematic.phase !== 'VISTA_MODE'
  ) {
    return null;
  }

  const isTransitioning = cinematic.phase === 'TRANSITION_TO_PLAYER';
  const isVista = cinematic.phase === 'VISTA_MODE';

  if (isVista) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 5000,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '20px 24px',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '10px 16px',
            borderLeft: '3px solid var(--neon-amber)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              letterSpacing: '0.16em',
              color: 'var(--neon-amber)',
              fontWeight: 600,
            }}
          >
            AERIAL ORBIT // LIVE TELEMETRY
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.92rem',
              color: 'var(--text-primary)',
              marginTop: 2,
            }}
          >
            {cinematic.caption}
          </div>
        </div>
        <button
          onClick={() => CinematicManager.getInstance().skip()}
          className="cyber-btn"
          style={{
            pointerEvents: 'auto',
            padding: '8px 14px',
            fontSize: '0.72rem',
          }}
        >
          RESUME GROUND CONTROL [V]
        </button>
      </div>
    );
  }

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
        transition: 'opacity 0.55s ease',
        opacity: isTransitioning ? 0.55 : 1.0,
      }}
    >
      {/* Top Architectural Letterbox Bar */}
      <div
        className="cinematic-bar"
        style={{
          height: '68px',
          backgroundColor: 'rgba(7, 9, 14, 0.94)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 28px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--neon-amber)',
              boxShadow: '0 0 10px var(--neon-amber)',
              animation: 'pulse 1.4s infinite ease-in-out',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              letterSpacing: '0.18em',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            NEXUS ARCHITECTURAL RECON // ORBITAL TELEMETRY
          </span>
        </div>

        {cinematic.canSkip && (
          <button
            onClick={() => CinematicManager.getInstance().skip()}
            className="cyber-btn cyber-btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>ENTER METROPOLIS</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* Lower-Third Editorial Caption Frame */}
      <div
        className="cinematic-caption"
        style={{
          padding: '0 32px 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <div
          className="glass-panel"
          style={{
            borderLeft: '3px solid var(--neon-amber)',
            padding: '16px 24px',
            maxWidth: '620px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--neon-amber)',
              letterSpacing: '0.18em',
              marginBottom: '6px',
              fontWeight: 600,
            }}
          >
            SECTOR SCAN // REAL-TIME PROCEDURAL STREAM
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '0.06em',
              marginBottom: '4px',
            }}
          >
            {cinematic.caption}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
            }}
          >
            {cinematic.subcaption}
          </div>
        </div>
      </div>

      {/* Bottom Letterbox Bar */}
      <div
        className="cinematic-bar"
        style={{
          height: '64px',
          backgroundColor: 'rgba(7, 9, 14, 0.94)',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 28px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.14em',
          }}
        >
          GRID MATRIX 24×24 • SEED #847291
        </div>

        <div
          style={{
            width: '200px',
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, cinematic.progress * 100)}%`,
              backgroundColor: 'var(--neon-cyan)',
              boxShadow: '0 0 10px var(--neon-cyan)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
};
