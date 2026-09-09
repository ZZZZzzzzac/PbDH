# Keep One Active Platform Session per Account

Status: accepted

ADR-0051 removes Creator-to-GM App session switching because both capabilities share Creator App. The account-wide single-active-session policy remains accepted.

PbDH retains one active Platform session per Account across Player, Creator/GM and authenticated Market operations. An explicit sign-in or user-selected takeover is sufficient intent to replace the previous session; successful sign-in does not ask for a second confirmation. Automatic session restoration and token refresh are not takeover intent.

The normal user workflow is moving between devices, not actively editing on several devices at once. Account-wide exclusion is retained without adding document leases; document revision checks still protect writes and remain necessary.

When replaced, the old client stops authenticated cloud writes. Local-first guarantees remain: it can continue editing its local cache and exporting files, while pending changes remain in its durable local outbox. It must not silently reclaim the session or overwrite cloud content after another client takes control.

## Consequences

- Session ownership belongs to PbDH Account infrastructure, not to an individual Character Save, Creator Workspace, or GM tabletop document.
- Switching App surfaces in the Platform Shell reuses one Provider and session; same-origin tabs share the existing accepted session.
- Passive token refresh preserves the confirmed account and cached workspaces while requests are pending or the network is unavailable. Repeated notifications for the same accepted token and session do not re-fetch account status. An explicit SDK sign-out clears identity; a transient empty restoration observation does not.
- Replacement requires an explicit user action; a background reconnect cannot evict the current active client.
- A known invalid local session does not automatically reclaim even if the server's prior claim is now stale. The user can explicitly continue on this device.
- Session replacement is detected from actual authenticated request failures, not a dedicated 15-second polling loop. An idle old device may display the change later, but the server still rejects its writes immediately. Notifications are scoped to the requesting session so stale responses cannot invalidate a newer login.
- Public Market browsing remains anonymous and unaffected. Authenticated Market actions require the active Platform session.
- Multi-device or cross-App concurrent cloud use requires a future ADR and measured user demand; it is not implemented through hidden per-document exceptions.
