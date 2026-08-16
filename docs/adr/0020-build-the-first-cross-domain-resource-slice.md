# Build the First Cross-domain Resource Slice

Status: accepted

ADR-0051 moves GM placement into the Creator App composition root. The Resource Workspace-to-Tabletop Document boundary and the cross-L1 acceptance slice remain accepted.

PbDH migration will first prove one Game Resource across the new platform boundaries instead of completing one App in isolation. The slice establishes the Resource Package Contract and Template Registry, exports a resource from Creator App, imports and routes it in Player App, places and persists it in GM App, then connects the same flow to Market and the preserved Cloud Sync capabilities.

This order targets the main architectural risk: whether independently released products actually agree on versioned contracts, Templates, resource identity, compatibility, rendering, and runtime state. Finishing a large UI migration before proving that seam would preserve local features while postponing the ecosystem integration the monorepo exists to solve.

## Consequences

- Contracts and at least one real trusted Template are executable and conformance-tested before broad App migration.
- Creator App acceptance first requires local creation and Resource Package export; Market publication is not needed to prove the file boundary.
- Player acceptance proves Target System Package ID/`MAJOR` gating, Template Compatibility routing, Other Resources fallback, and retained mature Sheet behaviour.
- GM App acceptance proves unrestricted resource-card placement, independent instance resource-copy editing, and persistent Tabletop Instance state without mutating the source Game Resource.
- Market publish/install and Cloud Sync are connected after the local cross-domain path works; their existing Cards behaviours remain requirements and are not discarded.
- Each stage has contract fixtures and an end-to-end handoff artifact usable by the next stage.
- Completing the slice does not imply full feature parity. Broader Template migration, Sheet parity, Creator App migration, and Market/GM completion remain separately accepted work.
