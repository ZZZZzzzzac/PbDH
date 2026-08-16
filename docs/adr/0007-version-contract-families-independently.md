# Version Contract Families Independently

Status: accepted

PbDH will version five Contract Families independently: Resource Package, System Package, Character Save, Tabletop Document, and Backend API. Each Family represents one stable exchange boundary and has its own supported-version policy. Resource Templates remain independently identified and versioned and are not folded into a global Contract version.

A single platform version would make unrelated changes appear coupled: changing a tabletop instance envelope should not imply a new resource-package format or backend API. Versioning every type separately would create the opposite problem, forcing callers to negotiate a graph of implementation details. Five coarse Families keep compatibility aligned with observable trust and persistence boundaries.

## Consequences

- Resource Package Contract governs the pure-data package document plus its self-contained Portable Archive file Profile, contained Game Resources, Asset ID references, and installation-facing metadata.
- System Package Contract governs the player-system definition, Resource Compatibility declarations, system-specific Character Data Schema, and Player App extension points.
- Character Save Contract governs the durable platform envelope around player-owned character state, including its System Package reference and version plus the system-specific Character Data payload. Per ADR-0052, resource-backed character fields contain final values written by a Player resource-application interaction rather than Game Resource References, selected-state snapshots, or Resource Package dependency metadata.
- Tabletop Document Contract governs the pure-data tabletop document plus its self-contained Portable Archive file Profile, including Tabletop Instances, their independent Tabletop Instance Resource Copies, layout, and runtime state. It owns and may mutate table-private copies without owning or mutating their source Game Resources.
- Backend API Contract governs client/server request, response, error, authentication-context, and synchronization protocol payloads.
- A file or network boundary must carry, or unambiguously negotiate, the relevant Family version; internal functions and TypeScript-only types do not need public versions.
- A change affects only the Families whose observable contracts change. Cross-Family features may require several explicit version changes, never an implicit global release number.
- Version syntax follows ADR-0008. Long-lived document migration and retirement follow ADR-0046; each Family sets its own support duration rather than inheriting a global retention count.
