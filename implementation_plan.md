# NEXUS CITY — Architecture & Phase 1 Engine Foundation Plan

A browser-based, procedural 3D open-world futuristic city exploration experience built with React, Three.js, React Three Fiber, and custom GLSL/procedural generation systems with zero external 3D models.

---

## 1. System Specification Analysis & Architecture

### System Core Principles
1. **Zero External 3D Models**: 100% procedural geometry (BufferGeometry, InstancedMesh, procedural shaders, mathematical building extrusions, procedural foliage, canvas-generated textures).
2. **Deterministic Seed-Based Generation**: A single seed (e.g. `847291`) drives district topologies, road networks, building footprints, heights, facades, foliage placement, and landmark coordinates.
3. **Chunk-Based Spatial Streaming**: Scalable grid partitioning with distance LOD (High, Med, Low, Unloaded), geometry instancing, and worker-assisted streaming.
4. **Hybrid Lighting & Atmosphere**: Dynamic sun/moon cycle, ambient irradiance approximation, screen-space reflections on wet roads, emissive neon bloom, dynamic weather states (clear, fog, rain with wetness shaders).
5. **Decoupled Simulation & Presentation**: Simulation loops (time, weather, NPC schedules, player physics, interaction triggers) operate deterministically and pipe state into render instances.

### High-Level Folder Architecture
```text
nexus-city/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   └── index.css                 # Sleek dark-mode aesthetic, typography, HUD overlay styling
│   ├── core/
│   │   ├── SeedRandom.ts             # Deterministic PRNG (Mulberry32 / PCG32)
│   │   ├── MathUtils.ts              # Noise, interpolation, vector helpers
│   │   └── EventBus.ts               # Decoupled event messaging system
│   ├── rendering/
│   │   ├── QualityManager.ts         # Ultra, High, Med, Low, Lite adaptive presets
│   │   ├── PerformanceMonitor.ts     # FPS & draw call tracking with dynamic throttles
│   │   └── PostProcessing.tsx        # Bloom, tone mapping, vignette, chromatic aberration
│   ├── player/
│   │   ├── InputManager.ts           # Desktop keyboard/mouse + pointer lock bindings
│   │   ├── TouchController.ts        # Mobile virtual dual-stick + action buttons
│   │   ├── PlayerController.tsx      # Procedural character mesh, physics kinematic controller
│   │   └── PlayerCamera.tsx          # Collision-aware 3rd-person spring camera
│   ├── lighting/
│   │   ├── LightingManager.tsx       # Dynamic sky, directional sunlight/moonlight, ambient light
│   │   ├── GIManager.ts              # Irradiance & light probe approximations
│   │   └── ReflectionManager.ts      # Planar/SSR wetness reflections
│   ├── city/
│   │   ├── CityGenerator.ts          # Master seeded city layout orchestrator
│   │   ├── DistrictGenerator.ts      # 7 districts (Central, Neural, Sky, Industrial, Old, Green, Unknown)
│   │   ├── RoadGenerator.ts          # Road grids, cross-sections, procedural asphalt/markings
│   │   ├── BuildingGenerator.ts      # Floor tiers, procedural windows, antennas, neon signs
│   │   └── VegetationGenerator.ts    # Procedural tree branching, canopy clusters, instanced grass
│   ├── world/
│   │   ├── WorldManager.tsx          # World coordinator component
│   │   ├── ChunkManager.ts           # Grid streaming & LOD management
│   │   ├── TimeSystem.ts             # Dawn -> Day -> Dusk -> Night continuous cycle
│   │   └── WeatherSystem.ts          # Clear, Cloudy, Rain, Fog atmospheric particle systems
│   ├── npc/
│   │   ├── NPCManager.ts             # NPC lifecycle & crowd simulation
│   │   ├── NPCSchedule.ts            # Routine scheduler (home, work, transit, leisure)
│   │   └── DialogueSystem.ts         # Prewritten branching dialogue + optional Gemini hook
│   ├── map/
│   │   ├── CityMap.tsx               # Fullscreen holographic interactive vector map
│   │   └── NavigationSystem.ts       # A* road network pathfinder & waypoint ribbon
│   ├── interaction/
│   │   ├── InteractionSystem.ts      # Proximity query detector & prompt dispatcher
│   │   └── InteractiveObject.ts      # Building doors, terminals, elevators, NPCs
│   ├── ui/
│   │   ├── HUD.tsx                   # Minimalist HUD (compass/minimap, prompt, time, weather)
│   │   ├── CityMapModal.tsx          # Interactive map overlay
│   │   ├── DialogueBox.tsx           # Cyberpunk/sci-fi dialogue modal
│   │   ├── MobileControls.tsx        # Virtual joysticks for mobile
│   │   └── SettingsModal.tsx         # Graphic quality toggles & volume
│   └── persistence/
│       └── SaveSystem.ts             # localStorage/IndexedDB player coordinates & discovery state
```

