# Make the Resource Package Target System Optional

Status: accepted

Every first-version Resource Package may declare at most one Target System Package Reference containing one stable System Package ID and one exact SemVer version. The reference is optional because a Creator may author resources for a rule system that has no System Package yet, or for use outside Player App. Absence is represented explicitly by an omitted reference, not by a fake package ID or an empty ID/version. A package still cannot target several System Packages.

Only Player App gives this reference runtime compatibility meaning. During Resource Package import or update, Player first requires a declared target whose ID and SemVer `MAJOR` equal the Current System Package ID and `MAJOR`. A missing target, different ID, or different `MAJOR` is rejected in that Player import context. `MINOR` and `PATCH` differences do not reject the package. Player then evaluates the Current System Package's Resource Compatibility declarations against each Resource Template ID/version or explicit Template mapping.

## Consequences

- A package with no target, a different target ID, or a different target `MAJOR` is rejected by the current Player import context rather than installed globally or placed in Other Resources.
- A package with the same target ID and `MAJOR` proceeds even when `MINOR` or `PATCH` differs; individual unsupported, unknown, free-form, or unmapped Templates fall back to Other Resources.
- Player-installed resource storage remains scoped by the declared Target System Package Reference's stable ID, preserving the mature Sheet isolation model instead of creating one global cross-system catalog.
- Creator App does not load a System Package or require the optional reference. If a Creator supplies one, Creator validates only its Contract shape and preserves it as package metadata; the referenced System Package need not exist yet.
- GM App accepts any otherwise valid Resource Package regardless of rule tags, missing or declared target, target version, or Player Resource Compatibility.
- Market validates the optional reference's Contract shape when present, but does not require it, resolve the referenced System Package, or certify compatibility. Rule-system filters remain discovery metadata only.
- System Authoring is the other intentional match check: every official Resource Package embedded as a System Package's offline baseline must declare a target whose ID and `MAJOR` match that owning System Package. The build/validation workflow rejects an absent or mismatched target before the System Package can be released.
- When a target is declared, Player accepts any target version with the same ID and `MAJOR`, regardless of whether the target `MINOR`/`PATCH` is newer or older than the Current System Package.
- Absence of a target makes no wildcard or multi-system compatibility claim. Supporting one package against several Player System Packages or adding Player-side cross-system mapping requires a future explicit contract.
