import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCDef, NPCManager } from './NPCManager';
import { ProceduralNPC } from './ProceduralNPC';
import { InteractiveEntity, InteractionSystem } from '../interaction/InteractionSystem';
import { QualityManager } from '../rendering/QualityManager';

interface NPCCrowdProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const NPCCrowd: React.FC<NPCCrowdProps> = ({ playerPosRef }) => {
  const manager = useRef(NPCManager.getInstance());

  const filterByDensity = (density: number): NPCDef[] => {
    const all = manager.current.npcs;
    const story = all.slice(0, 4);
    const citizens = all.slice(4);
    const count = Math.max(8, Math.round(citizens.length * density));
    return [...story, ...citizens.slice(0, count)];
  };

  const [activeNpcs, setActiveNpcs] = useState<NPCDef[]>(() => filterByDensity(QualityManager.current.NPCDensity));
  const [activeEntity, setActiveEntity] = useState<InteractiveEntity | null>(null);

  useEffect(() => {
    manager.current.setRenderedNpcs(activeNpcs);
    return () => manager.current.setRenderedNpcs([]);
  }, [activeNpcs]);

  useEffect(() => {
    const uInt = InteractionSystem.getInstance().subscribe(setActiveEntity);
    const uQual = QualityManager.subscribe((s) => setActiveNpcs(filterByDensity(s.NPCDensity)));
    return () => {
      uInt();
      uQual();
    };
  }, []);

  useFrame((_, delta) => {
    manager.current.update(delta, playerPosRef.current);
  });

  return (
    <group name="NPCCrowdLayer">
      {activeNpcs.map((npc) => (
        <ProceduralNPC key={npc.id} npc={npc} isNearby={activeEntity?.id === npc.id} />
      ))}
    </group>
  );
};
