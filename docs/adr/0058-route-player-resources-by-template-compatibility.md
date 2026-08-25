# Route Player Resources by Template Compatibility

Status: accepted

Player App routes each installed Game Resource by comparing its exact Resource Template identity and version with the Current System Package's Resource Compatibility declarations. A matching declaration determines the native resource entry; a resource that matches no declaration, or whose exact Template implementation is unavailable locally, remains in Other Resources. Resource Package Target System Package References do not gate this decision.

Resource Templates are platform-governed semantic identities. A System Package explicitly declares which Template identities it understands and how each maps into its native resource entries. Requiring a Resource Package author to repeat a target System Package declaration adds a second, package-level compatibility switch that can contradict the resource's Template identity and the System Package's own declaration. In particular, a Creator-authored Weapon using the trusted Weapon Template must appear in a Player system that explicitly accepts that Template even when the containing package has no target metadata.

Target System Package References remain optional opaque distribution and discovery metadata. Creator and Market may preserve and display them, but Player does not use them for native routing, installation, or access. A package can contain resources using several Templates, and Player routes every resource independently.

This decision supersedes the target-gated routing decision in ADR-0053 and the older target-gating portions of ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0020, ADR-0032, and ADR-0038. Their remaining decisions about Market scope, Player migration, optional target metadata, explicit package replacement, stable identity, Character Data materialization, and local package storage remain accepted.

## Consequences

- A Creator-authored Weapon with no Resource Package targets enters a native Weapon entry whenever the Current System Package accepts that exact Weapon Template version.
- The same installed package may produce different native and Other Resources views under different Current System Packages without copying or rewriting the package.
- A target that names another system cannot suppress a Template match declared by the Current System Package.
- Creator does not need a system selector merely to make a trusted Template usable in Player. Target metadata can remain absent when the author has no discovery claim to make.
- Player routing diagnostics concern Template incompatibility or unavailable implementations; `no-targets` and `target-mismatch` are no longer routing outcomes.
- Contract validation, package identity, Snapshot Digest, Market indexing, and version classification for target metadata remain unchanged.
