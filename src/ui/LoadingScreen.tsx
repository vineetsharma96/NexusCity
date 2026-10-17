import React, { useEffect, useState } from 'react';
import { CinematicManager } from '../cinematics/CinematicManager';

export const LoadingScreen: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    const finish = () => {
      setIsReady(true);
      CinematicManager.getInstance().finishLoading();
    };
    window.addEventListener('nexus:world-ready', finish, { once: true });
    if ((window as Window & { __NEXUS_WORLD_READY__?: boolean }).__NEXUS_WORLD_READY__) finish();
    const timeout = window.setTimeout(() => setIsTakingLonger(true), 15000);
    return () => {
      window.removeEventListener('nexus:world-ready', finish);
      window.clearTimeout(timeout);
    };
  }, []);

  if (isReady) return null;

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-panel">
        <span className="menu-section-label">PROCEDURAL WORLD / SEED 847291</span>
        <h1>NEXUS CITY</h1>
        <p>{isTakingLonger ? 'The city is still preparing its first frame. Larger worlds can take a moment on this device.' : 'Building the city and preparing your view.'}</p>
        <div className="loading-track" aria-hidden="true"><span /></div>
        <span className="loading-caption">{isTakingLonger ? 'Preparing graphics…' : 'Architecture · streets · atmosphere'}</span>
        {isTakingLonger && <button className="cyber-btn" onClick={() => {
          try { localStorage.setItem('nexus_city_graphics_settings_v2', JSON.stringify({ preset: 'LITE' })); } catch { /* Storage may be unavailable. */ }
          window.location.reload();
        }}>Restart in Lite mode</button>}
      </div>
    </div>
  );
};
