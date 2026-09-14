import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCManager, NPCDef } from './NPCManager';
import { ProceduralNPC } from './ProceduralNPC';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';
import { QualityManager } from '../rendering/QualityManager';

interface NPCCrowdProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const NPCCrowd: React.FC<NPCCrowdProps> = ({ playerPosRef }) => {
  const npcManager = useRef(NPCManager.getInstance());

  const getFilteredNpcs = (density: number): NPCDef[] => {
    const all = npcManager.current.npcs;
    const story = all.slice(0, 4);
    const citizens = all.slice(4);
    const count = Math.max(8, Math.round(citizens.length * density));
    return [...story, ...citizens.slice(0, count)];
  };

  const [activeNpcs, setActiveNpcs] = useState<NPCDef[]>(() =>
    getFilteredNpcs(QualityManager.current.NPCDensity)
  );
  const [activeEntity, setActiveEntity] = useState<InteractiveEntity | null>(null);

  useEffect(() => {
    const unsubInteraction = InteractionSystem.getInstance().subscribe(setActiveEntity);
    const unsubQuality = QualityManager.subscribe((settings) => {
      setActiveNpcs(getFilteredNpcs(settings.NPCDensity));
    });

    return () => {
      unsubInteraction();
      unsubQuality();
    };
  }, []);

  useFrame((_, delta) => {
    const pPos = playerPosRef.current;
    npcManager.current.update(delta, pPos);
    InteractionSystem.getInstance().updatePlayerPosition(pPos);
  });

  return (
    <group name="NPCCrowdLayer">
      {activeNpcs.map((npc) => (
        <ProceduralNPC
          key={npc.id}
          npc={npc}
          isNearby={activeEntity?.id === npc.id}
        />
      ))}
    </group>
  );
};
