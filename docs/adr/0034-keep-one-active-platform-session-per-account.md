# Keep One Active Platform Session per Account

Status: accepted

PbDH will retain the Cards account-wide single-active-session design. A PbDH Account has at most one active Platform session across Player App, Creator App, GM App, and authenticated Market operations. Starting a new session while another exists requires explicit confirmation that the old session will be replaced.

The product does not optimize its first release for one person using multiple PbDH Apps or devices concurrently. Account-wide exclusion is simpler than document leases, prevents concurrent cloud writers across all domain documents, and reuses the implemented Cards session claim and replacement behavior.

When replaced, the old client stops authenticated cloud writes. Local-first guarantees remain: it can continue editing its local cache and exporting files, while pending changes remain in its durable local outbox. It must not silently reclaim the session or overwrite cloud content after another client takes control.

## Consequences

- Session ownership belongs to PbDH Account infrastructure, not to an individual Character Save, Creator Workspace, or GM tabletop document.
- Switching among Creator App, GM App, and Player App can replace the previous App's session even when they edit unrelated documents.
- Replacement requires an explicit user action; a background reconnect cannot evict the current active client.
- Public Market browsing remains anonymous and unaffected. Authenticated Market actions require the active Platform session.
- Multi-device or cross-App concurrent cloud use requires a future ADR and measured user demand; it is not implemented through hidden per-document exceptions.
