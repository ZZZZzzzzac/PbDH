# Make Card Surfaces Creator-owned and Size-explicit

Status: accepted

Every visual Game Resource definition has one Canonical Card Surface whose field-to-visual mapping, layout, style, assets, and intrinsic width and height are fixed by the Creator through a trusted Resource Template. Given the same structured definition, exact Template version, Assets, and runtime state, the surface is treated like a printed image without becoming a raster snapshot: Player App, Creator App, GM App, and Market cannot reinterpret fields or produce host-specific internal layouts.

Placing a Game Resource on a tabletop creates an independent Tabletop Instance Resource Copy. A GM may intentionally edit structured values such as difficulty or damage in that private copy, causing the shared Resource Renderer to produce a correspondingly different surface for that instance. This changes renderer input, not the Template-owned field mapping or layout, and never mutates the source Game Resource.

The common 63×88 ratio is a host default, not a Template or Resource Contract restriction. Creator may declare another positive intrinsic width and height for any card. Each host decides how a non-default surface fits its available rectangle by uniform scaling or clipping; it cannot stretch, reflow, omit, reorder, or restyle the internal card content.

## Consequences

- Intrinsic card width and height belong to the Game Resource presentation data rather than a Template-owned allowlist.
- The shared Resource Renderer is the only implementation allowed to produce the Canonical Card Surface for a supported Template version.
- Creator App preview, Player card mode, GM App, and Market card presentation consume the same Renderer output and scoped styles.
- GM edits to an instance resource copy must pass the exact Template version's validation and use the same Renderer Revision as any identical definition in another host.
- Host UI may add selection outlines, table status, counters, controls, loading states, and clipping masks outside or above the surface, provided they do not alter its authored content.
- Tabletop scale is relative to the declared intrinsic size; changing an instance scale does not rewrite the Game Resource dimensions.
- Practical dimension and asset limits are validation policy, not a return to a mandatory 63×88 ratio.
- Resource Packages do not contain a pre-rendered canonical surface. They contain structured resource data, the exact Template version, presentation dimensions, and Assets; shared App code performs rendering.
