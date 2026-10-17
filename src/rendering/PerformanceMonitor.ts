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

type MetricsListener = (metrics: PerformanceMetrics) => void;

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frames = 0;
  private lastSampleTime = performance.now();
  private lowFpsCounter = 0;
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };
  private listeners = new Set<MetricsListener>();

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public update(gl?: THREE.WebGLRenderer): void {
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.lastSampleTime;

    if (elapsed >= 500) {
      const fps = Math.round((this.frames * 1000) / elapsed);
      const frameTimeMs = Number((elapsed / this.frames).toFixed(1));
      this.metrics = {
        fps,
        frameTimeMs,
        drawCalls: gl ? gl.info.render.calls : this.metrics.drawCalls,
        triangles: gl ? gl.info.render.triangles : this.metrics.triangles,
        geometries: gl ? gl.info.memory.geometries : this.metrics.geometries,
        textures: gl ? gl.info.memory.textures : this.metrics.textures,
      };
      this.frames = 0;
      this.lastSampleTime = now;

      if (fps < 28) {
        this.lowFpsCounter++;
        if (this.lowFpsCounter >= 4) {
          QualityManager.throttleDown();
          this.lowFpsCounter = 0;
        }
      } else {
        this.lowFpsCounter = Math.max(0, this.lowFpsCounter - 1);
      }

      this.listeners.forEach((l) => l({ ...this.metrics }));
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.metrics });
    return () => this.listeners.delete(listener);
  }
}
