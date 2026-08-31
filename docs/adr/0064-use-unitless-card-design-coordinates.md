# Use Unitless Card Design Coordinates

Status: accepted

The Canonical Card Surface uses a `63 × 88` design viewport. These numbers are unitless design coordinates. Resource presentation and Tabletop Resource Copies contain only presentation behavior (`mode` and `fixedRatio`); they do not carry width, height or a physical unit. Renderer-authored geometry expresses one design coordinate as one CSS pixel inside the canonical surface and hosts apply one uniform outer scale to reach their chosen display size.

Physical units belong only to a physical-output interface. A4 page layout and print margins may use `mm`, but screen rendering, tabletop placement, cover rasterization and canonical Template design must not convert `63` or `88` through millimetres. Publication covers use the same design viewport at ten pixels per design coordinate, producing `630 × 880` WebP output.

This decision makes explicit the design-coordinate rule in ADR-0021 and supersedes its stale statement that Resource Packages contain presentation dimensions.

## Consequences

- Resource Package and Tabletop Document readers reject or ignore no private width/height/unit extension; supported logical presentation has one shape across Apps.
- Tabletop geometry stores actual host width separately from the copied Resource presentation. Scale remains relative to the canonical viewport.
- Canonical Template CSS and SVG use design-coordinate pixels. No `mm` conversion constant exists in the renderer or tabletop core.
- Tests protect the `63:88` viewport, the `630 × 880` cover output and the absence of legacy presentation dimensions.
- Print styles may continue to use physical units because they are a separate output interface rather than canonical card design input.
