import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { AudioManager } from '../audio/AudioManager';
import { QualityManager, QualityPreset } from '../rendering/QualityManager';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { NavigationSystem } from '../map/NavigationSystem';

import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';
import { InteriorManager } from '../world/InteriorManager';
import { SaveSystem, NexusSaveData, DiscoveredEntity } from '../core/SaveSystem';

interface TeleportLocation {
  id: string;
  name: string;
  category: string;
  district: string;
  position: THREE.Vector3;
  icon: string;
  color: string;
}

const EXTERIOR_TELEPORT_LOCATIONS: TeleportLocation[] = [
  {
    id: 'plaza',
    name: 'Central Plaza Core',
    category: 'PLAZA',
    district: 'Central Metropolis',
    position: new THREE.Vector3(0, 0.2, 10),
    icon: '🏛️',
    color: '#00f0ff',
  },
  {
    id: 'park',
    name: 'Central Park & Water Pond',
    category: 'SANCTUARY',
    district: 'Biosphere Green District',
    position: new THREE.Vector3(75, 0.2, 75),
    icon: '🌳',
    color: '#10b981',
  },
  {
    id: 'skybridge',
    name: 'Apex High-Altitude Skybridge',
    category: 'LANDMARK',
    district: 'Sky District (Elev. 60m)',
    position: new THREE.Vector3(0, 60.5, 0),
    icon: '🌉',
    color: '#38bdf8',
  },
];

// Combine exterior landmarks and all 11 registered interior destinations
const TELEPORT_LOCATIONS: TeleportLocation[] = [
  ...EXTERIOR_TELEPORT_LOCATIONS,
  ...Object.entries(INTERIOR_DESTINATIONS).map(([id, dest]) => ({
    id,
    name: dest.name,
    category: 'INTERIOR',
    district: dest.district,
    position: dest.interactionPosition.clone(),
    icon: dest.icon,
    color: dest.accentColor,
  })),
];

export interface CyberMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeleport: (newPos: THREE.Vector3) => void;
  onOpenAI: () => void;
}

