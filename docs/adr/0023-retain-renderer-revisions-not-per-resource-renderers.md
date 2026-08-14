# Retain Renderer Revisions, Not Per-resource Renderers

Status: accepted

PbDH will retain immutable Renderer Revisions needed to reproduce supported historical Template appearances. Every exact Resource Template version maps permanently to one Revision, while any number of Template versions with identical visual and interactive behaviour may map to the same implementation. Game Resources store only their exact Template version and never duplicate renderer code.

The number of resources does not multiply renderer cost. One thousand adversary resources referring to three historical Renderer Revisions load three implementations, not one thousand. Runtime dispatch is a registry lookup; catalog performance depends primarily on how many card surfaces and assets are mounted at once.

## Consequences

- A Template version bump for schema, editor, validation, or documentation changes does not require a new Renderer Revision when output and interaction remain identical.
- Renderer Revision retention is one part of complete historical Template retention; exact historical Schema, validation, defaults, authoring layout, and Tabletop Behaviors remain available even when several Template versions share one Renderer Revision.
- Visual or interactive changes create a new immutable Revision. Existing resources remain pinned through their exact Template version until a Creator explicitly upgrades and reviews them.
- Shared primitives and styles may be reused across Revisions; only changed behaviour must remain versioned.
- Apps bundle each supported Revision once. Dropping a Revision requires an explicit deprecation and resource-migration policy; applying a new Revision silently is forbidden.
- Resource catalogs with hundreds or thousands of cards must virtualize or paginate card surfaces and lazy-load assets rather than mount every card. This is required regardless of versioning.
- Renderer count, bundle bytes, mounted surfaces, asset memory, and render time are separate performance metrics. Acceptance tests must not use total resource count as a proxy for simultaneous DOM work.
- If Revision count later creates material bundle cost, code splitting and explicit migration are available without changing Resource Package data.
