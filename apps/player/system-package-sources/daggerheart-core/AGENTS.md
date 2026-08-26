# daggerheart-core Author Rules

## Skin task default scope

When the task is to create or beautify a Skin, read `SKINNING.md` and `docs/system-package/contract/pages-layout-skins.md` first.

Allowed writes by default:

- `skins/<skin-id>/**`
- `assets/skins/<skin-id>/**`
- only that Skin's registration in `manifest.json`

Do not modify Base files under `layouts/`, `modules.json`, `pages.json`, `dependencies.json`, `guides/`, `checks/`, or `resources/` for a Skin task.

A Skin may carry its own optional HTML overrides under its Skin directory. Overrides must be registered through `layoutOverrides`, preserve the exact Sheet Module set of the Base Page/Shell, and never move a module across Page/Shell boundaries.

Do not add scripts, event attributes, custom form controls, external resources, `@import`, `@font-face`, font files, or base64 assets. Images belong under `assets/skins/<skin-id>/`.

`plain` is a compatibility and troubleshooting Skin. Create a new Skin instead of redesigning `plain`.

## Verification

Run `npm test -- src/test/daggerheartCorePackage.test.ts src/domain/systemPackage.test.ts src/rendering/moduleRegistry.test.tsx` and `npm run build`. Use Author Preview for visual, responsive, overflow and print QA.
