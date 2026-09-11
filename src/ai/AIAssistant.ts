import * as THREE from 'three';
import { NavigationSystem } from '../map/NavigationSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { TimeSystem } from '../world/TimeSystem';
import { ChunkManager } from '../world/ChunkManager';

export interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionExecuted?: string;
}

type AIListener = (messages: AIMessage[], isProcessing: boolean) => void;

export class AIAssistant {
  private static instance: AIAssistant;

  private messages: AIMessage[] = [
    {
      id: 'init-1',
      sender: 'ai',
      text: 'Greetings, Operator. NEXUS-AI Urban Core online. I can guide you through the city, control atmospheric conditions, jump daylight cycles, or provide real-time sector intelligence. How may I assist your exploration?',
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

    // Small delay to simulate neural processing
    await new Promise((r) => setTimeout(r, 450));

    try {
      const apiKey = this.userApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (apiKey) {
        const response = await this.queryGemini(trimmed, playerPos, apiKey);
        this.handleAIResponse(response.text, response.action);
      } else {
        const response = this.parseOfflineRule(trimmed, playerPos);
        this.handleAIResponse(response.text, response.action);
      }
    } catch (err) {
      console.warn('Gemini query error, falling back to offline NLP:', err);
      const response = this.parseOfflineRule(trimmed, playerPos);
      this.handleAIResponse(response.text, response.action);
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }

  private handleAIResponse(text: string, action?: { type: string; param: string }): void {
    let actionExecuted: string | undefined = undefined;

    if (action) {
      actionExecuted = this.executeAction(action.type, action.param);
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

  private executeAction(type: string, param: string): string | undefined {
    switch (type.toLowerCase()) {
      case 'navigate': {
        const nav = NavigationSystem.getInstance();
        const landmark = nav.landmarks.find(
          (l) => l.id.toLowerCase() === param.toLowerCase() || l.name.toLowerCase().includes(param.toLowerCase())
        );
        if (landmark) {
          nav.setDestination(landmark.id);
          return `WAYPOINT SET: ${landmark.name.toUpperCase()}`;
        }
        break;
      }
      case 'weather': {
        const weather = WeatherSystem.getInstance();
        const wt = param.toUpperCase() as WeatherType;
        if (['CLEAR', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'FOG'].includes(wt)) {
          weather.setWeather(wt);
          return `ATMOSPHERE MODIFIED: ${wt}`;
        }
        break;
      }
      case 'time': {
        const hour = parseFloat(param);
        if (!isNaN(hour)) {
          TimeSystem.getInstance().setHour(hour);
          return `CHRONO WARP: ${TimeSystem.getInstance().getState().formattedTime}`;
        }
        break;
      }
    }
    return undefined;
  }

  /**
   * Offline zero-latency rule-based heuristic parser.
   */
  private parseOfflineRule(
    query: string,
    playerPos: THREE.Vector3
  ): { text: string; action?: { type: string; param: string } } {
    const q = query.toLowerCase();
    const chunk = ChunkManager.getInstance().getState();
    const district = chunk.activeDistrict;
    const time = TimeSystem.getInstance().getState();
    const weather = WeatherSystem.getInstance().getState();
    const nav = NavigationSystem.getInstance();

    // 1. Navigation intents
    if (q.includes('lab') || q.includes('research') || q.includes('quantum')) {
      return {
        text: 'Plotting direct waypoint vectors to Nexus Advanced Labs. Holographic ground ribbon activated on your HUD.',
        action: { type: 'navigate', param: 'nexus_labs' },
      };
    }
    if (q.includes('lounge') || q.includes('cafe') || q.includes('bar') || q.includes('drink') || q.includes('coffee')) {
      return {
        text: 'Setting destination to Neon Velocity Lounge on West Avenue. Automated double doors are ready for entry.',
        action: { type: 'navigate', param: 'cyber_lounge' },
      };
    }
    if (q.includes('plaza') || q.includes('center') || q.includes('square')) {
      return {
        text: 'Routing course toward Central Plaza Hub. The holographic monument is visible at the city center.',
        action: { type: 'navigate', param: 'central_plaza' },
      };
    }
    if (q.includes('twin') || q.includes('skybridge') || q.includes('bridge')) {
      return {
        text: 'Waypoint locked to Twin Spire Skybridge in the north-east commercial zone.',
        action: { type: 'navigate', param: 'twin_spires' },
      };
    }
    if (q.includes('apex') || q.includes('tallest') || q.includes('monolith')) {
      return {
        text: 'Locking trajectory onto Apex Monolith Tower. Beacon active.',
        action: { type: 'navigate', param: 'apex_tower' },
      };
    }

    // 2. Weather intents
    if (q.includes('storm') || q.includes('thunder') || q.includes('heavy rain') || q.includes('lightning')) {
      return {
        text: 'Atmospheric condensers engaged: generating torrential storm precipitation and electrical storm bursts.',
        action: { type: 'weather', param: 'HEAVY_RAIN' },
      };
    }
    if (q.includes('rain') || q.includes('shower') || q.includes('wet')) {
      return {
        text: 'Triggering moderate rainfall over Nexus City. Pavements are beginning to darken and glisten.',
        action: { type: 'weather', param: 'RAIN' },
      };
    }
    if (q.includes('clear') || q.includes('sun') || q.includes('sunny') || q.includes('dry')) {
      return {
        text: 'Dispersing cloud cover and precipitation. Atmosphere returned to clear pristine status.',
        action: { type: 'weather', param: 'CLEAR' },
      };
    }
    if (q.includes('fog') || q.includes('smog') || q.includes('haze') || q.includes('mist')) {
      return {
        text: 'Deploying cybernetic dense fog blanket. Distance visibility restricted to 48 meters.',
        action: { type: 'weather', param: 'FOG' },
      };
    }
    if (q.includes('cloud') || q.includes('overcast')) {
      return {
        text: 'Modulating tropospheric cloud layer to overcast status.',
        action: { type: 'weather', param: 'CLOUDY' },
      };
    }

    // 3. Time of day intents
    if (q.includes('night') || q.includes('midnight') || q.includes('dark')) {
      return {
        text: 'Advancing city chronometer to 23:00 Midnight. Celestial moonlight and neon emissive channels illuminated.',
        action: { type: 'time', param: '23' },
      };
    }
    if (q.includes('sunset') || q.includes('dusk') || q.includes('evening') || q.includes('golden hour')) {
      return {
        text: 'Warping time to 18:30 Sunset. Golden celestial horizon and purple atmospheric bounce engaged.',
        action: { type: 'time', param: '18.5' },
      };
    }
    if (q.includes('dawn') || q.includes('morning') || q.includes('sunrise')) {
      return {
        text: 'Resetting time to 06:00 Dawn. Morning radiance spreading over the eastern skyline.',
        action: { type: 'time', param: '6' },
      };
    }
    if (q.includes('noon') || q.includes('day') || q.includes('daylight')) {
      return {
        text: 'Setting time to 13:00 High Noon. Maximum ambient visibility across all urban sectors.',
        action: { type: 'time', param: '13' },
      };
    }

    // 4. Location & District Lore
    if (q.includes('where am i') || q.includes('district') || q.includes('location') || q.includes('sector')) {
      return {
        text: `You are currently standing in the ${district.name} (${district.subtitle}) at coordinates (${Math.round(playerPos.x)}, ${Math.round(playerPos.z)}). Sector characteristics: ${district.description}`,
      };
    }

    // 5. NPC Lore
    if (q.includes('vance') || q.includes('kael') || q.includes('scientist')) {
      return {
        text: 'Dr. Vance Kael is the Chief Quantum Architect at Nexus Advanced Labs. He oversees the central atmospheric stabilizer reactor and experimental anti-entropy fields.',
      };
    }
    if (q.includes('kira') || q.includes('jin') || q.includes('courier')) {
      return {
        text: 'Kira Jin is a high-priority data courier operating between Central Plaza and the Neon Velocity Lounge. Known for rapid rooftop transversal.',
      };
    }
    if (q.includes('echo') || q.includes('chen') || q.includes('security') || q.includes('officer')) {
      return {
        text: 'Officer Chen and Patrol Unit Echo-7 are stationed throughout the Central District to monitor transit safety and biometric compliance.',
      };
    }

    // 6. City lore
    if (q.includes('nexus city') || q.includes('city') || q.includes('lore') || q.includes('history')) {
      return {
        text: 'Nexus City is an autonomous metropolis built upon 64 procedural sectors across 7 thematic urban zones, powered by zero external 3D models and pure WebGL procedural architecture.',
      };
    }

    // 7. General Help
    return {
      text: `NEXUS-AI Operational. Current Status: ${district.name} // ${time.formattedTime} (${time.phase}) // ${weather.currentWeather}. Try asking me: "Take me to the lab", "Make it rain", "Jump to sunset", "Where am I?", or "Tell me about Dr. Vance".`,
    };
  }

  /**
   * Online query using Gemini API.
   */
  private async queryGemini(
    query: string,
    playerPos: THREE.Vector3,
    apiKey: string
  ): Promise<{ text: string; action?: { type: string; param: string } }> {
    const chunk = ChunkManager.getInstance().getState();
    const district = chunk.activeDistrict;
    const time = TimeSystem.getInstance().getState();
    const weather = WeatherSystem.getInstance().getState();

    const systemPrompt = `You are "NEXUS-AI", the sophisticated holographic urban assistant embedded in the cyberpunk open-world experience "Nexus City".
Current World State:
- Player Position: (${Math.round(playerPos.x)}, ${Math.round(playerPos.y)}, ${Math.round(playerPos.z)})
- Current District: ${district.name} (${district.subtitle}) - ${district.description}
- Time of Day: ${time.formattedTime} (${time.phase})
- Weather: ${weather.currentWeather} (Wetness: ${Math.round(weather.wetnessFactor * 100)}%)
- Landmarks Available: central_plaza (Central Plaza Hub), nexus_labs (Nexus Advanced Labs, enterable), cyber_lounge (Neon Velocity Lounge, enterable), twin_spires (Twin Spire Skybridge), apex_tower (Apex Monolith Tower).

Respond in character (concise, sleek cyberpunk sci-fi AI).
If the user wants to navigate somewhere, change the weather, or change the time, respond with a JSON object:
{
  "reply": "Your in-character spoken response",
  "action": {
    "type": "navigate" | "weather" | "time",
    "param": "landmark_id" | "CLEAR"|"CLOUDY"|"RAIN"|"HEAVY_RAIN"|"FOG" | "hour_number (e.g. 18.5, 23, 6, 12)"
  }
}
If no action is needed, omit the "action" field or set it to null. Return ONLY valid raw JSON with no backticks.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Query: "${query}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (rawText) {
      try {
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          text: parsed.reply || rawText,
          action: parsed.action || undefined,
        };
      } catch {
        return { text: rawText };
      }
    }

    return this.parseOfflineRule(query, playerPos);
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
