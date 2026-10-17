import React, { useEffect, useState } from 'react';
import { AudioManager } from '../audio/AudioManager';
import { QualityManager, QualityPreset } from '../rendering/QualityManager';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { NavigationSystem } from '../map/NavigationSystem';
import { SaveSystem, CityHistoryEntry } from '../core/SaveSystem';
import { VehicleInteractionSystem } from '../vehicle/VehicleInteractionSystem';
import { MissionSystem, MissionSystemState } from '../gameplay/MissionSystem';
import { useModalFocus } from './useModalFocus';

interface CyberSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'WORLD' | 'MISSIONS' | 'VIEW' | 'VEHICLE' | 'CODEX' | 'HISTORY' | 'CONTROLS';

export const CyberSideMenu: React.FC<CyberSideMenuProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<Section>('WORLD');
  const [quality, setQuality] = useState<QualityPreset>(QualityManager.preset);
  const [isMuted, setIsMuted] = useState(AudioManager.getInstance().getSettings().isMuted);
  const [history, setHistory] = useState<CityHistoryEntry[]>(() => SaveSystem.getInstance().getData().cityHistory);
  const [landmarks, setLandmarks] = useState(() => SaveSystem.getInstance().getData().discoveredLandmarks);
  const [vehicleState, setVehicleState] = useState(() => VehicleInteractionSystem.getInstance().getState());
  const [fleet, setFleet] = useState(() => SaveSystem.getInstance().getData().vehicleFleet || []);
  const [missionState, setMissionState] = useState<MissionSystemState>(() => MissionSystem.getInstance().getState());
  const [nightLightsEnabled, setNightLightsEnabled] = useState(QualityManager.current.nightLightsEnabled);
  const [currentWeather, setCurrentWeather] = useState(WeatherSystem.getInstance().getState().currentWeather);
  const menuRef = useModalFocus(isOpen, onClose);

  useEffect(() => {
    const unsubscribeQuality = QualityManager.subscribe((settings) => {
      setQuality(settings.name);
      setNightLightsEnabled(settings.nightLightsEnabled);
    });
    const unsubscribeWeather = WeatherSystem.getInstance().subscribe((state) => setCurrentWeather(state.currentWeather));
    const unsubscribeAudio = AudioManager.getInstance().subscribe((settings) => setIsMuted(settings.isMuted));
     const unsubscribeSave = SaveSystem.getInstance().subscribe((data) => { setHistory(data.cityHistory); setLandmarks(data.discoveredLandmarks); setFleet(data.vehicleFleet || []); });
     const unsubscribeVehicle = VehicleInteractionSystem.getInstance().subscribe(setVehicleState);
     const unsubscribeMissions = MissionSystem.getInstance().subscribe(setMissionState);
    return () => {
      unsubscribeQuality();
      unsubscribeAudio();
      unsubscribeSave();
      unsubscribeVehicle();
      unsubscribeMissions();
      unsubscribeWeather();
    };
  }, []);

  const setTime = (hour: number) => TimeSystem.getInstance().setHour(hour);
  const setWeather = (weather: WeatherType) => WeatherSystem.getInstance().setWeather(weather);
  if (!isOpen) return null;

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
          background: 'rgba(1, 5, 14, 0.42)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
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
          width: 'min(340px, 88vw)',
          zIndex: 150,
          padding: '24px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background: 'rgba(4, 9, 22, 0.96)',
          borderRight: '1px solid rgba(0, 240, 255, 0.28)',
          boxShadow: '18px 0 48px rgba(0, 0, 0, 0.36)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-104%)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div id="world-menu-title" style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: 2 }}>
              NEXUS SYSTEM
            </div>
            <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.67rem', letterSpacing: 1.4 }}>
              WORLD CONTROLS // QUIET MODE
            </div>
          </div>
          <button className="cyber-btn" onClick={onClose} style={{ padding: '5px 9px', color: '#ff6688', borderColor: '#ff6688' }}>
            CLOSE
          </button>
        </header>

          <nav aria-label="Menu sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(['WORLD', 'MISSIONS', 'VIEW', 'VEHICLE', 'CODEX', 'HISTORY', 'CONTROLS'] as Section[]).map((item) => (
            <button
              key={item}
              aria-pressed={section === item}
              className="cyber-btn"
              onClick={() => setSection(item)}
              style={{
                padding: '9px 5px',
                fontSize: '0.68rem',
                color: section === item ? '#04101a' : 'var(--neon-cyan)',
                background: section === item ? 'var(--neon-cyan)' : 'transparent',
                borderColor: 'rgba(0, 240, 255, 0.55)',
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="menu-content" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>
          {section === 'WORLD' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div className="menu-section-label">TIME OF DAY</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  {[
                    ['DAWN', 6],
                    ['DAY', 13],
                    ['DUSK', 18.5],
                    ['NIGHT', 23],
                  ].map(([label, hour]) => (
                    <button key={label} className="cyber-btn" onClick={() => setTime(Number(hour))} style={{ padding: 11 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="menu-section-label">WEATHER FIELD</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  {(['CLEAR', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'FOG'] as WeatherType[]).map((weather) => (
                    <button key={weather} className="cyber-btn" aria-pressed={weather === currentWeather} onClick={() => setWeather(weather)} style={{ padding: 10, fontSize: '0.72rem' }}>
                      {weather === 'HEAVY_RAIN' ? 'STORM' : weather}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === 'MISSIONS' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="menu-section-label">MISSION CONTROL</div>
              <div className="menu-note">Choose an assignment to explore the city. One assignment can be active at a time.</div>
              {missionState.active && (
                <div style={{ padding: 10, border: '1px solid #00ffaa', background: 'rgba(0, 255, 170, 0.06)' }}>
                  <div style={{ color: '#00ffaa', fontSize: '0.72rem' }}>ACTIVE // {missionState.active.title}</div>
                  <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{missionState.active.targetLabel}</div>
                </div>
              )}
              {missionState.missions.map((mission) => (
                <article key={mission.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: mission.status === 'COMPLETED' ? '#64748b' : 'var(--neon-amber)', fontSize: '0.72rem' }}>
                    <span>{mission.title}</span><span>{mission.status}</span>
                  </div>
                  <div style={{ marginTop: 5, color: 'var(--text-secondary)', fontSize: '0.68rem', lineHeight: 1.4 }}>{mission.briefing}</div>
                  {mission.status === 'AVAILABLE' && !missionState.active && <button className="cyber-btn" onClick={() => MissionSystem.getInstance().acceptMission(mission.id)} style={{ marginTop: 8, padding: '6px 9px', fontSize: '0.65rem' }}>ACCEPT // +{mission.reward}</button>}
                </article>
              ))}
              <div className="menu-section-label">STANDING</div>
              {Object.entries(missionState.factionRelations).map(([faction, value]) => <div key={faction} className="menu-note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{faction.replaceAll('_', ' ')}</span><span style={{ color: value >= 0 ? '#00ffaa' : '#ff6688' }}>{value > 0 ? '+' : ''}{value}</span></div>)}
              <div className="menu-section-label" style={{ marginTop: 4 }}>DISTRICT REPUTATION</div>
              {Object.entries(missionState.districtReputation).map(([district, value]) => <div key={district} className="menu-note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{district.replace('_DISTRICT', '').replaceAll('_', ' ')}</span><span style={{ color: value >= 0 ? '#38bdf8' : '#ff6688' }}>{value > 0 ? '+' : ''}{value}</span></div>)}
            </section>
          )}

          {section === 'VIEW' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="menu-section-label">GRAPHICS PROFILE</div>
                <select aria-label="Graphics profile" className="cyber-select" value={quality} onChange={(event) => QualityManager.setPreset(event.target.value as QualityPreset)} style={{ width: '100%', marginTop: 8, padding: 10 }}>
                  <option value="AUTO">AUTO</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                  <option value="LITE">LITE</option>
                  <option value="HIGH">HIGH</option>
                  <option value="ULTRA">ULTRA</option>
                  <option value="CUSTOM" disabled>CUSTOM</option>
                </select>
              </div>
              <button
                className="cyber-btn"
                onClick={() => AudioManager.getInstance().toggleMute()}
                style={{ padding: 12, color: isMuted ? '#94a3b8' : '#00ffaa', borderColor: isMuted ? '#475569' : '#00ffaa' }}
              >
                {isMuted ? 'AUDIO OFF // ENABLE' : 'AUDIO ON // MUTE'}
              </button>
              <button className="cyber-btn" onClick={() => { onClose(); NavigationSystem.getInstance().setMapOpen(true); }} style={{ padding: 12, color: '#38bdf8', borderColor: '#38bdf8' }}>
                OPEN CITY MAP
              </button>
              <button
                className="cyber-btn"
                onClick={() => QualityManager.updateCustomSettings({ nightLightsEnabled: !QualityManager.current.nightLightsEnabled })}
                style={{
                  padding: 12,
                  color: nightLightsEnabled ? '#ffd166' : '#94a3b8',
                  borderColor: nightLightsEnabled ? '#ffd166' : '#475569',
                }}
              >
                {nightLightsEnabled ? 'STREET LIGHTS // ON' : 'STREET LIGHTS // OFF'}
              </button>
            </section>
          )}

          {section === 'VEHICLE' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="menu-section-label">MOBILITY CONFIGURATION</div>
              <div className="menu-note">
                {vehicleState.mode === 'RIDING' ? 'HOVER VEHICLE CONTROL LINK ACTIVE.' : vehicleState.mode === 'TRANSIT_LINKED' ? 'TRANSIT NODE LINK ACTIVE.' : 'Approach a mobility node and press E.'}
              </div>
              <div className="menu-section-label">PERSONAL FLEET</div>
              {fleet.map((vehicle) => <div key={vehicle.id} className="menu-note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{vehicle.name}</span><span style={{ color: vehicle.owned ? '#00ffaa' : '#64748b' }}>{vehicle.owned ? 'OWNED' : 'LOCKED'}</span></div>)}
              {(['speed', 'handling', 'neon'] as const).map((upgrade) => (
                <button
                  key={upgrade}
                  className="cyber-btn"
                  onClick={() => VehicleInteractionSystem.getInstance().cycleUpgrade(upgrade)}
                  style={{ padding: 12, textAlign: 'left', color: vehicleState.upgrades[upgrade] > 0 ? '#00ffaa' : 'var(--text-secondary)', borderColor: vehicleState.upgrades[upgrade] > 0 ? '#00ffaa' : 'rgba(148,163,184,0.35)' }}
                >
                  {vehicleState.upgrades[upgrade] > 0 ? '● ' : '○ '}{upgrade.toUpperCase()} {vehicleState.upgrades[upgrade] > 0 ? `// LEVEL ${vehicleState.upgrades[upgrade]}/3` : '// OFFLINE'}
                </button>
              ))}
            </section>
          )}

           {section === 'CODEX' && (
             <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               <div className="menu-section-label">OPERATIVE CODEX // DISCOVERED SIGNALS</div>
               <div className="menu-note">World discoveries are logged by proximity and interaction. No route markers required.</div>
               {Object.values(landmarks).length === 0 ? (
                 <div className="menu-note">No signals decoded yet. Follow the soundscape and inspect unusual structures.</div>
               ) : (
                 Object.values(landmarks).map((landmark) => (
                   <article key={landmark.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
                     <div style={{ color: 'var(--neon-amber)', fontSize: '0.72rem', letterSpacing: 0.7 }}>{landmark.name}</div>
                     <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{landmark.category} // SIGNAL CONFIRMED</div>
                     <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: '0.62rem' }}>{new Date(landmark.discoveredAt).toLocaleString()}</div>
                   </article>
                 ))
               )}
             </section>
           )}

           {section === 'HISTORY' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="menu-section-label">PERSISTENT CITY HISTORY</div>
              {history.length === 0 ? (
                <div className="menu-note">No city events have been logged yet. Explore, talk, and watch the city change.</div>
              ) : (
                history.slice(0, 12).map((entry) => (
                  <article key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{ color: 'var(--neon-cyan)', fontSize: '0.72rem', letterSpacing: 0.7 }}>{entry.title}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.45 }}>{entry.detail}</div>
                    <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: '0.62rem' }}>{new Date(entry.recordedAt).toLocaleString()}</div>
                  </article>
                ))
              )}
            </section>
          )}

          {section === 'CONTROLS' && (
            <section style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.8 }}>
              <div className="menu-section-label">GROUND OPERATIVE</div>
              <p><strong>WASD</strong> move · <strong>SHIFT</strong> sprint</p>
              <p><strong>SPACE</strong> jump · <strong>E</strong> interact / board</p>
              <p><strong>M</strong> open city map · <strong>V</strong> vista mode</p>
              <p><strong>ESC</strong> close this menu</p>
              <div className="menu-note">On touchscreens, drag the left side to move and the right side to look around. Use the map to choose a landmark or travel.</div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};
