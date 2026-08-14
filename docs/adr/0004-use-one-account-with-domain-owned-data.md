# Use One Account with Domain-owned Data

Status: accepted

Player App, Creator App, GM App, and Market will recognize one PbDH Account. A person uses the same credentials and stable Account ID across all four entry points. Authentication and identity are shared platform capabilities, while each App owns and authorizes its own data: Creator Workspaces belong to Creator storage, GM tabletop documents belong to GM storage, Market publications belong to Market storage, and Character Saves belong to Player storage.

One identity removes duplicate registration and makes publication ownership, installation history, and future cross-entry navigation understandable to users. It does not justify a shared user-data aggregate: loading an account must not require loading every character, draft, table, publication, or installation, and one domain must not mutate another domain's records directly.

## Consequences

- All authenticated services use the same stable Account ID as the principal, but expose domain-specific authorization and repositories.
- Shared credentials do not require one database schema or one deployable backend.
- Player App, Creator App, and GM App retain anonymous/local-only operation; authentication cannot become a startup requirement for offline data.
- Public Market browsing and file-based import/export remain usable without an account; actions that need ownership, such as publishing, require authentication.
- A valid login does not silently upload local data. Each document type keeps its own explicit migration contract.
- Account deletion, export, and recovery will need a coordinated platform policy, but each domain remains responsible for deleting or exporting its owned records.
