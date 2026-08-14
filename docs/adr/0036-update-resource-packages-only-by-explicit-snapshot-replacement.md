# Update Resource Packages Only by Explicit Snapshot Replacement

Status: accepted

Resource data crosses Creator App, Market, Player App, and GM App boundaries as snapshots. A Creator Workspace is mutable, but editing it does not mutate a Market listing. Publishing updates the Market-owned snapshot, but that does not mutate any Player or GM local resource library. A consumer changes only after the user explicitly imports or updates a Resource Package.

Player and GM local libraries keep one current installed snapshot for a stable Resource Package ID. Explicitly importing a newer snapshot for that ID replaces the older local library snapshot. Existing Character Save references use composite Game Resource References—Resource Package ID plus package-scoped Resource ID—rather than embedding resource definitions; after explicit replacement, references still present in the package resolve to the new definitions. This update is intentional because the user chose to import the package; no background or silent upgrade can produce the same effect.

Tabletops use a different stability boundary. Every placement copies the current resource definition into an independent Tabletop Instance Resource Copy inside that Tabletop Document. Replacing the local library therefore does not redraw or change cards already on a table. A later placement uses the then-current library definition, allowing old and new printings for the same Game Resource Reference to coexist; GM edits can additionally make otherwise identical placements diverge.

For example, a character using resource `armor-a` continues to see `闪避 +1` while only Creator or Market has changed. If the Player explicitly imports a package snapshot where the same `armor-a` now provides `护甲 +1`, that character then sees the new definition. The consent boundary is package import, not a separate migration of every character reference.

## Consequences

- Resource Package version identifies and compares transferable snapshots, but individual Game Resources do not require independent SemVer.
- Market may announce that an update exists, but cannot install it or alter local data without an explicit user action.
- A replacement is validated before commit. Failure preserves the previously installed snapshot rather than leaving a partial mixed library.
- Validation and commit cover every required normalized media blob as well as manifests and Game Resources. A package with missing required assets cannot replace the previous complete local snapshot.
- Package-scoped Resource IDs retained across library snapshots update existing Character Save references consistently after replacement. Removed IDs become unresolved Character Save references and follow existing missing-resource diagnostics; they are not guessed or silently deleted.
- A resource's exact Template version remains part of its definition. Replacing a package may therefore change its Canonical Card Surface, but only after explicit import; consumers that keep the old local snapshot continue using the old Template version and Renderer Revision.
- Character Save remains separate from resource definitions and resolves stable references through the current local Resource Package snapshot.
- Player and GM Tabletop Documents own an independent resource copy and runtime state for every instance. These copies no longer depend on the current local Resource Package snapshot after placement and never write changes back into it.
- Retaining historical Market releases or local rollback copies is optional product functionality, not required to prevent silent updates.
