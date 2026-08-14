# Retain Complete Published Template Versions

Status: accepted

Every published Resource Template version is an immutable, complete authoring and runtime unit. PbDH retains its exact data Schema, validation, defaults, Creator input layout, mapping to a Renderer Revision, and Tabletop Behaviors. Resources pinned to that version can continue to be viewed, operated, and edited without first migrating to a newer Template version.

This extends the historical Renderer decision rather than multiplying it per resource. One thousand resources using one Template version share the same Template implementation. Multiple Template versions may also share one Renderer Revision when their visible and interactive card behaviour is identical. Historical Template capabilities may be code-split and loaded only when referenced.

Migration remains an explicit Creator action. A newer Template may offer a migration path, but opening or correcting an old resource cannot silently change its Template version, defaults, layout, rendering, or behaviour.

## Consequences

- Platform Administrators cannot modify a published Template version in place; every observable change requires a new version.
- Creator App keeps the authoring UI for historical versions instead of forcing migration before editing.
- Player App, Creator App, GM App, and Market resolve the same exact historical Template behaviour through the shared Registry.
- Registry and App bundle cost grows with distinct Template implementations, not with the number of resources. Lazy loading and shared Renderer Revisions control runtime cost.
- Removing a published Template version requires a future explicit deprecation and migration decision; ordinary App cleanup cannot delete it.
