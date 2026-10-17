import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Scene } from './components/Scene';
import { HUD } from './ui/HUD';
import { LoadingScreen } from './ui/LoadingScreen';
import { CinematicOverlay } from './ui/CinematicOverlay';

class WorldErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="world-recovery" role="alert" style={{ position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', gap: 16, padding: 32, background: '#050811', textAlign: 'center' }}>
          <h1>Unable to render the city</h1>
          <p>The graphics session stopped. Try reopening the city with the lightest graphics profile.</p>
          <button className="cyber-btn" onClick={() => {
            try { localStorage.setItem('nexus_city_graphics_settings_v2', JSON.stringify({ preset: 'LITE' })); } catch { /* Storage may be disabled. */ }
            window.location.reload();
          }}>Restart in Lite mode</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const playerPosRef = useRef(new THREE.Vector3(0, 0.2, 10));

  return (
    <WorldErrorBoundary>
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <LoadingScreen />
      <CinematicOverlay />
      <Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100vw',
              height: '100vh',
              backgroundColor: '#050811',
              color: '#00f0ff',
              fontFamily: 'var(--font-display)',
              letterSpacing: '2px',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '1rem', textShadow: '0 0 16px rgba(0, 240, 255, 0.6)' }}>
              INITIALIZING NEXUS WORLD ENGINE...
            </div>
            <div style={{ fontSize: '0.85rem', color: '#8ba2c4', fontFamily: 'var(--font-mono)' }}>
              SEED #847291 // PROCEDURAL PROCEDURES LOADING
            </div>
          </div>
        }
      >
        <Scene playerPosRef={playerPosRef} />
        <HUD playerPosRef={playerPosRef} />
      </Suspense>
    </div>
    </WorldErrorBoundary>
  );
};

export default App;
