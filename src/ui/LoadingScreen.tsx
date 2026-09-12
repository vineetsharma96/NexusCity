import React, { useState, useEffect } from 'react';
import { CinematicManager } from '../cinematics/CinematicManager';

export const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('INITIALIZING PROCEDURAL CORE...');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const steps = [
      { at: 15, text: 'SEED #847291 // METROPOLITAN GRID 3,000M' },
      { at: 35, text: 'STREAMING 11 PROCEDURAL BUILDING INTERIORS...' },
      { at: 55, text: 'COMPILING REALTIME SHADERS & VIDEO BILLBOARDS...' },
      { at: 75, text: 'SYNCHRONIZING TRAFFIC Gantries & PEDESTRIAN PATHS...' },
      { at: 90, text: 'ATMOSPHERIC WIND & VOLUMETRIC CLOUDS ONLINE...' },
      { at: 100, text: 'NEXUS SYSTEM OPERATIONAL. ENTERING METROPOLIS.' },
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, prev + Math.floor(Math.random() * 8) + 5);
        for (const s of steps) {
          if (next >= s.at) {
            setStatusText(s.text);
          }
        }
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDone(true);
            CinematicManager.getInstance().finishLoading();
          }, 450);
        }
        return next;
      });
    }, 70);

    return () => clearInterval(interval);
  }, []);

  if (isDone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#040711',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        color: '#00f0ff',
        fontFamily: 'var(--font-mono, monospace)',
        userSelect: 'none',
      }}
    >
      {/* Background cyber grid scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.08) 0%, transparent 70%), linear-gradient(rgba(0, 240, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '560px',
          width: '100%',
          backgroundColor: 'rgba(8, 14, 28, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          borderRadius: '8px',
          padding: '36px 32px',
          boxShadow: '0 0 40px rgba(0, 240, 255, 0.25)',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            letterSpacing: '3px',
            color: '#ff007f',
            marginBottom: '8px',
            fontWeight: 700,
          }}
        >
          SYS.BOOT // KERNEL v4.8
        </div>

        <h1
          style={{
            fontSize: '2rem',
            margin: '0 0 16px 0',
            letterSpacing: '4px',
            fontFamily: 'var(--font-display, sans-serif)',
            color: '#ffffff',
            textShadow: '0 0 16px rgba(0, 240, 255, 0.8)',
          }}
        >
          NEXUS CITY
        </h1>

        <div
          style={{
            fontSize: '0.82rem',
            color: '#94a3b8',
            marginBottom: '24px',
            height: '24px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {statusText}
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(0, 240, 255, 0.12)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '16px',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #00f0ff, #ff007f)',
              boxShadow: '0 0 12px rgba(0, 240, 255, 0.9)',
              transition: 'width 0.15s ease-out',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <span>100% PROCEDURAL // ZERO ASSETS</span>
          <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>{progress}%</span>
        </div>

        {/* Quick Skip Button */}
        <button
          onClick={() => {
            setIsDone(true);
            CinematicManager.getInstance().skip();
          }}
          style={{
            marginTop: '28px',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#cbd5e1',
            padding: '8px 20px',
            borderRadius: '4px',
            fontSize: '0.78rem',
            letterSpacing: '1.5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#00f0ff';
            e.currentTarget.style.color = '#00f0ff';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            e.currentTarget.style.color = '#cbd5e1';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          SKIP TO GAMEPLAY &gt;&gt;
        </button>
      </div>
    </div>
  );
};
