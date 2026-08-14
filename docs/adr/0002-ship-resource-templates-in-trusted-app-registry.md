# Ship Resource Templates in a Trusted App Registry

Status: accepted

Resource Templates are trusted platform code created and versioned only by Platform Administrators. Player App, Creator App, GM App, and Market frontend consume the same versioned Template Registry source through their releases; each App independently selects the exact Registry versions it supports. Resource Packages carry Template ID/version, resource data, and assets, but never executable Template implementations.

Admin-only publication does not make imported ZIP or JSON content trustworthy because local files can impersonate an official Template ID. Compiling Templates into the Apps preserves the existing Cards freedom to implement specialised React editors, renderers, validation, and tabletop behaviour without creating a third-party code execution path, signature infrastructure, or first-version Template DSL.

## Consequences

- Adding or changing executable Template behaviour requires an App release to adopt that Template version, but does not require coordinated App releases.
- All four frontends must resolve Template ID/version through the shared Registry contract and compatibility tests even when they currently ship different supported versions.
- Once a frontend adopts a published Template version, the shared Registry retains that version's complete runtime and authoring capabilities. Implementations may be lazy-loaded, but a newer version cannot overwrite the old entry.
- Unknown Template IDs or unsupported versions preserve their Game Resources under Other Resources with a generic fallback; they are never executed.
- A future independently distributed Template system requires a new ADR covering authenticity, sandboxing, compatibility, and rollback.
