# Publish Resource Package Contract 1.1.0

Status: accepted

Resource Package Contract `1.1.0` is approved for production publication. It extends the published `1.0.0` exchange boundary with per-resource attribution, explicit publication fork provenance, and template-declared tabletop replacements while retaining the self-contained archive, stable identity, media integrity, and deterministic Snapshot Digest rules.

The exact Schema, positive and negative conformance fixtures, archive and digest compatibility evidence, Creator producers, Player consumers, and Python Market publication path are recorded in `contracts/releases/resource-package/1.1.0.json`. The Contract Catalog lifecycle state is `published`; production Market publication may accept the version.

## Consequences

- Resource Package `1.1.0` is immutable. Any later data-shape or semantic change requires a new SemVer version.
- The `1.0.0` Reader and release evidence remain supported; publishing `1.1.0` does not migrate or relabel existing packages.
- Creator may produce `1.1.0` packages for production publication, including packages that use published Resource Template `1.0.1` versions.
- Contract lifecycle and Resource Template lifecycle remain independent. This decision does not alter any Template state.