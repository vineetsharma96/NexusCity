import React, { Component, ReactNode } from 'react';
import { WebGLCapabilities } from '../rendering/WebGLCapabilities';
import { QualityManager } from '../rendering/QualityManager';

export class SafeWebGLErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (!this.state.error) return this.props.children;
    const caps = WebGLCapabilities.detect();
    return (
      <main className="world-recovery" role="alert" style={{ position: 'fixed', inset: 0, overflowY: 'auto', display: 'grid', placeContent: 'center', gap: 16, padding: 24, background: '#050811', textAlign: 'center' }}>
        <h1>Unable to render the city</h1>
        <p style={{ maxWidth: 560 }}>
          {caps.version !== 'webgl2' ? 'This city needs WebGL 2. Enable hardware acceleration or try another browser.' : 'The graphics session stopped. Try reopening the city with the lightest graphics profile.'}
        </p>
        <details style={{ maxWidth: 560, overflowWrap: 'anywhere', textAlign: 'left', color: 'var(--text-secondary)' }}>
          <summary>Graphics details</summary>
          <p>{caps.unmaskedRenderer}</p>
          <p>{this.state.error.message}</p>
        </details>
        <button className="cyber-btn" onClick={() => {
          QualityManager.setPreset('LITE');
          window.location.reload();
        }}>Restart in Lite mode</button>
        <button className="cyber-btn" onClick={() => {
          try {
            localStorage.removeItem('nexus_city_graphics_settings_v3');
            localStorage.removeItem('nexus_city_graphics_settings_v2');
          } catch { /* Storage may be unavailable. */ }
          window.location.reload();
        }}>Reset graphics settings</button>
      </main>
    );
  }
}
