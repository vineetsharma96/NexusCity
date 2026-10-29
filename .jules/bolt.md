## 2024-10-28 - Optimizing Interaction System Registration
**Learning:** Frequent unregistering and re-registering of interactive entities via clearing a Map creates unnecessary object allocations and GC pressure, leading to an O(N) performance hit.
**Action:** Always compute diffs (using Sets or arrays) for dynamic entity updates so that only new/removed items trigger registration changes.

## 2025-03-02 - Reusing THREE.Vector3 objects in main useFrame update loop
**Learning:** Frequent instantiations of `THREE.Vector3` objects (like `new THREE.Vector3()` and `.clone()`) inside core physics or animation update loops (e.g. `useFrame`) create continuous garbage collection pressure. In a physics controller firing every frame, 7 unneeded allocations per frame scales significantly.
**Action:** Store reusable `THREE.Vector3` instances as private class properties, and update them in place via methods like `.set()`, `.copy()`, or `.addScaledVector()` to eliminate object allocations in performance-critical loops.
