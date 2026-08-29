# Make Card Surfaces Creator-owned and Size-explicit

Status: accepted

Every visual Game Resource definition has one Canonical Card Surface whose field-to-visual mapping, layout, style, assets, and design viewport are fixed through a trusted Resource Template. Fixed-ratio cards use a `63:88` design viewport. Variable-height cards use the same design width and may vary only in height. These values are design coordinates, not the actual CSS or printed millimetre size. Given the same structured definition, exact Template version, Assets, and runtime state, the surface is treated like a printed image without becoming a raster snapshot: Player App, Creator App, GM App, and Market cannot reinterpret fields or produce host-specific internal layouts.

Placing a Game Resource on a tabletop creates an independent Tabletop Instance Resource Copy. A GM may intentionally edit structured values such as difficulty or damage in that private copy, causing the shared Resource Renderer to produce a correspondingly different surface for that instance. This changes renderer input, not the Template-owned field mapping or layout, and never mutates the source Game Resource.

Each host chooses the actual display size independently from the design viewport. A host location that requires a fixed card frame uses a `63:88` frame and clips overflow after uniform scaling. A host cannot stretch, reflow, omit, reorder, or restyle the internal card content.

## Consequences

- Fixed-ratio Resource presentation is normalised to the `63:88` design viewport at the shared Renderer boundary. Variable-height presentation uses the same width and retains only its positive height.
- The shared Resource Renderer is the only implementation allowed to produce the Canonical Card Surface for a supported Template version.
- Creator App preview, Player card mode, GM App, and Market card presentation consume the same Renderer output and scoped styles.
- GM edits to an instance resource copy must pass the exact Template version's validation and use the same Renderer Revision as any identical definition in another host.
- Host UI may add selection outlines, table status, counters, controls, loading states, and clipping masks outside or above the surface, provided they do not alter its authored content.
- Tabletop scale is relative to the canonical design viewport; changing an instance scale does not rewrite the Game Resource definition.
- Host display width is not inferred from the presentation number and must not treat `63` as `63mm` on screen.
- Resource Packages do not contain a pre-rendered canonical surface. They contain structured resource data, the exact Template version, presentation dimensions, and Assets; shared App code performs rendering.
