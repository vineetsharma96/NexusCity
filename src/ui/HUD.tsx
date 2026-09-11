import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { QualityManager, QualityPreset } from '../rendering/QualityManager';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { InputManager, InputState } from '../player/InputManager';
import { MobileControls } from './MobileControls';
import { DialogueBox } from './DialogueBox';
import { Minimap } from './Minimap';
import { CityMapModal } from './CityMapModal';
import { AIAssistantModal } from './AIAssistantModal';
import { NavigationSystem } from '../map/NavigationSystem';
import { defaultRNG } from '../core/SeedRandom';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';
import { InteriorManager, InteriorState } from '../world/InteriorManager';
import { ChunkManager, ChunkManagerState } from '../world/ChunkManager';
import { WeatherSystem, WeatherState, WeatherType } from '../world/WeatherSystem';
import { AudioManager, AudioSettings } from '../audio/AudioManager';

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
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    AudioManager.getInstance().getSettings()
  );

  useEffect(() => {
    const unsubPerf = PerformanceMonitor.getInstance().subscribe(setMetrics);
    const unsubQuality = QualityManager.subscribe((q) => setQualityPreset(q.name));
    let prevMapKey = false;

    const unsubInput = InputManager.subscribe((state) => {
      setInputState(state);
      if (state.interact) {
        InteractionSystem.getInstance().triggerInteract();
      }
      // Toggle map on press
      if (state.map !== prevMapKey) {
        prevMapKey = state.map;
        NavigationSystem.getInstance().toggleMap();
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

    return () => {
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

  return (
    <>
      {/* Interior Teleport Transition Fade */}
      {interiorState.isTransitioning && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#040711',
            zIndex: 100,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* District Discovery Notification Banner */}
      {chunkState.recentDiscovery && (
        <div
          style={{
            position: 'absolute',
            top: 24,
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
      <div className="center-reticle" />

      {/* Top Left: World Telemetry & Seed */}
      <div
        className="hud-top-left"
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 900,
              letterSpacing: '2.5px',
              color: 'var(--neon-cyan)',
              textShadow: '0 0 12px rgba(0, 240, 255, 0.5)',
            }}
          >
            NEXUS CITY
          </h1>
          <span className="cyber-badge" style={{ color: 'var(--neon-amber)', borderColor: 'rgba(255, 170, 0, 0.4)' }}>
            SEED: #{defaultRNG.initialSeed}
          </span>
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: interiorState.current !== 'NONE' ? '#ffaa00' : chunkState.activeDistrict.accentColor,
              boxShadow: `0 0 8px ${interiorState.current !== 'NONE' ? '#ffaa00' : chunkState.activeDistrict.accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: interiorState.current !== 'NONE' ? 'var(--neon-amber)' : chunkState.activeDistrict.accentColor,
              fontWeight: 700,
              letterSpacing: '1px',
            }}
          >
            {interiorState.current !== 'NONE'
              ? interiorState.name
              : `${chunkState.activeDistrict.name} // ${chunkState.activeDistrict.subtitle}`}
          </span>
        </div>

        {/* Time of Day & Fast-Switch Presets */}
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

        {/* Dynamic Weather & Atmospheric Presets */}
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
      </div>

      {/* Top Right: Performance Telemetry & Graphics Presets */}
      <div
        className="glass-panel hud-top-right"
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          zIndex: 30,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
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
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 4 }}>
            ({metrics.frameTimeMs}ms)
          </span>
        </div>

        {metrics.drawCalls > 0 && (
          <div>
            <span style={{ color: 'var(--text-muted)' }}>CALLS: </span>
            <span style={{ color: 'var(--neon-cyan)' }}>{metrics.drawCalls}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>QUALITY:</span>
          <select
            value={qualityPreset}
            onChange={handleQualityChange}
            className="cyber-select"
          >
            <option value="ULTRA">ULTRA</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="LITE">LITE</option>
          </select>
        </div>

        {/* Audio Mute / Unmute Toggle */}
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
      </div>

      {/* Dynamic Contextual Interaction Prompt */}
      {activeInteractable && (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            pointerEvents: 'none',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '8px 20px',
              border: '1px solid rgba(0, 240, 255, 0.45)',
              boxShadow: '0 0 24px rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--neon-cyan)',
                color: '#050811',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: '0.85rem',
              }}
            >
              E
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.85rem',
                letterSpacing: '1.5px',
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

      {/* Bottom Left: Controls Guide & Mouse Lock Toggle */}
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

      {/* Navigation Minimap Widget */}
      <Minimap playerPosRef={playerPosRef} />

      {/* Fullscreen Holographic Vector Map Modal */}
      <CityMapModal playerPosRef={playerPosRef} />

      {/* Holographic AI City Assistant Terminal Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        playerPosRef={playerPosRef}
      />

      {/* Mobile Touch Controller Layer */}
      <MobileControls />
    </>
  );
};
