# 🌆 NEXUS CITY

> **A Production-Quality Procedural 3D Open-World Exploration Experience Running in the Browser**  
> *Zero External 3D Models • Zero External Textures • Zero External Audio • 100% Procedural WebGL & Web Audio*

---

## 🌟 Overview

**NEXUS CITY** is an interactive, browser-based 3D cyberpunk open-world game experience built with React 19, TypeScript, Three.js, and React Three Fiber.

Unlike typical WebGL demonstrations that rely on multi-gigabyte downloaded 3D assets (`.glb` / `.gltf` / `.fbx`), **every single aspect of Nexus City is procedurally generated at runtime via pure mathematics, shaders, and code**:
- **Zero external 3D models** — All skyscrapers, cyber-armor characters, interior laboratories, furniture, and trees are procedural meshes.
- **Zero external image textures** — All road asphalt grains, concrete slab joints, building facades, and holographic signs are generated via HTML5 Canvas procedural shaders.
- **Zero external audio files** — All ambient district hums, traffic drones, rain patter, thunder rumbles, and footstep sound effects are synthesized in real time via the native Web Audio API.

---

## 🎮 Features

### 🏃 Procedural Protagonist & Kinematic Controller
- **Fully Articulated Cyber-Armor Protagonist**: Helmet, amber HUD visor, arc reactor chestplate, thruster boots, articulated limbs.
- **Kinematic Physics**: Camera-relative WASD movement, coyote jump, custom gravity, smooth slerp orientation, and sliding AABB collision resolution.
- **Procedural IK Gait System**: Real-time forward kinematics for idle breathing, walk stride, sprint velocity, jump ascent, falling, and ground impact.
- **Collision-Aware Spring-Arm Camera**: Raycasting collision solver that automatically pulls the third-person camera in front of obstacles.

### 🏙️ Metropolis Architecture & 3km World Streaming (24×24 Chunks)
- **16 Skyscraper Archetypes**: Monoliths, Stepped Ziggurats, Cantilevers, and Twin Spires connected by high-altitude skybridges at 60m elevation.
- **7 Thematic Urban Districts**: Central City, Neural District, Sky District, Industrial Zone, Old Metro Sector, Biosphere Green District, and Classified Sector.
- **576 Spatial Chunks (~3,000m × 3,000m World Scale)**: Thrice expanded world bounds with 4 distance-based LOD tiers and 240 instanced distant skyline silhouettes maintaining smooth 60 FPS.

### 🚗 Autonomous Dual-Layer Traffic System
- **32 Ground Hover-Cruisers**: Autonomous vehicles navigating multi-lane avenues with glowing twin LED headlights and red rear taillight bars.
- **24 High-Altitude Skyway Commuters**: Sleek airborne commuters gliding between skyscraper spires along aerial transit corridors with cyan plasma exhaust trails.
- **Boundary Wrapping & High Performance**: 100% instanced rendering for zero-overhead vehicular movement.

### 🚦 Traffic Light System & Intersection Rules
- **Overhead Signal Gantries (`TrafficLightGantry.tsx`)**: 3D cantilever signal masts over intersections with illuminated Red, Amber, Green emissive lenses and directional visors.
- **Automated Signal Cycle Engine (`TrafficLightSystem.ts`)**: Coordinated North-South vs East-West signal phases, amber clearance intervals, and pedestrian walk/don't walk cycles.
- **Vehicle Intersection Deceleration**: Ground hover-cruisers detect approaching stop lines, smoothly decelerating to a stop on Red/Amber with flaring bright red brake lights, and accelerating to cruising speed on Green.

### 🚶 NPC Road Crossing & Zebra Footpaths
- **Zebra Crosswalks (`CrosswalkMarkings.tsx`)**: Delineated thermal striped pavement markings, vehicle stop bars, and illuminated curb ramps connecting sidewalks across multi-lane avenues.
- **Pedestrian Signal Compliance (`NPCManager.ts`)**: Autonomous citizens observe pedestrian signals, safely walking across avenues via zebra footpaths during vehicle Red phases and waiting patiently at curbs during vehicle Green phases.

### 🌳 Central Park & Reflective Water Pond Sanctuary
- **Urban Sanctuary (`ParkSanctuary.tsx`)**: Organic 70m × 70m central park landscape with granite retaining walls and neon accent trims.
- **Procedural Rippling Water Pond**: Custom GLSL water shader with surface sine wave displacement, deep emerald refraction, caustics, and cyan rim highlights.
- **Arching Footbridge**: Physical wooden footbridge spanning across the pond that players and NPCs can walk across.
- **Flora & Amenities**: Bioluminescent floating lotus blossoms, weeping willow cyber-trees, pink sakura cherry blossoms, and ergonomic park benches.

