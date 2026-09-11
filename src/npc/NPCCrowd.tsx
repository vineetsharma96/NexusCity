import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCManager, NPCDef } from './NPCManager';
import { ProceduralNPC } from './ProceduralNPC';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';

interface NPCCrowdProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const NPCCrowd: React.FC<NPCCrowdProps> = ({ playerPosRef }) => {
  const npcManager = useRef(NPCManager.getInstance());
  const [npcs] = useState<NPCDef[]>(() => npcManager.current.npcs);
  const [activeEntity, setActiveEntity] = useState<InteractiveEntity | null>(null);

  useEffect(() => {
    return InteractionSystem.getInstance().subscribe(setActiveEntity);
  }, []);

  useFrame((_, delta) => {
    const pPos = playerPosRef.current;
    npcManager.current.update(delta, pPos);
    InteractionSystem.getInstance().updatePlayerPosition(pPos);
  });

  return (
    <group name="NPCCrowdLayer">
      {npcs.map((npc) => (
        <ProceduralNPC
          key={npc.id}
          npc={npc}
          isNearby={activeEntity?.id === npc.id}
        />
      ))}
    </group>
  );
};