export const CyberMenuModal: React.FC<CyberMenuModalProps> = ({
  isOpen,
  onClose,
  onTeleport,
  onOpenAI,
}) => {
  const [activeTab, setActiveTab] = useState<'TELEPORT' | 'WORLD' | 'SETTINGS' | 'CODEX' | 'GUIDE'>('TELEPORT');
  const [saveData, setSaveData] = useState<NexusSaveData>(() => SaveSystem.getInstance().getData());
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(QualityManager.preset);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const unsubPerf = PerformanceMonitor.getInstance().subscribe(setMetrics);
    const unsubQuality = QualityManager.subscribe((q) => setQualityPreset(q.name));
    const unsubAudio = AudioManager.getInstance().subscribe((s) => setIsMuted(s.isMuted));
    const unsubSave = SaveSystem.getInstance().subscribe(setSaveData);
    return () => {
      unsubPerf();
      unsubQuality();
      unsubAudio();
      unsubSave();
    };
  }, []);

  if (!isOpen) return null;

  const handleWarp = (loc: TeleportLocation) => {
    AudioManager.getInstance().playUI('click');

    if (loc.category === 'INTERIOR') {
      const success = InteriorManager.getInstance().enterDestination(loc.id, loc.position, onTeleport);
      if (success) {
        onClose();
        return;
      }
    }

    // If player is inside an interior and warps to an exterior landmark, cleanly exit first
    if (InteriorManager.getInstance().currentInterior !== 'NONE') {
      InteriorManager.getInstance().exit(() => {
        onTeleport(loc.position.clone());
      });
    } else {
      onTeleport(loc.position.clone());
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
          backgroundColor: 'rgba(10, 18, 35, 0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              color: 'var(--neon-cyan)',
              fontWeight: 900,
              letterSpacing: '2px',
            }}
          >
            NEXUS SYSTEM MENU
          </span>
          <span className="cyber-badge" style={{ color: '#00ffaa' }}>
            v2.5
          </span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="cyber-btn"
          style={{
            padding: '6px 16px',
            fontSize: '0.9rem',
            color: '#ff3366',
            borderColor: '#ff3366',
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      {/* Navigation Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(6, 12, 24, 0.6)',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('TELEPORT')}
          className="cyber-btn"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: activeTab === 'TELEPORT' ? '#050811' : 'var(--neon-cyan)',
            backgroundColor: activeTab === 'TELEPORT' ? 'var(--neon-cyan)' : 'transparent',
            borderColor: 'var(--neon-cyan)',
            whiteSpace: 'nowrap',
          }}
        >
          ⚡ TELEPORT HUB
        </button>
        <button
          onClick={() => setActiveTab('WORLD')}
          className="cyber-btn"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: activeTab === 'WORLD' ? '#050811' : '#ffaa00',
            backgroundColor: activeTab === 'WORLD' ? '#ffaa00' : 'transparent',
            borderColor: '#ffaa00',
            whiteSpace: 'nowrap',
          }}
        >
          ☀️ TIME & WEATHER
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="cyber-btn"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: activeTab === 'SETTINGS' ? '#050811' : '#38bdf8',
            backgroundColor: activeTab === 'SETTINGS' ? '#38bdf8' : 'transparent',
            borderColor: '#38bdf8',
            whiteSpace: 'nowrap',
          }}
        >
          ⚙️ SETTINGS & AUDIO
        </button>
        <button
          onClick={() => setActiveTab('CODEX')}
          className="cyber-btn"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: activeTab === 'CODEX' ? '#050811' : '#00ffaa',
            backgroundColor: activeTab === 'CODEX' ? '#00ffaa' : 'transparent',
            borderColor: '#00ffaa',
            whiteSpace: 'nowrap',
          }}
        >
          📜 DISCOVERY CODEX
        </button>
        <button
          onClick={() => setActiveTab('GUIDE')}
          className="cyber-btn"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            color: activeTab === 'GUIDE' ? '#050811' : '#a78bfa',
            backgroundColor: activeTab === 'GUIDE' ? '#a78bfa' : 'transparent',
            borderColor: '#a78bfa',
            whiteSpace: 'nowrap',
          }}
        >
          📖 CONTROLS GUIDE
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* =========================================================
            TAB 1: TELEPORT / FAST-TRAVEL HUB
            ========================================================= */}
        {activeTab === 'TELEPORT' && (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                marginBottom: 14,
              }}
            >
              SELECT DESTINATION TO INSTANTLY TELEPORT // ZERO TRANSIT TIME:
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              {TELEPORT_LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => handleWarp(loc)}
                  className="glass-panel"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    border: `1px solid ${loc.color}44`,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = loc.color;
                    e.currentTarget.style.boxShadow = `0 0 16px ${loc.color}55`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${loc.color}44`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.6rem' }}>{loc.icon}</span>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.95rem',
                          color: loc.color,
                          fontWeight: 700,
                        }}
                      >
                        {loc.name}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {loc.district}
                      </div>
                    </div>
                  </div>

                  <button
                    className="cyber-btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      color: loc.color,
                      borderColor: loc.color,
                    }}
                  >
                    WARP
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: TIME OF DAY & WEATHER SIMULATION
            ========================================================= */}
        {activeTab === 'WORLD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
            {/* Time Presets */}
            <div className="glass-panel" style={{ padding: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  color: '#ffaa00',
                  fontSize: '1rem',
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                ☀️ TIME OF DAY PRESETS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <button
                  onClick={() => {
                    TimeSystem.getInstance().setHour(6.0);
                    AudioManager.getInstance().playUI('click');
                  }}
                  className="cyber-btn"
                  style={{ padding: '12px' }}
                >
                  🌅 DAWN (06:00)
                </button>
                <button
                  onClick={() => {
                    TimeSystem.getInstance().setHour(13.0);
                    AudioManager.getInstance().playUI('click');
                  }}
                  className="cyber-btn"
                  style={{ padding: '12px' }}
                >
                  ☀️ NOON (13:00)
                </button>
                <button
                  onClick={() => {
                    TimeSystem.getInstance().setHour(18.5);
                    AudioManager.getInstance().playUI('click');
                  }}
                  className="cyber-btn"
                  style={{ padding: '12px', color: '#ffaa00', borderColor: '#ffaa00' }}
                >
                  🌆 DUSK (18:30)
                </button>
                <button
                  onClick={() => {
                    TimeSystem.getInstance().setHour(23.0);
                    AudioManager.getInstance().playUI('click');
                  }}
                  className="cyber-btn"
                  style={{ padding: '12px', color: '#60a5fa', borderColor: '#60a5fa' }}
                >
                  🌙 MIDNIGHT (23:00)
                </button>
              </div>
            </div>

            {/* Weather Presets */}
            <div className="glass-panel" style={{ padding: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  color: '#38bdf8',
                  fontSize: '1rem',
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                ⛈️ ATMOSPHERIC WEATHER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(['CLEAR', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'FOG'] as WeatherType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      WeatherSystem.getInstance().setWeather(w);
                      AudioManager.getInstance().playUI('click');
                    }}
                    className="cyber-btn"
                    style={{ padding: '10px 8px', fontSize: '0.78rem' }}
                  >
                    {w === 'CLEAR'
                      ? '☀️ CLEAR'
                      : w === 'CLOUDY'
                      ? '☁️ CLOUDY'
                      : w === 'RAIN'
                      ? '🌧️ RAIN'
                      : w === 'HEAVY_RAIN'
                      ? '⚡ STORM'
                      : '🌫️ FOG'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: SETTINGS, AUDIO & QUALITY
            ========================================================= */}
        {activeTab === 'SETTINGS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
            {/* Audio Section */}
            <div className="glass-panel" style={{ padding: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  color: '#00ffaa',
                  fontSize: '1rem',
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                🔊 PROCEDURAL WEB AUDIO
              </div>
              <button
                onClick={() => {
                  AudioManager.getInstance().toggleMute();
                  AudioManager.getInstance().playUI('click');
                }}
                className="cyber-btn"
                style={{
                  padding: '12px 20px',
                  width: '100%',
                  color: isMuted ? '#94a3b8' : '#00ffaa',
                  borderColor: isMuted ? '#94a3b8' : '#00ffaa',
                }}
              >
                {isMuted ? '🔇 AUDIO IS MUTED // CLICK TO UNMUTE' : '🔊 AUDIO IS ACTIVE // CLICK TO MUTE'}
              </button>
            </div>

            {/* Graphics Preset & Custom Controls */}
            <div className="glass-panel" style={{ padding: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--neon-cyan)',
                  fontSize: '1rem',
                  marginBottom: 12,
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>⚙️ GRAPHICS & RENDERING</span>
                {qualityPreset === 'CUSTOM' && (
                  <span className="cyber-badge" style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>
                    CUSTOM MODE
                  </span>
                )}
              </div>

              {/* Preset Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>PROFILE:</span>
                <select
                  value={qualityPreset}
                  onChange={(e) => QualityManager.setPreset(e.target.value as QualityPreset)}
                  className="cyber-select"
                  style={{ flex: 1, padding: 8 }}
                >
                  <option value="AUTO">AUTO (Adaptive Performance & Dynamic Scaling)</option>
                  <option value="ULTRA">ULTRA (2600m Far, 2K Shadows, Full FX)</option>
                  <option value="HIGH">HIGH (1800m Far, 1K Shadows)</option>
                  <option value="MEDIUM">MEDIUM (1200m Far, Balanced Mobile)</option>
                  <option value="LOW">LOW (800m Far, Zero Shadows)</option>
                  <option value="LITE">LITE (500m Far, Minimal Shaders)</option>
                  <option value="CUSTOM">CUSTOM (User Overrides Active)</option>
                </select>
              </div>

              {/* Custom Sliders & Toggles */}
              <div
                style={{
                  borderTop: '1px solid rgba(0, 240, 255, 0.15)',
                  paddingTop: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* 1. Draw Distance Slider */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      marginBottom: 6,
                    }}
                  >
                    <span>DRAW DISTANCE:</span>
                    <strong style={{ color: 'var(--neon-cyan)' }}>
                      {QualityManager.current.drawDistance}m
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="3000"
                    step="50"
                    value={QualityManager.current.drawDistance}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ drawDistance: Number(e.target.value) })
                    }
                    style={{ width: '100%', accentColor: 'var(--neon-cyan)', cursor: 'pointer' }}
                  />
                </div>

                {/* 2. Resolution / DPR Slider */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      marginBottom: 6,
                    }}
                  >
                    <span>RESOLUTION SCALE (DPR):</span>
                    <strong style={{ color: '#00ffaa' }}>
                      {Math.round((QualityManager.current.dpr[1] || 1) * 100)}%
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={QualityManager.current.dpr[1] || 1}
                    onChange={(e) => {
                      const maxDpr = Number(e.target.value);
                      QualityManager.updateCustomSettings({
                        dpr: [Math.min(1, maxDpr), maxDpr],
                      });
                    }}
                    style={{ width: '100%', accentColor: '#00ffaa', cursor: 'pointer' }}
                  />
                </div>

                {/* 3. Realtime Toggles Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 4 }}>
                  {/* Dynamic Shadows */}
                  <button
                    onClick={() =>
                      QualityManager.updateCustomSettings({
                        shadows: !QualityManager.current.shadows,
                        shadowMapSize: QualityManager.current.shadows ? 256 : 1024,
                      })
                    }
                    className="cyber-btn"
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: QualityManager.current.shadows ? '#00ffaa' : '#94a3b8',
                      borderColor: QualityManager.current.shadows ? '#00ffaa' : '#334155',
                    }}
                  >
                    {QualityManager.current.shadows ? '🌑 SHADOWS: ON' : '🌑 SHADOWS: OFF'}
                  </button>

                  {/* Volumetric Clouds */}
                  <button
                    onClick={() =>
                      QualityManager.updateCustomSettings({
                        cloudsEnabled: !QualityManager.current.cloudsEnabled,
                      })
                    }
                    className="cyber-btn"
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: QualityManager.current.cloudsEnabled ? '#38bdf8' : '#94a3b8',
                      borderColor: QualityManager.current.cloudsEnabled ? '#38bdf8' : '#334155',
                    }}
                  >
                    {QualityManager.current.cloudsEnabled ? '☁️ CLOUDS: ON' : '☁️ CLOUDS: OFF'}
                  </button>

                  {/* Wind & Dirt Particles */}
                  <button
                    onClick={() =>
                      QualityManager.updateCustomSettings({
                        windParticlesEnabled: !QualityManager.current.windParticlesEnabled,
                      })
                    }
                    className="cyber-btn"
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: QualityManager.current.windParticlesEnabled ? '#f59e0b' : '#94a3b8',
                      borderColor: QualityManager.current.windParticlesEnabled ? '#f59e0b' : '#334155',
                    }}
                  >
                    {QualityManager.current.windParticlesEnabled ? '💨 PARTICLES: ON' : '💨 PARTICLES: OFF'}
                  </button>

                  {/* Night Streetlights */}
                  <button
                    onClick={() =>
                      QualityManager.updateCustomSettings({
                        nightLightsEnabled: !QualityManager.current.nightLightsEnabled,
                      })
                    }
                    className="cyber-btn"
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: QualityManager.current.nightLightsEnabled ? '#ec4899' : '#94a3b8',
                      borderColor: QualityManager.current.nightLightsEnabled ? '#ec4899' : '#334155',
                    }}
                  >
                    {QualityManager.current.nightLightsEnabled ? '💡 NIGHT LIGHTS: ON' : '💡 NIGHT LIGHTS: OFF'}
                  </button>
                </div>
              </div>

              {/* Live Diagnostics */}
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: 10,
                }}
              >
                <div>
                  FPS: <strong style={{ color: metrics.fps > 45 ? '#00ffaa' : '#f59e0b' }}>{metrics.fps}</strong>
                </div>
                <div>FRAME: {metrics.frameTimeMs}ms</div>
                <div>CALLS: {metrics.drawCalls}</div>
                <div>POLY: {Math.round(metrics.triangles / 1000)}k</div>
              </div>
            </div>

            {/* AI Assistant & Map Quick Launch */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  onClose();
                  onOpenAI();
                }}
                className="cyber-btn"
                style={{ flex: 1, padding: '12px' }}
              >
                🤖 OPEN NEXUS-AI
              </button>
              <button
                onClick={() => {
                  onClose();
                  NavigationSystem.getInstance().toggleMap();
                }}
                className="cyber-btn"
                style={{ flex: 1, padding: '12px', color: '#38bdf8', borderColor: '#38bdf8' }}
              >
                🗺️ OPEN CITY MAP
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: CONTROLS GUIDE
            ========================================================= */}
        {activeTab === 'GUIDE' && (
          <div className="glass-panel" style={{ padding: 20, maxWidth: 640 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                color: 'var(--neon-cyan)',
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              📱 MOBILE TOUCH CONTROLS
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--neon-cyan)' }}>🕹️ Left Screen Half:</strong> Virtual
                Analog Thumbstick. Drag anywhere on the left side to move in 360°.
              </div>
              <div>
                <strong style={{ color: '#ffaa00' }}>👀 Right Screen Half:</strong> Drag to orbit
                and rotate the camera angle.
              </div>
              <div>
                <strong style={{ color: '#38bdf8' }}>🔍 Pinch Gesture:</strong> Pinch with 2
                fingers to zoom camera distance in and out.
              </div>
              <div>
                <strong style={{ color: '#00ffaa' }}>🏃 RUN Button:</strong> Tap to toggle sprint
                running mode.
              </div>
              <div>
                <strong style={{ color: '#ffaa00' }}>⬆️ JUMP Button:</strong> Tap to jump over
                curbs and obstacles.
              </div>
              <div>
                <strong style={{ color: '#22c55e' }}>💬 INTERACT [E]:</strong> Tap when near
                citizens or building doors to talk or enter interiors.
              </div>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                color: 'var(--neon-amber)',
                marginTop: 24,
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              ⌨️ DESKTOP KEYBOARD & MOUSE
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
              }}
            >
              <div><strong>WASD:</strong> Camera-relative movement</div>
              <div><strong>SPACE:</strong> Jump | <strong>SHIFT:</strong> Sprint</div>
              <div><strong>E:</strong> Interact with citizens & enter buildings</div>
              <div><strong>V:</strong> 360° Cinematic Drone Vista Mode</div>
              <div><strong>F5:</strong> Quick Save Progress to Neural Cache</div>
              <div><strong>M:</strong> Fullscreen City Map</div>
              <div><strong>I or ~:</strong> NEXUS-AI Assistant Terminal</div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: DISCOVERY CODEX & OPERATIVE TELEMETRY
            ========================================================= */}
        {activeTab === 'CODEX' && (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                color: '#00ffaa',
                marginBottom: 16,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span>📜 OPERATIVE CODEX & DISCOVERY TELEMETRY</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    SaveSystem.getInstance().save(true);
                    AudioManager.getInstance().playSaveSound();
                  }}
                  className="cyber-btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.6)',
                  }}
                >
                  💾 QUICK SAVE [F5]
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Reset all operative progress, discovered landmarks, and saved location?')) {
                      SaveSystem.getInstance().resetProgress();
                    }
                  }}
                  className="cyber-btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    color: '#ff0055',
                    borderColor: 'rgba(255, 0, 85, 0.6)',
                  }}
                >
                  ⚠️ RESET PROGRESS
                </button>
              </div>
            </div>

            {/* Lifetime Stats Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div className="glass-panel" style={{ padding: 14, border: '1px solid rgba(0, 255, 170, 0.25)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  DISTRICTS EXPLORED
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00ffaa', marginTop: 4 }}>
                  {saveData.discoveredDistricts.length} / 16
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>
                  {Math.round((saveData.discoveredDistricts.length / 16) * 100)}% Metropolitan Coverage
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 14, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  LANDMARKS & POIS
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                  {Object.keys(saveData.discoveredLandmarks).length} / 16
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>
                  Facilities & Sights Logged
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 14, border: '1px solid rgba(255, 170, 0, 0.25)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  DISTANCE TRAVELED
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffaa00', marginTop: 4 }}>
                  {(saveData.stats.distanceTraveledMeters / 1000).toFixed(2)} km
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>
                  Pedestrian Locomotion
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 14, border: '1px solid rgba(192, 132, 252, 0.25)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  FACILITIES ENTERED
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc', marginTop: 4 }}>
                  {saveData.stats.interiorsEnteredCount} Visits
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>
                  {saveData.stats.elevatorsRiddenCount} Elevator Lifts
                </div>
              </div>
            </div>

            {/* Discovered Landmarks Registry */}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.05rem',
                color: 'var(--neon-cyan)',
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              DISCOVERED LANDMARKS & FACILITIES REGISTRY
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 10,
              }}
            >
              {Object.values(saveData.discoveredLandmarks).map((landmark: DiscoveredEntity) => (
                <div
                  key={landmark.id}
                  className="glass-panel"
                  style={{
                    padding: 12,
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>
                        {landmark.name}
                      </span>
                      <span
                        className="cyber-badge"
                        style={{
                          fontSize: '0.62rem',
                          color: landmark.category === 'INTERIOR' ? '#00ffaa' : '#38bdf8',
                          borderColor: landmark.category === 'INTERIOR' ? '#00ffaa' : '#38bdf8',
                        }}
                      >
                        {landmark.category}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: 4,
                      }}
                    >
                      LOGGED: {new Date(landmark.discoveredAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
