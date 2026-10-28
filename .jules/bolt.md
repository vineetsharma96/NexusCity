## YYYY-MM-DD - TrafficSystem Colors Optimization
**Learning:** InstancedMesh `setColorAt` operations should be executed once on mount if colors are static, instead of re-calculating them inside `useFrame`.
**Action:** Always check if color arrays are static and can be uploaded once via `setColorAt` in a `useEffect` on component mount, rather than in an update loop.
## YYYY-MM-DD - `ProceduralNPC` material caching
**Learning:** `ProceduralNPC` caches materials and uses common geometries, which is good. But creating new vector instances or doing too much math in `useFrame` per NPC can still cause bottlenecks with 40+ NPCs.
**Action:** Re-check vector/object creation in loop.
## YYYY-MM-DD - `FallingLeavesSystem` Colors Optimization
**Learning:** `FallingLeavesSystem` and possibly others call `setColorAt` on `instancedMesh` every frame inside `useFrame`, but the color does not change over time (e.g. `colorObj.set(leaf.color)`).
**Action:** Move `setColorAt` to a `useEffect` on mount for static colors.
## YYYY-MM-DD - Notes on `setColorAt`
**Learning:** `SteamVentSystem` color lerps over time, so it needs `setColorAt` every frame. `StreamedCityChunks` sets color in a `useEffect` anyway. `FallingLeavesSystem` sets static color every frame.
**Action:** Let's fix `FallingLeavesSystem.tsx` by setting color once.
## YYYY-MM-DD - `FallingLeavesSystem` Colors Optimization
**Action:** Move `setColorAt` out of `useFrame` into a `useEffect` inside `FallingLeavesSystem.tsx`. The colors are tied to the leaf agents and don't change.
