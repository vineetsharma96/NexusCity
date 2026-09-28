import React, { useEffect, useState } from 'react';
import { WebGLCapabilities, WebGLDiagnosticInfo } from '../rendering/WebGLCapabilities';
import { PerformanceMonitor, PerformanceMetrics } from '../rendering/PerformanceMonitor';
import { QualityManager, QualitySettings, QualityPreset } from '../rendering/QualityManager';

export const GPUDiagnosticOverlay: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [caps, setCaps] = useState<WebGLDiagnosticInfo | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(PerformanceMonitor.getInstance().metrics);
  const [quality, setQuality] = useState<QualitySettings>(QualityManager.current);
  const [contextStatus, setContextStatus] = useState<'ACTIVE' | 'LOST'>('ACTIVE');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Check if ?debug=gpu or #debug=gpu is in URL
    const hasDebugParam =
      typeof window !== 'undefined' &&
      (window.location.search.includes('debug=gpu') ||
        window.location.hash.includes('debug=gpu') ||
        localStorage.getItem('nexus_debug_gpu') === 'true');

    if (hasDebugParam) {
      setEnabled(true);
      setCaps(WebGLCapabilities.detect());
    }

    // Subscribe to performance monitor
    const unsubPerf = PerformanceMonitor.getInstance().subscribe(setMetrics);
    const unsubQ = QualityManager.subscribe(setQuality);

    // WebGL Context Lost / Restored tracking
    const handleContextLost = () => setContextStatus('LOST');
    const handleContextRestored = () => setContextStatus('ACTIVE');

    window.addEventListener('webglcontextlost', handleContextLost);
    window.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      unsubPerf();
      unsubQ();
      window.removeEventListener('webglcontextlost', handleContextLost);
      window.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  if (!enabled || !caps) return null;

  const currentDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const effectiveDpr = Math.min(quality.dpr[1], currentDpr);

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 99998,
        backgroundColor: 'rgba(5, 9, 20, 0.92)',
        border: '1px solid #00f0ff',
        borderRadius: 8,
        padding: collapsed ? '6px 12px' : '14px 16px',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: 1.45,
        maxWidth: 360,
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: collapsed ? 'none' : '1px solid rgba(0, 240, 255, 0.25)',
          paddingBottom: collapsed ? 0 : 8,
          marginBottom: collapsed ? 0 : 10,
        }}
      >
        <span style={{ color: '#00f0ff', fontWeight: 800, letterSpacing: '1px' }}>
          ⚡ NEXUS GPU DIAGNOSTICS
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px 6px',
          }}
        >
          {collapsed ? '▼ EXPAND' : '▲ COLLAPSE'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Hardware & Renderer Telemetry */}
          <div style={{ marginBottom: 10 }}>
            <div>
              <span style={{ color: '#64748b' }}>GPU RENDERER: </span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{caps.unmaskedRenderer}</span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>GPU VENDOR: </span>
              <span>{caps.unmaskedVendor}</span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>WEBGL VERSION: </span>
              <span style={{ color: caps.version === 'webgl2' ? '#22c55e' : '#f59e0b' }}>
                {caps.version.toUpperCase()}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>CONTEXT STATUS: </span>
              <span
                style={{
                  color: contextStatus === 'ACTIVE' ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                }}
              >
                ● {contextStatus}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>ENVIRONMENT: </span>
              <span style={{ color: caps.isVirGL ? '#f59e0b' : caps.isMobile ? '#38bdf8' : '#e2e8f0' }}>
                {caps.isVirGL ? 'VirGL / Turnip Bridge (Linux Mobile)' : caps.isMobile ? 'Mobile GPU' : 'Desktop'}
              </span>
            </div>
          </div>

          {/* WebGL Caps & Limits */}
          <div style={{ marginBottom: 10, padding: '6px 8px', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 4 }}>
            <div><span style={{ color: '#64748b' }}>MAX TEXTURE: </span>{caps.maxTextureSize}px</div>
            <div><span style={{ color: '#64748b' }}>MAX RENDERBUFFER: </span>{caps.maxRenderBufferSize}px</div>
            <div><span style={{ color: '#64748b' }}>MAX VIEWPORT: </span>{caps.maxViewportDims[0]} × {caps.maxViewportDims[1]}</div>
            <div><span style={{ color: '#64748b' }}>EXTENSIONS: </span>{caps.extensions.length} active ({caps.extensions.slice(0, 3).join(', ')}...)</div>
            <div><span style={{ color: '#64748b' }}>HALF-FLOAT FBO: </span>{caps.supportsHalfFloatRenderTarget ? 'SUPPORTED' : 'DISABLED'}</div>
            <div><span style={{ color: '#64748b' }}>FLOAT TEXTURES: </span>{caps.supportsFloatTextures ? 'SUPPORTED' : 'DISABLED'}</div>
          </div>

          {/* Realtime Performance */}
          <div style={{ marginBottom: 10 }}>
            <div>
              <span style={{ color: '#64748b' }}>PERFORMANCE: </span>
              <span
                style={{
                  color: metrics.fps >= 50 ? '#22c55e' : metrics.fps >= 30 ? '#eab308' : '#ef4444',
                  fontWeight: 'bold',
                }}
              >
                {metrics.fps} FPS
              </span>
              <span style={{ color: '#64748b' }}> ({metrics.frameTimeMs} ms)</span>
            </div>
            <div><span style={{ color: '#64748b' }}>DRAW CALLS: </span><span style={{ color: metrics.drawCalls > 250 ? '#ef4444' : '#f8fafc' }}>{metrics.drawCalls}</span></div>
            <div><span style={{ color: '#64748b' }}>TRIANGLES: </span>{metrics.triangles.toLocaleString()}</div>
            <div><span style={{ color: '#64748b' }}>GEOMETRIES: </span>{metrics.geometries}</div>
            <div><span style={{ color: '#64748b' }}>TEXTURES: </span>{metrics.textures}</div>
            <div>
              <span style={{ color: '#64748b' }}>PIXEL RATIO: </span>
              <span>{effectiveDpr.toFixed(2)} (Device: {currentDpr})</span>
            </div>
          </div>

          {/* Preset & Quick Controls */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 8 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>ACTIVE PRESET: </span>
              <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>{quality.name}</span>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['LITE', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as QualityPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => QualityManager.setPreset(p)}
                  style={{
                    backgroundColor: quality.name === p ? '#00f0ff' : 'rgba(30, 41, 59, 0.8)',
                    color: quality.name === p ? '#050914' : '#cbd5e1',
                    border: '1px solid #334155',
                    borderRadius: 3,
                    padding: '3px 6px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
