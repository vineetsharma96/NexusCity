import * as THREE from 'three';
import { NavigationSystem, LandmarkDef } from '../map/NavigationSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { TimeSystem } from '../world/TimeSystem';
import { ChunkManager } from '../world/ChunkManager';
import { DistrictGenerator, DistrictInfo } from '../city/DistrictGenerator';
import { AudioManager } from '../audio/AudioManager';

export interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionExecuted?: string;
}

export interface AIWorldStateSnapshot {
  playerCoordinates: { x: number; y: number; z: number };
  distanceFromCenter: number;
  district: DistrictInfo;
  weather: {
    current: WeatherType;
    rainIntensityPercent: number;
    wetnessPercent: number;
    fogMultiplier: number;
    isLightning: boolean;
  };
  wind: {
    speedMps: number;
    cardinalDirection: string;
    gustFactor: number;
  };
  time: {
    formattedTime: string;
    phase: string;
    isNight: boolean;
  };
  navigation: {
    activeWaypoint: string;
    distanceMeters?: number;
    etaSeconds?: number;
  };
  exploration: {
    revealedSectors: number;
    totalSectors: number;
    exploredPercent: number;
  };
  nearbyLocations: {
    id: string;
    name: string;
    category: string;
    distanceMeters: number;
    direction: string;
  }[];
}

type AIListener = (messages: AIMessage[], isProcessing: boolean) => void;

export class AIAssistant {
  private static instance: AIAssistant;

  private messages: AIMessage[] = [
    {
      id: 'init-1',
      sender: 'ai',
      text: 'NEXUS-AI Urban Core online. I possess direct telemetry of your coordinates, district atmospheric readings, outdoor landmarks, and transit routes. I can route waypoints, warp coordinates, modulate weather, or brief you on sectors and city personnel. How may I direct your exploration?',
      timestamp: '00:00:01',
    },
  ];

  private isProcessing: boolean = false;
  private listeners: Set<AIListener> = new Set();
  private userApiKey: string = '';

  private constructor() {
    if (typeof window !== 'undefined') {
      this.userApiKey = localStorage.getItem('nexus_gemini_api_key') || '';
    }
  }

  public static getInstance(): AIAssistant {
    if (!AIAssistant.instance) {
      AIAssistant.instance = new AIAssistant();
    }
    return AIAssistant.instance;
  }

