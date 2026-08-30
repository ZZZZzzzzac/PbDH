# Retire Unpublished Template Prereleases

Status: accepted

The Resource Template prereleases created before the first monorepo release were never published and are no longer supported. The trusted Template Registry contains only the current `1.0.0` versions. Creator, Player, GM, Market and Backend do not read, render, edit, publish or upgrade the retired `alpha` and `dev` Template versions.

This decision does not remove prerelease Platform Contract readers. Contract versions and Resource Template versions are independent. ADR-0041 continues to protect every Template version that reaches the published lifecycle state; none of the retired versions did. This decision supersedes ADR-0057 only where it required retaining prerelease Template readers during development.

## Consequences

- Stable `1.0.0` Template capabilities and frontend implementations must be self-contained rather than importing retired source directories.
- The Template Catalog, registries, authoring layouts, renderers, conversion outputs, samples and first-party resources reference only current Template versions.
- A resource pinned to a retired Template version remains structurally readable only if its enclosing Platform Contract supports it, but the Template is unsupported and cannot execute or be upgraded.
- Any future compatibility promise begins only after a Template version is promoted to `published`.
