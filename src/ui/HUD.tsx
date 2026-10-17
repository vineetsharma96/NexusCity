import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { InputManager, InputState } from '../player/InputManager';
import { MobileControls } from './MobileControls';
import { DialogueBox } from './DialogueBox';
import { WorldHUDMarkers } from './WorldHUDMarkers';
import { CityMapModal } from './CityMapModal';
import { CyberSideMenu } from './CyberSideMenu';
import { NavigationSystem } from '../map/NavigationSystem';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { AudioManager } from '../audio/AudioManager';
import { CinematicManager, CinematicPhase } from '../cinematics/CinematicManager';
import { VehicleInteractionSystem, VehicleState } from '../vehicle/VehicleInteractionSystem';
import { DialogueSystem } from '../npc/DialogueSystem';

export interface HUDProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const HUD: React.FC<HUDProps> = ({ playerPosRef: externalPosRef }) => {
  const fallbackPosRef = useRef(new THREE.Vector3(0, 0.2, 10));
  const playerPosRef = externalPosRef || fallbackPosRef;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  const [inputState, setInputState] = useState<InputState>(InputManager.getState());
  const [activeInteractable, setActiveInteractable] = useState<InteractiveEntity | null>(null);
  const [chunkState, setChunkState] = useState<ChunkManagerState>(() =>
    ChunkManager.getInstance().getState()
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>(() =>
    CinematicManager.getInstance().getState().phase
  );
  const [activeToast, setActiveToast] = useState<{ title: string; message: string } | null>(null);
  const [vehicleState, setVehicleState] = useState<VehicleState>(() => VehicleInteractionSystem.getInstance().getState());
  const [isMapOpen, setIsMapOpen] = useState(() => NavigationSystem.getInstance().getState().isMapOpen);
  const [hasDialogue, setHasDialogue] = useState(false);
  const overlayOpen = isMobileMenuOpen || isMapOpen || hasDialogue;
  const overlayOpenRef = useRef(overlayOpen);
  overlayOpenRef.current = overlayOpen;

  useEffect(() => {
    InputManager.setUIBlocking(overlayOpen);
  }, [overlayOpen]);
  useEffect(() => () => InputManager.setUIBlocking(false), []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const onOpenMenuEvent = () => {
      setIsMobileMenuOpen(true);
    };
    window.addEventListener('nexus:open-menu', onOpenMenuEvent);

    const unsubPerf = PerformanceMonitor.getInstance().subscribe(setMetrics);
    let prevMapKey = InputManager.getState().map;
    let prevInteract = false;

    const unsubInput = InputManager.subscribe((state) => {
      setInputState(state);
      const interactPressed = state.interact && !prevInteract;
      prevInteract = state.interact;
      if (interactPressed && !overlayOpenRef.current) {
        InteractionSystem.getInstance().triggerInteract();
      }
      // Toggle map on press
      if (state.map !== prevMapKey) {
        prevMapKey = state.map;
        if (!overlayOpenRef.current || NavigationSystem.getInstance().getState().isMapOpen) {
          NavigationSystem.getInstance().toggleMap();
        }
      }
    });

    // Audio resume on first user interaction
    const handleUserGesture = () => {
      AudioManager.getInstance().ensureContext();
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('touchstart', handleUserGesture, { once: true });

    const unsubInteract = InteractionSystem.getInstance().subscribe(setActiveInteractable);
    const unsubChunks = ChunkManager.getInstance().subscribe(setChunkState);
    const unsubCinematic = CinematicManager.getInstance().subscribe((s) => setCinematicPhase(s.phase));
    const unsubVehicle = VehicleInteractionSystem.getInstance().subscribe(setVehicleState);
    const unsubNavigation = NavigationSystem.getInstance().subscribe((state) => setIsMapOpen(state.isMapOpen));
    const unsubDialogue = DialogueSystem.getInstance().subscribe((node) => setHasDialogue(Boolean(node)));

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('nexus:open-menu', onOpenMenuEvent);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      unsubPerf();
      unsubInput();
      unsubInteract();
      unsubChunks();
      unsubCinematic();
      unsubVehicle();
      unsubNavigation();
      unsubDialogue();
    };
  }, []);

