# Retire Unpublished Platform Contract Prereleases

Status: accepted

The Platform Contract prereleases created before the first monorepo release were development artifacts and were never published. They are no longer supported and are removed together with their Schemas, fixtures, compatibility types, Readers and migration branches. Apps preserve unsupported external files without partially opening them, but do not promise to read or migrate these unpublished artifacts.

Compatibility protection in ADR-0046 begins when a Contract version enters the `published` lifecycle state or when an explicit distribution promise is otherwise recorded. Development and prerelease versions may be deleted before that point. The published `1.0.0` versions are now the oldest supported Resource Package, System Package, Character Save and Tabletop Document Contracts.

The Contract Catalog and release records show that the five `1.0.0` Platform Contracts have since passed review and entered `published`; this supersedes ADR-0057's earlier Contract development-lifecycle description. This decision also supersedes its prerelease Platform Contract Reader requirement and the sentence in ADR-0062 that preserved those Readers. Resource Templates remain governed by their own catalog lifecycle, and this decision does not promote them or weaken protection for any published Contract or Resource Template version.

## Consequences

- The repository contains no pre-`1.0.0` Platform Contract Schema, fixture, Reader or migration implementation.
- Importing an unpublished prerelease artifact returns an unsupported-version diagnostic and never relabels it as `1.0.0`.
- Future compatibility promises begin only after lifecycle promotion or another explicit distribution commitment.
- Published Contract evidence hashes use canonical LF text bytes so the release gate is independent of checkout line endings.
