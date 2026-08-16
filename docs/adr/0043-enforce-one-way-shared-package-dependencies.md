# Enforce One-way Shared Package Dependencies

Status: accepted

ADR-0051 removes GM App as a separate composition root and injects Tabletop capabilities through Creator App. The one-way dependency rules remain accepted.

PbDH shared packages form a directed acyclic dependency graph. Top-level `contracts` is the language-neutral foundation. Shared packages never depend on an App, and App composition roots resolve concrete Template capabilities and inject them into Renderer, Tabletop, and Conversion workflows. A shared module cannot locate host state or the Template Registry through a reverse import or global singleton.

`packages/templates` exposes a React-free `core` entry for schemas, defaults, Registry metadata, and behaviour declarations, plus a frontend-only `frontend` entry for authoring layouts and presentation implementations. `packages/tabletop` similarly exposes pure `core` state and command capabilities separately from its `react` spatial surface. `packages/resource-renderer` defines the common rendering interface, primitives, and isolated surface but does not import `packages/templates`; it renders a Template capability supplied by the host. `packages/resource-conversion` may use Contract definitions and `templates/core`, never frontend Template code.

Player App, Creator App, GM App, and Market are composition roots and may depend on the required shared entries. Platform Backend may depend on language-neutral Contract artifacts and service-safe `templates/core` validation, but never on React, DOM, browser storage, or a frontend entry point.

## Consequences

- `templates ↔ resource-renderer` and `tabletop ↔ templates` cycles are prevented through dependency injection rather than hidden behind global registries.
- Backend can validate published Template data without bundling React or browser code.
- Core and frontend separation uses package subpath exports first; no additional shared package is created until a concrete tooling or deployment constraint requires it.
- Dependency boundaries must be enforced by an automated repository check once executable packages exist.
- Adding a dependency exception requires updating repository rules and this architecture decision before implementation.
