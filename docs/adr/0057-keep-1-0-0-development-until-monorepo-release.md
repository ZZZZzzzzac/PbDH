# Keep 1.0.0 Development Until Monorepo Release

Status: accepted

PbDH uses `1.0.0` as the target first-release version for Resource Package Contract and the first-party Resource Templates while the monorepo is still under development. Their Contract Catalog and Template Registry lifecycle state remains `development` until the whole ecosystem passes its release gate. The version string does not by itself mean that a Contract, Template, Market Publication or application has been released.

Development `1.0.0` content may still change before the monorepo release. At release, the exact accepted Schema, Template capabilities, Renderer revisions and conformance evidence are frozen and their lifecycle state changes to `published`. Version evolution starts only after that freeze; later changes use a new SemVer instead of mutating the published `1.0.0`.

Issue #39 exercises Creator → Market → anonymous download inside the development deployment. The development Backend may accept lifecycle-state `development` candidates for that tracer bullet, but production publication mode must continue rejecting them. This development path is not evidence that PbDH Market or the monorepo has been publicly released.

Existing `1.0.0-alpha.1` readers remain available for development artifacts already created during earlier stages. New first-party Creator content uses `1.0.0`; importing an alpha artifact does not silently rewrite its Contract or Template version.

## Consequences

- Catalog lifecycle state, not the numeric version string, is the authority for publication readiness.
- Promotion at monorepo release is an explicit governance operation with conformance and human approval; it is not performed by #39.
- Backend publication validation receives an explicit deployment mode. Development mode can exercise the vertical slice; production mode rejects all development Contract or Template versions.
- Documents, UI and Issue evidence must call the #39 result a development Market publication until the monorepo release gate passes.
