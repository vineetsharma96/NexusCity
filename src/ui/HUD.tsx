import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PerformanceMetrics, PerformanceMonitor } from '../rendering/PerformanceMonitor';
import { InputManager, InputState } from '../player/InputManager';
import { MobileControls } from './MobileControls';
import { DialogueBox } from './DialogueBox';
import { WorldHUDMarkers } from './WorldHUDMarkers';
import { CityMapModal } from './CityMapModal';
import { CyberSideMenu } from './CyberSideMenu';
import { NavigationSystem } from '../map/NavigationSystem';
import { InteractiveEntity, InteractionSystem } from '../interaction/InteractionSystem';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { AudioManager } from '../audio/AudioManager';
import { CinematicManager, CinematicPhase } from '../cinematics/CinematicManager';
import { VehicleInteractionSystem, VehicleState } from '../vehicle/VehicleInteractionSystem';
import { DialogueSystem } from '../npc/DialogueSystem';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherState, WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { Gauge, RotateCcw, Wind, Zap } from 'lucide-react';

const WEATHER_CYCLE_ORDER: WeatherType[] = ['CLEAR', 'RAIN', 'HEAVY_RAIN', 'SNOW', 'BLIZZARD', 'FOG'];

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
  const [timeState, setTimeState] = useState<TimeLightingState>(() => TimeSystem.getInstance().getState());
  const [weatherState, setWeatherState] = useState<WeatherState>(() => ({
    ...WeatherSystem.getInstance().getState(),
  }));
  const [inputState, setInputState] = useState<InputState>(InputManager.getState());
  const [activeInteractable, setActiveInteractable] = useState<InteractiveEntity | null>(null);
  const [chunkState, setChunkState] = useState<ChunkManagerState>(() => ChunkManager.getInstance().getState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>(
    () => CinematicManager.getInstance().getState().phase
  );
  const [activeToast, setActiveToast] = useState<{ title: string; message: string } | null>(null);
  const [vehicleState, setVehicleState] = useState<VehicleState>(() =>
    VehicleInteractionSystem.getInstance().getState()
  );
  const [isMapOpen, setIsMapOpen] = useState(() => NavigationSystem.getInstance().getState().isMapOpen);
  const [hasDialogue, setHasDialogue] = useState(false);

  const overlayOpen = isMenuOpen || isMapOpen || hasDialogue;
  const overlayOpenRef = useRef(overlayOpen);
  overlayOpenRef.current = overlayOpen;

  useEffect(() => {
    InputManager.setUIBlocking(overlayOpen);
  }, [overlayOpen]);

  useEffect(() => () => InputManager.setUIBlocking(false), []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });

    const onOpenMenu = () => setIsMenuOpen(true);
    window.addEventListener('nexus:open-menu', onOpenMenu);

    const unsubPerf = PerformanceMonitor.getInstance().subscribe(setMetrics);
    let lastMinute = '';
    const unsubTime = TimeSystem.getInstance().subscribe((t) => {
      if (t.timeString !== lastMinute) {
        lastMinute = t.timeString;
        setTimeState(t);
      }
    });
    let lastWeatherKey = '';
    const unsubWeather = WeatherSystem.getInstance().subscribe((w) => {
      const key = `${w.currentWeather}:${Math.round(w.precipitationIntensity * 25)}:${Math.round(w.temperatureC)}`;
      if (key !== lastWeatherKey) {
        lastWeatherKey = key;
        setWeatherState({ ...w });
      }
    });

    let prevMapKey = InputManager.getState().map;
    let prevInteract = false;

    const unsubInput = InputManager.subscribe((state) => {
      setInputState(state);
      const interactPressed = state.interact && !prevInteract;
      prevInteract = state.interact;
      if (interactPressed && !overlayOpenRef.current) {
        InteractionSystem.getInstance().triggerInteract();
      }
      if (state.map !== prevMapKey) {
        prevMapKey = state.map;
        if (!overlayOpenRef.current || NavigationSystem.getInstance().getState().isMapOpen) {
          NavigationSystem.getInstance().toggleMap();
        }
      }
    });

    const handleUserGesture = () => {
      AudioManager.getInstance().ensureContext();
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('touchstart', handleUserGesture, { once: true });

    const unsubInteract = InteractionSystem.getInstance().subscribe(setActiveInteractable);
    let lastChunkHudKey = '';
    const unsubChunks = ChunkManager.getInstance().subscribe((cs) => {
      const key = `${cs.currentDistrict.type}:${cs.activeChunkCount}:${cs.recentDiscovery?.type ?? ''}`;
      if (key !== lastChunkHudKey) {
        lastChunkHudKey = key;
        setChunkState(cs);
      }
    });
    const unsubCinematic = CinematicManager.getInstance().subscribe((s) => setCinematicPhase(s.phase));
    const unsubVehicle = VehicleInteractionSystem.getInstance().subscribe(setVehicleState);
    const unsubNavigation = NavigationSystem.getInstance().subscribe((s) => setIsMapOpen(s.isMapOpen));
    const unsubDialogue = DialogueSystem.getInstance().subscribe((node) => setHasDialogue(Boolean(node)));

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('nexus:open-menu', onOpenMenu);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      unsubPerf();
      unsubTime();
      unsubWeather();
      unsubInput();
      unsubInteract();
      unsubChunks();
      unsubCinematic();
      unsubVehicle();
      unsubNavigation();
      unsubDialogue();
    };
  }, []);

  useEffect(() => {
    const enterVista = () => {
      if (!overlayOpenRef.current && CinematicManager.getInstance().getState().phase === 'GAMEPLAY') {
        window.dispatchEvent(new CustomEvent('nexus:vista'));
      }
    };
    let timeoutId = window.setTimeout(enterVista, 35000);
    const resetIdleTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(enterVista, 35000);
    };
    const events: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'touchstart', 'wheel', 'mousemove'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, []);

  useEffect(() => {
    if (chunkState.recentDiscovery) {
      AudioManager.getInstance().playDiscoveryChime();
    }
  }, [chunkState.recentDiscovery?.name]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleNotification = (event: Event) => {
      const e = event as CustomEvent<{ title?: string; message?: string; duration?: number }>;
      if (e.detail) {
        clearTimeout(timer);
        setActiveToast({
          title: e.detail.title || 'SECTOR TELEMETRY',
          message: e.detail.message || '',
        });
        timer = setTimeout(() => setActiveToast(null), e.detail.duration ?? 3800);
      }
    };
    window.addEventListener('nexus:notification', handleNotification as EventListener);
    return () => {
      window.removeEventListener('nexus:notification', handleNotification as EventListener);
      clearTimeout(timer);
    };
  }, []);

  // Keyboard shortcut [R] to toggle Reverse gear when driving the Experimental Car
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (e.repeat || overlayOpenRef.current || tag === 'input' || tag === 'textarea') return;
      if (e.key === 'r' || e.key === 'R') {
        const vs = VehicleInteractionSystem.getInstance().getState();
        if (vs.mode === 'RIDING' && vs.variant === 'car') {
          VehicleInteractionSystem.getInstance().toggleReverseGear();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      {/* Top-Left Architectural Sector & Weather Telemetry Readout */}
      {!overlayOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 18,
            left: 18,
            zIndex: 35,
            padding: '10px 16px',
            borderLeft: `3px solid ${chunkState.currentDistrict.accentColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            pointerEvents: 'auto',
            minWidth: 230,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              letterSpacing: '0.16em',
              color: 'var(--neon-amber)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeState.timeString} · {timeState.phase} · {Math.round(weatherState.temperatureC)}°C
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.96rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}
          >
            {chunkState.currentDistrict.name}
          </div>

          {/* Live Weather & Precipitation Telemetry Row */}
          <div
            style={{
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.64rem',
              color: 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>
              ATMO:{' '}
              <strong
                style={{
                  color:
                    weatherState.snowIntensity > 0.02
                      ? '#e0f2fe'
                      : weatherState.rainIntensity > 0.02
                      ? 'var(--neon-cyan)'
                      : 'var(--text-primary)',
                }}
              >
                {weatherState.currentWeather.replace('_', ' ')}
              </strong>
              {weatherState.precipitationIntensity > 0.01 &&
                ` · ${Math.round(weatherState.precipitationIntensity * 100)}% (${weatherState.precipitationRateMmHr} MM/H)`}
            </span>
            <button
              type="button"
              className="cyber-btn"
              title="Cycle atmospheric weather state"
              onClick={() => {
                const idx = WEATHER_CYCLE_ORDER.indexOf(weatherState.currentWeather);
                const next = WEATHER_CYCLE_ORDER[(idx + 1) % WEATHER_CYCLE_ORDER.length];
                WeatherSystem.getInstance().setWeather(next);
              }}
              style={{
                padding: '2px 6px',
                fontSize: '0.58rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              CYCLE ATMO
            </button>
          </div>

          {/* Live Precipitation Intensity Bar */}
          <div
            aria-hidden="true"
            style={{
              marginTop: 2,
              width: '100%',
              height: 3,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(weatherState.precipitationIntensity * 100)}%`,
                height: '100%',
                background:
                  weatherState.snowIntensity > weatherState.rainIntensity
                    ? '#e0f2fe'
                    : 'var(--neon-cyan)',
                transition: 'width 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {vehicleState.mode !== 'ON_FOOT' && (
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.66rem',
                color: vehicleState.variant === 'car' ? 'var(--neon-cyan)' : 'var(--neon-emerald)',
                letterSpacing: '0.1em',
              }}
            >
              {vehicleState.mode === 'RIDING'
                ? vehicleState.variant === 'car'
                  ? 'VX-01 PROTOTYPE ENGAGED [E TO EXIT]'
                  : 'HOVER-COUPE ENGAGED [E TO EXIT]'
                : 'SHUTTLE LINKED [E TO RELEASE]'}
            </div>
          )}
        </div>
      )}

      {/* District Discovery Banner */}
      {chunkState.recentDiscovery && (
        <div
          className="district-discovery"
          role="status"
          style={{
            position: 'absolute',
            top: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90,
            pointerEvents: 'none',
            animation: 'fadeIn 0.35s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '12px 28px',
              borderTop: `2px solid ${chunkState.recentDiscovery.accentColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--neon-amber)',
                letterSpacing: '0.2em',
                fontWeight: 600,
              }}
            >
              SECTOR ENTERED
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                color: 'var(--text-primary)',
                letterSpacing: '0.08em',
                fontWeight: 800,
              }}
            >
              {chunkState.recentDiscovery.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
              }}
            >
              {chunkState.recentDiscovery.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Subtle Vignette & Precision Reticle */}
      <div className="vignette-overlay" />
      {!overlayOpen && <div className="center-reticle" />}

      {/* Kinetic Acceleration & Deceleration Screen Effects (works on all GPUs & mobile) */}
      {vehicleState.mode === 'RIDING' && !overlayOpen && (() => {
        const tel = vehicleState.telemetry;
        const accelIntensity = Math.min(
          1,
          Math.max(0, tel.longitudinalAccelG) * 0.45 +
            Math.max(0, (tel.speedMs - 11) / 34) * 0.45 +
            (tel.isBoosting ? 0.35 : 0)
        );
        const decelIntensity = Math.min(
          1,
          Math.max(0, -tel.longitudinalAccelG) * 0.55 + (tel.isBraking && tel.speedMs > 2.5 ? 0.25 : 0)
        );
        return (
          <>
            {/* Acceleration Radial Speed-Streak Edge Frame */}
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 24,
                opacity: accelIntensity > 0.04 ? accelIntensity * 0.72 : 0,
                transition: 'opacity 90ms linear',
                background:
                  'repeating-conic-gradient(from 0deg at 50% 50%, rgba(56, 189, 248, 0.22) 0deg 0.8deg, transparent 0.8deg 6deg)',
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 48%, rgba(0, 0, 0, 0.95) 100%)',
                maskImage: 'radial-gradient(circle at center, transparent 48%, rgba(0, 0, 0, 0.95) 100%)',
              }}
            />
            {/* Deceleration / Braking Peripheral Crimson G-Force Squeeze */}
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 25,
                opacity: decelIntensity > 0.04 ? decelIntensity * 0.82 : 0,
                transition: 'opacity 80ms linear',
                boxShadow: 'inset 0 0 110px 26px rgba(244, 63, 94, 0.52)',
              }}
            />
          </>
        );
      })()}

      {/* Experimental Car Cockpit Telemetry Cluster (Speed, Gear/Reverse Toggle, G-Force, Air Drag & Grip) */}
      {vehicleState.mode === 'RIDING' && vehicleState.variant === 'car' && !overlayOpen && (() => {
        const tel = vehicleState.telemetry;
        const gClamped = Math.max(-1, Math.min(1, tel.longitudinalAccelG / 2.2));
        const gWidthPct = Math.abs(gClamped) * 50;
        const isRev = tel.gear === 'R' || tel.isReversing;
        return (
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: isMobile ? 190 : 52,
              zIndex: 35,
              padding: '11px 14px',
              minWidth: 236,
              background: 'rgba(11, 15, 25, 0.88)',
              border: `1px solid ${tel.isBraking ? 'rgba(244, 63, 94, 0.7)' : isRev ? 'rgba(248, 250, 252, 0.65)' : 'rgba(56, 189, 248, 0.5)'}`,
              borderRight: `3px solid ${tel.isBraking ? '#f43f5e' : isRev ? '#f8fafc' : tel.isBoosting ? '#f59e0b' : '#38bdf8'}`,
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              pointerEvents: 'auto',
            }}
          >
            {/* Header + Reverse Gear Toggle Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.62rem',
                  letterSpacing: '0.14em',
                  color: 'var(--neon-cyan)',
                  fontWeight: 700,
                }}
              >
                <Gauge size={13} />
                VX-01 TELEMETRY
              </span>
              <button
                type="button"
                className="cyber-btn"
                onClick={() => VehicleInteractionSystem.getInstance().toggleReverseGear()}
                title="Toggle Reverse Gear (R)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  fontSize: '0.6rem',
                  background: isRev ? 'rgba(248, 250, 252, 0.18)' : 'rgba(15, 23, 42, 0.85)',
                  borderColor: isRev ? '#f8fafc' : 'var(--border-subtle)',
                  color: isRev ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <RotateCcw size={11} />
                REV [R]
              </button>
            </div>

            {/* Digital KM/H Readout + P / N / D / R Gear Indicator */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: tel.isBoosting ? 'var(--neon-amber)' : 'var(--text-primary)',
                  }}
                >
                  {String(tel.speedKmh).padStart(3, '0')}
                </span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                  KM/H
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {(['R', 'N', 'D'] as const).map((g) => {
                  const active = tel.gear === g;
                  return (
                    <span
                      key={g}
                      style={{
                        width: 22,
                        height: 22,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 3,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: active
                          ? g === 'R'
                            ? '#f8fafc'
                            : 'var(--neon-cyan)'
                          : 'rgba(255, 255, 255, 0.06)',
                        color: active ? '#07090e' : 'var(--text-muted)',
                      }}
                    >
                      {g}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Bidirectional Longitudinal G-Force Bar (Decel left / Accel right) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.58rem',
                  color: 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ color: tel.isBraking ? '#fb7185' : 'var(--text-muted)' }}>DECEL</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-primary)' }}>
                  <Zap size={10} />
                  {tel.longitudinalAccelG >= 0 ? '+' : ''}
                  {tel.longitudinalAccelG.toFixed(2)} G
                </span>
                <span style={{ color: tel.isBoosting ? 'var(--neon-amber)' : 'var(--text-muted)' }}>
                  {tel.isBoosting ? 'BOOST' : 'ACCEL'}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 5,
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(255, 255, 255, 0.35)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: gClamped >= 0 ? '50%' : `${50 - gWidthPct}%`,
                    width: `${gWidthPct}%`,
                    background: gClamped >= 0 ? (tel.isBoosting ? '#f59e0b' : '#38bdf8') : '#f43f5e',
                    transition: 'width 60ms linear, left 60ms linear',
                  }}
                />
              </div>
            </div>

            {/* Unified World Physics Readout: Air Resistance Drag & Surface Friction */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingTop: 4,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.6rem',
                color: 'var(--text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Wind size={11} />
                DRAG {tel.dragForceN} N
              </span>
              <span>
                μ {tel.surfaceGrip.toFixed(2)} · {tel.surfaceLabel}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Discrete Frame Telemetry */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: isMobile ? 150 : 16,
          zIndex: 30,
          padding: '4px 9px',
          color: metrics.fps >= 50 ? 'var(--neon-emerald)' : metrics.fps >= 30 ? 'var(--neon-amber)' : 'var(--neon-magenta)',
          background: 'rgba(11, 15, 25, 0.72)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.66rem',
          letterSpacing: '0.08em',
          pointerEvents: 'none',
        }}
      >
        {metrics.fps} FPS{!isMobile && ` · ${metrics.frameTimeMs}ms`}
      </div>

      {/* Contextual Telemetry Toast */}
      {activeToast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: isMobile ? 185 : 155,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 42,
            pointerEvents: 'none',
            animation: 'fadeIn 0.25s ease',
            width: 'min(90vw, 460px)',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '10px 18px',
              borderLeft: '3px solid var(--neon-cyan)',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--neon-amber)',
                letterSpacing: '0.14em',
                fontWeight: 600,
              }}
            >
              {activeToast.title}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
                lineHeight: 1.4,
              }}
            >
              {activeToast.message}
            </div>
          </div>
        </div>
      )}

      {/* Contextual Interaction Prompt */}
      {activeInteractable && !overlayOpen && (
        <button
          className="interaction-prompt"
          style={{
            position: 'absolute',
            bottom: isMobile ? 245 : 96,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            pointerEvents: 'auto',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
          }}
          onClick={() => InteractionSystem.getInstance().triggerInteract()}
        >
          <div
            className="glass-panel"
            style={{
              padding: '8px 18px',
              border: '1px solid var(--neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--neon-amber)',
                color: '#07090e',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                padding: '2px 7px',
                borderRadius: 3,
                fontSize: '0.76rem',
              }}
            >
              {isMobile ? 'TAP' : 'E'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--text-primary)',
              }}
            >
              {activeInteractable.actionText}
            </span>
          </div>
        </button>
      )}

      <DialogueBox />

      {/* Desktop Controls Legend */}
      {!isMobile && !overlayOpen && (
        <div
          className="glass-panel hud-controls-guide"
          style={{
            position: 'absolute',
            bottom: 18,
            left: 18,
            zIndex: 30,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>NAVIGATION</span>
            {!inputState.isPointerLocked ? (
              <button
                onClick={InputManager.requestPointerLock}
                className="cyber-btn"
                style={{ fontSize: '0.64rem', padding: '2px 7px' }}
              >
                LOCK LOOK
              </button>
            ) : (
              <span style={{ color: 'var(--neon-emerald)', fontSize: '0.66rem' }}>● MOUSE LOCKED</span>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {vehicleState.mode === 'RIDING' && vehicleState.variant === 'car' ? (
              <>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>W/S</strong> Throttle &amp; Brake/Rev ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>A/D</strong> Steer ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>R</strong> Reverse
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>SPACE</strong> Handbrake ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>SHIFT</strong> Boost ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>E</strong> Exit
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>WASD</strong> Move ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>SPACE</strong> Jump ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>E</strong> Interact
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>M</strong> Atlas ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>V</strong> Vista ·{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>SHIFT</strong> Sprint
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!overlayOpen && <WorldHUDMarkers playerPosRef={playerPosRef} />}

      <CityMapModal playerPosRef={playerPosRef} />

      <CyberSideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Bottom Console Trigger */}
      {!overlayOpen && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            className="cyber-btn"
            aria-label="Open world menu"
            onClick={() => {
              setIsMenuOpen(true);
              AudioManager.getInstance().playUI('open');
            }}
            style={{
              minWidth: 96,
              padding: '8px 16px',
              background: 'rgba(11, 15, 25, 0.9)',
            }}
          >
            CONSOLE
          </button>
          <button
            className="cyber-btn cyber-btn-primary"
            aria-label="Open metropolitan atlas"
            onClick={() => {
              NavigationSystem.getInstance().setMapOpen(true);
              AudioManager.getInstance().playUI('open');
            }}
            style={{
              minWidth: 96,
              padding: '8px 16px',
            }}
          >
            ATLAS [M]
          </button>
        </div>
      )}

      <MobileControls disabled={overlayOpen} />
    </>
  );
};
