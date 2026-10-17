import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Scene } from './components/Scene';
import { HUD } from './ui/HUD';
import { LoadingScreen } from './ui/LoadingScreen';
import { CinematicOverlay } from './ui/CinematicOverlay';
import { SafeWebGLErrorBoundary } from './components/SafeWebGLErrorBoundary';
import { GPUDiagnosticOverlay } from './ui/GPUDiagnosticOverlay';

export const App: React.FC = () => {
  const playerPosRef = useRef(new THREE.Vector3(0, 0.2, 10));
  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <SafeWebGLErrorBoundary>
        <LoadingScreen />
        <CinematicOverlay />
        <Suspense fallback={null}>
          <Scene playerPosRef={playerPosRef} />
          <HUD playerPosRef={playerPosRef} />
        </Suspense>
        <GPUDiagnosticOverlay />
      </SafeWebGLErrorBoundary>
    </div>
  );
};

export default App;