---

## 2. Highest-Risk Systems & Mitigation Strategies

| High-Risk System | Technical Challenges | Mitigation Strategy |
| :--- | :--- | :--- |
| **Draw Call & GPU Overhead** | Generating thousands of unique buildings without models could overwhelm WebGL draw calls. | Aggressive geometry batching with `InstancedMesh` for building facade panels, windows, streetlights, and foliage. Shared procedural materials with atlas coordinates. |
| **Collision Detection without Physics Engine Bloat** | Loading heavy physics packages (like Cannon or Rapier) can introduce bundle bloat and memory leaks on mobile. | Lightweight spatial hash / grid-based 2D/3D AABB & capsule collision solver tailored for city streets, sidewalks, and building bounds. |
| **Mobile Performance & Touch Latency** | WebGL shader complexity and dynamic lighting can throttle mobile devices. | Adaptive quality controller (`QualityManager`) detecting thermal/frame dips, rendering at 0.75x–1.0x native DPR with simplified shadows on mobile. Dual on-screen touch virtual joystick controller with zero latency. |
| **Camera Clipping in High-Density Districts** | Third-person camera clipping inside building walls or narrow alleys. | Raycasting-based spring-arm camera dampener that smoothly pulls toward the player when occlusion occurs. |

---

## 3. Phase 1 Implementation Plan: Engine Foundation

The goal of Phase 1 is to build an uncompromising, production-grade foundation that proves the render loop, responsive canvas, lighting framework, modular input handling, and debug scene.

### Planned Deliverables for Phase 1:
1. **Project Scaffolding**:
   - Initialize Vite + React + TypeScript app in `./`.
   - Install dependencies: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `lucide-react`.
   - Configure modern TypeScript (`strict`, modern ES target) and Vite config with chunking optimization.
2. **Modern Styling & Design System (`src/styles/index.css`)**:
   - Curated sci-fi dark aesthetic: obsidian backgrounds, neon cyan (`#00f0ff`), amber accents (`#ffaa00`), sleek typography (Inter/system sans fonts), glassmorphism HUD styling.
   - Cross-browser responsive canvas full-viewport styling (zero scrollbars, touch-action none).
3. **Core Engine Architecture**:
   - `SeedRandom.ts`: High-performance deterministic PRNG for seeded consistency.
   - `PerformanceMonitor.ts`: Real-time FPS, frame-time, memory, and draw call counter.
   - `QualityManager.ts`: Presets (Ultra, High, Med, Low, Lite) with dynamic pixel ratio and shadow map scale controls.
4. **Input Management (`InputManager.ts` & `TouchController.ts`)**:
   - Multi-device unified input abstraction:
     - Desktop: WASD movement, Space (jump), Shift (sprint), Mouse look (pointer lock), E (interact), M (map), ESC (menu).
     - Mobile / Touch: Dual virtual touch pads (left joystick for omnidirectional movement, right screen drag for camera rotation, jump and sprint buttons).
5. **Phase 1 3D Scene (`src/components/Scene.tsx`)**:
   - Responsive Canvas configured with ACESFilmic tone mapping, sRGB color space, and soft shadows.
   - Dynamic Sky & Lighting foundation (`LightingManager.tsx`) with ambient irradiance, primary directional sun with cascade shadow maps, and ground bounce simulation.
   - Foundation Test Environment:
     - Procedural futuristic grid platform with subtle neon edge subdivisions.
     - Sample procedural architectural pillars and test obstacles with emissive trims to verify depth, shadows, and material fidelity.
     - Smooth interactive camera rig with orbital / free-look fallback.
6. **Engine Diagnostic HUD (`src/ui/HUD.tsx`)**:
   - Sleek cyberpunk minimal HUD showing current FPS, active quality preset, input state indicators, seed indicator, and control hints.

---

## 4. Verification Plan

### Automated / Build Verification
- TypeScript type-checking: `npx tsc --noEmit`
- Production bundle build: `npm run build`
- Dev server initialization: verify zero Vite/React runtime warnings or console errors.

### Interactive Manual & Browser Verification
- Launch local development server (`npm run dev`).
- Open browser test session via browser subagent:
  - Verify smooth WebGL render canvas rendering at 60 FPS.
  - Verify pointer lock, mouse movement, and keyboard input responses.
  - Verify touch controls / mobile layout responsiveness.
  - Verify performance metrics overlay and quality toggle responsiveness.
