import React, { useEffect, useState } from 'react';
import { TouchController } from '../player/TouchController';
import { InputManager } from '../player/InputManager';
import { NavigationSystem } from '../map/NavigationSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';

export const MobileControls: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({
    active: false,
    ox: 100,
    oy: 0,
    cx: 100,
    cy: 0,
  });

  useEffect(() => {
    if (disabled) {
      TouchController.getInstance().reset();
      setIsSprintActive(false);
      setJoystickPos((prev) => ({ ...prev, active: false }));
      return;
    }

    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 800);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);

    const tc = TouchController.getInstance();

    const onTouchStart = (e: TouchEvent) => {
      if (
        InputManager.isUIBlocked() ||
        (e.target instanceof Element && e.target.closest('button, select, input, [role="dialog"]'))
      ) {
        return;
      }
      tc.handleTouchStart(e);
      const st = tc.getState();
      if (st.joystickActive) {
        setJoystickPos({
          active: true,
          ox: st.joystickOrigin.x,
          oy: st.joystickOrigin.y,
          cx: st.joystickCurrent.x,
          cy: st.joystickCurrent.y,
        });
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      tc.handleTouchMove(e);
      const st = tc.getState();
      if (st.joystickActive) {
        setJoystickPos((prev) => ({
          ...prev,
          cx: st.joystickCurrent.x,
          cy: st.joystickCurrent.y,
        }));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      tc.handleTouchEnd(e);
      if (!tc.getState().joystickActive) {
        setJoystickPos((prev) => ({ ...prev, active: false }));
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      tc.reset();
      InputManager.setVirtualAction('sprint', false);
      window.removeEventListener('resize', checkTouch);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled]);

  const toggleSprint = () => {
    const next = !isSprintActive;
    setIsSprintActive(next);
    InputManager.setVirtualAction('sprint', next);
  };

  if (!isTouchDevice || disabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        touchAction: 'none',
      }}
    >
      {/* Left Virtual Thumbstick */}
      {joystickPos.active ? (
        <div
          style={{
            position: 'absolute',
            left: joystickPos.ox - 54,
            top: joystickPos.oy - 54,
            width: 108,
            height: 108,
            borderRadius: '50%',
            border: '1.5px solid var(--neon-cyan)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 54 + (joystickPos.cx - joystickPos.ox) - 24,
              top: 54 + (joystickPos.cy - joystickPos.oy) - 24,
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'var(--neon-cyan)',
              boxShadow: '0 0 14px var(--neon-cyan)',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            bottom: 'max(38px, env(safe-area-inset-bottom))',
            left: 32,
            width: 86,
            height: 86,
            borderRadius: '50%',
            border: '1px dashed rgba(56, 189, 248, 0.35)',
            backgroundColor: 'rgba(11, 15, 25, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.25)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
            }}
          />
        </div>
      )}

      {/* Right Action Cluster */}
      <div
        style={{
          position: 'absolute',
          bottom: 'max(24px, env(safe-area-inset-bottom))',
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'auto',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="cyber-btn"
            style={{ width: 48, height: 48, borderRadius: 8, padding: 0, fontSize: '0.68rem' }}
            onClick={() => NavigationSystem.getInstance().setMapOpen(true)}
          >
            ATLAS
          </button>
          <button
            className="cyber-btn"
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              padding: 0,
              fontSize: '0.68rem',
              color: isSprintActive ? '#07090e' : 'var(--neon-cyan)',
              backgroundColor: isSprintActive ? 'var(--neon-cyan)' : 'rgba(11, 15, 25, 0.85)',
            }}
            aria-pressed={isSprintActive}
            onClick={toggleSprint}
          >
            RUN
          </button>
        </div>

        <button
          className="cyber-btn cyber-btn-primary"
          style={{
            width: 62,
            height: 62,
            borderRadius: 10,
            padding: 0,
            fontSize: '0.78rem',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            InputManager.setVirtualAction('jump', true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            InputManager.setVirtualAction('jump', false);
          }}
          onPointerCancel={() => InputManager.setVirtualAction('jump', false)}
          onLostPointerCapture={() => InputManager.setVirtualAction('jump', false)}
        >
          JUMP
        </button>

        <button
          className="cyber-btn"
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 6,
            fontSize: '0.72rem',
            borderColor: 'var(--neon-emerald)',
            color: 'var(--neon-emerald)',
          }}
          onClick={() => InteractionSystem.getInstance().triggerInteract()}
        >
          INTERACT
        </button>
      </div>
    </div>
  );
};
