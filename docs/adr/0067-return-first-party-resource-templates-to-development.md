# Return First-party Resource Templates to Development

Status: accepted

The eleven first-party Resource Templates at `1.0.0` return from `published` to `development`. Their JSON data fields were reviewed, but their Template-owned authoring editors and Canonical Card Surfaces had not completed visual implementation and cross-host acceptance. ADR-0065 declared them production-ready too early and is superseded by this decision.

Development Market publication remains available for end-to-end testing. Production Market publication is disabled until every Template's editor and Renderer have been completed in its authoritative JSX/HTML/CSS implementation, visually validated in the real Creator and GM surfaces where applicable, and passed the repository release gate.

## Consequences

- Existing `1.0.0` identifiers remain development versions; no replacement version is created merely to finish their pre-publication UI.
- Template Catalog entries and compiled core capabilities report `development` consistently.
- A later ADR must explicitly approve the completed versions before production publication is enabled again.
- Once a version returns to `published`, ADR-0041 retention and compatibility requirements apply normally.
