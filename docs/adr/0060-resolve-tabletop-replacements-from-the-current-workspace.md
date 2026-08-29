# Resolve Tabletop Replacements from the Current Creator Workspace

Status: accepted

A Tabletop Replacement is an explicit transition that resolves its package-local target from the same Creator Workspace at execution time and replaces the current card with a newly created Tabletop Instance. The new instance copies the target resource's current definition and media, initializes fresh Template-declared runtime state, and retains only the previous instance's position, size, rotation, and layer. Resolution and replacement are atomic: a missing or invalid target leaves the current instance and Tabletop Document unchanged.

The Tabletop Document persists only the currently visible instance. It does not materialize a Replacement closure, cache forms that were previously visited, or retain hidden and historical instances. Switching back therefore performs another current-workspace lookup and can fail if that target no longer exists. Editing a target in the Workspace affects a later explicit switch to that target but never mutates the current instance in the background.

This decision partially supersedes ADR-0051's requirement to copy a complete Replacement closure during placement. ADR-0047 remains accepted: the instance visible after either placement or Replacement owns an independent resource copy and never shares mutable definition or runtime state with its Workspace source or another instance.

## Considered Options

- Materializing the complete Replacement closure at placement would make later switching independent of the Workspace, but would persist hidden forms, make deletion semantics surprising, and duplicate definitions and media that may never be used.
- Caching each successfully visited form would make repeated switches depend on navigation history and would allow stale Workspace content to reappear.
- Resolving the target on every explicit switch keeps the Tabletop Document minimal and makes current Workspace contents the single, visible source for creating the next form while preserving atomic failure and current-instance independence.
