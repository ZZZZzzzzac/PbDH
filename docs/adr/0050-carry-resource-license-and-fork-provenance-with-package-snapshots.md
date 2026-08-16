# Carry Resource License and Fork Provenance with Package Snapshots

Status: accepted

Every Resource Package Snapshot eligible for Market publication carries a Resource License consisting of an opaque label string plus a human-readable declaration string that remains readable after `.pbres` download. Its package-level Fork source field is required but nullable: `null` means that the package has no upstream Fork source; a non-null value identifies the source Publication, Package ID, exact version or system-derived Snapshot Digest, and copied Game Resource References. PbDH stores and displays these records but does not interpret, validate, or enforce their legal meaning and does not turn them into ownership, compatibility, authorization, UI capability, publication, or runtime dependencies.

A Fork can originate only from an explicit user action against an already published Market resource. That action creates a new Creator draft with a new Package ID and the selected Publication snapshot as its pending upstream source. The private draft is not itself a Market Fork relationship until the user explicitly publishes it. Ordinary file import, Workspace import or update, copying resources, conflict resolution, and saving a draft under a new Package ID never infer or create Fork provenance automatically.

Keeping license and provenance only in mutable Market listing text would lose the terms when a package moves offline and would let metadata edits silently change the meaning of an already acquired snapshot. Binding them to the immutable snapshot makes offline transfer auditable while still allowing a later higher package version to declare different terms prospectively.

## Consequences

- Creator publication preflight requires a structurally valid license label and declaration string plus an author affirmation that the content and media may be published. PbDH does not determine whether the declaration is legally sufficient or true.
- “Open in Creator to adapt”, Fork, private editing, `.pbres` export, Market publication, installation, and “send to tabletop” are never enabled or disabled by Resource License content. Users remain responsible for following the displayed declaration and applicable law.
- Publication preflight requires the Fork source field to exist. It must be `null` for no upstream or structurally complete for a Market-initiated Fork; Creator and Market never infer it from matching content, Package IDs, resource references, or import history.
- A source Publication lifecycle never cascades into a published Fork. A Fork suspected of infringement receives its own moderation or copyright action.
- First-version Resource Packages cannot depend on other Resource Packages at runtime; provenance is descriptive evidence, not a dependency graph.