  public setApiKey(key: string): void {
    this.userApiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_gemini_api_key', this.userApiKey);
    }
    this.notify();
  }

  public getApiKey(): string {
    return this.userApiKey;
  }

  public getMessages(): AIMessage[] {
    return this.messages;
  }

  public getIsProcessing(): boolean {
    return this.isProcessing;
  }

  public clearHistory(): void {
    this.messages = [
      {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        text: 'Terminal session cleared. System ready for queries or navigational routing.',
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
    this.notify();
  }

  /**
   * Compiles ground-truth world telemetry snapshot based on real simulation state.
   */
  public getWorldState(playerPos: THREE.Vector3): AIWorldStateSnapshot {
    const distFromCenter = Math.round(Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z));
    const district = DistrictGenerator.getDistrictAt(playerPos.x, playerPos.z);
    const weather = WeatherSystem.getInstance().getState();
    const wind = WindSystem.getInstance().getState();
    const time = TimeSystem.getInstance().getState();
    const nav = NavigationSystem.getInstance().getState();
    const chunkManager = ChunkManager.getInstance();

    // Wind direction to cardinal compass
    const windAngleDeg = ((wind.direction * 180) / Math.PI + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cardinalDir = cardinals[Math.round(windAngleDeg / 45) % 8];

    // Calculate nearest real locations
    const allLandmarks = NavigationSystem.getInstance().landmarks;
    const nearbyLocations = allLandmarks
      .map((l) => {
        const dx = l.position.x - playerPos.x;
        const dz = l.position.z - playerPos.z;
        const d = Math.round(Math.sqrt(dx * dx + dz * dz));
        const angle = ((Math.atan2(dz, dx) * 180) / Math.PI + 450) % 360;
        const dir = cardinals[Math.round(angle / 45) % 8];
        return {
          id: l.id,
          name: l.name,
          category: l.category,
          distanceMeters: d,
          direction: dir,
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 6);

    return {
      playerCoordinates: {
        x: Math.round(playerPos.x * 10) / 10,
        y: Math.round(playerPos.y * 10) / 10,
        z: Math.round(playerPos.z * 10) / 10,
      },
      distanceFromCenter: distFromCenter,
      district,
      weather: {
        current: weather.currentWeather,
        rainIntensityPercent: Math.round(weather.rainIntensity * 100),
        wetnessPercent: Math.round(weather.wetnessFactor * 100),
        fogMultiplier: Math.round(weather.fogDensityMultiplier * 10) / 10,
        isLightning: weather.isLightningActive,
      },
      wind: {
        speedMps: Math.round(wind.speed * 10) / 10,
        cardinalDirection: cardinalDir,
        gustFactor: Math.round(wind.gustFactor * 10) / 10,
      },
      time: {
        formattedTime: time.formattedTime,
        phase: time.phase,
        isNight: time.isNight,
      },
      navigation: {
        activeWaypoint: nav.activeLandmark ? nav.activeLandmark.name : 'None (Freeroam)',
        distanceMeters: nav.activeLandmark ? Math.round(nav.distance) : undefined,
        etaSeconds: nav.activeLandmark ? Math.round(nav.distance / 5.5) : undefined,
      },
      exploration: {
        revealedSectors: chunkManager.getState().discoveredChunks.size,
        totalSectors: 576,
        exploredPercent: chunkManager.getExploredPercent(),
      },
      nearbyLocations,
    };
  }

  public async sendMessage(userText: string, playerPos: THREE.Vector3): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed) return;

    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.messages.push(userMsg);
    this.isProcessing = true;
    this.notify();

    const worldState = this.getWorldState(playerPos);

    try {
      const apiKey = this.userApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (apiKey) {
        const response = await this.queryGemini(trimmed, worldState, apiKey);
        this.handleAIResponse(response.text, response.action, playerPos);
      } else {
        // Zero-latency autonomous offline parser
        await new Promise((r) => setTimeout(r, 200));
        const response = this.parseOfflineRule(trimmed, worldState);
        this.handleAIResponse(response.text, response.action, playerPos);
      }
    } catch (err) {
      console.warn('Gemini query error, falling back to autonomous offline NLP:', err);
      const response = this.parseOfflineRule(trimmed, worldState);
      const fallbackText = `${response.text}\n\n[Autonomous Core: Gemini API unavailable; processed via internal neural heuristic.]`;
      this.handleAIResponse(fallbackText, response.action, playerPos);
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }

  private handleAIResponse(
    text: string,
    action?: { type: string; param: string },
    playerPos?: THREE.Vector3
  ): void {
    let actionExecuted: string | undefined = undefined;

    if (action) {
      actionExecuted = this.executeAction(action.type, action.param, playerPos);
    }

    const aiMsg: AIMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text,
      timestamp: new Date().toLocaleTimeString(),
      actionExecuted,
    };

    this.messages.push(aiMsg);
  }

  private executeAction(type: string, param: string, playerPos?: THREE.Vector3): string | undefined {
    switch (type.toLowerCase()) {
      case 'navigate': {
        const nav = NavigationSystem.getInstance();
        const target = this.resolveLandmark(param);
        if (target) {
          nav.setDestination(target.id);
          AudioManager.getInstance().playTerminalBeep();
          return `WAYPOINT LOCKED: ${target.name.toUpperCase()}`;
        }
        break;
      }
      case 'teleport': {
        const target = this.resolveLandmark(param);
        if (target) {
          window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: target.position.clone() }));
          AudioManager.getInstance().playElevatorMove();
          return `⚡ QUANTUM WARP: ${target.name.toUpperCase()}`;
        }
        break;
      }
      case 'weather': {
        const weather = WeatherSystem.getInstance();
        const wt = param.toUpperCase() as WeatherType;
        if (['CLEAR', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'FOG'].includes(wt)) {
          weather.setWeather(wt);
          AudioManager.getInstance().playUI('click');
          return `ATMOSPHERE MODULATED: ${wt}`;
        }
        break;
      }
      case 'time': {
        const hour = parseFloat(param);
        if (!isNaN(hour)) {
          TimeSystem.getInstance().setHour(hour);
          AudioManager.getInstance().playUI('click');
          return `CHRONO JUMP: ${TimeSystem.getInstance().getState().formattedTime}`;
        }
        break;
      }
    }
    return undefined;
  }

  /**
   * Resolves a target string to an authentic registered LandmarkDef (no hallucinations).
   */
  private resolveLandmark(query: string): LandmarkDef | undefined {
    const q = query.toLowerCase().trim();
    const landmarks = NavigationSystem.getInstance().landmarks;

    // 1. Exact ID match
    const exactId = landmarks.find((l) => l.id.toLowerCase() === q);
    if (exactId) return exactId;

    // 2. Keyword dictionary for authentic registered outdoor landmarks
    const keywordMap: Record<string, string> = {
      plaza: 'central_plaza',
      center: 'central_plaza',
      square: 'central_plaza',
      hub: 'central_plaza',

      spires: 'twin_spires',
      skybridge: 'twin_spires',
      twin: 'twin_spires',

      apex: 'apex_tower',
      monolith: 'apex_tower',
      tower: 'apex_tower',
      corporate: 'apex_tower',

      park: 'park_sanctuary',
      sanctuary: 'park_sanctuary',
      lotus: 'park_sanctuary',
      pond: 'park_sanctuary',
      trees: 'park_sanctuary',
      nature: 'park_sanctuary',

      north: 'north_crossway',
      highway: 'north_crossway',

      south: 'south_crossway',
      artery: 'south_crossway',
      crossing: 'north_crossway',
    };

    for (const [kw, landmarkId] of Object.entries(keywordMap)) {
      if (q.includes(kw)) {
        const found = landmarks.find((l) => l.id === landmarkId);
        if (found) return found;
      }
    }

    // 3. Name inclusion
    return landmarks.find(
      (l) => l.name.toLowerCase().includes(q) || q.includes(l.name.toLowerCase())
    );
  }

  /**
   * Offline Zero-Latency Rule-Based Heuristic Parser.
   * Completely autonomous: no internet or Gemini API needed for core gameplay.
   */
  private parseOfflineRule(
    query: string,
    world: AIWorldStateSnapshot
  ): { text: string; action?: { type: string; param: string } } {
    const q = query.toLowerCase().trim();
    const isWarp = q.includes('teleport') || q.includes('warp') || q.includes('fast travel') || q.includes('beam');

    // 1. Navigation & Teleportation to Ground-Truth Locations
    const resolvedLandmark = this.resolveLandmark(q);
    if (resolvedLandmark && (isWarp || q.includes('take me') || q.includes('navigate') || q.includes('go to') || q.includes('find') || q.includes('route') || q.includes('lead') || q.includes('head to') || q.includes('where is'))) {
      const actionType = isWarp ? 'teleport' : 'navigate';
      const actionVerb = isWarp ? 'Initiating instantaneous quantum warp to' : 'Plotting optimal sidewalk route vectors to';
      return {
        text: `${actionVerb} ${resolvedLandmark.name}. Ground guidance beacon activated on your HUD.`,
        action: { type: actionType, param: resolvedLandmark.id },
      };
    }

    // 2. Weather Modifications
    if (q.includes('storm') || q.includes('thunder') || q.includes('heavy rain') || q.includes('lightning')) {
      return {
        text: 'Atmospheric condensers engaged: generating torrential storm precipitation and high-voltage electrical bursts across the metropolis.',
        action: { type: 'weather', param: 'HEAVY_RAIN' },
      };
    }
    if (q.includes('rain') || q.includes('shower') || q.includes('wet') || q.includes('drizzle')) {
      return {
        text: 'Deploying cloud seeding matrices. Moderate rainfall initiated; pavements and road asphalt are glistening.',
        action: { type: 'weather', param: 'RAIN' },
      };
    }
    if (q.includes('clear') || q.includes('sun') || q.includes('sunny') || q.includes('dry') || q.includes('bright')) {
      return {
        text: 'Dispersing moisture clouds and precipitation. Skybox returned to crystal-clear atmospheric transparency.',
        action: { type: 'weather', param: 'CLEAR' },
      };
    }
    if (q.includes('fog') || q.includes('smog') || q.includes('mist') || q.includes('haze')) {
      return {
        text: 'Generating dense cyberpunk smog blanket. Ground mist and street-level fog layers deployed.',
        action: { type: 'weather', param: 'FOG' },
      };
    }
    if (q.includes('cloud') || q.includes('overcast')) {
      return {
        text: 'Tropospheric cloud layer modulated to dense overcast cover.',
        action: { type: 'weather', param: 'CLOUDY' },
      };
    }

    // 3. Chronometer & Time Jumps
    if (q.includes('midnight') || q.includes('night') || q.includes('dark')) {
      return {
        text: 'Advancing chronometer to 23:00 Midnight. Celestial moonlight and skyscraper neon channels illuminated.',
        action: { type: 'time', param: '23' },
      };
    }
    if (q.includes('sunset') || q.includes('dusk') || q.includes('evening') || q.includes('golden hour')) {
      return {
        text: 'Setting city chronometer to 18:30 Sunset. Horizon gold and violet atmospheric bounce active.',
        action: { type: 'time', param: '18.5' },
      };
    }
    if (q.includes('dawn') || q.includes('sunrise') || q.includes('morning')) {
      return {
        text: 'Resetting time to 06:00 Dawn. Early morning sunlight filtering through urban towers.',
        action: { type: 'time', param: '6' },
      };
    }
    if (q.includes('noon') || q.includes('day') || q.includes('daylight') || q.includes('afternoon')) {
      return {
        text: 'Setting time to 12:00 High Noon. Maximum ambient visibility across all 64 sectors.',
        action: { type: 'time', param: '12' },
      };
    }

    // 4. Exact World State Telemetry Queries
    if (q.includes('where am i') || q.includes('current location') || q.includes('coordinates') || q.includes('my position')) {
      const { playerCoordinates, distanceFromCenter, district } = world;
      return {
        text: `You are outdoors in ${district.name} (${district.subtitle}) at coordinates (${playerCoordinates.x}, ${playerCoordinates.z}), located ${distanceFromCenter}m from Central Plaza. District traits: ${district.description}`,
      };
    }

    if (q.includes('weather') || q.includes('atmosphere') || q.includes('wind') || q.includes('forecast')) {
      const { weather, wind } = world;
      return {
        text: `Active Weather: ${weather.current} (Wetness: ${weather.wetnessPercent}%, Fog Multiplier: ${weather.fogMultiplier}x). Wind speed: ${wind.speedMps} m/s blowing ${wind.cardinalDirection} with gust factor ${wind.gustFactor}x.`,
      };
    }

    if (q.includes('time') || q.includes('clock') || q.includes('hour')) {
      const { time } = world;
      return {
        text: `Metropolitan Chronometer: ${time.formattedTime} [${time.phase}]. Status: ${time.isNight ? 'Night Lighting Emissive Grid Active' : 'Daylight Solar Grid Active'}.`,
      };
    }

    if (q.includes('exploration') || q.includes('map') || q.includes('fog of war') || q.includes('discovered')) {
      const { exploration } = world;
      return {
        text: `Metropolitan Blueprint: ${exploration.exploredPercent}% explored (${exploration.revealedSectors} of ${exploration.totalSectors} sectors mapped). Press [M] to inspect the interactive 24×24 map.`,
      };
    }

    if (q.includes('nearby') || q.includes('closest') || q.includes('what is around')) {
      const list = world.nearbyLocations
        .map((l) => `• ${l.name} (${l.distanceMeters}m ${l.direction})`)
        .join('\n');
      return {
        text: `Real verified locations in your vicinity:\n${list}\n\nSay "take me to <name>" to route a ground navigation path.`,
      };
    }

    // 5. NPC & Character Lore
    if (q.includes('vance') || q.includes('kael')) {
      return {
        text: 'Dr. Vance Kael is the Chief Quantum Architect at Nexus Advanced Labs. He investigates anti-entropy containment fields and atmospheric stabilization.',
      };
    }
    if (q.includes('kira') || q.includes('jin')) {
      return {
        text: 'Kira Jin is an elite high-speed data courier frequently spotted between the Central Boulevard and the Neon Velocity Lounge.',
      };
    }
    if (q.includes('chen') || q.includes('echo') || q.includes('police') || q.includes('officer')) {
      return {
        text: 'Officer Chen and Autonomous Patrol Unit Echo-7 enforce municipal civil protocols and biometric compliance throughout the commercial sectors.',
      };
    }
    if (q.includes('viktor') || q.includes('doc')) {
      return {
        text: 'Ripperdoc Viktor operates Krom-Doc Augmentation Clinic in Medical Alley, specializing in military-grade neural optics and cyberware prosthetics.',
      };
    }
    if (q.includes('zero-day') || q.includes('zeroday')) {
      return {
        text: 'Zero-Day is an elusive legendary netrunner stationed inside the Black-Ice Hacker Safehouse, monitoring megacorp data nodes.',
      };
    }
    if (q.includes('taro') || q.includes('chef')) {
      return {
        text: 'Chef Taro crafts legendary synthetic broth ramen at Tokyo-Neo Synth-Ramen on East Food Bazaar.',
      };
    }

    // 6. General Guidance / Default Help
    return {
      text: `NEXUS-AI Operational. Telemetry: ${world.district.name} // ${world.time.formattedTime} (${world.time.phase}) // ${world.weather.current}.
Try commands such as:
• "Take me to Tokyo-Neo Ramen" or "Route to Ripperdoc"
• "Warp to Nexus Labs"
• "Make it rain" or "Clear the sky"
• "Set time to midnight"
• "What is nearby?" or "Where am I?"`,
    };
  }

  /**
   * Online Gemini API Integration with strict ground-truth context and multi-turn awareness.
   */
  private async queryGemini(
    query: string,
    world: AIWorldStateSnapshot,
    apiKey: string
  ): Promise<{ text: string; action?: { type: string; param: string } }> {
    // Compile comprehensive ground-truth reference table
    const landmarkList = NavigationSystem.getInstance().landmarks.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      coordinates: `(${Math.round(l.position.x)}, ${Math.round(l.position.z)})`,
      description: l.description,
    }));

    const systemPrompt = `You are "NEXUS-AI", the sophisticated holographic urban assistant embedded in the cyberpunk open-world simulation "Nexus City".

Nexus City is an expansive outdoor open-world cyberpunk exploration metropolis. All architectural exploration, NPC interactions, traffic observation, and navigation happen outdoors on city streets, plazas, parks, and boulevards.

=== LIVE WORLD TELEMETRY (GROUND TRUTH) ===
- Player Coordinates: (${world.playerCoordinates.x}, ${world.playerCoordinates.y}, ${world.playerCoordinates.z})
- Current District: ${world.district.name} (${world.district.subtitle}) - ${world.district.description}
- Time of Day: ${world.time.formattedTime} [${world.time.phase}] (Night lighting: ${world.time.isNight ? 'ON' : 'OFF'})
- Weather: ${world.weather.current} (Wetness: ${world.weather.wetnessPercent}%, Fog Multiplier: ${world.weather.fogMultiplier}x)
- Wind: ${world.wind.speedMps} m/s blowing ${world.wind.cardinalDirection} (Gust factor: ${world.wind.gustFactor}x)
- Navigation: Active Route = ${world.navigation.activeWaypoint}${world.navigation.distanceMeters ? ` (${world.navigation.distanceMeters}m, ~${world.navigation.etaSeconds}s)` : ''}
- Exploration Progress: ${world.exploration.exploredPercent}% mapped (${world.exploration.revealedSectors}/${world.exploration.totalSectors} sectors)

=== VERIFIED GROUND-TRUTH LOCATIONS (STRICT NO-HALLUCINATION RULE) ===
You must ONLY refer to, navigate to, or recommend real registered locations in Nexus City:
${JSON.stringify(landmarkList, null, 2)}

=== STRICT BEHAVIORAL CONSTRAINTS ===
1. NO HALLUCINATIONS: Do NOT invent fictional shop names or attempt to direct the player inside buildings. Refer exclusively to the registered outdoor city landmarks above.
2. TONE: Sleek, highly intelligent, concise cyberpunk operative assistant.
3. ACTIONS: If the user requests navigation, teleportation, weather modification, or time warping, you must return a valid action object.
   - For fast travel / warp: action type "teleport" with valid landmark id.
   - For route guidance / directions: action type "navigate" with valid landmark id.
   - For weather: action type "weather" with parameter "CLEAR" | "CLOUDY" | "RAIN" | "HEAVY_RAIN" | "FOG".
   - For time: action type "time" with numeric hour (e.g. "6", "12", "18.5", "23").

Format your response as a JSON object:
{
  "reply": "Your in-character spoken dialogue (concise, 1-3 sentences)",
  "action": {
    "type": "navigate" | "teleport" | "weather" | "time",
    "param": "landmark_id_or_value"
  }
}
If no action is triggered, set action to null.`;

    // Multi-turn context
    const contents: any[] = [];
    const recentMessages = this.messages.slice(-4);
    for (const msg of recentMessages) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }

    // Ensure the final user query is attached
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: query }],
      });
    }

    // Try gemini-2.0-flash with fallback to gemini-1.5-flash
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 500,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`Gemini ${model} HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (rawText) {
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return {
            text: parsed.reply || rawText,
            action: parsed.action || undefined,
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt with ${model} failed, trying fallback:`, err.message);
      }
    }

    throw lastError || new Error('Gemini query failed on all endpoints');
  }

  public subscribe(listener: AIListener): () => void {
    this.listeners.add(listener);
    listener(this.messages, this.isProcessing);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.messages, this.isProcessing));
  }
}
