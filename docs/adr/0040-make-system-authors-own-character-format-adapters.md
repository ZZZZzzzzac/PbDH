# Make System Authors Own Character Format Adapters

Status: accepted

Character conversion and resource conversion have different semantic owners. A Character Format Adapter maps an external character format to or from the Character Data defined by one System Package. Only that System Package Author can authoritatively interpret its module fields, enum values, advancement rules, selected resources, and loss semantics. Character Format Adapters therefore belong to the System Package Authoring Workflow and ship with their System Package.

This preserves the mature bounded seam from PbDH Sheet without retaining its old resource-conversion ownership. Resource Conversion Adapters remain Platform Administrator-owned because they target Administrator-governed Resource Templates shared across Apps. The two Adapter kinds do not share a Registry or authority merely because both perform conversion.

Player App provides explicit source-format entry points, one Character Format Adapter orchestration interface, isolated execution where applicable, standard input and output contracts, diagnostics, and final validation. A successful import produces a short-lived Character Save Candidate. Player App validates its Character Save envelope and system-specific Character Data, shows any loss report, and creates a new Character Save only after user confirmation. Adapter code cannot write persistence directly.

Native PbDH Character Save files use a Platform-owned PbDH Character Format Adapter so callers do not maintain a separate `if native else convert` orchestration path. That Adapter is a thin composition over the authoritative Character Save Contract Reader and Migration plus the referenced System Package's Character Data Migration and validation; it parses, migrates, validates, and serializes native data without performing third-party semantic conversion or duplicating those lower-level capabilities.

## Consequences

- Adding or maintaining a third-party character format is a System Package Author responsibility, not a Platform Administrator responsibility.
- Character Format Adapter identity is scoped to its System Package; it need not enter the global Resource Conversion Adapter Registry.
- The PbDH native Adapter is Platform-owned and uses the same orchestration interface, but its Contract and Character Data operations remain delegated to their authoritative Readers, Migrations, and Validators.
- Player App can reuse Sheet's isolated execution and conversion-report behaviour, subject to the new Character Save Contract.
- Resource conversion remains reusable across Player App and Creator App, while character conversion remains a Player/System Package capability.
- A Character Format Adapter cannot bypass Character Save Contract validation, System Package Character Data validation, or user confirmation.
