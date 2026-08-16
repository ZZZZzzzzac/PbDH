# Version Contracts and Templates, Not App Coordination

Status: accepted

Deployment and independent-release references to a separate GM App are superseded by ADR-0051. Contract and Template versioning remains accepted.

Player App, Creator App, GM App, the Market frontend, and Platform Backend will release independently. Interoperability is expressed through explicit Platform Contract versions and Resource Template IDs/versions. Each App declares the Contract and Template versions it supports and may adopt new versions on its own schedule; an App release version is never used as a resource, file, or API compatibility key.

The Apps use shared contracts and trusted Templates for different jobs. Requiring lockstep releases would couple unrelated product changes and still would not guarantee that cached or offline clients update together. Versioning the actual exchanged artifacts makes compatibility testable at import, install, publish, API, and document-load boundaries.

## Consequences

- Shared source packages do not force the Apps to ship the same package versions at the same time.
- Resource Packages continue to identify each Resource Template by stable ID and version; older Apps may preserve unsupported resources through the documented fallback instead of executing unknown code.
- File formats, persisted documents, and HTTP payloads carry or unambiguously resolve a Platform Contract version at their trust boundary.
- Market publish and App import/install paths validate against their own declared support ranges and report incompatibility without guessing from App versions.
- Compatibility tests cover every supported Contract and Template range, including staggered App adoption.
- Removing an old Contract or Template version requires an explicit support and migration decision; publishing a new App version alone cannot remove compatibility.
