import React, { useEffect, useState } from 'react';
import { AudioManager } from '../audio/AudioManager';
import {
  AmbientAudioManager,
  AmbientChannelSettings,
  AmbientSoundscapeState,
} from '../audio/AmbientAudioManager';
import { QualityManager, QualityPreset, QualitySettings } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { NavigationSystem } from '../map/NavigationSystem';
import { CityHistoryEntry, SaveSystem } from '../core/SaveSystem';
import { VehicleInteractionSystem } from '../vehicle/VehicleInteractionSystem';
import { MissionSystem, MissionSystemState } from '../gameplay/MissionSystem';
import { useModalFocus } from './useModalFocus';

interface CyberSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'WORLD' | 'MISSIONS' | 'VIEW' | 'VEHICLE' | 'CODEX' | 'HISTORY' | 'CONTROLS';

interface GraphicsToggleItem {
  key: keyof QualitySettings;
  label: string;
  accent?: string;
}

const POST_OPTICS_TOGGLES: GraphicsToggleItem[] = [
  { key: 'postProcessing', label: 'POST-PROCESS GRADE', accent: 'var(--neon-cyan)' },
  { key: 'bloom', label: 'NEON BLOOM GLOW', accent: 'var(--neon-amber)' },
  { key: 'sharpeningEnabled', label: 'ULTRA CLARITY SHARP', accent: 'var(--neon-cyan)' },
  { key: 'vignetteEnabled', label: 'OPTICAL VIGNETTE', accent: 'var(--neon-emerald)' },
  { key: 'antiAliasing', label: 'ANTI-ALIASING (MSAA)', accent: 'var(--neon-cyan)' },
];

const LIGHTING_ATMOS_TOGGLES: GraphicsToggleItem[] = [
  { key: 'shadows', label: 'DYNAMIC SHADOWS', accent: 'var(--neon-amber)' },
  { key: 'nightLightsEnabled', label: 'STREET POINT LIGHTS', accent: 'var(--neon-amber)' },
  { key: 'volumetricRaysEnabled', label: 'SOLAR GOD RAYS', accent: 'var(--neon-amber)' },
  { key: 'starsEnabled', label: 'STARFIELD DOME', accent: 'var(--neon-cyan)' },
  { key: 'horizonHazeEnabled', label: 'HORIZON GLOW BAND', accent: 'var(--neon-cyan)' },
  { key: 'fogEnabled', label: 'DISTANCE FOG', accent: 'var(--neon-emerald)' },
  { key: 'cloudsEnabled', label: 'VOLUMETRIC CLOUDS', accent: 'var(--neon-cyan)' },
];

const SURFACE_WEATHER_TOGGLES: GraphicsToggleItem[] = [
  { key: 'rainParticlesEnabled', label: 'RAIN STREAKS', accent: 'var(--neon-cyan)' },
  { key: 'windParticlesEnabled', label: 'WIND EMBERS & MOTES', accent: 'var(--neon-amber)' },
  { key: 'wetReflectionsEnabled', label: 'WET ROAD SPECULAR', accent: 'var(--neon-cyan)' },
  { key: 'normalMapsEnabled', label: 'RELIEF NORMAL MAPS', accent: 'var(--neon-emerald)' },
];

const WORLD_ENTITY_TOGGLES: GraphicsToggleItem[] = [
  { key: 'vegetationEnabled', label: 'TREES & BOTANICALS', accent: 'var(--neon-emerald)' },
  { key: 'streetFurnitureEnabled', label: 'PROPS & SKYBRIDGES', accent: 'var(--neon-cyan)' },
  { key: 'billboardsEnabled', label: 'VIDEO BILLBOARDS', accent: 'var(--neon-amber)' },
  { key: 'trafficEnabled', label: 'VEHICLE TRAFFIC', accent: 'var(--neon-cyan)' },
  { key: 'npcsEnabled', label: 'PEDESTRIAN CROWD', accent: 'var(--neon-emerald)' },
];

interface GraphicsToggleGridProps {
  items: GraphicsToggleItem[];
  qualitySettings: QualitySettings;
}

