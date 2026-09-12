import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { AudioManager } from '../audio/AudioManager';
import { QualityManager, QualityPreset } from '../rendering/QualityManager';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { NavigationSystem } from '../map/NavigationSystem';

interface TeleportLocation {
  id: string;
  name: string;
  category: string;
  district: string;
  position: THREE.Vector3;
  icon: string;
  color: string;
}

const TELEPORT_LOCATIONS: TeleportLocation[] = [
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
  {
    id: 'labs',
    name: 'Nexus Advanced Labs',
    category: 'INTERIOR',
    district: 'Central East Avenue',
    position: new THREE.Vector3(12, 0.2, 32),
    icon: '🧪',
    color: '#00f0ff',
  },
  {
    id: 'lounge',
    name: 'Neon Velocity Lounge',
    category: 'INTERIOR',
    district: 'West Night District',
    position: new THREE.Vector3(-12, 0.2, 32),
    icon: '🍸',
    color: '#ec4899',
  },
  {
    id: 'clinic',
    name: 'Krom-Doc Ripperdoc Clinic',
    category: 'INTERIOR',
    district: 'Medical Alley',
    position: new THREE.Vector3(-12, 0.2, -32),
    icon: '💉',
    color: '#06b6d4',
  },
  {
    id: 'netrunner',
    name: 'Black-Ice Hacker Safehouse',
    category: 'INTERIOR',
    district: 'Neural Undergrid',
    position: new THREE.Vector3(12, 0.2, -32),
    icon: '💻',
    color: '#10b981',
  },
  {
    id: 'ramen',
    name: 'Tokyo-Neo Synth-Ramen',
    category: 'INTERIOR',
    district: 'East Food Bazaar',
    position: new THREE.Vector3(32, 0.2, 12),
    icon: '🍜',
    color: '#f59e0b',
  },
  {
    id: 'hangar',
    name: 'Aero-Cargo Drone Bay',
    category: 'INTERIOR',
    district: 'Industrial Harbor',
    position: new THREE.Vector3(32, 0.2, -12),
    icon: '🛸',
    color: '#f97316',
  },
  {
    id: 'penthouse',
    name: 'Apex Sky Suite Penthouse',
    category: 'INTERIOR',
    district: 'Sky Spire Towers',
    position: new THREE.Vector3(-32, 0.2, 12),
    icon: '🏙️',
    color: '#38bdf8',
  },
  {
    id: 'vault',
    name: 'Megacorp Secure Data Vault',
    category: 'INTERIOR',
    district: 'Corporate Core',
    position: new THREE.Vector3(-32, 0.2, -12),
    icon: '🔒',
    color: '#3b82f6',
  },
  {
    id: 'greenhouse',
    name: 'Biosphere Hydroponic Flora Lab',
    category: 'INTERIOR',
    district: 'Biosphere District',
    position: new THREE.Vector3(42, 0.2, 75),
    icon: '🌿',
    color: '#22c55e',
  },
  {
    id: 'metro',
    name: 'Hyperloop Metro Transit Hub',
    category: 'INTERIOR',
    district: 'Subterranean Rail',
    position: new THREE.Vector3(0, 0.2, 48),
    icon: '🚇',
    color: '#fbbf24',
  },
  {
    id: 'arcade',
    name: 'Cyber-Strike 2099 Retro Arcade',
    category: 'INTERIOR',
    district: 'South Entertainment Grid',
    position: new THREE.Vector3(0, 0.2, -48),
    icon: '🕹️',
    color: '#d946ef',
  },
];

interface CyberMenuModalProps {
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
  const [activeTab, setActiveTab] = useState<'TELEPORT' | 'WORLD' | 'SETTINGS' | 'GUIDE'>('TELEPORT');
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
    return () => {
      unsubPerf();
      unsubQuality();
      unsubAudio();
    };
  }, []);

  if (!isOpen) return null;

  const handleWarp = (pos: THREE.Vector3) => {
    AudioManager.getInstance().playUI('click');
    onTeleport(pos.clone());
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
                  onClick={() => handleWarp(loc.position)}
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

            {/* Graphics Preset */}
            <div className="glass-panel" style={{ padding: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--neon-cyan)',
                  fontSize: '1rem',
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                ⚙️ GRAPHICS PRESET
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>PRESET:</span>
                <select
                  value={qualityPreset}
                  onChange={(e) => QualityManager.setPreset(e.target.value as QualityPreset)}
                  className="cyber-select"
                  style={{ flex: 1, padding: 8 }}
                >
                  <option value="ULTRA">ULTRA (Maximum Shadows & Draw Distance)</option>
                  <option value="HIGH">HIGH (Standard High-End)</option>
                  <option value="MEDIUM">MEDIUM (Balanced Mobile/Laptop)</option>
                  <option value="LOW">LOW (Optimized Performance)</option>
                  <option value="LITE">LITE (Zero Shadows & Low Shader)</option>
                </select>
              </div>

              {/* Live Diagnostics */}
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  gap: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <div>
                  FPS: <strong style={{ color: '#00ffaa' }}>{metrics.fps}</strong>
                </div>
                <div>FRAME: {metrics.frameTimeMs}ms</div>
                <div>CALLS: {metrics.drawCalls}</div>
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
              <div><strong>M:</strong> Fullscreen City Map</div>
              <div><strong>I or ~:</strong> NEXUS-AI Assistant Terminal</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
