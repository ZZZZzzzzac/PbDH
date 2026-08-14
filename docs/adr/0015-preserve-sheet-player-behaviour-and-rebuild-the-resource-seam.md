# Preserve Sheet Player Behaviour and Rebuild the Resource Seam

Status: accepted

The existing production `PbDH_sheet` Player experience is the behavioural baseline for the new Player App. PbDH will selectively copy its proven System Package activation, Character Save, layout, Sheet Module, dependency, validation, import/export, print, and local-persistence behaviour instead of rewriting those areas from first principles.

The deliberate replacement boundary is resource integration. Game Resource contracts, Resource Package installation, Template resolution, Resource Compatibility, Other Resources, Resource Manager, and the connection to shared Tabletop Modules will be reshaped around the new versioned Contract and Template architecture. Legacy `Resource Extension` implementation details have no authority when they conflict with those decisions.

## Consequences

- First-version Player App caches and runs one Current System Package, matching Sheet. Importing another package replaces that cached snapshot rather than creating a multi-package installation library.
- Character Saves remain grouped by stable System Package ID and record the package version used when saved; replacing the Current System Package does not erase saves belonging to any Package ID.
- Existing Sheet tests are copied or translated as acceptance evidence before mature behaviour is reorganized into the monorepo.
- Stable Player behaviour outside the resource seam changes only through an explicit PRD or ADR, not as incidental cleanup during migration.
- Existing System Package resource declarations may need adapters into the new resource model, but the Player-facing package, character, and module semantics remain the baseline.
- Sheet's target-package isolation remains at Resource Package scope: a package with no Target System Package Reference, a different target ID, or a different target SemVer `MAJOR` is rejected. The new fallback applies only after that reference passes and Template compatibility is evaluated.
- Resource Manager parity means retaining useful management and diagnostics behaviour, not preserving its old storage keys, component boundaries, or System Package-scoped data model.
- Shared Tabletop extraction must preserve current Player interactions while allowing GM App to provide a different adapter and persistence owner.
