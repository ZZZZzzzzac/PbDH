# Render Structured Resources with the Exact Shared Renderer

Status: accepted

Canonical Card Surfaces will be rendered at runtime from structured Game Resource data, an exact Resource Template version, presentation dimensions, and Assets. PbDH will not rasterize every completed card or include a pre-rendered canonical image in each Resource Package. “Treat it like an image” is an immutability and consistency rule, not a storage format.

Player App, Creator App, GM App, and Market frontend use the same `packages/resource-renderer` implementation, immutable Renderer Revision, and scoped styles resolved by an exact Template version. Output outside Creator App must match its preview for the same inputs. Hosts may uniformly scale or clip that output but cannot substitute their own internal card renderer.

## Consequences

- Each published exact Template version resolves permanently to one immutable Renderer Revision. Any visual or semantic renderer change requires a new Template version and Revision; versions with identical rendering may share one Revision.
- Resource data records an exact Template version. A frontend cannot claim canonical support by applying a merely SemVer-compatible newer renderer to that resource.
- Frontends may release independently and may bundle different sets of exact Template versions. An unsupported exact renderer follows the documented unsupported-Template path instead of silently redrawing the card.
- Resource Packages remain compact because renderer code ships once with each App rather than once per card.
- Structured data remains available for editing, accessibility, search, conversion, validation, and Template-declared interaction.
- Runtime thumbnails or browser caches, if later introduced, are disposable performance artifacts and never contract authority or Resource Package content.
- Host CSS must not leak into the Canonical Card Surface, and surface styles must not leak into host UI; the isolation mechanism is an implementation decision to be verified by cross-host fixtures.
