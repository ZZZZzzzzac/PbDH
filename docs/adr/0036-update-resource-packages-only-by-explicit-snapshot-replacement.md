# Update Resource Packages Only by Explicit Snapshot Replacement

Status: accepted

The GM Resource Workspace and its same-Package-ID replacement rules are superseded by ADR-0051. Character Save reference-resolution rules are superseded by ADR-0052: a Player resource-application interaction writes final Character Data values without retaining the selection source, so later package replacement does not change existing character fields. Creator Workspace import/Fork rules, Player installed-package replacement, Tabletop Instance independence, and all no-silent-update rules remain accepted.

Resource data crosses Creator App, Market, Player App, and GM App boundaries as snapshots. A Creator Workspace is mutable, but editing it does not mutate a Market listing. Publishing updates the Market-owned snapshot, but that does not mutate any Player or GM local resource library. A consumer changes only after the user explicitly imports or updates a Resource Package.

The first Market release exposes only one current snapshot for each Publication. Its stable Publication link and surviving resource deep links resolve against that snapshot; it does not provide public historical versions, old-version downloads or rollback. Market-to-App handoff fetches the latest snapshot at transfer time, while the receiving App still previews and explicitly commits any local replacement.

Player local libraries keep one current installed snapshot for a stable Resource Package ID. Explicitly importing a different validated snapshot replaces that snapshot; Player retains no same-ID history and never merges fields. Existing Character Data already contains the final values written under ADR-0052, so replacement affects only future browsing and selections. No background or silent upgrade can replace the installed snapshot.

Tabletops use a different stability boundary. Every placement copies the current resource definition into an independent Tabletop Instance Resource Copy inside that Tabletop Document. Replacing the local library therefore does not redraw or change cards already on a table. A later placement uses the then-current library definition, allowing old and new printings for the same Game Resource Reference to coexist; GM edits can additionally make otherwise identical placements diverge.

For example, if applying `armor-a` wrote `闪避 +1` into Character Data, that value remains `闪避 +1` after Creator, Market, or the Player's installed package changes. Selecting the updated resource later may write `护甲 +1` into a new or explicitly replaced character field, but package replacement itself never edits a Character Save.

## Consequences

- Resource Package version identifies and compares transferable behavior snapshots, but individual Game Resources do not require independent SemVer. Market 的显式信息编辑可在目标系统与资源内容均未变化时保留包版本；精确修订仍由新的 Snapshot Digest 区分。
- Market may announce that an update exists, but cannot install it or alter local data without an explicit user action.
- A replacement is validated before commit. Failure preserves the previously installed snapshot rather than leaving a partial mixed library.
- Validation and commit cover every required normalized media blob as well as manifests and Game Resources. A package with missing required assets cannot replace the previous complete local snapshot.
- Package-scoped Resource IDs retained across library snapshots preserve resource identity for packages and future selection flows, but do not update existing Character Data values.
- A resource's exact Template version remains part of its definition. Replacing a package may therefore change its Canonical Card Surface, but only after explicit import; consumers that keep the old local snapshot continue using the old Template version and Renderer Revision.
- Character Save remains separate from resource definitions and the installed resource library; resource-backed character fields contain ordinary final Character Data values and are not resolved through the current package snapshot.
- Player and GM Tabletop Documents own an independent resource copy and runtime state for every instance. These copies no longer depend on the current Player snapshot or GM Resource Workspace after placement and never write changes back into it. GM provides no refresh or rebind command; using a newer workspace definition requires a new explicit placement.
- Retaining historical Market releases or local rollback copies is outside the first release and is not required to prevent silent updates.
