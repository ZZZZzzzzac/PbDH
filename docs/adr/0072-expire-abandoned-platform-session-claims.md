# Expire Abandoned Platform Session Claims

Status: accepted

The single-active-session policy in ADR-0034 protects against concurrent cloud writers, but an `active_sessions` row is not proof that another device is still active. A browser can temporarily lose its external authentication credential or close without releasing the server row. Treating every unmatched row as another live device creates a false replacement prompt on the user's next login.

An unmatched Platform session claim is considered abandoned after five minutes without an authenticated heartbeat. A client presenting the exact current session ID may always renew that claim, even after the inactivity window; this preserves recovery after browser sleep. A different client may claim an abandoned row without replacement confirmation, while a fresh unmatched row still requires explicit takeover. No database schema changes are required because `last_seen_at` already records the lease heartbeat.

Frontend authentication recovery serializes Supabase state callbacks with the explicit initial-session read, so two observations of the same login cannot race to claim twice. Temporary absence of the external authentication session no longer discards the Platform session ID; explicit sign-out still releases the server claim and clears the local ID.

## Consequences

- “Another device” means another recently active unmatched Platform session, not merely a historical database row.
- An active writer continues to refresh `last_seen_at` through authenticated requests and retains account-wide exclusion.
- An abandoned session cannot block the same user's next login indefinitely.
- A replaced client cannot silently reclaim while the replacement remains active; it continues to receive the replacement state required by ADR-0034.
- Under the revised ADR-0034, a client with a known invalid local session also waits for explicit user takeover when the competing claim is stale. The server still supports abandoned-claim recovery, but stale status is not permission for background reclaim by an already replaced client.
