# Host Frontend Apps in One Platform Shell

Status: accepted

PbDH hosts Player, Creator, GM Tabletop, and Market in one browser Platform Shell under one origin. These remain separate product capabilities and domain-owned state modules; frontend hosting does not merge their repositories, documents, permissions, or acceptance boundaries.

The Platform Shell is the only user-facing frontend composition root. It mounts one `AuthProvider` and one `PlatformAppBar`, owns primary-page routing, and composes the exported Player, Creator/GM, and Market surfaces. Switching primary pages reuses the same Platform session and must not claim, replace, release, or reconstruct that session. A session replacement remains an account-level interaction between distinct Platform clients, such as another device establishing a different active session.

Player, Creator/GM, and Market keep their existing App directories and domain state. They export embeddable surfaces that receive Shell capabilities through small interfaces and do not own global account state or global navigation. Creator and GM continue to share Creator Workspace state as decided by ADR-0051 while keeping Creator Workspace and Tabletop Document lifecycles separate.

Market handoff to Player, Creator, or GM uses same-window Shell navigation and an explicit one-shot handoff value. It does not open another frontend window or transfer state through development ports. Browser-local data uses the Shell origin, so all domain repositories can use the existing `pbdh-platform` IndexedDB without cross-origin bridges.

This decision preserves ADR-0034's one-active-Platform-session policy but supersedes its statement that switching among PbDH Apps replaces the previous App session. It supersedes only the separate user-facing frontend composition-root and deployment portions of ADR-0010 and ADR-0051; their product, domain, document, and dependency decisions remain accepted.

## Consequences

- The normal development topology is Platform Shell on port 5173 and Platform Backend on port 8001; Player and Market do not require separate browser ports.
- `apps/platform` may compose the exported surfaces from `apps/player`, `apps/creator`, and `apps/market`. Those surface modules cannot depend on `apps/platform` or on each other.
- Global typography, account controls, and primary navigation have one runtime owner. Domain-specific App Bar actions enter through a Shell slot instead of rendering another top bar.
- Cross-port authentication storage and focus-based session reconciliation are not part of the final interface.
- Build and architecture checks must reject multiple production `AuthProvider` or `PlatformAppBar` owners.
