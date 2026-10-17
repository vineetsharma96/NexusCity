# Nexus City

A browser-based 3D city exploration project built with React, TypeScript, Three.js, React Three Fiber, and Vite. The city layout uses seed `847291`; the scene includes procedural buildings and signage, traffic, pedestrians, a park, weather, and a day/night cycle.

## Run locally

Use Node.js 22 or later and npm, plus a browser with WebGL support and hardware acceleration.

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:3000`. The loading screen waits for the first world frame. After the opening camera tour, control moves to the player; click **Skip intro** to shorten the tour.

On Windows PowerShell, use `npm.cmd` if the execution policy prevents `npm` from running.

```sh
npm test         # Node-based regression tests
npm run build   # Type-check and produce dist/
npm run preview # Serve the production build locally
```

## Controls

| Input | Action |
| --- | --- |
| W/A/S/D or arrow keys | Move relative to the camera |
| Space | Jump |
| Hold Shift | Sprint; move faster while piloting a hover vehicle |
| Click the world or **Lock mouse look**, then move the mouse | Rotate the camera using pointer lock |
| Mouse wheel | Zoom the camera |
| E or the contextual interaction prompt | Talk, use a terminal, board a nearby vehicle/transit node, or exit it |
| M | Open or close the city map |
| V | Enter or leave the aerial vista |
| **Menu** button | Open world controls |
| Escape | Close an open menu, map, or conversation; release mouse pointer lock |
| Tab / Shift+Tab | Move between controls in an open overlay |

The vista also starts after 30 seconds of inactivity in gameplay. Press V, use the **Resume** button, or move to return to player control.

On touchscreens, drag the left side to move and the right side to rotate the camera. Pinch with two fingers on the right side to zoom. Use **Run** to toggle sprint, **Jump** to jump, **Interact** for nearby objects, and **Map** or **Menu** to open their overlays. World controls pause while a menu, map, or conversation is open.

## Explore and use the city

- **World menu:** choose dawn/day/dusk/night or clear/cloudy/rain/storm/fog weather.
- **Missions:** accept one assignment at a time. Speaking with residents, reaching districts, and witnessing city events can complete assignments and update faction standing and district reputation.
- **View:** choose Auto, Lite, Low, Medium, High, or Ultra graphics; toggle audio and street lights; open the map. Custom appears when settings have been changed programmatically. Rendering speed depends on the device, browser, and selected profile.
- **Vehicles:** approach a hover vehicle or transit node and interact. Pilot the hover vehicle with movement controls, or follow the shuttle while transit-linked. Interact again to leave. The vehicle menu cycles speed, handling, and neon upgrades.
- **Codex and history:** review discovered landmarks and recorded city events.
- **City map:** drag to pan, use the wheel or zoom buttons, and recenter on the player. Select a marker or choose a landmark from the inspector. Set a waypoint, cancel it, or fast travel.
- **Conversations and terminals:** use the nearby interaction prompt to speak with residents or inspect terminal information. Additional interactions include repair stations and rooftop access points.

Audio begins after a click or touch, subject to the browser's audio permissions. The View section controls muting.

## Saved progress

Progress is stored in the current browser's `localStorage`, including position, discoveries, city history, mission state, reputation, vehicle configuration, and travel statistics. Position saves run approximately every 45 seconds; several progression changes save immediately. Graphics settings are stored separately. Clearing the site's browser data removes these local saves.

## Code layout

| Directory | Responsibility |
| --- | --- |
| `src/city`, `src/environment`, `src/lighting` | Scene geometry, traffic, atmosphere, and lighting |
| `src/player` | Input, touch controls, movement, collision, avatar, and camera |
| `src/world` | Chunk streaming, time, weather, discoveries, and city events |
| `src/interaction`, `src/npc`, `src/gameplay`, `src/vehicle` | Interactions, dialogue, missions, and mobility |
| `src/map`, `src/ui`, `src/styles` | Navigation, map, HUD, overlays, and styling |
| `src/core`, `src/audio`, `src/rendering` | Saves, procedural audio, quality settings, and rendering |
| `tests` | Player/input/collision and simulation/save regression tests |

## Verification

`npm test` bundles the relevant TypeScript modules and runs Node's test runner with browser APIs stubbed. It covers input reset/blocking, collision, touch state, chunk quality changes, save validation, dialogue, vehicles, city-event identity, and weather cycling. `npm run build` checks TypeScript and bundles the app.

These checks do not render the world. Browser interaction, visual appearance, touch gestures, and performance need manual checks on the target device. No automated browser end-to-end test script is configured.

Licensed under the [MIT License](LICENSE).
