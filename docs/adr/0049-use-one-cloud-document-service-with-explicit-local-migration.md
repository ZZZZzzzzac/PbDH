# Use One Cloud Document Service with Explicit Local Migration

Status: accepted

ADR-0051 removes the GM Resource Workspace document kind. Character Save, Creator Workspace, and GM Tabletop Document continue to use this service and explicit local-to-cloud migration rule.

Character Saves, Creator Workspaces, and GM Tabletop Documents use one Platform Backend Cloud Document Service with a shared document envelope, repository, API, revision protocol, outbox delivery, conflict actions, single-active-session enforcement, deletion, 30-day recycle bin, and recovery. Each document retains its own `documentKind`, Contract/version, stable ID, owner, payload, Asset IDs, authorization and domain lifecycle; the common service does not interpret or merge payload semantics.

Signing in never uploads pre-existing local documents automatically. The user explicitly selects which local documents to copy to cloud, after which local data is the offline cache of the same Document ID rather than a second list item. Documents newly created or explicitly imported while an account session is active write locally first and then enter background synchronization. This supersedes ADR-0003's separate-repository wording and its Creator-only automatic anonymous migration exception so that every PbDH product presents the same privacy and conflict boundary.

## Consequences

- Uploads carry a base revision; conflicts preserve the local outbox and offer only keep cloud, explicitly overwrite with local, or save local as a new document. There is no automatic field merge or last-writer-wins overwrite.
- Session replacement stops remote writes on the old client but preserves local editing, outbox data and supported file export.
- Deleting a synchronized document hides it locally and places the cloud document in the common 30-day recycle bin; deleting nodes inside a document remains a domain decision.
- Managed Media remains outside JSON payloads and follows Asset ID authorization, ownership, deduplication and quota rules.
