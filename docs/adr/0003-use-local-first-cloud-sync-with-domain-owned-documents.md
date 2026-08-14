# Use Local-first Cloud Sync with Domain-owned Documents

Status: accepted

Player App, Creator App, and GM App will include Cloud Sync in their first release. Creator Workspaces, GM tabletop documents, and Character Saves write locally first, then reuse one synchronization mechanism for durable outbox delivery, debounced background upload, reconnect retry, quota handling, account-wide single-active-session enforcement, and server-side recycle-bin retention. They remain separate domain documents with separate repositories and sync payloads; Cloud Sync does not create one aggregate workspace that owns all private account data. Each Character Save is independently synchronized instead of placing every Player record in one Player workspace document.

This preserves the implemented Cards authoring guarantees: temporary network or quota failures do not block local editing or export, an interrupted client retains its local content, and anonymous authoring data is removed only after the server confirms an idempotent account migration. Sharing the mechanism avoids rebuilding delivery semantics, while separating document ownership prevents a Creator Workspace change from rewriting a GM tabletop document or requiring cross-domain conflict rules.

GM tabletop documents and Character Saves use the stricter migration boundary: signing in never silently uploads local tables or characters. The user must explicitly select local documents and create cloud copies. Local Character Saves remain after the server confirms each cloud copy. Creator Workspace may retain the implemented anonymous-to-account migration flow because cloud continuity is already part of that authoring contract.

## Consequences

- IndexedDB remains the immediate local persistence layer; network acknowledgement is not required to continue editing.
- Creator Workspace, GM tabletop document, and Character Save expose independent load, save, migrate, export, quota, and deletion operations even when backed by shared sync infrastructure.
- Cloud document payloads remain structured data with Asset ID references. Managed Media bytes use the separate media pipeline and are never embedded into sync JSON; self-contained bytes appear only in explicit portable file export.
- The first release permits only one active Platform session per PbDH Account across Player, Creator, GM, and authenticated Market operations. A replaced client becomes local-only instead of attempting automatic conflict merging.
- Cloud content is private. Sharing, collaboration, history browsing, and multi-writer merge are separate future decisions.
- Deleted cloud documents remain recoverable through the existing 30-day cloud recycle-bin policy.
- Player App synchronizes Character Saves only under this decision. Installed System Packages, installed Resource Packages, resource installation state, and App preferences require separate scope decisions.
