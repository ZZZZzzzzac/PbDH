# Make Admin Adapters the Only Resource Ingress

Status: accepted

Every external resource file entering Player App or Creator App passes through one explicitly selected, trusted Resource Conversion Adapter registered by Platform Administrators. This includes native PbDH JSON and Resource Packages through a PbDH Adapter. No third-party source shape crosses the conversion boundary into Creator Workspace, Player installation, Market publication, or cloud persistence.

An Adapter parses containers for one Source Format, validates a short-lived source-specific DTO, maps records directly to registered Template IDs/versions or Free Template, produces media candidates, and reports conversion loss. Its output is then independently validated against the exact Template Schema before becoming a Game Resource Candidate. The caller previews the report and assigns identity, ownership, draft state, package membership, or installation only after confirmation.

## Consequences

- Resource Conversion Adapters are trusted, versioned platform code shipped through the shared `packages/resource-conversion` Registry. Resource Packages and System Packages cannot carry executable Adapter code.
- Player App, Creator App, and Node workflows use the same Adapter implementation and conformance fixtures for a Source Format.
- System Package Authors no longer define Resource Format Adapter scripts. They define Resource Compatibility; Platform Administrators own mappings into platform Templates.
- Existing System Package-owned Character Format Adapters and bounded validation scripts remain separate Player concerns and are not generalized into resource conversion.
- PbDH Adapter validates Contract and Template versions and normalizes native containers; it is not an unchecked fast path around the conversion boundary.
- In-App editing, autosave, cloud synchronization, and backend reads of already canonical documents use their normal Contract validators rather than repeatedly converting canonical data.
- Market and sync backend modules accept only canonical PbDH contracts and media. Raw third-party archives and DTOs are rejected rather than converted server-side.
- Trusted Adapter code does not make its input trusted: archive, JSON, image, filename, size, and resource-limit checks still precede candidate confirmation.
