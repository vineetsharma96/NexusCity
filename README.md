# 🌆 NEXUS CITY

> **A Flagship Procedural 3D Cyberpunk Open-World Simulation Running in the Browser**  
> *Zero External 3D Models • Zero External Textures • Zero External Audio • 100% Pure Procedural WebGL & Web Audio*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-black.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646cff.svg)](https://vitejs.dev/)

---

## 🌟 Vision & Zero-Asset Architecture

**NEXUS CITY** is a vast, fully explorable cyberpunk metropolis running natively in the browser. Unlike conventional WebGL experiences that download hundreds of megabytes of external 3D models (`.glb`/`.fbx`), image textures (`.png`/`.jpg`), and audio clips (`.mp3`/`.wav`), **every single atom of Nexus City is procedurally generated at runtime via code, shaders, mathematics, and the Web Audio API**:

* 🏛️ **0 External 3D Models** — Every skyscraper, neon gantry, vehicle, cyber-armor operative, streetlamp, tree, bench, and outdoor architectural facade is synthesized using Three.js procedural primitives and custom buffer geometries.
* 🎨 **0 External Textures** — All asphalt roadways, concrete facade paneling, illuminated window matrices, holographic signage, and puddle surface maps are drawn on demand by HTML5 Canvas procedural texture generators.
* 🔊 **0 External Audio Files** — District ambient drones, atmospheric rain patter, thunder cracks, Doppler hover-car flybys, UI clicks, footsteps, and discovery arpeggios are generated in real-time by an advanced Web Audio synthesizer engine.
* 🎲 **100% Deterministic World** — Built upon a seeded Linear Congruential PRNG (`SeedRandom.ts`, Seed `#847291`), ensuring infinite reproducibility across every device and session.

---

## ⚡ Master Architectural Rework

Nexus City operates on an expansive outdoor open-world architecture ensuring 60+ FPS performance, zero memory leaks, and continuous world streaming:

* **Open-World Surface Streamer**: Infinite chunk generation (`ProceduralChunkGenerator.ts`) across 576 spatial chunks (~3,000m × 3,000m world bounds) with 4 distance-based LOD tiers and instanced distant silhouettes.
* **Procedural Environment**: Integrated street furniture (kiosks, benches, bus shelters, trash receptacles, bollards) and district-specific biome props (storage tanks, steam pipes, server nodes, historical pillars) into deterministic chunk generation with scoped chunk colliders.
* **Lighting, Shadows & Volumetrics**: Smooth point-light lerping across chunk boundaries, dynamic shadow camera frustum updates, and custom GLSL volumetric celestial god-rays with dust turbulence.
* **NPC & Vehicle Simulation**: 50+ procedurally generated citizens walking sidewalks with 6-phase traffic light awareness, vehicle-to-vehicle queuing headway, and mutual physical collision separation.
* **Performance & Mobile Optimization**: Zero-allocation simulation hot loops, shared GPU unit geometry buffers, throttled React HUD telemetry, and quality-driven reflection and light budget scaling.

---

## 🗺️ Engineering Architecture

### 1. Core Foundation & Procedural Geometry
* **Protagonist Cyber-Armor**: Articulated 14-bone procedural humanoid model with helmet visor, glowing arc reactor chestplate, thruster boots, and dynamic IK locomotion.
* **Kinematic Movement Engine**: 60 FPS camera-relative movement with WASD / gamepad controls, sprint velocity scaling, coyote time jumping, gravity physics, and multi-axis sliding AABB collision detection.
* **Collision-Aware Spring-Arm Camera**: Raycasting sphere sweep that automatically pulls the third-person camera forward when obstructed by walls, pillars, or buildings.

### 2. Procedural Texturing & Canvas Shaders
* **Procedural Surface Synthesizer**: Runtime generation of seamless PBR-style textures via Canvas 2D contexts.
* **Procedural Signage & Billboards**: High-contrast neon corporate typography, holographic warnings, kanji glyphs, and animated advertising screens.
* **Emissive Facade Matrices**: Skyscraper window lights that automatically balance between daylight silhouettes and nighttime bioluminescence.

### 3. Realism, Shaders, Lighting & Celestial Volumetrics
* **Dynamic Celestial Time of Day**: Four cyclical quadrants (Dawn, Day, Dusk, Night) with physical sun and moon directional arcs, chromatic horizon gradients, and celestial light scattering.
* **Celestial Volumetric God Rays**: Ray-marched volumetric light shafts piercing through skyscraper canyons, with dynamic density based on weather and sun angles.
* **Weather & Wet Surface Reflections**: Dynamic road puddle accumulation during rainstorms, with real-time roughness and metalness attenuation simulating drenched asphalt.

### 4. Traffic, NPC AI & Pedestrian Realism
* **Dual-Layer Vehicular Traffic**: 32 ground hover-cruisers and 24 high-altitude skyway commuters navigating autonomous lane networks with boundary-wrapping streaming.
* **Autonomous Gantry Traffic Lights**: Cantilever signal gantries at intersections with automated Red, Amber, Green cycles and vehicle stop-line deceleration.
* **Pedestrian Crosswalks & Crowd AI**: 30+ procedurally generated citizens walking sidewalks, following wander waypoints, adhering to zebra crossing signals, and greeting the player.

### 5. Audio Atmosphere & City Audio-Visual Immersion
* **District Soundscapes**: Procedural sound engines tailored to individual districts (sub-bass hums in Industrial, high-tech synthesizers in Central Metropolis, organic crickets in Central Park).
* **Spatial Audio Engine**: Distance-attenuated 3D audio for hover-cruisers, Doppler vehicle flybys, and neon gantry buzzing.
* **Dynamic Weather Audio**: Real-time synthesized rain patter, rolling thunder claps, and atmospheric wind resonance.

### 6. Discovery, Mini-Map / Compass & Interactive UX Polish
* **Dynamic Mini-Map & Radar Compass**: Real-time rotating HUD radar tracking operative heading, nearby landmarks, street networks, and district zones.
* **Holographic 3D Map Modal**: Fullscreen interactive city map with district boundaries, real-time player GPS dot, and instant fast-travel nodes.
* **Operative HUD Telemetry**: Compass heading tape, speed indicators, weather/time fast toggles, and contextual interaction prompts.

### 7. Dynamic Video Billboards & Metropolis Media
* **Multi-Channel Procedural Video Simulation**: High-altitude skyscraper billboards running procedural 60 FPS video animations:
  * *Channel 1 (Nexus 24 Live News)*: Live scrolling news ticker tape, animated 3D rotating wireframe globe, and pulsing audio spectrum equalizer bars.
  * *Channel 2 (Cyber-Corp Commercial Adverts)*: Cycling adverts ("NEO-COCA", "KROM-OPTICS", "VELOCITY-X") with glitch VHS scanlines, chromatic aberration, and flashing typography.
  * *Channel 3 (Metropolis Grid Surveillance)*: 360° sweeping radar beam with blips, digital matrix code rain, and live security camera HUD telemetry.

### 8. Environmental Dynamics & Flora
* **Central Park Sanctuary**: 70m × 70m organic park landscape with granite retaining walls and neon accent trims.
* **Procedural Rippling Water Pond**: Custom GLSL water shader with surface sine wave displacement, deep emerald refraction, caustics, and cyan rim highlights.
* **Dynamic Global Wind System**: Real-time vector aerodynamics with micro-turbulence, wind gust surges, and avenue channel acceleration.
* **Interactive Foliage & Particles**: Weeping willow cyber-trees, pink sakura cherry blossoms, swaying leaves, falling leaf particles, and urban street dust specks.
* **Natural 3D Cloud Clusters**: Volumetric cloud banks drifting along high-altitude wind currents, dynamically tinted by celestial time with lightning flash backlighting.

### 9. Grounded AI City Intelligence
* **Google Gemini 2.5 Flash Integration**: Real-time natural language terminal communicating directly with the operative.
* **Actual World State Telemetry**: AI understands operative position, active district, current weather, time of day, and all outdoor city landmarks.
* **Zero Location Hallucinations**: Grounded strictly in the actual world coordinate system with deterministic fallback NLP when offline.
* **Zero Dependency Core Gameplay**: The city remains 100% playable, responsive, and functional even without an API key or internet connection.

### 10. Performance & Quality Scalability
* **Dynamic Chunk LOD System**: 576 spatial chunks (~3,000m × 3,000m world bounds) streamed dynamically with 4 distance-based LOD tiers and instanced distant silhouettes.
* **Geometry & Draw Call Optimization**: Unit geometry instancing (`BoxGeometry(1, 1, 1)`) with matrix transforms for thousands of structural features in single draw calls.
* **Crowd & Traffic Scaling**: Automatic entity throttling based on distance and device capabilities.
* **7 Quality Presets**: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `LITE`, `AUTO`, and `CUSTOM` with dynamic mobile DPR clamping.

### 12. Final Polish, Cinematic Vista Mode & Save System
* **Cinematic Vista Drone Mode (`[V]`)**: 360° orbital camera sweeping across the sector with widescreen letterbox bars, location typography, and audio ducking.
* **Persistent Save System (`SaveSystem.ts`)**: Automatic `localStorage` saving (debounced every 45s) and manual quick-save (`[F5]`) preserving operative position, rotation, district, and lifetime statistics.
* **Landmark Discovery & Codex System (`DiscoverySystem.ts`)**: Proximity triggers for 17 landmarks and facilities with celebratory HUD banners, discovery arpeggios, and codex telemetry logging.

---

## ⌨️ Controls Guide

| Key / Input | Action |
| :--- | :--- |
| **W, A, S, D** / **Left Thumbstick** | Move Operative (Camera-Relative) |
| **Mouse Drag** / **Right Touch Drag** | Orbit Third-Person Camera |
| **Scroll Wheel** / **Pinch Gesture** | Zoom Camera Distance (3.5m — 18m) |
| **Space** / **JUMP Button** | Jump (with Coyote Time) |
| **Shift** / **RUN Button** | Sprint Locomotion (13.5 m/s) |
| **E** / **INTERACT Button** | Interact with NPCs, Terminals & Enter Buildings |
| **V** / **VISTA Button** | Toggle Cinematic Aerial Vista Drone Mode |
| **F5** / **SAVE Button** | Manual Quick Save Operative Progress |
| **M** / **MAP Button** | Toggle Fullscreen Holographic City Map |
| **TAB** / **MENU Button** | Open Cyber Command Menu (Codex, Teleport, Audio) |
| **I** or **`~`** (Tilde) | Toggle NEXUS-AI Grounded City Terminal |
| **1 - 5 Keys** | Fast Switch Weather (`CLEAR`, `CLOUDY`, `RAIN`, `STORM`, `FOG`) |
| **6 - 9 Keys** | Fast Switch Time (`DAWN`, `DAY`, `DUSK`, `NIGHT`) |

---

## 🏗️ Project Architecture

```
nexus-city/
├── src/
│   ├── ai/               # Grounded Gemini 2.5 Flash & Heuristic NLP Assistant
│   ├── audio/            # Web Audio Synthesizer (Zero-Asset procedural soundscapes)
│   ├── cinematics/       # High-altitude intros, drone vista orbits, camera sweeps
│   ├── city/             # Procedural skyscrapers, roads, chunks, park, water, traffic
│   ├── core/             # SaveSystem, persistent storage, input manager, PRNG
│   ├── lighting/         # Dynamic celestial sun/moon, volumetric rays, night lamps
│   ├── map/              # Holographic 2D/3D map, GPS waypoint navigation
│   ├── npc/              # Citizen crowd generation, pathfinding, interaction dialogue
│   ├── player/           # Cyber-armor protagonist, kinematic controller, spring camera
│   ├── rendering/        # Quality manager, presets, performance profiling monitor
│   ├── ui/               # Cyberpunk HUD, mini-map, radar, terminal, codex modals
│   └── world/            # Chunks, weather, wind, time of day, discovery systems
├── public/               # Minimal HTML entry point & favicon
├── dist/                 # Production-optimized WebGL bundle
├── package.json          # Vite + React 19 + Three.js + R3F dependencies
├── tsconfig.json         # Strict TypeScript configuration
└── vite.config.ts        # Fast HMR build pipeline
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* Modern WebGL2-compatible browser (Chrome, Firefox, Edge, Safari, Brave)

### Installation & Development
```bash
# 1. Clone the repository
git clone https://github.com/vineetsharma96/NexusCity.git

# 2. Navigate to project root
cd NexusCity

# 3. Install dependencies
npm install

# 4. Launch development server with HMR
npm run dev

# 5. Open in browser
http://localhost:3000/
```

### Production Build
```bash
# Compile TypeScript and bundle via Vite
npm run build

# Preview production build locally
npm run preview
```

### Optional: Configure Gemini AI Key
Nexus City operates seamlessly offline with built-in heuristic intelligence. To enable live Google Gemini 2.5 Flash responses:
1. Create a `.env.local` file in the project root.
2. Add your API key:
   ```env
   VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
   ```
3. Restart the dev server.

---

## 📜 License & Credits

Distributed under the **MIT License**. Created with passion for procedural WebGL graphics by [Vineet Sharma](https://github.com/vineetsharma96).
