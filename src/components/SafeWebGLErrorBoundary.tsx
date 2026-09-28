import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WebGLCapabilities, WebGLDiagnosticInfo } from '../rendering/WebGLCapabilities';
import { QualityManager } from '../rendering/QualityManager';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  caps: WebGLDiagnosticInfo | null;
}

export class SafeWebGLErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    caps: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      caps: WebGLCapabilities.detect(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeWebGLErrorBoundary] Uncaught graphics/render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleLaunchSafeMode = () => {
    try {
      localStorage.removeItem('nexus_city_graphics_settings_v3');
      localStorage.removeItem('nexus_city_graphics_settings_v2');
      QualityManager.setPreset('LITE');
    } catch (e) {}
    window.location.reload();
  };

  private handleResetAll = () => {
    try {
      localStorage.clear();
    } catch (e) {}
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      const caps = this.state.caps || WebGLCapabilities.detect();

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#040714',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          {/* Cyberpunk Warning Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              marginBottom: '1.5rem',
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.4)',
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '2px',
              color: '#00f0ff',
              textShadow: '0 0 16px rgba(0, 240, 255, 0.5)',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
            }}
          >
            Graphics Engine Guard Activated
          </h1>

          <p
            style={{
              maxWidth: 620,
              color: '#94a3b8',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}
          >
            The 3D renderer encountered an unsupported graphics instruction or memory constraint. NexusCity prevented a full browser crash and preserved system state.
          </p>

          {/* Diagnostic Info Box */}
          <div
            style={{
              maxWidth: 680,
              width: '100%',
              backgroundColor: '#090e20',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '2rem',
              textAlign: 'left',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#cbd5e1',
            }}
          >
            <div style={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              // TELEMETRY & HARDWARE PROBE:
            </div>
            <div>• WebGL Version: <span style={{ color: caps.supported ? '#22c55e' : '#ef4444' }}>{caps.version.toUpperCase()}</span></div>
            <div>• GPU Renderer: <span style={{ color: '#e2e8f0' }}>{caps.unmaskedRenderer}</span></div>
            <div>• GPU Vendor: <span style={{ color: '#e2e8f0' }}>{caps.unmaskedVendor}</span></div>
            <div>• Environment: <span style={{ color: caps.isVirGL ? '#f59e0b' : '#38bdf8' }}>{caps.isVirGL ? 'VirGL / Turnip Bridge (Mobile Linux)' : caps.isMobile ? 'Mobile Device' : 'Standard Desktop'}</span></div>
            <div>• Max Texture Size: {caps.maxTextureSize}px</div>
            {this.state.error && (
              <div style={{ marginTop: '0.75rem', color: '#f87171', wordBreak: 'break-word' }}>
                • Error: {this.state.error.message}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleLaunchSafeMode}
              style={{
                backgroundColor: '#00f0ff',
                color: '#040714',
                border: 'none',
                padding: '0.75rem 1.75rem',
                borderRadius: 6,
                fontWeight: 700,
                letterSpacing: '1px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                boxShadow: '0 0 16px rgba(0, 240, 255, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              LAUNCH IN SAFE MODE (LITE PRESET)
            </button>

            <button
              onClick={this.handleResetAll}
              style={{
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                padding: '0.75rem 1.5rem',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              RESET SETTINGS & RELOAD
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
