# daggerheart-core Skin contract

Start with the canonical [Pages, Layout and Skins contract](../../../docs/system-package/contract/pages-layout-skins.md).

## Package-specific boundaries

- Base HTML lives in `layouts/*.html`; never edit it for one Skin.
- Base structural CSS lives in `layouts/*.css`.
- `skins/plain.css` defines the current neutral values and is the compatibility baseline, not the design target.
- New Skin CSS belongs at `skins/<skin-id>/skin.css`.
- Optional HTML overrides belong under the same Skin directory and are registered in `manifest.json`.
- Skin images belong at `assets/skins/<skin-id>/**`.

`plain.css` exposes the current `--dh-*` package tokens for sheet, shell, Beast Forms, Ranger Companion, lines, ink and system font stacks. A new Skin may override those tokens and the stable Framework module tokens at `:scope`, then add targeted rules where tokens are insufficient.

All five Page IDs and the Shell have fixed meaning. An override may rearrange modules only inside its matching owner. It cannot change Page metadata, A4 sizing, Guide behavior, Character Data, Dependencies, Validation Checks or Card behavior.

Before handoff, verify every runtime-visible Page, hidden conditional Page, the Shell card area, Guide targets, narrow viewport and browser print preview.

## Text-card contrast check

Before handoff, create or inspect text-mode Cards in both compact Card Face and Card Detail. Confirm that the Card name, description, tags and overflow indicator remain clearly readable against:

- the default text-card background;
- every outline and badge declared in the Card Table's `状态外观` mapping; and
- the Skin's screen and print presentations.

Do not let Skin rules obscure the Author-defined `--play-card-state-color`, outline, or state badge. The Framework owns the badge's neutral readable surface; Skins may style ordinary Card content without changing the state meaning.
