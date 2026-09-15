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

    // 5. Senior Researcher Nova — Quantum Physicist (Nexus Labs Promenade)
    this.registerConversation({
      npcId: 'lab_researcher_nova',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Senior Researcher Nova',
          role: 'Quantum Containment Specialist // Nexus Advanced Labs',
          text: 'Careful near the containment perimeter! The tachyon ring is spinning at 14,000 RPM. We are observing zero quantum decoherence across all eight spatial quadrants.',
          choices: [
            { text: 'What does the quantum core power?', nextNodeId: 'power' },
            { text: 'Can I access Level 2 Mezzanine?', nextNodeId: 'elevator' },
            { text: 'Carry on with your research.', nextNodeId: 'exit' },
          ],
        },
        power: {
          id: 'power',
          speaker: 'Senior Researcher Nova',
          role: 'Quantum Containment Specialist // Nexus Advanced Labs',
          text: 'It powers the entire district telemetry grid and magnetic hover corridors. Without this reactor, the skyway traffic would lose anti-gravity stabilization within seconds.',
          choices: [{ text: 'Impressive engineering.', nextNodeId: 'exit' }],
        },
        elevator: {
          id: 'elevator',
          speaker: 'Senior Researcher Nova',
          role: 'Quantum Containment Specialist // Nexus Advanced Labs',
          text: 'Yes! Step onto the elevator lift in the corner. Level 2 has our upper observation deck and deep-spectrum telemetry consoles.',
          choices: [{ text: 'I will check it out.', nextNodeId: 'exit' }],
        },
      },
    });

    // 6. Mixologist Unit K-9 — Cyber Bartender (Neon Velocity Boulevard)
    this.registerConversation({
      npcId: 'lounge_bartender_k9',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Mixologist Unit K-9',
          role: 'Synthetic Mixologist // Neon Velocity Lounge',
          text: 'Welcome to Neon Velocity, operative. Synthesized cocktail or a chilled electrolyte infusion? Our taps are direct-fed from the central chilling conduits.',
          choices: [
            { text: 'What do you recommend?', nextNodeId: 'recommend' },
            { text: 'Who frequents this lounge?', nextNodeId: 'patrons' },
            { text: 'Just passing through.', nextNodeId: 'exit' },
          ],
        },
        recommend: {
          id: 'recommend',
          speaker: 'Mixologist Unit K-9',
          role: 'Synthetic Mixologist // Neon Velocity Lounge',
          text: 'The "Neon Blue Mirage" — liquid nitrogen, synthetic curacao, and micro-luminescent effervescence. Guaranteed to lower neural heat by 4.2 degrees.',
          choices: [{ text: 'Sounds refreshing. Thanks, K-9.', nextNodeId: 'exit' }],
        },
        patrons: {
          id: 'patrons',
          speaker: 'Mixologist Unit K-9',
          role: 'Synthetic Mixologist // Neon Velocity Lounge',
          text: 'Netrunners, corporate couriers, skyway pilots on shore leave. Everyone gathers here between night cycles to exchange encrypted dataslates.',
          choices: [{ text: 'Ill keep my eyes open.', nextNodeId: 'exit' }],
        },
      },
    });

    // 7. Doc Viktor Vance — Ripperdoc Surgeon (Krom-Doc Plaza)
    this.registerConversation({
      npcId: 'ripperdoc_viktor',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Doc Viktor Vance',
          role: 'Master Cyber-Surgeon // Krom-Doc Clinic',
          text: 'Sit down, take a breath. Looking for titanium bone lacing, sub-dermal reflex accelerators, or an optical HUD recalibration?',
          choices: [
            { text: 'How are my current vital telemetry readings?', nextNodeId: 'vitals' },
            { text: 'Tell me about the cyber-prosthetics cases.', nextNodeId: 'prosthetics' },
            { text: 'Just browsing the clinic, Doc.', nextNodeId: 'exit' },
          ],
        },
        vitals: {
          id: 'vitals',
          speaker: 'Doc Viktor Vance',
          role: 'Master Cyber-Surgeon // Krom-Doc Clinic',
          text: 'Your bioreactor output is solid. Kinematic response time under 12 milliseconds. Your cyber armor is in pristine condition.',
          choices: [{ text: 'Good to know.', nextNodeId: 'exit' }],
        },
        prosthetics: {
          id: 'prosthetics',
          speaker: 'Doc Viktor Vance',
          role: 'Master Cyber-Surgeon // Krom-Doc Clinic',
          text: 'Grade-5 carbon fiber and aero-grade titanium alloys. We craft prosthetics that can withstand atmospheric re-entry friction.',
          choices: [{ text: 'Unbelievable craftsmanship.', nextNodeId: 'exit' }],
        },
      },
    });

    // 8. Netrunner Zero-Day — Rogue Hacker (Black-Ice Safehouse Alley)
    this.registerConversation({
      npcId: 'netrunner_zeroday',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Netrunner Zero-Day',
          role: 'Black-Ice Infiltration Operative // Classified Safehouse',
          text: 'Keep your comms encrypted while you are in here. The Megacorp ICE probes ping this sector every forty seconds, looking for packet leaks.',
          choices: [
            { text: 'What are you decrypting on these server banks?', nextNodeId: 'decryption' },
            { text: 'Can I use the deep-net terminal?', nextNodeId: 'terminal' },
            { text: 'Ill let you focus.', nextNodeId: 'exit' },
          ],
        },
        decryption: {
          id: 'decryption',
          speaker: 'Netrunner Zero-Day',
          role: 'Black-Ice Infiltration Operative // Classified Safehouse',
          text: 'Intercepted corporate flight manifests from the high-altitude skyways. The megacorps are shifting classified quantum data cubes to the outer orbital rings.',
          choices: [{ text: 'Stay safe in the shadows.', nextNodeId: 'exit' }],
        },
        terminal: {
          id: 'terminal',
          speaker: 'Netrunner Zero-Day',
          role: 'Black-Ice Infiltration Operative // Classified Safehouse',
          text: 'Go ahead. The console on the center desk has a bypass key loaded. Run an ICE-breaker sweep if you want to inspect encrypted feeds.',
          choices: [{ text: 'Thanks for the access.', nextNodeId: 'exit' }],
        },
      },
    });

    // 9. Master Chef Taro — Noodle Artisan (Tokyo-Neo Food Court)
    this.registerConversation({
      npcId: 'chef_taro',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Master Chef Taro',
          role: 'Executive Synth-Chef // Tokyo-Neo Ramen',
          text: 'Irasshaimase! Welcome! Boiling hot synthetic tonkotsu ramen with roasted garlic oil and simulated chashu! Best recipe in Sector 1!',
          choices: [
            { text: 'How do you prepare synthetic ramen?', nextNodeId: 'recipe' },
            { text: 'The atmosphere in here is amazing.', nextNodeId: 'ambience' },
            { text: 'Smells delicious, Chef!', nextNodeId: 'exit' },
          ],
        },
        recipe: {
          id: 'recipe',
          speaker: 'Master Chef Taro',
          role: 'Executive Synth-Chef // Tokyo-Neo Ramen',
          text: 'High-protein algae broth boiled for sixteen hours under magnetic heat induction. Even cyber-enhanced bodies need real culinary soul!',
          choices: [{ text: 'I can smell the craftsmanship.', nextNodeId: 'exit' }],
        },
        ambience: {
          id: 'ambience',
          speaker: 'Master Chef Taro',
          role: 'Executive Synth-Chef // Tokyo-Neo Ramen',
          text: 'Traditional lanterns blended with neon signs. A peaceful haven away from the thundering skyway commuters outside.',
          choices: [{ text: 'A true oasis. Arigato!', nextNodeId: 'exit' }],
        },
      },
    });

    // 10. Executive Vane — Corporate Tycoon (Apex Plaza Promenade)
    this.registerConversation({
      npcId: 'penthouse_executive_vane',
      startNodeId: 'intro',
      nodes: {
        intro: {
          id: 'intro',
          speaker: 'Executive Vane',
          role: 'Vice President of Aerial Transit // Apex Monolith',
          text: 'Quite a view from up here at 180 meters altitude, isn’t it? The entire 3-kilometer metropolis spread across the horizon like a living circuit board.',
          choices: [
            { text: 'How do you oversee the city?', nextNodeId: 'oversight' },
            { text: 'Is that the Sky District skybridge over there?', nextNodeId: 'skybridge' },
            { text: 'Stunning penthouse, sir.', nextNodeId: 'exit' },
          ],
        },
        oversight: {
          id: 'oversight',
          speaker: 'Executive Vane',
          role: 'Vice President of Aerial Transit // Apex Monolith',
          text: 'Through quantum telemetry feeds. Every hover-cruiser, every airborne transit drone, every kilowatt of street lighting is monitored in real-time.',
          choices: [{ text: 'A magnificent vantage point.', nextNodeId: 'exit' }],
        },
        skybridge: {
          id: 'skybridge',
          speaker: 'Executive Vane',
          role: 'Vice President of Aerial Transit // Apex Monolith',
          text: 'Indeed. The Twin Spires skybridge connects the financial towers at 60 meters. When the rain sets in, the clouds sweep directly through the bridge arches.',
          choices: [{ text: 'A truly breathtaking spectacle.', nextNodeId: 'exit' }],
        },
      },
    });
  }

  public registerConversation(conv: DialogueConversation): void {
    this.conversations.set(conv.npcId, conv);
  }

  public startDialogue(npcId: string, citizenName?: string, citizenRole?: string): boolean {
    const conv = this.conversations.get(npcId);
    if (conv) {
      this.currentNode = conv.nodes[conv.startNodeId] || null;
    } else {
      // Procedural Citizen ambient dialogue chatter
      const ambientQuotes = [
        "The skyward magnetic grid is experiencing high flux today. Fascinating readings.",
        "Heading toward Central Plaza. The holographic news broadcast is updating sector trade tariffs.",
        "Have you seen the weather atmospheric condensers? The rainfall patterns are completely synthetic.",
        "Always watch the skybridge crossings when the high-altitude winds pick up.",
        "Dr. Vance Kael's team at Nexus Labs just stabilized the quantum reactor core.",
        "The Neon Velocity Lounge on West Avenue has the best synthesized espresso in District 1.",
        "Beautiful day in Nexus City. The solar arrays are running at 100% capacity.",
      ];
      const randomQuote = ambientQuotes[Math.floor(Math.random() * ambientQuotes.length)];
      this.currentNode = {
        id: `dialogue_${npcId}`,
        speaker: citizenName || 'Nexus Citizen',
        role: citizenRole || 'Metropolis Resident',
        text: randomQuote,
        choices: [
          { text: 'Understood. Safe travels in the city.', nextNodeId: 'exit' },
          { text: 'Catch you later.', nextNodeId: 'exit' },
        ],
      };
    }
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
