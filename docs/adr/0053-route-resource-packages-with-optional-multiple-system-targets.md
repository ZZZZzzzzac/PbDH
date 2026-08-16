# Route Resource Packages with Optional Multiple System Targets

Status: accepted

A Resource Package may declare zero or more Target System Package References. Each reference contains one stable System Package ID and one exact SemVer version. An empty collection means that the package makes no native-system claim; it does not make the package invalid. Multiple references let one immutable Resource Package Snapshot declare native integration candidates for several rule systems without copying or forking the package.

Player App treats the target collection as native-routing metadata, not as an installation gate or access restriction. Every otherwise valid Resource Package can be installed into the Player Resource Manager. For the Current System Package, Player attempts Resource Compatibility routing only when at least one declared target has the same System Package ID and SemVer `MAJOR`. Resources that have no targets, have no target matching the Current System Package, fail to match a Resource Compatibility declaration, or lack a locally executable Template implementation remain available through Other Resources with appropriate diagnostics. Only an invalid Resource Package candidate is rejected.

The Player-installed repository owns one immutable current snapshot per stable Resource Package ID rather than copying the same package into a System Package-scoped store. Explicit replacement changes that one current snapshot; Player keeps no same-ID version history. Switching the Current System Package recomputes the routing view over the same installed snapshot. Explicit replacement or removal changes future resource choices across those views, but never changes Character Data values already written by a Player resource-selection interaction or existing Tabletop Instance Resource Copies.

Target references are opaque metadata outside Player. Creator App and Market validate, preserve, display, and optionally index their Contract shape but do not load the referenced System Packages or certify compatibility. GM Tabletop does not apply Player native-routing rules. A System Package's embedded official offline Resource Package must include a target matching that owning System Package ID and `MAJOR`, but it may also declare other targets.

The target collection is canonicalized as an unordered set under the Resource Package Contract so presentation order cannot change the Snapshot Digest. Exact duplicate references are invalid. Adding a new target expands native-routing capability and requires at least a Resource Package `MINOR`; removing a target, changing a target System Package ID, or changing its `MAJOR` can remove an existing native route and requires `MAJOR`; changing only `MINOR` or `PATCH` within an otherwise matching target requires at least `PATCH`.

This decision supersedes ADR-0016 in full; the singular-reference wording of ADR-0014; the target-gating portion of ADR-0015; the single-target and Player-install-gate portions of ADR-0017; the target-gating acceptance of ADR-0020; and the Target System Package SemVer classification portion of ADR-0038. Their remaining Market scope, Player migration, rule-semantics, cross-domain-slice, identity, ownership, and snapshot decisions remain accepted.

## Consequences

- A generic package such as a reusable weapon collection can be installed under any Current System Package and appears in Other Resources unless the current system is explicitly named and its Resource Compatibility accepts the relevant Template.
- A package explicitly targeting systems A and B remains installable while system C is current; it appears in C's Other Resources rather than being rejected.
- System Package Authors can expose Other Resources through declared Player resource-library Modules and Dependency rules. Player initiates the selection; the Player framework executes the declaration without interpreting weapon, damage, health, or other game semantics.
- Resource Package Contract fixtures cover empty, single, and multiple target collections; any-target matching; no-match fallback; deterministic ordering; duplicate references; and structural SemVer classification.
- Creator uses a simple optional target list rather than a compatibility matrix or automatic inference. Market target filters are discovery metadata only.
- Player no longer needs a target mismatch error mode. Contract, Template Schema, relation, media, and archive failures remain installation errors.
