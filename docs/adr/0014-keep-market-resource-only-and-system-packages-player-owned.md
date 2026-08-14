# Keep Market Resource-only and System Packages Player-owned

Status: accepted

Market will discover and distribute Game Resources and Resource Packages only. It will not publish, host, install, or version System Packages. System Packages belong to Player App, which owns their local acquisition, storage, validation, selection, and runtime use.

Creator App, GM App, and Market do not integrate with a System Package implementation. Their interoperability with Player App comes from independently versioned Platform Contracts and Resource Templates. A Resource created outside any known system can therefore remain useful to a GM, while Player App can make its own explicit compatibility decision when that Resource is installed.

## Consequences

- System Package Authors distribute package files outside Market; Player App remains the only product entry point that loads them.
- Creator App can create Game Resources and GM App can use them without either App installing a System Package.
- Market validates Resource Package and Template data contracts but does not need the System Package Contract or player runtime to publish a resource.
- Market treats an optional Target System Package Reference as opaque distribution metadata: when present, it can validate ID and SemVer syntax but cannot require or certify that the referenced package exists or is compatible because Market does not own System Packages.
- Market may later expose rule-system tags or filters as discovery metadata. Such a tag is never proof of Resource Compatibility and cannot route a resource into Player-native modules.
- Resource Compatibility remains a System Package-owned declaration evaluated locally by Player App against Template IDs, versions, and explicit mappings.
- Market unavailability or lack of knowledge about a System Package cannot prevent file import, installed-resource use, or Player App startup.
- No App release version or System Package artifact becomes a hidden integration dependency between the four frontends.
