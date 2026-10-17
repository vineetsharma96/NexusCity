import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkManager } from './ChunkManager';
import { TimeSystem } from './TimeSystem';
import { WeatherSystem } from './WeatherSystem';
import { WindSystem } from './WindSystem';
import { EmergencyAlertSystem } from './EmergencyAlertSystem';
import { LivingCityEventState, LivingCityEventSystem } from './LivingCityEventSystem';
import { MissionSystem } from '../gameplay/MissionSystem';
import { StreamedCityChunks } from '../city/StreamedCityChunks';
import { AudioManager } from '../audio/AudioManager';
import { QualityManager } from '../rendering/QualityManager';

interface WorldManagerProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

const EVENT_POSITIONS: Record<string, [number, number, number]> = {
  CENTRAL_CITY: [0, 0.2, 0],
  NEURAL_DISTRICT: [-165, 0.2, -165],
  INDUSTRIAL_DISTRICT: [-165, 0.2, 165],
};

export const WorldManager: React.FC<WorldManagerProps> = ({ playerPosRef }) => {
  const chunkManager = useRef(ChunkManager.getInstance());
  const timeSystem = useRef(TimeSystem.getInstance());
  const weatherSystem = useRef(WeatherSystem.getInstance());
  const windSystem = useRef(WindSystem.getInstance());
  const emergencySystem = useRef(EmergencyAlertSystem.getInstance());
  const eventSystem = useRef(LivingCityEventSystem.getInstance());
  const missionSystem = useRef(MissionSystem.getInstance());
  const audioManager = useRef(AudioManager.getInstance());

  const [cityEvent, setCityEvent] = useState<LivingCityEventState>(() => eventSystem.current.getState());
  const ringRef = useRef<THREE.Mesh>(null);

  useEffect(() => eventSystem.current.subscribe(setCityEvent), []);

  useFrame(({ clock }, delta) => {
    chunkManager.current.updatePlayerPosition(playerPosRef.current, clock.getElapsedTime());
    timeSystem.current.update(delta);
    weatherSystem.current.update(delta);
    const wState = weatherSystem.current.getState();
    const tState = timeSystem.current.getState();
    windSystem.current.update(delta, wState.rainIntensity);
    const windState = windSystem.current.getState();
    emergencySystem.current.update(wState, tState);
    eventSystem.current.update(delta);
    const currentEvent = eventSystem.current.getState();
    missionSystem.current.update(
      chunkManager.current.getState().currentDistrict.type,
      currentEvent
    );

    const trafficFactor = QualityManager.current.trafficEnabled
      ? currentEvent.trafficSpeedMultiplier
      : 0;
    audioManager.current.updateAmbientSoundscape(
      delta,
      tState,
      wState,
      windState,
      trafficFactor
    );

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.9;
    }
  });

  const eventColor =
    cityEvent.type === 'POWER_OUTAGE'
      ? '#f59e0b'
      : cityEvent.type === 'CORPORATE_LOCKDOWN'
      ? '#f43f5e'
      : '#38bdf8';
  const eventPos = EVENT_POSITIONS[cityEvent.district] || EVENT_POSITIONS.CENTRAL_CITY;

  return (
    <>
      <StreamedCityChunks />
      {cityEvent.phase !== 'IDLE' && (
        <group name="LivingCityEventBeacon" position={eventPos}>
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[7.5, 9.2, 32]} />
            <meshBasicMaterial color={eventColor} transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 14, 0]}>
            <cylinderGeometry args={[0.35, 1.4, 28, 12, 1, true]} />
            <meshBasicMaterial color={eventColor} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
    </>
  );
};
