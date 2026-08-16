# Persist Player Resource-Application Results in Character Data

Status: accepted

When a Player selects a Game Resource in a Player resource-library Module, Player App executes the declarative Dependency rules supplied by the Current System Package and writes their results into Character Data. The System Package declares the source Module, event, target Module, field reads, formatting, and write action; it does not initiate the interaction or execute the write. Player App provides the generic event and write framework without interpreting game semantics.

The resource selection is a one-time input operation, not a continuing relationship. A target field stores the ordinary value that the character sheet uses, such as the opaque string `长剑 +2 1d8+4`. After the write, a weapon `freeText` value is no different to Player App from a character-name `freeText` value. Character Save carries no Game Resource Reference, Resource Package dependency metadata, library or entry ID, source provenance, or persisted selected state for that field. Reopening a character restores the written value but does not restore or highlight the resource that originally produced it.

Player App may present candidates and diagnostics before commit, but after the user confirms, the resulting Character Data is authoritative. Updating, removing, withdrawing, or losing the source Resource Package never rewrites, refreshes, invalidates, or removes the written character result. The legacy PbDH Sheet `resourceSelections` snapshot and any load-time replay that depends on it are migration evidence only and do not enter the new Character Save Contract.

Player Tabletop data follows its existing self-contained-copy rule. A Tabletop Instance Resource Copy embedded in Character Data contains everything required for that instance rather than resolving through the installed library. If the copy records source identity for provenance, that identity is descriptive only: it is not a Character Save dependency, refresh key, recovery requirement, or permission to write back.

This decision supersedes ADR-0032 in full; the Resource Package dependency and missing-resource portions of ADR-0033; the Character Save reference-resolution portions of ADR-0036; and the Game Resource Reference/dependency-metadata portions of ADR-0007 and ADR-0039.

## Consequences

- Opening, exporting, synchronizing, or restoring a Character Save does not require the Resource Package from which a character field was originally chosen.
- Character Save Contract does not include Game Resource References or Resource Package dependency metadata for resource-backed character fields.
- Resource Package updates affect future selections only. They do not update existing characters, even after the user explicitly replaces the installed package.
- Missing-package placeholders and one-click dependency recovery do not apply to final character-field values. Resource Manager remains available when the user wants to make a new selection.
- Player App commits all Character Data writes produced by one confirmed resource-selection event atomically after Contract and System Package validation. Platform Modules execute declared operations over IDs and opaque values; they do not infer a result from names, numbers, formulas, or other game semantics.
- System Package Dependency declarations are not Resource Format Conversion. Conversion Adapters normalize external source data before persistence; Dependency rules describe a Player interaction over already valid Resource Template data.
- Migration of any legacy reference-based save must be explicit and must not guess a result when the exact source data or System Package conversion rule is unavailable.
