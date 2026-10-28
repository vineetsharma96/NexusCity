## 2024-10-28 - Optimizing Interaction System Registration
**Learning:** Frequent unregistering and re-registering of interactive entities via clearing a Map creates unnecessary object allocations and GC pressure, leading to an O(N) performance hit.
**Action:** Always compute diffs (using Sets or arrays) for dynamic entity updates so that only new/removed items trigger registration changes.