  // Return to the cinematic vista when the player has been inactive for 30s.
  // Any keyboard, pointer, touch, or wheel input counts as active control.
  useEffect(() => {
    const enterVista = () => {
      if (!overlayOpenRef.current && CinematicManager.getInstance().getState().phase === 'GAMEPLAY') {
        window.dispatchEvent(new CustomEvent('nexus:vista'));
      }
    };
    let timeoutId = window.setTimeout(enterVista, 30000);
    const resetIdleTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(enterVista, 30000);
    };
    const events: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'touchstart', 'wheel', 'mousemove'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, []);

  // Trigger cyber discovery chime on new district detection
  useEffect(() => {
    if (chunkState.recentDiscovery) {
      AudioManager.getInstance().playDiscoveryChime();
    }
  }, [chunkState.recentDiscovery?.name]);


  // Listen to interactive object / terminal notifications
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleNotification = (event: Event) => {
      const e = event as CustomEvent<{ title?: string; message?: string; duration?: number }>;
      if (e.detail) {
        clearTimeout(timer);
        setActiveToast({
          title: e.detail.title || 'SYSTEM TELEMETRY',
          message: e.detail.message || '',
        });
        timer = setTimeout(() => {
          setActiveToast(null);
        }, e.detail.duration ?? 3800);
      }
    };
    window.addEventListener('nexus:notification', handleNotification as EventListener);
    return () => {
      window.removeEventListener('nexus:notification', handleNotification as EventListener);
      clearTimeout(timer);
    };
  }, []);

  if (
    cinematicPhase === 'LOADING' ||
    cinematicPhase === 'CINEMATIC_INTRO' ||
    cinematicPhase === 'TRANSITION_TO_PLAYER' ||
    cinematicPhase === 'VISTA_MODE'
  ) {
    return null;
  }

  return (
    <>
      {/* District Discovery Notification Banner */}
      {chunkState.recentDiscovery && (
        <div
          className="district-discovery"
          role="status"
          style={{
            position: 'absolute',
            top: 62,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90,
            pointerEvents: 'none',
            animation: 'fadeIn 0.4s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '12px 28px',
              border: `2px solid ${chunkState.recentDiscovery.accentColor}`,
              boxShadow: `0 0 32px ${chunkState.recentDiscovery.accentColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--neon-amber)',
                letterSpacing: '2px',
                fontWeight: 900,
              }}
            >
              ★ NEW DISTRICT DISCOVERED ★
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                color: chunkState.recentDiscovery.accentColor,
                letterSpacing: '2px',
                fontWeight: 900,
              }}
            >
              {chunkState.recentDiscovery.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              {chunkState.recentDiscovery.subtitle}
            </div>
          </div>
        </div>
      )}


      {/* Visual Overlay Scanlines & Vignette */}
      <div className="scanlines-overlay" />
      <div className="vignette-overlay" />
      {!overlayOpen && <div className="center-reticle" />}

      {vehicleState.mode !== 'ON_FOOT' && (
        <div style={{ position: 'absolute', top: 18, left: 18, zIndex: 35, padding: '8px 12px', border: '1px solid #00ffaa', background: 'rgba(3, 8, 20, 0.86)', color: '#00ffaa', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: 1.2 }}>
          {vehicleState.mode === 'RIDING' ? 'HOVER VEHICLE // CONTROL LINKED' : 'TRANSIT NODE // LINKED'}
          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.62rem' }}>E {vehicleState.mode === 'RIDING' ? 'EXIT' : 'RELEASE'} · SPEED {vehicleState.upgrades.speed ? `LV${vehicleState.upgrades.speed}` : 'STD'} · NEON {vehicleState.upgrades.neon ? `LV${vehicleState.upgrades.neon}` : 'OFF'}</div>
        </div>
      )}

      {/* Low-profile performance meter, kept out of the play-space */}
      <div
        style={{
          position: 'absolute',
          right: 14,
          bottom: isMobile ? 150 : 14,
          zIndex: 30,
          padding: '4px 8px',
          color: metrics.fps >= 50 ? '#00ffaa' : metrics.fps >= 30 ? '#ffaa00' : '#ff6688',
          background: 'rgba(3, 8, 20, 0.68)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          letterSpacing: 1,
          pointerEvents: 'none',
        }}
      >
        FPS {metrics.fps}{!isMobile && ` // ${metrics.frameTimeMs}ms`}
      </div>

      {/* Dynamic Contextual Terminal / Object Notification Toast */}
      {activeToast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: isMobile ? 185 : 160,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 42,
            pointerEvents: 'none',
            animation: 'fadeIn 0.3s ease',
            width: 'min(90vw, 480px)',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '10px 18px',
              border: '1.5px solid var(--neon-cyan)',
              boxShadow: '0 0 24px rgba(0, 240, 255, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              backgroundColor: 'rgba(3, 8, 20, 0.94)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--neon-amber)',
                letterSpacing: '1.5px',
                fontWeight: 800,
              }}
            >
              ◆ {activeToast.title} ◆
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                color: '#e2e8f0',
                lineHeight: 1.4,
              }}
            >
              {activeToast.message}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Contextual Interaction Prompt */}
      {activeInteractable && !overlayOpen && (
        <button
          className="interaction-prompt"
          style={{
            position: 'absolute',
            bottom: isMobile ? 245 : 105,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            pointerEvents: 'auto',
            cursor: 'pointer',
            maxWidth: '90vw',
          }}
          onClick={() => InteractionSystem.getInstance().triggerInteract()}
        >
          <div
            className="glass-panel"
            style={{
              padding: isMobile ? '6px 14px' : '8px 20px',
              border: '1px solid rgba(0, 240, 255, 0.55)',
              boxShadow: '0 0 22px rgba(0, 240, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--neon-cyan)',
                color: '#050811',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                padding: '2px 7px',
                borderRadius: 3,
                fontSize: isMobile ? '0.75rem' : '0.85rem',
              }}
            >
              {isMobile ? 'TAP' : 'E'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: isMobile ? '0.78rem' : '0.85rem',
                letterSpacing: '1px',
                color: 'var(--text-primary)',
              }}
            >
              {activeInteractable.actionText}
            </span>
          </div>
        </button>
      )}

      {/* Cyberpunk Interactive Dialogue Modal */}
      <DialogueBox />

      {/* Bottom Left: Controls Guide (Desktop Only — Hidden completely on mobile to eliminate clutter) */}
      {!isMobile && !overlayOpen && (
        <div
          className="glass-panel hud-controls-guide"
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 30,
            padding: '10px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>CONTROLS GUIDE</span>
            {!inputState.isPointerLocked ? (
              <button
                onClick={InputManager.requestPointerLock}
                className="cyber-btn"
                style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              >
                LOCK MOUSE LOOK
              </button>
            ) : (
              <span style={{ color: '#00ffaa', fontSize: '0.72rem' }}>● MOUSE LOOK ENGAGED (ESC TO EXIT)</span>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>WASD</strong> move · <strong style={{ color: 'var(--text-primary)' }}>SPACE</strong> jump · <strong style={{ color: 'var(--text-primary)' }}>E</strong> interact</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>M</strong> map · <strong style={{ color: 'var(--text-primary)' }}>V</strong> vista · <strong style={{ color: 'var(--text-primary)' }}>SHIFT</strong> sprint</div>
          </div>
        </div>
      )}

      {/* Floating 3D World Landmark / Objective HUD Markers */}
      {!overlayOpen && <WorldHUDMarkers playerPosRef={playerPosRef} />}

      {/* Fullscreen Holographic Vector Map Modal */}
      <CityMapModal playerPosRef={playerPosRef} />

      {/* Compact world-control side menu */}
      <CyberSideMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Single universal menu control, kept at the bottom on every device */}
      {!overlayOpen && <button
        className="cyber-btn"
        aria-label="Open world menu"
        onClick={() => {
          setIsMobileMenuOpen(true);
          AudioManager.getInstance().playUI('click');
        }}
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          zIndex: 60,
          minWidth: 92,
          padding: '9px 16px',
          color: 'var(--neon-cyan)',
          borderColor: 'var(--neon-cyan)',
          background: 'rgba(3, 8, 20, 0.9)',
          boxShadow: '0 0 14px rgba(0, 240, 255, 0.28)',
        }}
      >
        MENU
      </button>}

      {/* Mobile Touch Controller Layer */}
      <MobileControls disabled={overlayOpen} />
    </>
  );
};
