# Separate Creator Workshop and GM Table Domains

Status: superseded by ADR-0048

Creator Workshop and GM Table are separate L1 product domains hosted by one Creator/GM App. Creator Workshop owns Game Resource creation and editing, Creator Workspaces, Resource Package assembly, file transfer, and Market publication actions. GM Table owns private tabletop documents, Tabletop Instances, GM interaction state, and table-specific persistence and synchronization.

The `apps/creator-gm` composition root directly combines both domains and handles routing, PbDH Account restoration, installed-resource initialization, and Template Registry wiring. These are application-level composition concerns, not a third App Shell Module or product domain. Sharing one deployment therefore does not collapse the two domains.

## Consequences

- Creator Workshop and GM Table receive separate L1 PRDs and independent acceptance criteria.
- Creator Workspace and GM Table documents use separate repositories, sync payloads, quotas, migration actions, and deletion paths even when the same Cloud Sync mechanism serves both.
- Workshop mutates owned Game Resource definitions; GM Table creates an independent Tabletop Instance Resource Copy on every placement and may mutate that copy and the instance runtime state. It never writes either back into the source Game Resource.
- Both domains may read the same local Game Resource catalog and trusted Template Registry without sharing one mutable aggregate. Once placed, a table card resolves through its own resource copy rather than the current catalog definition or another instance.
- A failure or unfinished feature in Workshop must not prevent a GM from opening a locally saved table, and the reverse is also true.
- No `creator-gm-shell` package, Module, or PRD is created. Small application-level composition code remains in `apps/creator-gm` until a concrete reusable responsibility justifies extraction.
