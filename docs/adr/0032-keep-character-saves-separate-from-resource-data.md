# Keep Character Saves Separate from Resource Data

Status: superseded by ADR-0052

A Character Save stores character-owned state plus stable references and dependency metadata for the Game Resources it uses. It does not embed Game Resource definitions, Resource Packages, or resource media bytes. Resource data remains independently installed, versioned, distributed through Market, or imported from a user-provided file.

When restoring a cloud Character Save on a device, Player App resolves its resource references against installed Resource Packages. Missing dependencies that remain available through Market are shown with an explicit one-click installation action. Dependencies unavailable through Market require manual Resource Package upload. Player App does not silently install Market content, guess replacements, or synchronize every installed Resource Package through the account.

This keeps character sync small and preserves resource ownership and update boundaries. Changing, uninstalling, or republishing a Resource Package does not rewrite Character Saves, while character edits do not create private copies of resource data.

## Consequences

- The independently versioned Character Save Contract must carry enough stable dependency identity to report missing Resource Packages and affected resource references without carrying their definitions.
- Resource installation still runs Target System Package and Template compatibility checks. Character restore cannot bypass those checks merely because the save references a resource.
- Missing resource references are preserved so installing the dependency later can resolve them; they are never discarded or rewritten to a guessed resource.
- Market unavailability cannot block local character data from loading or exporting, but it can prevent one-click recovery of a missing resource dependency.
- Missing resources degrade through diagnostics and placeholders rather than blocking the whole character, as decided by ADR-0033.
