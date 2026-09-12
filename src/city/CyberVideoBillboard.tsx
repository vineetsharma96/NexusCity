import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface CyberVideoBillboardProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  channel?: 1 | 2 | 3;
}

export const CyberVideoBillboard: React.FC<CyberVideoBillboardProps> = ({
  position,
  rotationY = 0,
  width = 20,
  height = 12,
  channel = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const tickerOffsetRef = useRef(0);
  const lastDrawTimeRef = useRef(0);

  // Setup offscreen canvas and texture
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, []);

  useEffect(() => {
    canvasRef.current = canvas;
    textureRef.current = texture;

    // Draw initial test pattern immediately
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#040714';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('NEXUS BROADCAST // ONLINE', 60, 160);
      texture.needsUpdate = true;
    }
  }, [canvas, texture]);

  // Frame update for dynamic video rendering
  useFrame(({ clock, camera }) => {
    const camDist = Math.hypot(
      camera.position.x - position[0],
      camera.position.y - position[1],
      camera.position.z - position[2]
    );
    if (camDist > 220) return; // Skip 2D canvas redraws when distant

    const time = clock.getElapsedTime();

    // Throttle canvas draw to ~30 FPS for optimal performance
    if (time - lastDrawTimeRef.current < 0.033) return;
    lastDrawTimeRef.current = time;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Determine active video channel (can cycle or use prop)
    const activeChannel = channel;

    // Clear background
    ctx.fillStyle = '#040714';
    ctx.fillRect(0, 0, w, h);

    if (activeChannel === 1) {
      // ==========================================
      // CHANNEL 1: NEXUS 24 LIVE NEWS BROADCAST
      // ==========================================

      // 1. Top Header Bar
      ctx.fillStyle = '#091326';
      ctx.fillRect(0, 0, w, 36);

      // Blinking Red Recording Dot
      const blink = Math.sin(time * 6) > 0;
      ctx.fillStyle = blink ? '#ff0055' : '#55001a';
      ctx.beginPath();
      ctx.arc(20, 18, 7, 0, Math.PI * 2);
      ctx.fill();

      // Broadcast Title
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('🔴 NEXUS 24 // LIVE METROPOLIS FEED', 36, 23);

      // Time readout
      const hrs = String(Math.floor((time * 2) % 24)).padStart(2, '0');
      const mins = String(Math.floor((time * 40) % 60)).padStart(2, '0');
      const secs = String(Math.floor((time * 120) % 60)).padStart(2, '0');
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`${hrs}:${mins}:${secs} UTC`, w - 120, 23);

      // 2. Central 3D Wireframe Rotating Globe / Hologram
      const centerX = w / 2;
      const centerY = h / 2 - 10;
      const globeRadius = 55;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Outer glowing ring
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating latitude / longitude ellipses
      for (let ring = 1; ring <= 4; ring++) {
        ctx.strokeStyle = ring % 2 === 0 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 0, 128, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const ellipseScale = Math.cos(time * 1.5 + (ring * Math.PI) / 4);
        ctx.ellipse(0, 0, globeRadius, Math.abs(ellipseScale) * globeRadius, time * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center spinning core
      ctx.fillStyle = '#00ffaa';
      ctx.beginPath();
      ctx.arc(0, 0, 8 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 3. Audio Spectrum Equalizer Bars
      const numBars = 24;
      const barW = 8;
      const startX = 20;
      const baseY = h - 60;

      for (let b = 0; b < numBars; b++) {
        const barH = Math.max(
          8,
          Math.sin(time * 8 + b * 0.6) * 28 + Math.cos(time * 5 + b * 1.2) * 18 + 25
        );
        const bx = startX + b * (barW + 4);
        const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(0.6, '#00ffaa');
        grad.addColorStop(1, '#ff0077');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, baseY - barH, barW, barH);
      }

      // Right Side Telemetry Readout
      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`TRANSIT: OPTIMAL`, w - 165, baseY - 45);
      ctx.fillText(`SOLAR FLUX: 14.8 GW`, w - 165, baseY - 25);
      ctx.fillText(`AIR PURITY: 92.4%`, w - 165, baseY - 5);

      // 4. Bottom Scrolling News Marquee Ticker
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, h - 38, w, 38);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(0, h - 38, w, 2);

      tickerOffsetRef.current -= 2.2;
      if (tickerOffsetRef.current < -1200) tickerOffsetRef.current = 0;

      const tickerText =
        '⚡ NEXUS BULLETINS: CELESTIAL ORBIT ACTIVE // TRAFFIC SYSTEM ONLINE // BIOSPHERE WATER POND SANCTUARY OPEN // HYPERLOOP TRANSIT ON SCHEDULE // STOCK TICKER: $CYBR +6.8% // METROPOLIS STABILITY 99.8% // ⚡';

      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(tickerText, tickerOffsetRef.current + w, h - 14);
      ctx.fillText(tickerText, tickerOffsetRef.current + w + 1200, h - 14);

    } else if (activeChannel === 2) {
      // ==========================================
      // CHANNEL 2: CYBER-CORP COMMERCIAL ADVERT
      // ==========================================
      const commercialIdx = Math.floor(time / 4) % 3;

      if (commercialIdx === 0) {
        // Ad 1: NEO-COCA ENERGY
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#3b0764');
        grad.addColorStop(0.5, '#701a75');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.font = '900 36px "Courier New", sans-serif';
        ctx.fillStyle = '#f43f5e';
        ctx.textAlign = 'center';
        ctx.fillText('NEO - COCA', w / 2, 90);

        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillStyle = '#fbcfe8';
        ctx.fillText('RECHARGE YOUR SYNAPSES', w / 2, 130);

        // Animated neon bottle silhouette
        const pulse = 1 + Math.sin(time * 8) * 0.08;
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(w / 2 - 18 * pulse, 155, 36 * pulse, 85);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(w / 2 - 10, 142, 20, 15);

        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillStyle = '#00ffaa';
        ctx.fillText('AVAILABLE AT ALL METRO VENDORS', w / 2, 280);
        ctx.textAlign = 'left';

      } else if (commercialIdx === 1) {
        // Ad 2: CYBER-OPTICS 8K
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, w, h);

        // Animated Concentric HUD Reticle
        ctx.save();
        ctx.translate(w / 2, h / 2 - 20);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ff0077';
        ctx.beginPath();
        ctx.arc(0, 0, 42, time * 2, time * 2 + Math.PI * 1.5);
        ctx.stroke();

        // Crosshairs
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-75, 0);
        ctx.lineTo(75, 0);
        ctx.moveTo(0, -75);
        ctx.lineTo(0, 75);
        ctx.stroke();
        ctx.restore();

        ctx.font = '900 28px "Courier New", monospace';
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.fillText('KROM - OPTICS 8K', w / 2, 235);
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.fillStyle = '#e0e7ff';
        ctx.fillText('SEE BEYOND THE GRID // UPGRADE TODAY', w / 2, 265);
        ctx.textAlign = 'left';

      } else {
        // Ad 3: AERO-CRUISER
        ctx.fillStyle = '#022c22';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '900 32px "Courier New", sans-serif';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText('VELOCITY - X', w / 2, 100);

        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText('HIGH-ALTITUDE HOVER COMMUTING', w / 2, 140);

        // Flying wedge shape
        const flyX = ((time * 120) % (w + 120)) - 60;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(flyX, 190);
        ctx.lineTo(flyX - 45, 175);
        ctx.lineTo(flyX - 45, 205);
        ctx.closePath();
        ctx.fill();

        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('EXPERIENCE 600 KM/H GLIDE', w / 2, 270);
        ctx.textAlign = 'left';
      }

    } else {
      // ==========================================
      // CHANNEL 3: METROPOLIS GRID SURVEILLANCE
      // ==========================================
      ctx.fillStyle = '#020b08';
      ctx.fillRect(0, 0, w, h);

      // Radar Screen Circle
      const rx = w / 2;
      const ry = h / 2;
      const rRad = 90;

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, rRad, 0, Math.PI * 2);
      ctx.arc(rx, ry, rRad * 0.66, 0, Math.PI * 2);
      ctx.arc(rx, ry, rRad * 0.33, 0, Math.PI * 2);
      ctx.stroke();

      // Sweeping Radar Beam
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(time * 2.5);
      const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rRad);
      sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.6)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rRad, 0, Math.PI / 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Tracking Blips
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(rx + 35, ry - 25, 4, 0, Math.PI * 2);
      ctx.arc(rx - 45, ry + 15, 4, 0, Math.PI * 2);
      ctx.arc(rx + 15, ry + 50, 4, 0, Math.PI * 2);
      ctx.fill();

      // Surveillance Header & Footers
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText('CAM-04 // SECTOR 0 // CORE BOULEVARDS', 20, 30);
      ctx.fillText('FPS: 60 // RES: 1080p // REC ●', 20, h - 20);
      ctx.fillText(`GRID LOCK: ACTIVE [${Math.floor(time * 10) % 9999}]`, w - 240, 30);
    }

    // 5. Global Video Glitch & Scanline Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let line = 0; line < h; line += 4) {
      ctx.fillRect(0, line, w, 1.5);
    }

    // VHS tracking glitch bar every ~4s
    if (Math.sin(time * 3.5) > 0.88) {
      const glitchY = Math.abs(Math.sin(time * 12)) * (h - 20);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fillRect(0, glitchY, w, 14);
    }

    texture.needsUpdate = true;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Heavy Industrial Screen Enclosure / Backing */}
      <mesh position={[0, 0, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[width + 1.6, height + 1.4, 0.5]} />
        <meshStandardMaterial color="#070b14" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Dynamic Video Display Surface (in front of backing) */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Outer Glowing Neon Bezel Rim Tubes */}
      <mesh position={[0, height / 2 + 0.35, 0.08]}>
        <boxGeometry args={[width + 0.8, 0.12, 0.12]} />
        <meshBasicMaterial color={channel === 1 ? '#00f0ff' : channel === 2 ? '#ec4899' : '#10b981'} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.35, 0.08]}>
        <boxGeometry args={[width + 0.8, 0.12, 0.12]} />
        <meshBasicMaterial color={channel === 1 ? '#00f0ff' : channel === 2 ? '#ec4899' : '#10b981'} />
      </mesh>
      <mesh position={[-width / 2 - 0.35, 0, 0.08]}>
        <boxGeometry args={[0.12, height + 0.8, 0.12]} />
        <meshBasicMaterial color={channel === 1 ? '#00f0ff' : channel === 2 ? '#ec4899' : '#10b981'} />
      </mesh>
      <mesh position={[width / 2 + 0.35, 0, 0.08]}>
        <boxGeometry args={[0.12, height + 0.8, 0.12]} />
        <meshBasicMaterial color={channel === 1 ? '#00f0ff' : channel === 2 ? '#ec4899' : '#10b981'} />
      </mesh>

      {/* Structural Catwalk Grate Platform Below Screen */}
      <mesh position={[0, -height / 2 - 0.8, 0.8]}>
        <boxGeometry args={[width + 2, 0.15, 1.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.4} />
      </mesh>
    </group>
  );
};
