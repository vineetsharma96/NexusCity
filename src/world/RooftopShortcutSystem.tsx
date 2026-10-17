import React, { useEffect } from 'react';
import * as THREE from 'three';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { SaveSystem } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';
import { DiscoverySystem } from './DiscoverySystem';

export interface RooftopShortcutSystemProps {
  teleportRef: React.MutableRefObject<((position: THREE.Vector3) => void) | null>;
}

interface RooftopShortcut {
  id: string;
  name: string;
  subtitle: string;
  position: THREE.Vector3;
  destination: THREE.Vector3;
}

const SHORTCUTS: RooftopShortcut[] = [
  {
    id: 'rooftop_relay_east',
    name: 'Eastline Rooftop Relay',
    subtitle: 'ELEVATED SERVICE ROUTE // EASTLINE',
    position: new THREE.Vector3(32, 0.2, 8),
    destination: new THREE.Vector3(86, 0.2, 8),
  },
  {
    id: 'rooftop_relay_north',
    name: 'Northline Rooftop Relay',
    subtitle: 'ELEVATED SERVICE ROUTE // NORTHLINE',
    position: new THREE.Vector3(-8, 0.2, -38),
    destination: new THREE.Vector3(-8, 0.2, -108),
  },
  {
    id: 'rooftop_relay_south',
    name: 'Southline Rooftop Relay',
    subtitle: 'ELEVATED SERVICE ROUTE // SOUTHLINE',
    position: new THREE.Vector3(8, 0.2, 38),
    destination: new THREE.Vector3(8, 0.2, 108),
  },
];

export const RooftopShortcutSystem: React.FC<RooftopShortcutSystemProps> = ({ teleportRef }) => {
  useEffect(() => {
    const interactions = InteractionSystem.getInstance();
    SHORTCUTS.forEach((shortcut) => {
      interactions.register({
        id: shortcut.id,
        name: shortcut.name,
        actionText: `USE ${shortcut.name.toUpperCase()}`,
        position: shortcut.position,
        radius: 3.8,
        onInteract: () => {
          teleportRef.current?.(shortcut.destination.clone());
          SaveSystem.getInstance().recordHistory(
            `shortcut_${shortcut.id}`,
            `ROOFTOP ROUTE OPENED // ${shortcut.name.toUpperCase()}`,
            `${shortcut.subtitle} fast transfer archived in city history.`,
          );
          DiscoverySystem.getInstance().recordDiscovery(
            shortcut.id,
            shortcut.name,
            shortcut.subtitle,
            'Rooftop Relay Network',
          );
          AudioManager.getInstance().playShortcutCue();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nexus:notification', {
              detail: {
                title: 'SHORTCUT ROUTE ACTIVE',
                message: `${shortcut.name} // destination transfer complete`,
                type: 'discovery',
                duration: 3200,
              },
            }));
          }
        },
      });
    });
    return () => SHORTCUTS.forEach((shortcut) => interactions.unregister(shortcut.id));
  }, [teleportRef]);

  return (
    <group>
      {SHORTCUTS.map((shortcut) => (
        <group key={shortcut.id} position={shortcut.position}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.55, 0.8, 2.2, 6]} />
            <meshStandardMaterial color="#071a2c" emissive="#00eaff" emissiveIntensity={1.8} metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 2.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 0.85, 6]} />
            <meshBasicMaterial color="#ffd166" transparent opacity={0.9} />
          </mesh>
          <pointLight color="#00eaff" intensity={2.2} distance={8} position={[0, 1.8, 0]} />
        </group>
      ))}
    </group>
  );
};