const GraphicsToggleGrid: React.FC<GraphicsToggleGridProps> = React.memo(({ items, qualitySettings }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
    {items.map((item) => {
      const isOn = Boolean(qualitySettings[item.key]);
      const accentColor = item.accent || 'var(--accent)';
      return (
        <button
          key={String(item.key)}
          type="button"
          aria-pressed={isOn}
          className="cyber-btn"
          onClick={() =>
            QualityManager.updateCustomSettings({
              [item.key]: !isOn,
            } as Partial<QualitySettings>)
          }
          style={{
            padding: '7px 8px',
            fontSize: '0.66rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            textAlign: 'left',
            color: isOn ? 'var(--text)' : 'var(--muted)',
            borderColor: 'var(--border)',
            borderBottom: isOn ? `1px solid ${accentColor}` : '1px solid var(--border)',
            background: isOn ? 'var(--raised)' : 'var(--surface)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: isOn ? accentColor : 'var(--muted)',
              flexShrink: 0,
            }}
          >
            {isOn ? 'ON' : 'OFF'}
          </span>
        </button>
      );
    })}
  </div>
));

export const CyberSideMenu: React.FC<CyberSideMenuProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<Section>('WORLD');
  const [quality, setQuality] = useState<QualityPreset>(() => QualityManager.preset);
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(() => QualityManager.current);
  const [muted, setMuted] = useState(AudioManager.getInstance().getSettings().muted);
  const [ambientState, setAmbientState] = useState<AmbientSoundscapeState>(() =>
    AmbientAudioManager.getInstance().getState()
  );
  const [ambientChannels, setAmbientChannels] = useState<AmbientChannelSettings>(() =>
    AmbientAudioManager.getInstance().getChannelSettings()
  );
  const [history, setHistory] = useState<CityHistoryEntry[]>(() => SaveSystem.getInstance().getData().cityHistory);
  const [landmarks, setLandmarks] = useState(() => SaveSystem.getInstance().getData().discoveredLandmarks);
  const [vehicleState, setVehicleState] = useState(() => VehicleInteractionSystem.getInstance().getState());
  const [missionState, setMissionState] = useState<MissionSystemState>(() => MissionSystem.getInstance().getState());
  const [currentWeather, setCurrentWeather] = useState(WeatherSystem.getInstance().getState().currentWeather);
  const [timeState, setTimeState] = useState(() => TimeSystem.getInstance().getState());
  const menuRef = useModalFocus(isOpen, onClose);

  useEffect(() => {
    const uQual = QualityManager.subscribe((s) => {
      setQuality(QualityManager.preset);
      setQualitySettings(s);
    });
    const uWea = WeatherSystem.getInstance().subscribe((s) => setCurrentWeather(s.currentWeather));
    const uTime = TimeSystem.getInstance().subscribe(setTimeState);
    const uAud = AudioManager.getInstance().subscribe((s) => setMuted(s.muted));
    const uAmb = AmbientAudioManager.getInstance().subscribe((s) => {
      setAmbientState(s);
      setAmbientChannels(AmbientAudioManager.getInstance().getChannelSettings());
    });
    const uSave = SaveSystem.getInstance().subscribe((d) => {
      setHistory(d.cityHistory);
      setLandmarks(d.discoveredLandmarks);
    });
    const uVeh = VehicleInteractionSystem.getInstance().subscribe(setVehicleState);
    const uMis = MissionSystem.getInstance().subscribe(setMissionState);
    return () => {
      uQual();
      uWea();
      uTime();
      uAud();
      uAmb();
      uSave();
      uVeh();
      uMis();
    };
  }, []);

  if (!isOpen) return null;

  const updateAmbientChannel = (partial: Partial<AmbientChannelSettings>) => {
    AudioManager.getInstance().ensureContext();
    AmbientAudioManager.getInstance().updateChannelSettings(partial);
    setAmbientChannels(AmbientAudioManager.getInstance().getChannelSettings());
  };

  return (
    <>
      <button
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 140,
          border: 0,
          background: 'rgba(19, 18, 23, 0.68)',
          cursor: 'pointer',
        }}
      />
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-menu-title"
        tabIndex={-1}
        className="world-menu"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(410px, 94vw)',
          zIndex: 150,
          padding: '22px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div
              id="world-menu-title"
              style={{
                color: 'var(--text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '1.15rem',
              }}
            >
              NEXUS CONSOLE
            </div>
            <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: '0.75rem' }}>
              Metropolitan simulation directives
            </div>
          </div>
          <button
            className="cyber-btn"
            onClick={onClose}
            style={{ padding: '5px 10px', color: 'var(--negative)', borderColor: 'var(--border)' }}
          >
            CLOSE
          </button>
        </header>

        <nav aria-label="Menu sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {(['WORLD', 'MISSIONS', 'VIEW', 'VEHICLE', 'CODEX', 'HISTORY', 'CONTROLS'] as Section[]).map((item) => (
            <button
              key={item}
              aria-pressed={section === item}
              className="cyber-btn"
              onClick={() => setSection(item)}
              style={{
                padding: '7px 4px',
                fontSize: '0.68rem',
                color: section === item ? 'var(--text)' : 'var(--muted)',
                background: section === item ? 'var(--raised)' : 'var(--surface)',
                borderColor: 'var(--border)',
                borderBottom: section === item ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {item === 'VIEW' ? 'GRAPHICS' : item}
            </button>
          ))}
        </nav>

        <div className="menu-content" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
          {section === 'WORLD' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="section-heading" style={{ margin: 0 }}>
                    SOLAR PHASE & GLOBAL ILLUMINATION
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--neon-amber)', fontWeight: 700 }}>
                    {timeState.timeString} // {timeState.subPhaseLabel}
                  </span>
                </div>

                {/* Live Sky Palette & Global Illumination Readout */}
                <div
                  style={{
                    marginTop: 8,
                    padding: '9px 11px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(7, 9, 14, 0.6)',
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 10px',
                      fontSize: '0.6rem',
                      color: 'var(--text-secondary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>
                      SUN ELEV:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {Math.round(timeState.sunElevationDeg)}°
                      </strong>
                    </div>
                    <div>
                      SPECTRUM:{' '}
                      <strong style={{ color: 'var(--neon-amber)' }}>
                        {timeState.colorTemperatureK}K
                      </strong>
                    </div>
                    <div>
                      GI HEMISPHERE:{' '}
                      <strong style={{ color: 'var(--neon-cyan)' }}>
                        {Math.round(timeState.hemiIntensity * 100)}%
                      </strong>
                    </div>
                    <div>
                      SKY BOUNCE:{' '}
                      <strong style={{ color: 'var(--neon-emerald)' }}>
                        {Math.round(timeState.giBounceIntensity * 100)}%
                      </strong>
                    </div>
                  </div>

                  {/* Live Interpolated Sky & GI Color Swatches */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {(
                      [
                        ['ZENITH', timeState.skyTopColor],
                        ['MID-SKY', timeState.skyMidColor],
                        ['HORIZON', timeState.skyHorizonColor],
                        ['GI BOUNCE', timeState.giBounceColor],
                      ] as const
                    ).map(([label, hex]) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '0.54rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 2,
                            background: hex,
                            border: '1px solid rgba(255,255,255,0.22)',
                            flexShrink: 0,
                          }}
                        />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Continuous 24-Hour Time Scrubber */}
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: '0.6rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SOLAR ORBIT SCRUBBER</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{timeState.timeString} HRS</strong>
                    </div>
                    <input
                      aria-label="Solar orbit time scrubber"
                      type="range"
                      min={0}
                      max={23.95}
                      step={0.05}
                      value={timeState.timeOfDay}
                      onChange={(e) => TimeSystem.getInstance().setTime(Number(e.target.value))}
                    />
                  </label>

                  {/* Diurnal Progression Rate Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {(
                      [
                        ['PAUSE', 0],
                        ['1X LIVE', 1],
                        ['4X FAST', 4],
                        ['12X ORBIT', 12],
                      ] as const
                    ).map(([label, mult]) => {
                      const active =
                        (mult === 0 && timeState.isPaused) ||
                        (!timeState.isPaused && Math.abs(timeState.timeScaleMultiplier - mult) < 0.1);
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={active}
                          className="cyber-btn"
                          onClick={() => TimeSystem.getInstance().setTimeScaleMultiplier(mult)}
                          style={{
                            padding: '5px 4px',
                            fontSize: '0.56rem',
                            color: active ? '#07090e' : 'var(--text-secondary)',
                            background: active ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.03)',
                            borderColor: active ? 'var(--neon-cyan)' : 'var(--border-subtle)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  {(
                    [
                      ['DAWN // 06:00', 6.2],
                      ['ZENITH // 13:00', 13],
                      ['SOLAR DUSK // 18:30', 18.5],
                      ['NOCTURNE // 23:00', 23],
                    ] as const
                  ).map(([label, hour]) => (
                    <button
                      key={label}
                      className="cyber-btn"
                      onClick={() => TimeSystem.getInstance().setTime(hour)}
                      style={{ padding: '10px 8px', fontSize: '0.68rem' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-heading">ATMOSPHERIC PRECIPITATION</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  {(['CLEAR', 'RAIN', 'HEAVY_RAIN', 'FOG'] as WeatherType[]).map((w) => (
                    <button
                      key={w}
                      className="cyber-btn"
                      aria-pressed={w === currentWeather}
                      onClick={() => WeatherSystem.getInstance().setWeather(w)}
                      style={{ padding: 10, fontSize: '0.7rem' }}
                    >
                      {w === 'HEAVY_RAIN' ? 'MONSOON STORM' : w}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-heading">GLOBAL WIND FORCE (ALL PARTICLES)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
                  {(
                    [
                      ['CALM', 0.45],
                      ['BREEZE', 1.0],
                      ['GALE', 1.75],
                      ['TEMPEST', 2.6],
                    ] as const
                  ).map(([label, mult]) => (
                    <button
                      key={label}
                      type="button"
                      className="cyber-btn"
                      onClick={() => WindSystem.getInstance().setWindMultiplier(mult)}
                      style={{ padding: '8px 4px', fontSize: '0.62rem' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Procedural Ambient City Soundscape Mixer */}
              <div
                style={{
                  padding: '12px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(7, 9, 14, 0.6)',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="section-heading" style={{ margin: 0 }}>
                    AMBIENT SOUNDSCAPE SYNTH
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--neon-amber)', fontWeight: 700 }}>
                    {ambientState.profileName}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px 10px',
                    fontSize: '0.6rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>
                    TRAFFIC HUM:{' '}
                    <strong style={{ color: 'var(--neon-cyan)' }}>
                      {Math.round(ambientState.trafficLevel * 100)}%
                    </strong>
                  </div>
                  <div>
                    CANYON WIND:{' '}
                    <strong style={{ color: 'var(--neon-emerald)' }}>
                      {Math.round(ambientState.windLevel * 100)}%
                    </strong>
                  </div>
                  <div>
                    RAIN WASH:{' '}
                    <strong style={{ color: 'var(--neon-cyan)' }}>
                      {Math.round(ambientState.rainLevel * 100)}%
                    </strong>
                  </div>
                  <div>
                    NEON DRONE:{' '}
                    <strong style={{ color: 'var(--neon-amber)' }}>
                      {Math.round(ambientState.nocturneDroneLevel * 100)}%
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(
                    [
                      ['trafficEnabled', 'DISTANT TRAFFIC'],
                      ['windEnabled', 'CANYON WIND'],
                      ['rainEnabled', 'RAIN & THUNDER'],
                      ['droneEnabled', 'CITY HARMONICS'],
                    ] as const
                  ).map(([channelKey, label]) => {
                    const active = ambientChannels[channelKey];
                    return (
                      <button
                        key={channelKey}
                        type="button"
                        aria-pressed={active}
                        className="cyber-btn"
                        onClick={() => updateAmbientChannel({ [channelKey]: !active })}
                        style={{
                          padding: '6px 8px',
                          fontSize: '0.58rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderColor: active ? 'var(--neon-cyan)' : 'var(--border-subtle)',
                          color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        <span>{label}</span>
                        <strong style={{ color: active ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                          {active ? 'ON' : 'OFF'}
                        </strong>
                      </button>
                    );
                  })}
                </div>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    fontSize: '0.62rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SOUNDSCAPE LEVEL</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {Math.round(ambientChannels.ambientVolume * 100)}%
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={ambientChannels.ambientVolume}
                    onChange={(e) => updateAmbientChannel({ ambientVolume: Number(e.target.value) })}
                  />
                </label>
              </div>
            </section>
          )}

          {section === 'MISSIONS' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="section-heading">CIVIC ASSIGNMENTS</div>
              {missionState.active && (
                <div
                  style={{
                    padding: 12,
                    border: '1px solid var(--neon-emerald)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ color: 'var(--neon-emerald)', fontSize: '0.72rem', fontWeight: 700 }}>
                    ACTIVE // {missionState.active.title}
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    {missionState.active.targetLabel}
                  </div>
                </div>
              )}
              {missionState.missions.map((m) => (
                <article
                  key={m.id}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      color: m.status === 'COMPLETED' ? 'var(--text-muted)' : 'var(--neon-amber)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{m.title}</span>
                    <span>{m.status}</span>
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.45 }}>
                    {m.briefing}
                  </div>
                  {m.status === 'AVAILABLE' && !missionState.active && (
                    <button
                      className="cyber-btn"
                      onClick={() => MissionSystem.getInstance().acceptMission(m.id)}
                      style={{ marginTop: 8, padding: '5px 10px', fontSize: '0.66rem' }}
                    >
                      ACCEPT CONTRACT // +{m.reward} REP
                    </button>
                  )}
                </article>
              ))}
              <div className="section-heading">FACTION STANDING</div>
              {Object.entries(missionState.factionRelations).map(([faction, value]) => (
                <div key={faction} className="menu-note" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{faction.replaceAll('_', ' ')}</span>
                  <span style={{ color: value >= 0 ? 'var(--neon-emerald)' : 'var(--neon-magenta)' }}>
                    {value > 0 ? '+' : ''}
                    {value}
                  </span>
                </div>
              ))}
            </section>
          )}

          {section === 'VIEW' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="section-heading">RENDERING PROFILE</div>
                <select
                  aria-label="Graphics profile"
                  className="cyber-select"
                  value={quality}
                  onChange={(e) => QualityManager.setPreset(e.target.value as QualityPreset)}
                  style={{ width: '100%', marginTop: 8, padding: 10 }}
                >
                  <option value="AUTO">AUTO ADAPTIVE</option>
                  <option value="LITE">LITE</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="ULTRA">ULTRA // 4K SHADOWS & CLARITY</option>
                  <option value="CUSTOM">CUSTOM // USER CONFIGURED</option>
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 8 }}>
                  {(['MEDIUM', 'HIGH', 'ULTRA', 'CUSTOM'] as QualityPreset[]).map((preset) => (
                    <button
                      key={preset}
                      className="cyber-btn"
                      aria-pressed={quality === preset}
                      onClick={() => QualityManager.setPreset(preset)}
                      style={{
                        padding: '7px 4px',
                        fontSize: '0.62rem',
                        color: quality === preset ? '#07090e' : 'var(--text-primary)',
                        background:
                          quality === preset
                            ? preset === 'ULTRA'
                              ? 'var(--neon-amber)'
                              : preset === 'CUSTOM'
                              ? 'var(--neon-emerald)'
                              : 'var(--neon-cyan)'
                            : 'rgba(255, 255, 255, 0.04)',
                        borderColor:
                          quality === preset
                            ? preset === 'ULTRA'
                              ? 'var(--neon-amber)'
                              : preset === 'CUSTOM'
                              ? 'var(--neon-emerald)'
                              : 'var(--neon-cyan)'
                            : 'var(--border-subtle)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '9px 11px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(7, 9, 14, 0.65)',
                  borderRadius: 4,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '5px 10px',
                  fontSize: '0.62rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <div>
                  MODE: <strong style={{ color: 'var(--neon-amber)' }}>{quality}</strong>
                </div>
                <div>
                  DPR: <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.dpr[1]}x MAX</strong>
                </div>
                <div>
                  HORIZON: <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.drawDistance}M</strong>
                </div>
                <div>
                  SHADOWS:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {qualitySettings.shadows ? `${qualitySettings.shadowMapSize}PX` : 'OFF'}
                  </strong>
                </div>
                <div>
                  SECTORS: <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.maxActiveChunks} ACTIVE</strong>
                </div>
                <div>
                  REFLECTIONS: <strong style={{ color: 'var(--neon-cyan)' }}>{qualitySettings.reflectionQuality}</strong>
                </div>
              </div>

              {/* Custom Graphics Master Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  className="cyber-btn"
                  onClick={() => QualityManager.setAllGraphicsToggles(true)}
                  style={{
                    padding: '8px 6px',
                    fontSize: '0.62rem',
                    color: 'var(--neon-emerald)',
                    borderColor: 'var(--neon-emerald)',
                  }}
                >
                  ENABLE ALL FX
                </button>
                <button
                  type="button"
                  className="cyber-btn"
                  onClick={() => QualityManager.setAllGraphicsToggles(false)}
                  style={{
                    padding: '8px 6px',
                    fontSize: '0.62rem',
                    color: 'var(--neon-amber)',
                    borderColor: 'var(--neon-amber)',
                  }}
                >
                  DISABLE ALL FX
                </button>
              </div>

              {/* 1. Post-Processing & Optics Toggles */}
              <div>
                <div className="section-heading">POST-PROCESSING & OPTICS TOGGLES</div>
                <GraphicsToggleGrid items={POST_OPTICS_TOGGLES} qualitySettings={qualitySettings} />
              </div>

              {/* 2. Lighting & Atmosphere Toggles */}
              <div>
                <div className="section-heading">LIGHTING & ATMOSPHERE TOGGLES</div>
                <GraphicsToggleGrid items={LIGHTING_ATMOS_TOGGLES} qualitySettings={qualitySettings} />
              </div>

              {/* 3. Surfaces & Weather FX Toggles */}
              <div>
                <div className="section-heading">SURFACES & WEATHER FX TOGGLES</div>
                <GraphicsToggleGrid items={SURFACE_WEATHER_TOGGLES} qualitySettings={qualitySettings} />
              </div>

              {/* 4. World Detail & Entities Toggles */}
              <div>
                <div className="section-heading">WORLD DETAIL & ENTITY TOGGLES</div>
                <GraphicsToggleGrid items={WORLD_ENTITY_TOGGLES} qualitySettings={qualitySettings} />
              </div>

              {/* 5. Multi-Tier & Budget Sliders */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '10px 12px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(7, 9, 14, 0.5)',
                  borderRadius: 4,
                }}
              >
                <div className="section-heading">CUSTOM GRAPHICS PARAMETERS</div>

                {/* Reflection Quality Selector */}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    CUBEMAP REFLECTIONS // <strong style={{ color: 'var(--neon-cyan)' }}>{qualitySettings.reflectionQuality}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {(['OFF', 'LOW', 'MEDIUM', 'HIGH'] as QualitySettings['reflectionQuality'][]).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        className="cyber-btn"
                        aria-pressed={qualitySettings.reflectionQuality === tier}
                        onClick={() => QualityManager.updateCustomSettings({ reflectionQuality: tier })}
                        style={{
                          padding: '5px 4px',
                          fontSize: '0.58rem',
                          color: qualitySettings.reflectionQuality === tier ? '#07090e' : 'var(--text-secondary)',
                          background:
                            qualitySettings.reflectionQuality === tier
                              ? 'var(--neon-cyan)'
                              : 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shadow Resolution Selector */}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    SHADOW MAP RESOLUTION // <strong style={{ color: 'var(--neon-amber)' }}>{qualitySettings.shadowMapSize}PX</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {([512, 1024, 2048, 4096] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className="cyber-btn"
                        aria-pressed={qualitySettings.shadowMapSize === sz}
                        onClick={() => QualityManager.updateCustomSettings({ shadowMapSize: sz, shadows: true })}
                        style={{
                          padding: '5px 4px',
                          fontSize: '0.58rem',
                          color: qualitySettings.shadowMapSize === sz ? '#07090e' : 'var(--text-secondary)',
                          background:
                            qualitySettings.shadowMapSize === sz
                              ? 'var(--neon-amber)'
                              : 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geometry LOD Tier */}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    GEOMETRY DETAIL (LOD) // <strong style={{ color: 'var(--neon-emerald)' }}>{qualitySettings.LODQuality}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {(['LOW', 'MEDIUM', 'HIGH'] as QualitySettings['LODQuality'][]).map((lod) => (
                      <button
                        key={lod}
                        type="button"
                        className="cyber-btn"
                        aria-pressed={qualitySettings.LODQuality === lod}
                        onClick={() => QualityManager.updateCustomSettings({ LODQuality: lod })}
                        style={{
                          padding: '5px 4px',
                          fontSize: '0.58rem',
                          color: qualitySettings.LODQuality === lod ? '#07090e' : 'var(--text-secondary)',
                          background:
                            qualitySettings.LODQuality === lod
                              ? 'var(--neon-emerald)'
                              : 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        {lod}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Resolution Scale (DPR) */}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    RENDER RESOLUTION SCALE // <strong style={{ color: 'var(--neon-cyan)' }}>{qualitySettings.dpr[1]}x</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {(
                      [
                        ['0.75x', [0.65, 0.75]],
                        ['1.0x', [0.85, 1.0]],
                        ['1.5x', [1.0, 1.5]],
                        ['2.0x', [1.5, 2.0]],
                      ] as const
                    ).map(([label, dprTuple]) => (
                      <button
                        key={label}
                        type="button"
                        className="cyber-btn"
                        aria-pressed={Math.abs(qualitySettings.dpr[1] - dprTuple[1]) < 0.05}
                        onClick={() =>
                          QualityManager.updateCustomSettings({
                            dpr: [dprTuple[0], dprTuple[1]],
                          })
                        }
                        style={{
                          padding: '5px 4px',
                          fontSize: '0.58rem',
                          color:
                            Math.abs(qualitySettings.dpr[1] - dprTuple[1]) < 0.05
                              ? '#07090e'
                              : 'var(--text-secondary)',
                          background:
                            Math.abs(qualitySettings.dpr[1] - dprTuple[1]) < 0.05
                              ? 'var(--neon-cyan)'
                              : 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Draw Distance Slider */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>HORIZON DRAW DISTANCE</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.drawDistance}M</strong>
                  </div>
                  <input
                    type="range"
                    min={240}
                    max={1500}
                    step={40}
                    value={qualitySettings.drawDistance}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ drawDistance: Number(e.target.value) })
                    }
                  />
                </label>

                {/* Active Sectors Slider */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>STREAMED CITY SECTORS</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.maxActiveChunks}</strong>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={140}
                    step={4}
                    value={qualitySettings.maxActiveChunks}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ maxActiveChunks: Number(e.target.value) })
                    }
                  />
                </label>

                {/* Max Dynamic Lights Slider */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>MAX DYNAMIC POINT LIGHTS</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{qualitySettings.maxLights}</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={2}
                    value={qualitySettings.maxLights}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ maxLights: Number(e.target.value) })
                    }
                  />
                </label>

                {/* Particle Density Slider */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>PARTICLE DENSITY</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{Math.round(qualitySettings.particlesDensity * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.8}
                    step={0.1}
                    value={qualitySettings.particlesDensity}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ particlesDensity: Number(e.target.value) })
                    }
                  />
                </label>

                {/* Crowd Density Slider */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CITIZEN CROWD DENSITY</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{Math.round(qualitySettings.NPCDensity * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.6}
                    step={0.1}
                    value={qualitySettings.NPCDensity}
                    onChange={(e) =>
                      QualityManager.updateCustomSettings({ NPCDensity: Number(e.target.value) })
                    }
                  />
                </label>
              </div>

              <button
                className="cyber-btn"
                onClick={() => AudioManager.getInstance().toggleMute()}
                style={{
                  padding: 11,
                  color: muted ? 'var(--text-muted)' : 'var(--neon-emerald)',
                  borderColor: muted ? 'var(--border-subtle)' : 'var(--neon-emerald)',
                }}
              >
                {muted ? 'ACOUSTICS MUTED // UNMUTE' : 'ACOUSTICS ACTIVE // MUTE'}
              </button>
              <button
                className="cyber-btn"
                onClick={() => {
                  onClose();
                  NavigationSystem.getInstance().setMapOpen(true);
                }}
                style={{ padding: 11 }}
              >
                OPEN METROPOLITAN ATLAS [M]
              </button>
            </section>
          )}

          {section === 'VEHICLE' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="section-heading">HOVER-COUPE CALIBRATION</div>
              <div className="menu-note">
                {vehicleState.mode === 'RIDING'
                  ? 'HOVER-COUPE TELEMETRY LINKED.'
                  : vehicleState.mode === 'TRANSIT_LINKED'
                  ? 'AUTONOMOUS SHUTTLE LINKED.'
                  : 'Approach the parked hover-coupe or transit shuttle and press [E].'}
              </div>
              {(['speed', 'handling', 'neon'] as const).map((upg) => (
                <button
                  key={upg}
                  className="cyber-btn"
                  onClick={() => VehicleInteractionSystem.getInstance().upgrade(upg)}
                  style={{
                    padding: 11,
                    textAlign: 'left',
                    color: vehicleState.upgrades[upg] > 0 ? 'var(--neon-emerald)' : 'var(--text-secondary)',
                    borderColor: vehicleState.upgrades[upg] > 0 ? 'var(--neon-emerald)' : 'var(--border-subtle)',
                  }}
                >
                  {vehicleState.upgrades[upg] > 0 ? '● ' : '○ '}
                  {upg.toUpperCase()} MODULE // LV {vehicleState.upgrades[upg]}/3
                </button>
              ))}
            </section>
          )}

          {section === 'CODEX' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="section-heading">ARCHITECTURAL CODEX</div>
              {Object.values(landmarks).length === 0 ? (
                <div className="menu-note">Explore the city to log architectural landmarks into your codex.</div>
              ) : (
                Object.values(landmarks).map((lm) => (
                  <article key={lm.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--neon-amber)', fontSize: '0.74rem', fontWeight: 700 }}>{lm.name}</div>
                    <div style={{ marginTop: 3, color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                      {lm.category} // SURVEYED
                    </div>
                  </article>
                ))
              )}
            </section>
          )}

          {section === 'HISTORY' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="section-heading">TELEMETRY LOG</div>
              {history.length === 0 ? (
                <div className="menu-note">No civic events recorded in this session yet.</div>
              ) : (
                history.slice(0, 12).map((entry) => (
                  <article key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--neon-cyan)', fontSize: '0.72rem', fontWeight: 600 }}>{entry.title}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.45 }}>
                      {entry.detail}
                    </div>
                  </article>
                ))
              )}
            </section>
          )}

          {section === 'CONTROLS' && (
            <section style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.8 }}>
              <div className="section-heading">OPERATIVE CONTROLS</div>
              <p>
                <strong>WASD / Arrows</strong> Traverse · <strong>SHIFT</strong> Sprint
              </p>
              <p>
                <strong>SPACE</strong> Jump · <strong>E</strong> Interact / Board
              </p>
              <p>
                <strong>M</strong> Metropolitan Atlas · <strong>V</strong> Aerial Vista
              </p>
              <p>
                <strong>ESC</strong> Dismiss Overlay
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
};
