# Publish First-Party Resource Templates 1.0.0

Status: accepted

The Platform Administrator has approved all eleven first-party Resource Templates at `1.0.0` for production publication after their Schemas, defaults, authoring layouts, Renderer revisions, conversion paths, generated System Packages and Backend publication paths passed the release gate. This supersedes the Resource Template portion of ADR-0057: the exact accepted capabilities are now immutable published versions and any later observable data-shape, meaning, authoring, rendering or tabletop-behaviour change requires a new SemVer version under ADR-0008 and ADR-0041.

## Consequences

- Template Catalog lifecycle state and every matching core capability are `published`; both development and production Market publication may accept them.
- Platform publication mode remains fail-closed: production accepts only catalog entries explicitly enabled for production.
- The published `data.类型` field remains ordinary game semantics. Platform code does not route resources or infer compatibility from its value.
