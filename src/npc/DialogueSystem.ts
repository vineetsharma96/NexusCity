export interface DialogueChoice {
  text: string;
  nextNodeId?: string;
  action?: () => void;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  role: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueConversation {
  npcId: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

type DialogueStateListener = (activeNode: DialogueNode | null) => void;

export class DialogueSystem {
  private static instance: DialogueSystem;
  private conversations: Map<string, DialogueConversation> = new Map();
  private currentNode: DialogueNode | null = null;
  private listeners: Set<DialogueStateListener> = new Set();

  constructor() {
    this.initDefaultDialogues();
  }

  public static getInstance(): DialogueSystem {
    if (!DialogueSystem.instance) {
      DialogueSystem.instance = new DialogueSystem();
    }
    return DialogueSystem.instance;
  }

  private initDefaultDialogues(): void {
    // 1. Dr. Vance Kael — Senior Neural Architect
    this.registerConversation({
      npcId: 'dr_vance',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Dr. Vance Kael',
          role: 'Chief Neural Architect // Nexus Labs',
          text: 'Greetings, traveler. You stand in District 1, the beating heart of Nexus City. Every spire you see is synchronized with the planetary quantum core.',
          choices: [
            { text: 'Tell me about the skyscrapers.', nextNodeId: 'skyscrapers' },
            { text: 'What research happens here?', nextNodeId: 'research' },
            { text: 'Safe travels, Doctor.', nextNodeId: 'exit' },
          ],
        },
        skyscrapers: {
          id: 'skyscrapers',
          speaker: 'Dr. Vance Kael',
          role: 'Chief Neural Architect // Nexus Labs',
          text: 'They are built from self-healing polymer alloy and photonic glass. As night falls, the facades harvest solar irradiance and channel it into ground-level grids.',
          choices: [
            { text: 'Fascinating. What about the research?', nextNodeId: 'research' },
            { text: 'Thank you for the insight.', nextNodeId: 'exit' },
          ],
        },
        research: {
          id: 'research',
          speaker: 'Dr. Vance Kael',
          role: 'Chief Neural Architect // Nexus Labs',
          text: 'We are engineering autonomous spatial systems and atmospheric climate regulators. The falling leaves you see along the avenues are bio-synthesized air filters.',
          choices: [
            { text: 'The leaves clean the city air?', nextNodeId: 'leaves' },
            { text: 'I will explore more of the district.', nextNodeId: 'exit' },
          ],
        },
        leaves: {
          id: 'leaves',
          speaker: 'Dr. Vance Kael',
          role: 'Chief Neural Architect // Nexus Labs',
          text: 'Precisely! They absorb urban carbon and dissolve upon contact with the mulch bedding. Nature augmented by quantum chemistry.',
          choices: [{ text: 'Brilliant engineering. See you around.', nextNodeId: 'exit' }],
        },
      },
    });

    // 2. Kira Jin — Urban Courier
    this.registerConversation({
      npcId: 'kira_courier',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Kira Jin',
          role: 'Rooftop Courier // Velocity Logistics',
          text: 'Hey! Watch your step on the avenue crossings. Delivery drones and speed-skaters move fast around here. What brings you to Sector 1?',
          choices: [
            { text: 'Just exploring the city avenues.', nextNodeId: 'exploring' },
            { text: 'Any good vantage points nearby?', nextNodeId: 'vantage' },
            { text: 'Catch you later, Kira.', nextNodeId: 'exit' },
          ],
        },
        exploring: {
          id: 'exploring',
          speaker: 'Kira Jin',
          role: 'Rooftop Courier // Velocity Logistics',
          text: 'Take the central boulevard down to the intersection plaza. When sunset hits, the neon light strips illuminate the whole skyline. Best view in the sector.',
          choices: [
            { text: 'Where can I get high up?', nextNodeId: 'vantage' },
            { text: 'Thanks for the tip!', nextNodeId: 'exit' },
          ],
        },
        vantage: {
          id: 'vantage',
          speaker: 'Kira Jin',
          role: 'Rooftop Courier // Velocity Logistics',
          text: 'The skybridge on the Twin Towers at Block 3 connects both spires at 60 meters up. The wind up there will blow you away!',
          choices: [{ text: 'I will definitely check that out.', nextNodeId: 'exit' }],
        },
      },
    });

    // 3. Echo-7 — Infrastructure Android
    this.registerConversation({
      npcId: 'echo_android',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Echo-7',
          role: 'Municipal Maintenance Android // Unit 41',
          text: 'Unit Echo-7 reporting nominal operation. Power grid telemetry: 99.8%. Street luminaire arrays: fully operational. How may this unit assist citizen?',
          choices: [
            { text: 'What is your current directive?', nextNodeId: 'directive' },
            { text: 'How does the day/night cycle work?', nextNodeId: 'cycle' },
            { text: 'Carry on with your patrol, Echo.', nextNodeId: 'exit' },
          ],
        },
        directive: {
          id: 'directive',
          speaker: 'Echo-7',
          role: 'Municipal Maintenance Android // Unit 41',
          text: 'Routine sidewalk patrol, verifying solar collection conduits and sidewalk curb integrity. All systems operating within approved tolerances.',
          choices: [{ text: 'Good work, Echo-7.', nextNodeId: 'exit' }],
        },
        cycle: {
          id: 'cycle',
          speaker: 'Echo-7',
          role: 'Municipal Maintenance Android // Unit 41',
          text: 'At 17:30 hours, luminaire point lights scale from 0.2 to 3.0 intensity. Energy reserves transition to stored capacitor banks until 06:00 dawn.',
          choices: [{ text: 'Understood. Thank you.', nextNodeId: 'exit' }],
        },
      },
    });

    // 4. Officer Chen — Peacekeeper
    this.registerConversation({
      npcId: 'officer_chen',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Officer Chen',
          role: 'Metropolis Peacekeeper // Sector 1 Patrol',
          text: 'Keep moving, citizen. Keep to the sidewalks and observe crosswalk signals. Sector 1 is under 24/7 automated monitoring.',
          choices: [
            { text: 'Is the city safe for exploration?', nextNodeId: 'safety' },
            { text: 'Where can I find the central terminal?', nextNodeId: 'terminal' },
            { text: 'Understood, Officer.', nextNodeId: 'exit' },
          ],
        },
        safety: {
          id: 'safety',
          speaker: 'Officer Chen',
          role: 'Metropolis Peacekeeper // Sector 1 Patrol',
          text: 'Completely. There is zero violent crime in Nexus City. The worst you might encounter is a rogue leaf particle in your visor.',
          choices: [{ text: 'Good to know. Stay safe.', nextNodeId: 'exit' }],
        },
        terminal: {
          id: 'terminal',
          speaker: 'Officer Chen',
          role: 'Metropolis Peacekeeper // Sector 1 Patrol',
          text: 'Right at the central intersection plaza. The holographic pedestal gives full district telemetry and seed parameters.',
          choices: [{ text: 'Heading there now.', nextNodeId: 'exit' }],
        },
      },
    });
  }

  public registerConversation(conv: DialogueConversation): void {
    this.conversations.set(conv.npcId, conv);
  }

  public startDialogue(npcId: string): boolean {
    const conv = this.conversations.get(npcId);
    if (!conv) return false;

    this.currentNode = conv.nodes[conv.startNodeId] || null;
    this.notify();
    return !!this.currentNode;
  }

  public selectChoice(choice: DialogueChoice): void {
    if (choice.action) choice.action();

    if (!choice.nextNodeId || choice.nextNodeId === 'exit') {
      this.closeDialogue();
      return;
    }

    // Find the node in the current conversation
    for (const conv of this.conversations.values()) {
      if (conv.nodes[choice.nextNodeId]) {
        this.currentNode = conv.nodes[choice.nextNodeId];
        this.notify();
        return;
      }
    }

    this.closeDialogue();
  }

  public closeDialogue(): void {
    this.currentNode = null;
    this.notify();
  }

  public getActiveNode(): DialogueNode | null {
    return this.currentNode;
  }

  public subscribe(listener: DialogueStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentNode);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.currentNode));
  }
}
