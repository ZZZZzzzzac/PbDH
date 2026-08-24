# Store Roleless Accounts and One Shared Admin in SQLite

Status: accepted

Platform Backend uses a versioned SQLite migration chain for PbDH Account identity and active-session persistence. The first schema contains `accounts` and `active_sessions`; normal accounts have no role or product-mode field. Player, Creator, GM Tabletop and Market are capabilities available to the same account, not mutually exclusive identities or permissions.

`accounts` maps one Supabase `auth_subject` to a Backend-generated stable public Account ID and optional public username. It stores timestamps and a nullable deletion timestamp, but never email or Supabase credentials. `active_sessions` contains at most one row per Account ID and implements the accepted account-wide single-active-session rule.

Platform administration uses one reserved Supabase identity shared by all administrators. Backend configuration names its exact auth subject; matching that subject grants platform administration without adding a `role` column or allowing ordinary accounts to be promoted. Admin credentials remain entirely in Supabase and outside repository, database and logs. The shared Admin Account still has one active session, so administrators cannot act concurrently and audit records cannot distinguish the individual human operator.

## Consequences

- SQLite enables foreign keys and WAL; identity creation and session replacement use explicit transactions and versioned SQL migrations.
- Missing Supabase configuration leaves authenticated operations disabled without blocking anonymous Player, Creator or Market behavior.
- The configured Admin auth subject is authorization configuration, not user-editable Account data. Changing it is a configuration change and requires the existing `.env`/secret approval boundary.
- A future requirement for concurrent administrators or person-attributable admin audit requires a new authorization decision; it cannot silently add roles to ordinary accounts.
- This decision reuses behavior and tests from `PbDH_Cards` without reusing its database or migrating its runtime data.
