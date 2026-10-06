---
"loro-crdt": patch
---

HyperSpaces own build: deduplicate repeated final-leaf remapping entries after
rope mutation. Preserve document state and exported bytes while removing
quadratic merge work for large concurrent text spans.
