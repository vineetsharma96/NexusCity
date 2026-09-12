import React, { useState, useEffect } from 'react';
import { TouchController } from '../player/TouchController';
import { InputManager } from '../player/InputManager';

export const MobileControls: React.FC = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState<{
    active: boolean;
    ox: number;
    oy: number;
    cx: number;
    cy: number;
  }>({
    active: false,
    ox: 100,
    oy: 0,
    cx: 100,
    cy: 0,
  });

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 800; // also show on small mobile viewports
      setIsTouchDevice(hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);

    const tc = TouchController.getInstance();

    const onTouchStart = (e: TouchEvent) => {
      tc.handleTouchStart(e);
      if (tc.state.joystickActive) {
        setJoystickPos({
          active: true,
          ox: tc.state.joystickOrigin.x,
          oy: tc.state.joystickOrigin.y,
          cx: tc.state.joystickCurrent.x,
          cy: tc.state.joystickCurrent.y,
        });
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      tc.handleTouchMove(e);
      if (tc.state.joystickActive) {
        setJoystickPos((prev) => ({
          ...prev,
          cx: tc.state.joystickCurrent.x,
          cy: tc.state.joystickCurrent.y,
        }));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      tc.handleTouchEnd(e);
      if (!tc.state.joystickActive) {
        setJoystickPos((prev) => ({ ...prev, active: false }));
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('resize', checkTouch);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const toggleSprint = () => {
    const next = !isSprintActive;
    setIsSprintActive(next);
    InputManager.setVirtualAction('sprint', next);
  };

  if (!isTouchDevice) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 20,
        touchAction: 'none',
      }}
    >
      {/* 1. Left Thumbstick: Active or Idle Anchor */}
      {joystickPos.active ? (
        <div
          style={{
            position: 'absolute',
            left: joystickPos.ox - 55,
            top: joystickPos.oy - 55,
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '2px solid rgba(0, 240, 255, 0.65)',
            backgroundColor: 'rgba(0, 240, 255, 0.12)',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
            transform: 'translate3d(0,0,0)',
          }}
        >
          {/* Thumb Knob */}
          <div
            style={{
              position: 'absolute',
              left: 55 + (joystickPos.cx - joystickPos.ox) - 26,
              top: 55 + (joystickPos.cy - joystickPos.oy) - 26,
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 240, 255, 0.85)',
              boxShadow: '0 0 16px #00f0ff, inset 0 0 8px #ffffff',
            }}
          />
        </div>
      ) : (
        /* Idle Thumb Guide Hint */
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 36,
            width: 90,
            height: 90,
            borderRadius: '50%',
            border: '1.5px dashed rgba(0, 240, 255, 0.35)',
            backgroundColor: 'rgba(0, 240, 255, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 240, 255, 0.25)',
              border: '1px solid rgba(0, 240, 255, 0.5)',
            }}
          />
        </div>
      )}

      {/* 2. Right Hand Floating Action Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'auto',
          alignItems: 'flex-end',
        }}
      >
        {/* Top Row: Menu, Map and Sprint Toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="cyber-btn"
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              padding: 0,
              fontSize: '0.72rem',
              color: '#00ffaa',
              borderColor: '#00ffaa',
              backgroundColor: 'rgba(10, 28, 20, 0.85)',
              boxShadow: '0 0 10px rgba(0, 255, 170, 0.3)',
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('nexus:open-menu'));
            }}
          >
            MENU
          </button>
          <button
            className="cyber-btn"
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              padding: 0,
              fontSize: '0.72rem',
              color: '#38bdf8',
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(10, 20, 35, 0.85)',
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              InputManager.setVirtualAction('map', true);
            }}
          >
            MAP
          </button>
          <button
            className="cyber-btn"
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              padding: 0,
              fontSize: '0.72rem',
              color: isSprintActive ? '#050811' : 'var(--neon-cyan)',
              backgroundColor: isSprintActive ? 'var(--neon-cyan)' : 'rgba(10, 20, 35, 0.85)',
              boxShadow: isSprintActive ? '0 0 16px var(--neon-cyan)' : undefined,
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              toggleSprint();
            }}
          >
            RUN
          </button>
        </div>

        {/* Middle Row: Jump Button */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="cyber-btn"
            style={{
              width: 66,
              height: 66,
              borderRadius: '50%',
              padding: 0,
              fontSize: '0.85rem',
              borderColor: 'var(--neon-amber)',
              color: 'var(--neon-amber)',
              backgroundColor: 'rgba(25, 18, 10, 0.85)',
              boxShadow: '0 0 12px rgba(255, 170, 0, 0.3)',
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              InputManager.setVirtualAction('jump', true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              InputManager.setVirtualAction('jump', false);
            }}
          >
            JUMP
          </button>
        </div>

        {/* Bottom Row: Interact Button */}
        <button
          className="cyber-btn"
          style={{
            height: 44,
            padding: '0 18px',
            borderRadius: 22,
            fontSize: '0.75rem',
            letterSpacing: '1px',
            borderColor: 'var(--neon-emerald)',
            color: 'var(--neon-emerald)',
            backgroundColor: 'rgba(10, 28, 20, 0.85)',
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            InputManager.setVirtualAction('interact', true);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            InputManager.setVirtualAction('interact', false);
          }}
        >
          INTERACT [E]
        </button>
      </div>
    </div>
  );
};
