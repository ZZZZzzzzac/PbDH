# Give Every Tabletop Instance an Independent Resource Copy

Status: accepted

Every placement of a Game Resource creates a new Tabletop Instance with its own Tabletop Instance Resource Copy; instances never share a mutable or immutable resource-definition record. This supersedes ADR-0037's shared immutable Tabletop Resource Snapshot because a GM's common operation is to change one enemy's difficulty, damage, thresholds, or other definition fields without affecting another instance created from the same resource.

The copy records its source Game Resource Reference for provenance, exact Template version, structured data, labels, and Managed Media Asset references. A GM may mutate structured data accepted by that exact Template, while runtime health, stress, status, notes, position, and layer remain instance-owned state. Neither kind of mutation writes back into the source Game Resource or another instance.

Each instance copy is persisted, synchronized, migrated, validated, and exported as part of its Tabletop Document. Media bytes remain deduplicated behind Asset IDs, so copying definition JSON does not duplicate images. Player App uses the same document model but may withhold definition-edit commands through its Tabletop Capability Set.

Resource Renderer still receives the exact Template and structured resource input and remains the only producer of the Canonical Card Surface. Editing an instance copy may change displayed values, but cannot replace the Template's field mapping, internal layout, styles, interaction semantics, or Renderer Revision.
