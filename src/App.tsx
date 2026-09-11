import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Scene } from './components/Scene';
import { HUD } from './ui/HUD';

export const App: React.FC = () => {
  const playerPosRef = useRef(new THREE.Vector3(0, 0.2, 10));

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
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
  );
};

export default App;