### 📺 Skyscraper Dynamic Video Billboards
- **Multi-Channel Procedural Video Simulation (`CyberVideoBillboard.tsx`)**:
  - *Channel 1 (Nexus 24 Live News)*: Live scrolling news ticker tape, animated 3D rotating wireframe globe, and pulsing audio spectrum equalizer bars.
  - *Channel 2 (Cyber-Corp Commercial Adverts)*: Cycling adverts ("NEO-COCA", "KROM-OPTICS", "VELOCITY-X") with glitch VHS scanlines, chromatic aberration, and flashing typography.
  - *Channel 3 (Metropolis Grid Surveillance)*: 360° sweeping radar beam with blips, digital matrix code rain, and live security camera HUD telemetry.

### 🏢 11 Enterable Procedural Cyberpunk Interiors
- Automated proximity sliding doors and distinct neon marquees on 11 enterable locations:
  1. **Nexus Advanced Labs** — Quantum reactor core, scientific consoles, server racks.
  2. **Neon Velocity Lounge** — Curved cyber bar counter, cocktail stools, VIP booths.
  3. **Krom-Doc Augmentation Clinic** — Ripperdoc operating chair, surgical arm, cyber-prosthetics cases.
  4. **Black-Ice Hacker Safehouse** — Server banks, green matrix terminal arrays, floor cable conduits.
  5. **Tokyo-Neo Synth-Ramen** — L-shaped wooden ramen bar, broth vats, red paper lanterns.
  6. **Aero-Cargo Drone Bay** — Quadcopter repair dock, hydraulic lift, industrial gantry crane.
  7. **Apex Sky Suite Penthouse** — Floor-to-ceiling panoramic skyline glass, luxury couch, glass coffee table.
  8. **Megacorp Secure Data Vault** — Hexagonal optical data core, rotating red security lasers.
  9. **Biosphere Hydroponic Flora Lab** — Vertical growth racks, violet UV grow lights, nutrient tanks.
  10. **Hyperloop Metro Transit Hub** — Subterranean train tracks, electrified 3rd rail, electronic schedule timetable.
  11. **Cyber-Strike 2099 Retro Arcade** — CRT pixel art arcade cabinets, dance revolution flashing stage.

### 📱 Simplified Mobile UI & Cyberpunk System Menu
- **Clutter-Free Mobile Viewport**: Streamlined single-line header on phones, desktop controls guide hidden on touch devices, and interaction prompts positioned for easy thumb taps.
- **Unified System Menu (`CyberMenuModal.tsx`)**: Sleek slide-out menu with:
  - **⚡ Fast-Travel Teleport Hub**: Instant warp to 14 key destinations across all districts and interiors.
  - **☀️ Time of Day Presets**: Dawn, Noon, Dusk, Midnight.
  - **⛈️ Atmospheric Weather Toggles**: Clear, Cloudy, Rain, Storm, Fog.
  - **🔊 Audio & Settings**: Sound mute/unmute, graphics quality presets, and touch controls cheatsheet.

---

## ⌨️ Controls Guide

| Input | Action |
| :--- | :--- |
| **W, A, S, D** / **Left Thumbstick** | Move Protagonist (Camera-Relative) |
| **Mouse Drag** / **Right Touch Drag** | Orbit Third-Person Camera |
| **Scroll Wheel** / **Pinch Gesture** | Zoom Camera Distance (3.5m — 18m) |
| **Space** / **JUMP Button** | Jump (with Coyote Time) |
| **Shift** / **RUN Button** | Sprint (13.5 m/s) |
| **E** / **INTERACT Button** | Interact with NPCs & Enter Buildings |
| **M** / **MAP Button** | Toggle Fullscreen Holographic City Map |
| **I** or **`~`** (Tilde) | Toggle NEXUS-AI City Assistant Terminal |
| **HUD Weather Buttons** | Fast-switch: `CLEAR`, `CLOUDY`, `RAIN`, `STORM`, `FOG` |
| **HUD Time Buttons** | Fast-switch: `DAWN`, `DAY`, `DUSK`, `NIGHT` |
| **HUD Audio Button** | Toggle Procedural Audio (Mute / Unmute) |

---

## 🛠️ Technology Stack

- **Frontend & Rendering**: React 19, TypeScript, Vite, Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`)
- **Procedural Audio**: Web Audio API (native oscillators, noise buffers, biquad filters)
- **Styling**: Modern Vanilla CSS, Glassmorphism, Scanline Shaders, CSS Grid/Flexbox
- **Deterministic RNG**: Custom Seeded Linear Congruential PRNG (`SeedRandom.ts`, Seed `#847291`)
- **AI Integration**: Google Gemini API (`gemini-2.5-flash`) + Offline Heuristic NLP Engine

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+ or 20+
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/vineetsharma96/NexusCity.git

# Navigate into project directory
cd NexusCity

# Install dependencies
npm install

# Start local development server
npm run dev

# Open in browser
http://localhost:3001/
```

### Production Build
```bash
npm run build
```

---

## 📜 License
MIT License. Created by [Vineet Sharma](https://github.com/vineetsharma96).
