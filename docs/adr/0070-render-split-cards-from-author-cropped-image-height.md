# Render Split Cards from Author-cropped Image Height

Status: accepted

The eleven first-party Resource Templates receive a `1.0.1` release for a new split (`image + text`) presentation. Published `1.0.0` capabilities and Renderer Revisions remain registered and unchanged.

Split presentation starts from the template's `63:88` text composition and inserts the admitted portrait above its body. With fixed ratio enabled, the native card height is exactly `502.857px + rendered portrait height`; the portrait therefore pushes the whole body down instead of consuming part of its fixed base. The portrait is rendered at the full `360px` native card width with its admitted aspect ratio. The title is drawn over the portrait's lower edge on a dark-to-transparent gradient. Templates do not impose a shared media height, crop the admitted portrait again with `object-fit: cover`, or choose a fixed-mode card height from authored text.

`presentation.fixedRatio` constrains the effective outer surface, including split mode, to `63:88`. The portrait may extend the Renderer-owned inner composition, but the Canonical Card Surface clips that composition at the fixed outer boundary and anchors the attribution footer to that boundary's bottom edge. The text composition is pushed down without image-triggered text fitting. If authored text no longer fits the visible area, the author must revise the crop or content, or disable fixed ratio.

Image admission remains the authority for author-controlled cropping and WebP normalization. Resource images are admitted at `630px` width while preserving the selected crop ratio. Renderer implementations consume the resulting intrinsic ratio and do not need new Resource Contract fields.

## Consequences

- Every `1.0.1` Template owns its split DOM and CSS; no shared card composition, media wrapper, or template stylesheet is introduced.
- Shared surface hosts always constrain a resource with `fixedRatio: true` to `63:88`, including split presentation, and clip the extended Renderer consistently in Creator, Player, Market and Tabletop.
- Pure-text and pure-image presentation retain their existing `1.0.0` behavior unless a template-specific `1.0.1` fix explicitly says otherwise.
- Existing resources pinned to `1.0.0` remain readable and retain their published appearance outside Creator.
- Creator resolves every new resource to the current Template version. Importing an older `.pbres` is an explicit conversion boundary: the review/export candidate is upgraded by Template ID to `1.0.1`, so Creator never emits a newly authored `1.0.0` resource.
