# Retain Read or Migrate Paths for Long-lived Contracts

Status: accepted

Resource Package, System Package, Character Save, and Tabletop Document Contracts protect long-lived user artifacts. Every artifact records an exact Contract SemVer, and consumers declare exact supported ranges. Within one `MAJOR`, later `MINOR` and `PATCH` releases preserve the compatibility rules in ADR-0008. An App cannot retire direct reading of an older document `MAJOR` unless it either retains the old Reader or provides an explicit deterministic Contract Migration to a supported version.

A Contract Migration creates a new candidate representation and validates it completely before any replacement. Failure leaves the original untouched. External files and unopened local documents are not silently scanned or migrated; migration occurs only through an explicit user action at the point where the artifact is imported or opened. A loader cannot guess from fields, silently relabel a version, or discard unsupported data to make validation pass.

Resource Template evolution remains separate. Migrating a document envelope does not change a resource's exact Template version, Renderer Revision, card appearance, or Tabletop Behavior. Template migration remains an optional Creator action under ADR-0041.

Backend API is a transient communication Contract rather than a user artifact. Its versions may be deprecated according to deployment and client-upgrade needs without retaining them for the full lifetime of stored documents. Each Contract Family defines its own support duration and retirement signals; PbDH does not impose one global number of years or retained majors.

## Consequences

- Updating an App cannot strand previously accepted user documents without a tested read or migration path.
- Migrations are pure, staged, idempotent transformations with fixtures for successful, lossy, malformed, and interrupted cases.
- Persistent replacement is atomic and occurs only after candidate validation; recoverable source data remains available until success.
- Unsupported artifacts without a Reader or migration remain preserved and rejected with diagnostics rather than partially opened.
- API deprecation and stored-document migration use separate policies even though both use SemVer.
