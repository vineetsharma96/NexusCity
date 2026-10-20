import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WeatherState, WeatherSystem } from '../world/WeatherSystem';
import { EmergencyAlertSystem, EmergencyState } from '../world/EmergencyAlertSystem';
import { DistrictGenerator } from './DistrictGenerator';
import { SaveSystem } from '../core/SaveSystem';
import { LivingCityEventState, LivingCityEventSystem } from '../world/LivingCityEventSystem';

interface CyberVideoBillboardProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  channel?: 1 | 2 | 3;
}

interface ChannelPoolEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  texture: THREE.CanvasTexture;
  lastDraw: number;
  ticker: number;
}

const channelPool = new Map<number, ChannelPoolEntry>();

function getChannelPool(channel: 1 | 2 | 3): ChannelPoolEntry {
  let entry = channelPool.get(channel);
  if (!entry) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    entry = {
      canvas: c,
      ctx: c.getContext('2d'),
      texture: tex,
      lastDraw: -1,
      ticker: 0,
    };
    channelPool.set(channel, entry);
  }
  return entry;
}

const BACKING_MAT = new THREE.MeshStandardMaterial({ color: '#070a12', roughness: 0.28, metalness: 0.9 });

export const CyberVideoBillboard: React.FC<CyberVideoBillboardProps> = React.memo(({
  position,
  rotationY = 0,
  width = 20,
  height = 12,
  channel = 1,
}) => {
  const weatherRef = useRef<WeatherState>(WeatherSystem.getInstance().getState());
  const emergencyRef = useRef<EmergencyState>(EmergencyAlertSystem.getInstance().getState());
  const eventRef = useRef<LivingCityEventState>(LivingCityEventSystem.getInstance().getState());
  const discoveryCountRef = useRef(Object.keys(SaveSystem.getInstance().getData().discoveredLandmarks).length);
  const district = useMemo(() => DistrictGenerator.getDistrictAt(position[0], position[2]), [position[0], position[2]]);

  const poolEntry = useMemo(() => getChannelPool(channel), [channel]);

  useEffect(() => {
    const uWea = WeatherSystem.getInstance().subscribe((s) => {
      weatherRef.current = s;
    });
    const uEmg = EmergencyAlertSystem.getInstance().subscribe((s) => {
      emergencyRef.current = s;
    });
    const uEvt = LivingCityEventSystem.getInstance().subscribe((s) => {
      eventRef.current = s;
    });
    const onDisc = (e: Event) => {
      if ((e as CustomEvent).detail?.type === 'discovery') {
        discoveryCountRef.current += 1;
      }
    };
    window.addEventListener('nexus:notification', onDisc);
    return () => {
      uWea();
      uEmg();
      uEvt();
      window.removeEventListener('nexus:notification', onDisc);
    };
  }, []);

  useFrame(({ clock, camera }) => {
    const dx = camera.position.x - position[0];
    const dy = camera.position.y - position[1];
    const dz = camera.position.z - position[2];
    if (dx * dx + dy * dy + dz * dz > 210 * 210) return;

    const time = clock.getElapsedTime();
    // Deduplicate canvas redraw across all billboards sharing the same channel (10 FPS update rate)
    if (time - poolEntry.lastDraw < 0.1) return;
    poolEntry.lastDraw = time;

    const ctx = poolEntry.ctx;
    if (!ctx) return;

    const w = poolEntry.canvas.width;
    const h = poolEntry.canvas.height;
    const weather = weatherRef.current;
    const emergency = emergencyRef.current;
    const cityEvent = eventRef.current;

    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);

    // Top telemetry header
    ctx.fillStyle = '#0d1322';
    ctx.fillRect(0, 0, w, 38);
    ctx.fillStyle = channel === 1 ? '#f59e0b' : channel === 2 ? '#38bdf8' : '#10b981';
    ctx.fillRect(0, 0, 6, 38);

    ctx.font = '700 14px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(
      channel === 1
        ? 'NEXUS CIVIC BROADCAST // SECTOR 01'
        : channel === 2
        ? 'SOLARIS ARCHITECTURAL CORP // INDEX'
        : 'METROPOLITAN GRID TELEMETRY // RADAR',
      18,
      24
    );

    if (channel === 1) {
      ctx.save();
      ctx.translate(w / 2, h / 2 - 4);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.stroke();

      for (let r = 1; r <= 3; r++) {
        ctx.strokeStyle = r % 2 === 0 ? 'rgba(245, 158, 11, 0.55)' : 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, Math.abs(Math.cos(time * 1.2 + r)) * 56, time * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (channel === 2) {
      const bars = 24;
      for (let b = 0; b < bars; b++) {
        const bh = 18 + Math.abs(Math.sin(time * 3.5 + b * 0.45)) * 90;
        ctx.fillStyle = b % 3 === 0 ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(36 + b * 18, h - 85 - bh, 11, bh);
      }
    } else {
      const rx = w / 2;
      const ry = h / 2 + 4;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 68, 0, Math.PI * 2);
      ctx.arc(rx, ry, 38, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(time * 2.0);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(68, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Status Banner
    ctx.fillStyle = emergency.active ? '#7f1d1d' : '#0b1528';
    ctx.fillRect(14, 48, w - 28, 24);
    ctx.font = '700 12px monospace';
    ctx.fillStyle = emergency.active ? '#fecaca' : '#bae6fd';
    ctx.fillText(
      `${district.name} // ATMO: ${weather.currentWeather} // ${emergency.message}`.slice(0, 66),
      22,
      64
    );

    if (cityEvent.phase !== 'IDLE') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(14, 76, w - 28, 22);
      ctx.fillStyle = '#07090e';
      ctx.fillText(`${cityEvent.title} (${cityEvent.remainingSeconds}S)`.slice(0, 64), 22, 91);
    }

    // Bottom marquee
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, h - 36, w, 36);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, h - 36, w, 2);

    poolEntry.ticker = (poolEntry.ticker - 2.5) % 900;
    const msg = `METROPOLIS TELEMETRY // ${discoveryCountRef.current} LANDMARKS LOGGED // TRANSIT CORRIDORS ACTIVE // `;
    ctx.font = '700 14px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(msg + msg, poolEntry.ticker, h - 13);

    poolEntry.texture.needsUpdate = true;
  });

  const rimColor = channel === 1 ? '#f59e0b' : channel === 2 ? '#38bdf8' : '#10b981';

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, -0.22]} material={BACKING_MAT}>
        <boxGeometry args={[width + 1.2, height + 1.2, 0.42]} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={poolEntry.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, height / 2 + 0.3, 0.06]}>
        <boxGeometry args={[width + 0.6, 0.1, 0.1]} />
        <meshBasicMaterial color={rimColor} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.3, 0.06]}>
        <boxGeometry args={[width + 0.6, 0.1, 0.1]} />
        <meshBasicMaterial color={rimColor} />
      </mesh>
    </group>
  );
});
