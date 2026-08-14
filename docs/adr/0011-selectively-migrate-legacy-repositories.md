# Selectively Migrate Legacy Repositories

Status: accepted

PbDH is the future source of truth and will not embed the old repositories or import their layouts as architecture. The unfinished `PbDH_Cards` code may be copied broadly into the new monorepo and reorganized. The production `PbDH_sheet` repository remains untouched; PbDH may selectively copy its proven code, tests, contracts, and behaviour into new ownership boundaries.

The old repositories preserve historical evidence, while the new repository establishes a clean architecture. A live submodule, subtree, shared source path, or bidirectional synchronization would keep obsolete ownership boundaries alive and make either repository's releases depend on the other.

## Consequences

- Migration copies record the source repository, commit, and original path so later reviewers can recover context without importing Git history.
- Cards code receives no architectural privilege merely because it is copied more broadly; incomplete behaviour is accepted only against new PRDs and tests.
- Sheet continues to ship from its original repository during migration. Copying code does not modify, deprecate, or replace the production application.
- Mature Sheet behaviour is preserved through copied tests, contract fixtures, or explicit parity tests before its implementation is reshaped.
- Fixes do not automatically flow in either direction. Any later port is a deliberate, traceable change.
- Archiving either old repository and cutting users over to the new Player App require separate explicit decisions after acceptance criteria are met.
- Files are copied rather than removed from old repositories; this ADR authorizes no deletion.
