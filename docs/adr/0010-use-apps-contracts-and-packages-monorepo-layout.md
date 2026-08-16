# Use Apps, Contracts, and Packages Monorepo Layout

Status: accepted

The `apps/gm` directory decision is superseded by ADR-0051; Creator-hosted GM Tabletop uses `apps/creator`. The remaining monorepo and dependency layout stays accepted.

PbDH will organize product entry points under `apps/`, language-neutral schemas under top-level `contracts/`, and shared executable frontend Modules under `packages/`. The first App directories are `player`, `creator`, `gm`, `market`, and `backend`; the first shared executable areas are `templates`, `resource-renderer`, `resource-conversion`, and `tabletop`.

Contract Schemas are not TypeScript implementation packages and therefore remain outside `packages/`. App boundaries remain visible even though all source is in one repository. A shared package is created only for behaviour genuinely used by more than one App, not merely because two files have similar names.

## Consequences

- `apps/backend` contains the modular monolith; Identity, Cloud Sync, and Market remain internal modules rather than top-level deployables.
- `contracts` is divided by the five independently versioned Contract Families and contains schemas plus cross-language conformance fixtures.
- `packages/templates` owns the trusted Template Registry and implementations. Its `core` entry is free of React; its `frontend` entry owns authoring and presentation code.
- `packages/resource-renderer` owns the single cross-frontend Canonical Card Surface interface, primitives, and host-isolated styles. It receives an already-resolved Template capability and never imports the Template Registry.
- `packages/resource-conversion` owns headless third-party resource conversion, its Adapter Registry, reports, and browser/Node host boundaries without owning persistence. It may consume `templates/core`, never `templates/frontend`.
- `packages/tabletop` owns the pure `core` entry and shared `react` Surface, with host adapters at App boundaries.
- Cross-App and conformance tests live under top-level `tests`; implementation-local tests stay with their owning App or package.
- New top-level areas or shared packages require an ownership and dependency justification before creation.
