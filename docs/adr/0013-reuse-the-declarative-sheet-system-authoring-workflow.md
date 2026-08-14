# Reuse the Declarative Sheet System Authoring Workflow

Status: accepted

PbDH will not build a System Author App in its first release. System Package Authors will use a file-first declarative workflow selectively migrated from `PbDH_sheet`: human- and AI-readable Author Data, a fixed manifest entry, ZIP distribution, directory-based development input, one normalized virtual package representation, layered validation diagnostics, and preview through the normal Player Runtime pipeline.

This preserves the mature low-frequency authoring contract without forcing its complexity into the user-facing Apps. The System Package remains declarative and cannot inject arbitrary React UI. Existing bounded Character Format Adapter and validation script seams may be retained only with their isolation, validation, and explicit contract boundaries; legacy System Package-owned Resource Format Adapters are not retained because shared resource conversion is platform-owned.

## Consequences

- Creator App creates Game Resources; neither Creator App nor GM App edits or previews System Packages.
- Ordinary Player navigation never exposes System Package author controls. Author Preview is a development entry that reuses the Player loader, validator, renderer, and Modules instead of creating a second runtime.
- ZIP and readable-directory inputs converge on the same normalized System Package before validation or rendering; input source cannot change package semantics.
- Package paths remain package-root-relative and cannot escape the package or depend on external URLs unless a later contract explicitly permits a safe asset source.
- Structural, reference, script, and security errors block runtime use; ordinary game text remains semantically permissive.
- System Package Authors may supply Character Format Adapters for their own Character Data semantics. Player App owns isolated execution, diagnostics, and final Contract validation; Platform Administrator does not register these Adapters.
- The new JSON Schema System Package Contract becomes authoritative. Sheet's Zod contract and tests are migration evidence and implementation sources, not a second authority.
- Current platform ADRs override legacy behaviour where they conflict. In particular, an unknown Contract `MAJOR` cannot be rendered after only a warning; it requires an explicit migration or a supported reader.
- The workflow may receive CLI, AI, and preview improvements without becoming a general low-code editor or another first-version product App.
