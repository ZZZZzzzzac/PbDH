# Separate Stable Artifact Identity from Version and Ownership

Status: accepted

Stable IDs answer whether two artifacts are the same logical thing; SemVer and snapshots answer which content version is being used; ownership answers who may publish or govern it. PbDH keeps these concerns separate.

System Package IDs and Resource Package IDs are globally unique and remain stable across their versions. Resource IDs are stable only inside their owning Resource Package and need not be globally unique. Any reference that crosses a package boundary therefore uses the pair `(Resource Package ID, Resource ID)`, called a Game Resource Reference.

Resource Template IDs and Resource Conversion Adapter IDs are assigned by the Platform Administrator because their implementations enter the trusted App release boundary. Ownership is stored as a separate relationship rather than encoded into an ID, username, or other mutable account attribute.

When Market first accepts a Resource Package ID, it binds that ID to the publishing Account ID. Only that owner, or a future owner established through an explicit transfer mechanism, may publish another Market snapshot under the same ID. Copying or adapting another package is a Fork and must receive a new Resource Package ID; preserving package-scoped Resource IDs inside the Fork is allowed because the new package identity keeps references distinct.

## Consequences

- Renaming an account or transferring ownership does not change artifact IDs or break references.
- Two packages may contain the same Resource ID without collision. Character Saves and provenance records must never persist a bare Resource ID.
- Releasing a new version keeps the same package ID; creating a Fork uses a new package ID.
- Market rejects attempts to publish an already-bound Resource Package ID from another account instead of treating them as updates.
- Explicit local file import may still replace a local package with the same ID because the user selected that file; Market ownership guarantees do not imply that offline files are platform-authenticated.
- Exact identifier encoding and generation algorithms may be chosen with the Contract Schema, but they must support offline creation without requiring a live Market reservation.
