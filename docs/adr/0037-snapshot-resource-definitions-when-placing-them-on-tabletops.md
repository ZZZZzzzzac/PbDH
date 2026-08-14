# Snapshot Resource Definitions When Placing Them on Tabletops

Status: superseded by ADR-0047

A Resource Package behaves like a published book: publishing or importing a new printing does not rewrite copies already being used on a table. When a Player or GM places a Game Resource, the Tabletop Document creates or reuses an immutable Tabletop Resource Snapshot containing the exact resource definition needed to render and operate that card. Each Tabletop Instance refers to one such snapshot rather than resolving its Resource ID through the current local resource library.

The snapshot records source Resource and Package identity, exact Template version, structured data, labels, and Managed Media Asset references. It does not duplicate image bytes. Multiple instances placed from the same exact definition share one snapshot, while their position, layer, and interactive state remain instance-owned.

Snapshot identity cannot be only the source Game Resource Reference. If the local library later replaces that resource, existing instances must keep the old snapshot and new placements must use the new definition. Old and new snapshots for the same Resource Package ID and package-scoped Resource ID can therefore coexist in one Tabletop Document.

## Consequences

- Creator edits, Market releases, and local Resource Package replacement never change cards already placed on Player or GM tabletops.
- A new placement uses the resource definition currently visible in the local library. It reuses a snapshot only when that definition is exactly the same; otherwise it adds another table-private snapshot.
- Deleting, unpublishing, or losing access to the source package does not prevent an existing table from opening, subject to the continued availability of trusted Template Renderer revisions and referenced media assets.
- Runtime interaction mutates Tabletop Instance state, never the immutable snapshot or source Game Resource.
- Tabletop Document export, persistence, sync, migration, and validation include these snapshots as part of the Tabletop Document Contract.
- Character Saves keep their separate policy: they reference the current explicitly imported local Resource Package snapshot and may resolve to updated definitions after replacement.
