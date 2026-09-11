import * as THREE from 'three';
import { QualityManager } from './QualityManager';

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  private frames: number = 0;
  private prevTime: number = performance.now();
  private lowFpsCounter: number = 0;

  public metrics: PerformanceMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };

  private listeners: Set<(m: PerformanceMetrics) => void> = new Set();

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public update(gl?: THREE.WebGLRenderer): void {
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.prevTime;

    if (elapsed >= 500) {
      this.metrics.fps = Math.round((this.frames * 1000) / elapsed);
      this.metrics.frameTimeMs = parseFloat((elapsed / this.frames).toFixed(1));

      if (gl && gl.info) {
        this.metrics.drawCalls = gl.info.render.calls;
        this.metrics.triangles = gl.info.render.triangles;
        this.metrics.geometries = gl.info.memory.geometries;
        this.metrics.textures = gl.info.memory.textures;
      }

      // Detect persistent low FPS below 25
      if (this.metrics.fps < 25) {
        this.lowFpsCounter++;
        if (this.lowFpsCounter >= 4) {
          QualityManager.throttleDown();
          this.lowFpsCounter = 0;
        }
      } else {
        this.lowFpsCounter = Math.max(0, this.lowFpsCounter - 1);
      }

      this.frames = 0;
      this.prevTime = now;
      this.notify();
    }
  }

  public subscribe(listener: (m: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    listener(this.metrics);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.metrics));
  }
}
