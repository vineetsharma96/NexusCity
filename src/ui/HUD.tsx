import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { QualityManager, QualityPreset } from '../rendering/QualityManager';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { InputManager, InputState } from '../player/InputManager';
import { MobileControls } from './MobileControls';
import { DialogueBox } from './DialogueBox';
import { Minimap } from './Minimap';
import { CompassTape } from './CompassTape';
import { WorldHUDMarkers } from './WorldHUDMarkers';
import { CityMapModal } from './CityMapModal';
import { InteriorTransitionOverlay } from './InteriorTransitionOverlay';
import { InteriorDebugOverlay } from './InteriorDebugOverlay';
import { AIAssistantModal } from './AIAssistantModal';
import { CyberMenuModal } from './CyberMenuModal';
import { NavigationSystem } from '../map/NavigationSystem';
import { defaultRNG } from '../core/SeedRandom';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';
import { InteriorManager, InteriorState } from '../world/InteriorManager';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { WeatherSystem, WeatherState, WeatherType } from '../world/WeatherSystem';
import { AudioManager, AudioSettings } from '../audio/AudioManager';
import { CinematicManager, CinematicPhase } from '../cinematics/CinematicManager';

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
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(QualityManager.preset);
  const [inputState, setInputState] = useState<InputState>(InputManager.getState());
  const [timeState, setTimeState] = useState<TimeLightingState>(() =>
    TimeSystem.getInstance().getState()
  );
  const [activeInteractable, setActiveInteractable] = useState<InteractiveEntity | null>(null);
  const [interiorState, setInteriorState] = useState<InteriorState>(() =>
    InteriorManager.getInstance().getState()
  );
  const [chunkState, setChunkState] = useState<ChunkManagerState>(() =>
    ChunkManager.getInstance().getState()
  );
  const [weatherState, setWeatherState] = useState<WeatherState>(() =>
    WeatherSystem.getInstance().getState()
  );
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    AudioManager.getInstance().getSettings()
  );
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>(() =>
    CinematicManager.getInstance().getState().phase
  );
  const [interiorArrivalBanner, setInteriorArrivalBanner] = useState<{
    name: string;
    floor: number;
  } | null>(null);
  const [activeToast, setActiveToast] = useState<{ title: string; message: string } | null>(null);

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
    const unsubQuality = QualityManager.subscribe((q) => setQualityPreset(q.name));
    let prevMapKey = false;

    const unsubInput = InputManager.subscribe((state) => {
      setInputState(state);
      if (state.interact) {
        InteractionSystem.getInstance().triggerInteract();
      }
      // Toggle map on press (prevent indoors)
      if (state.map !== prevMapKey) {
        prevMapKey = state.map;
        if (state.map) {
          if (InteriorManager.getInstance().getState().worldMode !== 'WORLD_ACTIVE') {
            setActiveToast({
              title: 'NAVIGATION TELEMETRY',
              message: 'City map unavailable indoors.',
            });
          } else {
            NavigationSystem.getInstance().toggleMap();
          }
        }
      }
    });

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyI' || e.code === 'Backquote') {
        e.preventDefault();
        setIsAIModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    // Audio resume on first user interaction
    const handleUserGesture = () => {
      AudioManager.getInstance().ensureContext();
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('touchstart', handleUserGesture, { once: true });

    const unsubTime = TimeSystem.getInstance().subscribe(setTimeState);
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeatherState);
    const unsubAudio = AudioManager.getInstance().subscribe(setAudioSettings);
    const unsubInteract = InteractionSystem.getInstance().subscribe(setActiveInteractable);
    const unsubInt = InteriorManager.getInstance().subscribe(setInteriorState);
    const unsubChunks = ChunkManager.getInstance().subscribe(setChunkState);
    const unsubCinematic = CinematicManager.getInstance().subscribe((s) => setCinematicPhase(s.phase));

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('nexus:open-menu', onOpenMenuEvent);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      unsubPerf();
      unsubQuality();
      unsubInput();
      unsubTime();
      unsubWeather();
      unsubAudio();
      unsubInteract();
      unsubInt();
      unsubChunks();
      unsubCinematic();
    };
  }, []);

  // Trigger cyber discovery chime on new district detection
  useEffect(() => {
    if (chunkState.recentDiscovery) {
      AudioManager.getInstance().playDiscoveryChime();
    }
  }, [chunkState.recentDiscovery?.name]);

  // Trigger interior arrival banner and sound chime when entering interior or switching floors
  useEffect(() => {
    if (interiorState.current !== 'NONE') {
      setInteriorArrivalBanner({
        name: interiorState.name || 'INTERIOR FACILITY',
        floor: interiorState.currentFloor || 1,
      });
      AudioManager.getInstance().playDiscoveryChime();
      const timer = setTimeout(() => {
        setInteriorArrivalBanner(null);
      }, 4200);
      return () => clearTimeout(timer);
    } else {
      setInteriorArrivalBanner(null);
    }
  }, [interiorState.current, interiorState.currentFloor]);

  // Listen to interactive object / terminal notifications
  useEffect(() => {
    const handleNotification = (e: any) => {
      if (e.detail) {
        setActiveToast({
          title: e.detail.title || 'SYSTEM TELEMETRY',
          message: e.detail.message || '',
        });
        const timer = setTimeout(() => {
          setActiveToast(null);
        }, 3800);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('nexus:notification', handleNotification as EventListener);
    return () => {
      window.removeEventListener('nexus:notification', handleNotification as EventListener);
    };
  }, []);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    QualityManager.setPreset(e.target.value as QualityPreset);
  };

  const setTime = (hour: number) => {
    TimeSystem.getInstance().setHour(hour);
  };

  const setWeather = (w: WeatherType) => {
    WeatherSystem.getInstance().setWeather(w);
  };

  if (cinematicPhase === 'LOADING' || cinematicPhase === 'CINEMATIC_INTRO') {
    return null;
  }

  return (
    <>
      {/* Interior Teleport Cyber Transition Overlay */}
      <InteriorTransitionOverlay interiorState={interiorState} />

      {/* Interior Development Debug Overlay */}
      <InteriorDebugOverlay interiorState={interiorState} playerPosRef={playerPosRef} />

      {/* 360° Horizontal Compass Tape (Exterior Only) */}
      {interiorState.worldMode === 'WORLD_ACTIVE' && (
        <CompassTape playerPosRef={playerPosRef} />
      )}

      {/* Active Interior Sector Telemetry Badge */}
      {interiorState.worldMode !== 'WORLD_ACTIVE' && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 85,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            background: 'rgba(5, 12, 24, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            borderRadius: 4,
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '2px',
          }}
        >
          <span style={{ color: '#00f0ff', fontWeight: 900 }}>INTERIOR //</span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>
            {interiorState.name || 'FACILITY'}
          </span>
          <span style={{ color: 'var(--neon-amber)', fontSize: '0.68rem' }}>
            [LVL {interiorState.currentFloor || 1}]
          </span>
        </div>
      )}

      {/* District Discovery Notification Banner */}
      {chunkState.recentDiscovery && (
        <div
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

      {/* Interior Sector Arrival & Floor Transition Banner */}
      {interiorArrivalBanner && !interiorState.isTransitioning && (
        <div
          style={{
            position: 'absolute',
            top: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 92,
            pointerEvents: 'none',
            animation: 'fadeIn 0.4s ease',
            width: 'min(92vw, 540px)',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '12px 24px',
              border: '2px solid var(--neon-cyan)',
              boxShadow: '0 0 32px rgba(0, 240, 255, 0.4), inset 0 0 16px rgba(0, 240, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--neon-amber)',
                letterSpacing: '2px',
                fontWeight: 900,
              }}
            >
              ★ INTERIOR ARCHITECTURE ACCESSED ★
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                color: 'var(--neon-cyan)',
                letterSpacing: '1.5px',
                fontWeight: 900,
              }}
            >
              {interiorArrivalBanner.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.5px',
              }}
            >
              LEVEL {interiorArrivalBanner.floor} // ATMOSPHERIC AIR-LOCK NOMINAL // ACCESS GRANTED
            </div>
          </div>
        </div>
      )}

      {/* Visual Overlay Scanlines & Vignette */}
      <div className="scanlines-overlay" />
      <div className="vignette-overlay" />
      <div className="center-reticle" />

      {/* Top Left: World Telemetry & Seed */}
      <div
        className="hud-top-left"
        style={{
          position: 'absolute',
          top: isMobile ? 12 : 18,
          left: isMobile ? 14 : 20,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 3 : 6,
          maxWidth: isMobile ? '60vw' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMobile ? '1.05rem' : '1.25rem',
              fontWeight: 900,
              letterSpacing: '2px',
              color: 'var(--neon-cyan)',
              textShadow: '0 0 12px rgba(0, 240, 255, 0.5)',
              margin: 0,
            }}
          >
            NEXUS CITY
          </h1>
          {!isMobile && (
            <span className="cyber-badge" style={{ color: 'var(--neon-amber)', borderColor: 'rgba(255, 170, 0, 0.4)' }}>
              SEED: #{defaultRNG.initialSeed}
            </span>
          )}
          {!isMobile && (
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="cyber-btn"
              style={{
                padding: '2px 8px',
                fontSize: '0.68rem',
                borderColor: 'var(--neon-cyan)',
                boxShadow: '0 0 10px rgba(0, 240, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Open AI City Assistant [Key I or ~]"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: 'var(--neon-cyan)',
                  boxShadow: '0 0 8px #00f0ff',
                }}
              />
              AI ASSISTANT [I]
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: interiorState.current !== 'NONE' ? '#ffaa00' : chunkState.activeDistrict.accentColor,
              boxShadow: `0 0 8px ${interiorState.current !== 'NONE' ? '#ffaa00' : chunkState.activeDistrict.accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: isMobile ? '0.72rem' : '0.85rem',
              color: interiorState.current !== 'NONE' ? 'var(--neon-amber)' : chunkState.activeDistrict.accentColor,
              fontWeight: 700,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {interiorState.current !== 'NONE'
              ? interiorState.name
              : `${chunkState.activeDistrict.name}`}
          </span>
        </div>

        {/* Time of Day & Fast-Switch Presets (Desktop Only, available in System Menu on Mobile) */}
        {!isMobile && (
          <div className="hud-time-weather-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span
              className="cyber-badge"
              style={{
                color: timeState.isNight ? '#60a5fa' : timeState.phase === 'SUNSET' ? '#ff8833' : '#00ffaa',
                borderColor: timeState.isNight ? 'rgba(96, 165, 250, 0.4)' : 'rgba(0, 240, 255, 0.3)',
                backgroundColor: 'rgba(10, 16, 30, 0.8)',
              }}
            >
              {timeState.formattedTime} // {timeState.phase}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setTime(6.0)}
                className="cyber-btn"
                style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                title="Dawn [06:00]"
              >
                DAWN
              </button>
              <button
                onClick={() => setTime(13.0)}
                className="cyber-btn"
                style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                title="Noon [13:00]"
              >
                DAY
              </button>
              <button
                onClick={() => setTime(18.5)}
                className="cyber-btn"
                style={{ padding: '2px 6px', fontSize: '0.65rem', color: '#ffaa00', borderColor: '#ffaa00' }}
                title="Sunset [18:30]"
              >
                DUSK
              </button>
              <button
                onClick={() => setTime(23.0)}
                className="cyber-btn"
                style={{ padding: '2px 6px', fontSize: '0.65rem', color: '#60a5fa', borderColor: '#60a5fa' }}
                title="Midnight [23:00]"
              >
                NIGHT
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Weather & Atmospheric Presets (Desktop Only) */}
        {!isMobile && (
          <div className="hud-time-weather-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span
              className="cyber-badge"
              style={{
                color:
                  weatherState.currentWeather === 'HEAVY_RAIN'
                    ? '#ff3366'
                    : weatherState.currentWeather === 'RAIN'
                    ? '#38bdf8'
                    : weatherState.currentWeather === 'FOG'
                    ? '#a78bfa'
                    : '#34d399',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                backgroundColor: 'rgba(10, 16, 30, 0.8)',
              }}
            >
              {weatherState.currentWeather}
              {weatherState.wetnessFactor > 0.05
                ? ` // WET ${Math.round(weatherState.wetnessFactor * 100)}%`
                : ''}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setWeather('CLEAR')}
                className="cyber-btn"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  borderColor: weatherState.currentWeather === 'CLEAR' ? 'var(--neon-cyan)' : undefined,
                }}
                title="Clear skies"
              >
                CLEAR
              </button>
              <button
                onClick={() => setWeather('CLOUDY')}
                className="cyber-btn"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  borderColor: weatherState.currentWeather === 'CLOUDY' ? 'var(--neon-cyan)' : undefined,
                }}
                title="Overcast skies"
              >
                CLOUDY
              </button>
              <button
                onClick={() => setWeather('RAIN')}
                className="cyber-btn"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  color: '#38bdf8',
                  borderColor: weatherState.currentWeather === 'RAIN' ? '#38bdf8' : undefined,
                }}
                title="Rain shower"
              >
                RAIN
              </button>
              <button
                onClick={() => setWeather('HEAVY_RAIN')}
                className="cyber-btn"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  color: '#ff3366',
                  borderColor: weatherState.currentWeather === 'HEAVY_RAIN' ? '#ff3366' : undefined,
                }}
                title="Storm with lightning"
              >
                STORM
              </button>
              <button
                onClick={() => setWeather('FOG')}
                className="cyber-btn"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  color: '#a78bfa',
                  borderColor: weatherState.currentWeather === 'FOG' ? '#a78bfa' : undefined,
                }}
                title="Cyberpunk dense fog"
              >
                FOG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right: System Menu & Performance Telemetry */}
      <div
        className="glass-panel hud-top-right"
        style={{
          position: 'absolute',
          top: isMobile ? 12 : 18,
          right: isMobile ? 14 : 20,
          zIndex: 30,
          padding: isMobile ? '6px 10px' : '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 8 : 16,
          fontSize: '0.8rem',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>FPS: </span>
          <span
            style={{
              fontWeight: 700,
              color: metrics.fps >= 50 ? '#00ffaa' : metrics.fps >= 30 ? '#ffaa00' : '#ff0055',
            }}
          >
            {metrics.fps}
          </span>
          {!isMobile && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 4 }}>
              ({metrics.frameTimeMs}ms)
            </span>
          )}
        </div>

        {!isMobile && metrics.drawCalls > 0 && (
          <div>
            <span style={{ color: 'var(--text-muted)' }}>CALLS: </span>
            <span style={{ color: 'var(--neon-cyan)' }}>{metrics.drawCalls}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6 }}>
          {!isMobile && <span style={{ color: 'var(--text-muted)' }}>QUALITY:</span>}
          <select
            value={qualityPreset}
            onChange={handleQualityChange}
            className="cyber-select"
            style={isMobile ? { padding: '2px 4px', fontSize: '0.7rem' } : undefined}
          >
            <option value="AUTO">AUTO</option>
            <option value="ULTRA">ULTRA</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="LITE">LITE</option>
            {qualityPreset === 'CUSTOM' && <option value="CUSTOM">CUSTOM</option>}
          </select>
        </div>

        {!isMobile && (
          <button
            onClick={() => {
              AudioManager.getInstance().toggleMute();
              AudioManager.getInstance().playUI('click');
            }}
            className="cyber-btn"
            style={{
              padding: '3px 8px',
              fontSize: '0.72rem',
              color: audioSettings.isMuted ? '#8ba2c4' : '#00ffaa',
              borderColor: audioSettings.isMuted ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 255, 170, 0.5)',
              backgroundColor: audioSettings.isMuted ? 'rgba(10, 15, 25, 0.7)' : 'rgba(0, 255, 170, 0.1)',
              boxShadow: !audioSettings.isMuted ? '0 0 10px rgba(0, 255, 170, 0.3)' : undefined,
            }}
            title={audioSettings.isMuted ? 'Click to Enable Procedural Audio' : 'Click to Mute Audio'}
          >
            {audioSettings.isMuted ? '🔇 AUDIO OFF' : '🔊 AUDIO ON'}
          </button>
        )}

        {/* Cinematic Vista Drone Mode Button */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('nexus:vista'));
          }}
          className="cyber-btn"
          style={{
            padding: isMobile ? '4px 8px' : '4px 10px',
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            color: '#c084fc',
            borderColor: 'rgba(192, 132, 252, 0.6)',
            backgroundColor: 'rgba(192, 132, 252, 0.12)',
            boxShadow: '0 0 10px rgba(192, 132, 252, 0.25)',
            fontWeight: 700,
          }}
          title="Toggle 360° Cinematic Drone Vista Tour [V]"
        >
          🎥 VISTA
        </button>

        {/* Quick Save Game Button */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('nexus:quicksave'));
          }}
          className="cyber-btn"
          style={{
            padding: isMobile ? '4px 8px' : '4px 10px',
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            color: '#38bdf8',
            borderColor: 'rgba(56, 189, 248, 0.6)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
            fontWeight: 700,
          }}
          title="Quick Save Progress to Local Storage [F5]"
        >
          💾 SAVE
        </button>

        {/* AI City Intelligence Assistant Button */}
        <button
          onClick={() => {
            setIsAIModalOpen(true);
            AudioManager.getInstance().playUI('click');
          }}
          className="cyber-btn"
          style={{
            padding: isMobile ? '4px 10px' : '4px 12px',
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            color: '#00ffaa',
            borderColor: 'rgba(0, 255, 170, 0.6)',
            backgroundColor: 'rgba(0, 255, 170, 0.12)',
            boxShadow: '0 0 12px rgba(0, 255, 170, 0.3)',
            fontWeight: 700,
          }}
          title="Open NEXUS-AI Assistant Terminal [I]"
        >
          🤖 AI CORE
        </button>

        {/* Unified Cyberpunk System Menu Button */}
        <button
          onClick={() => {
            setIsMobileMenuOpen(true);
            AudioManager.getInstance().playUI('click');
          }}
          className="cyber-btn"
          style={{
            padding: isMobile ? '4px 10px' : '4px 12px',
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            color: 'var(--neon-cyan)',
            borderColor: 'var(--neon-cyan)',
            backgroundColor: 'rgba(0, 240, 255, 0.15)',
            boxShadow: '0 0 12px rgba(0, 240, 255, 0.35)',
            fontWeight: 700,
          }}
          title="Open System Menu & Teleport Hub"
        >
          ☰ MENU
        </button>
      </div>

      {/* Dynamic Contextual Terminal / Object Notification Toast */}
      {activeToast && (
        <div
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
      {activeInteractable && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? 125 : 105,
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
        </div>
      )}

      {/* Cyberpunk Interactive Dialogue Modal */}
      <DialogueBox />

      {/* Bottom Left: Controls Guide (Desktop Only — Hidden completely on mobile to eliminate clutter) */}
      {!isMobile && (
        <div
          className="glass-panel"
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
            <div><strong style={{ color: 'var(--text-primary)' }}>WASD</strong>: Directional Movement</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>SPACE</strong>: Jump &nbsp;|&nbsp; <strong style={{ color: 'var(--text-primary)' }}>SHIFT</strong>: Sprint</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>SCROLL</strong>: Camera Zoom &nbsp;|&nbsp; <strong style={{ color: 'var(--text-primary)' }}>DRAG / MOUSE</strong>: Orbit Camera</div>
          </div>
        </div>
      )}

      {/* Floating 3D World Landmark / Objective HUD Markers (Exterior Only) */}
      {interiorState.worldMode === 'WORLD_ACTIVE' && (
        <WorldHUDMarkers playerPosRef={playerPosRef} />
      )}

      {/* Navigation Minimap Widget (Strictly Exterior Only) */}
      {interiorState.worldMode === 'WORLD_ACTIVE' && (
        <Minimap playerPosRef={playerPosRef} />
      )}

      {/* Fullscreen Holographic Vector Map Modal */}
      <CityMapModal playerPosRef={playerPosRef} />

      {/* Holographic AI City Assistant Terminal Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        playerPosRef={playerPosRef}
      />

      {/* Unified Cyberpunk System Menu Modal (Fast-Travel, Time/Weather, Settings, Audio) */}
      <CyberMenuModal
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onTeleport={(pos) => {
          window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: pos }));
        }}
        onOpenAI={() => setIsAIModalOpen(true)}
      />

      {/* Mobile Touch Controller Layer */}
      <MobileControls />
    </>
  );
};
