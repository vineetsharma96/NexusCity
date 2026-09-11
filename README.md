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

### 🌊 Skyscraper Fluid Motion Billboards
- **Procedural Navier-Stokes Liquid Simulation**: Giant monolithic holographic displays mounted to skyscraper facades.
- **Multi-Frequency Domain-Warped Shaders**: Real-time turbulent fluid eddies, chromatic edge aberration, scanlines, and neon bezels with custom color themes (Cyan/Magenta, Gold/Emerald, Plasma/Violet).

### 🌳 Dynamic Vegetation & Instanced Leaves
- Procedural street trees with tapered cylindrical bark trunks, multi-tier branches, and faceted dodecahedral canopy clouds.
- 800 instanced falling leaves with procedural wind gusts, 3D tumbling rotation, ground settling, and vertical recycling.

### ☀️ Realtime Celestial Sun & Dynamic Moving Shadows
- Continuous 24-hour celestial orbit (Dawn, Day, Sunset, Dusk, Night) with radiant sun sphere and outer glowing coronal aura.
- **Dynamic Real-Time Moving Shadows**: Sun trajectory continuously swings and stretches sharp directional shadow cascades across building facades, streets, vehicles, and pedestrians in real time.
- Dynamic atmospheric Rayleigh/Mie scattering colors, altitude fog, sunset ground bounce, and night-scaling emissive neon streetlights.

### 👥 50+ Living NPCs & Cyberpunk Dialogue
- **52 Autonomous Procedural Citizens**: Story characters (Dr. Vance Kael, Kira Jin, Officer Chen, Echo-7) alongside 48 procedural citizens (Netrunners, Technicians, Synthetic Civilians, Couriers) with randomized cyber-armor palettes and visors.
- **Sidewalk Waypoint Navigation**: Dynamic pacing, directional turning, procedural breathing/walking IK, and ambient chatter fallback.

### 🚪 Enterable Buildings & Procedural Interiors
- Automated proximity double sliding glass doors on **Nexus Advanced Labs** and **Neon Velocity Lounge**.
- Seamless fade transitions with exterior coordinate preservation.
- Procedurally generated interiors: quantum stabilizer reactor, multi-screen computer workstations, server racks, and curved lounge bar.

### 🗺️ Fullscreen Holographic Map & In-World Navigation
- Fullscreen 2D/SVG vector blueprint map (`M` key) with player heading pin, landmark inspection, and destination selection.
- In-world glowing cyan chevron guidance ribbon on the pavement pointing directly to the active destination.

### ⛈️ Dynamic Weather & Atmospheric Simulation
- 5 weather modes: `CLEAR`, `CLOUDY`, `RAIN`, `HEAVY_RAIN`, `FOG`.
- 1,800 instanced aerodynamic rain needles dynamically tilting with 3D wind velocity + 90 pavement ground splash ripples.
- Dynamic road wetness: asphalt roughness drops from 0.35 down to 0.08 with mirror-like specular reflections.
- Procedural double-pulse lightning strikes illuminating the sky and cityscape.

### 📱 Mobile Optimization & Touch Controls
- Left virtual analog thumbstick with resting guide for 360° omnidirectional movement.
- Right-hand camera look orbit drag zone.
- Dedicated touch action buttons (`RUN`, `JUMP`, `INTERACT`, `MAP`).
- Two-finger pinch-to-zoom camera distance (3.5m to 18m).
- Responsive mobile HUD layout and automatic mobile quality throttling.

### 🤖 NEXUS-AI City Assistant
- In-game holographic assistant terminal (`KeyI` or `~` shortcut).
- Real-time world telemetry awareness (coordinates, district lore, weather, time, landmarks).
- Dual-mode execution: online Gemini API integration (`gemini-2.5-flash`) + zero-latency offline heuristic NLP parser ("Take me to the lab", "Make it storm", "Set time to sunset", "Where am I?").

### 🔊 100% Procedural Web Audio Synthesizer
- Procedural district ambient soundscapes: low 55Hz traffic drone in Central City, high-altitude wind whistle in Sky District, server drone in Neural District.
- Continuous bandpass-filtered rain patter and low-frequency thunder bursts on lightning strikes.
- Procedural SFX: pavement footstep clicks synchronized to movement speed, jump jet-bursts, sliding door chimes, and UI blips.
- HUD Speaker toggle (`🔇 AUDIO OFF` / `🔊 AUDIO ON`) with browser autoplay policy compliance.

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
