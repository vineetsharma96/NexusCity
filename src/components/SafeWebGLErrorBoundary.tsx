import React, { Component, ReactNode } from 'react';
import { WebGLCapabilities } from '../rendering/WebGLCapabilities';
import { QualityManager } from '../rendering/QualityManager';

export class SafeWebGLErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const caps = WebGLCapabilities.detect();
    return (
      <main
        className="world-recovery"
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          display: 'grid',
          placeContent: 'center',
          gap: 16,
          padding: 24,
          background: 'var(--bg-dark)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>Unable to initialize WebGL</h1>
        <p style={{ maxWidth: 540, color: 'var(--text-secondary)' }}>
          {caps.version !== 'webgl2'
            ? 'NEXUS CITY requires WebGL 2 hardware acceleration. Please enable GPU acceleration in your browser settings.'
            : 'The graphics pipeline encountered an unexpected interruption. You can relaunch with the Lite profile.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="cyber-btn cyber-btn-primary"
            onClick={() => {
              QualityManager.setPreset('LITE');
              window.location.reload();
            }}
          >
            Relaunch in Lite Mode
          </button>
          <button
            className="cyber-btn"
            onClick={() => {
              try {
                localStorage.removeItem('nexus_city_graphics_settings_v3');
              } catch {}
              window.location.reload();
            }}
          >
            Reset Graphics Profile
          </button>
        </div>
      </main>
    );
  }
}
