# PbDH Sheet Player Resource Selection Migration

Source repository: `PbDH_sheet`

Source commit: `576867a0edd5992931b79cead826d1a502f4022c`

Selected sources:

- `src/rendering/ResourcePickerModule.tsx`: resource picker opens an available library and commits a single row immediately.
- `src/rendering/ResourceLibraryBrowser.tsx`: keyword search, field filters, column sorting, keyboard row selection, and a scrollable high-density table.
- `src/domain/dependencyEngine.ts`: `resourceSelected`, `always`, `fillText`, `selectedResourceField`, and `selectedResourceTemplate` behavior.
- `public/system-packages/daggerheart-core/dependencies.json`: Daggerheart Core primary-weapon formatting and target Module IDs.

Migration boundary:

- Player UI preserves the reviewed single-select browser behavior while using the current Player visual shell.
- The new System Package Contract declares picker columns and the minimal Dependency subset instead of copying the legacy internal schema.
- One confirmed selection evaluates every declared write first, then commits final plain Character Data values atomically.
- Legacy `resourceSelections`, package identity, resource identity, provenance, and load-time replay are intentionally excluded per ADR-0052.
