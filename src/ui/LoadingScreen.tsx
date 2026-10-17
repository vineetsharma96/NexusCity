import React, { useEffect, useState } from 'react';
import { CinematicManager } from '../cinematics/CinematicManager';
import { QualityManager } from '../rendering/QualityManager';

export const LoadingScreen: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    const finish = () => {
      setIsReady(true);
      CinematicManager.getInstance().finishLoading();
    };
    window.addEventListener('nexus:world-ready', finish, { once: true });
    if ((window as Window & { __NEXUS_WORLD_READY__?: boolean }).__NEXUS_WORLD_READY__) {
      finish();
    }
    const timeout = window.setTimeout(() => setIsTakingLonger(true), 14000);
    return () => {
      window.removeEventListener('nexus:world-ready', finish);
      window.clearTimeout(timeout);
    };
  }, []);

  if (isReady) return null;

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-panel">
        <span className="menu-section-label">METROPOLITAN DIGITAL TWIN // SEED 847291</span>
        <h1>NEXUS CITY</h1>
        <p>
          {isTakingLonger
            ? 'Synthesizing procedural sectors and atmospheric shaders. High-density worlds may take an extra moment on this device.'
            : 'Initializing 3km procedural urban matrix, diurnal lighting, and autonomous transit corridors.'}
        </p>
        <div className="loading-track" aria-hidden="true">
          <span />
        </div>
        <span className="loading-caption">
          {isTakingLonger ? 'Compiling WebGL pipelines…' : 'Architecture · Illumination · Acoustics'}
        </span>
        {isTakingLonger && (
          <button
            className="cyber-btn"
            onClick={() => {
              QualityManager.setPreset('LITE');
              window.location.reload();
            }}
          >
            Launch in Lite Performance Mode
          </button>
        )}
      </div>
    </div>
  );
};
