# Use One Platform Recycle Bin for Local and Cloud Documents

Status: accepted

PbDH presents one Platform recycle bin for Character Saves, Creator Workspaces, and GM Tabletop Documents. The recycle bin aggregates two storage locations without merging their ownership: local-only documents remain in IndexedDB, while synchronized documents use the existing Cloud Document Service recycle bin. Every first delete is recoverable, every item identifies its document type and storage location, and both locations retain deleted content for 30 days before permanent deletion.

`packages/local-storage` owns the generic local lifecycle fields and operations: trash, list, restore, permanent delete, expired-item purge, and orphaned-media cleanup. Domain repositories continue to validate and reconstruct their own payloads. `packages/platform-ui` owns the shared presentation and a small trash-source interface; Player and Creator composition roots adapt their domain repositories and cloud services to that interface. The shared UI does not read IndexedDB, cloud APIs, or domain payloads directly.

Signing in does not move local trash to the cloud and does not upload any pre-existing local document. A document marked for cloud sync but without a confirmed cloud revision still exists only locally: a failed first upload must not block deletion, and the document enters local trash instead of being uploaded merely so it can be deleted. Restoring a cloud document must not overwrite a local-only active or trashed document with the same ID. Restoring a local document preserves its stable ID. Permanent deletion requires an item already in the recycle bin and releases media only when no remaining local document references it.

The former `gm-tabletop-document-trash` document kind is migrated into the generic local document lifecycle. This supersedes product-specific recycle-bin entries and direct permanent deletion of local Character Saves or Creator Workspaces, while retaining ADR-0049's Cloud Document Service, explicit local-to-cloud migration, revision, conflict, and 30-day cloud retention rules.

## Consequences

- The Platform App Bar exposes the recycle bin independently from the account menu, so local trash remains available while signed out.
- Domain apps register adapters that list and act on their own document kinds; the Platform UI labels items as local or cloud and never interprets their payload.
- Active document repository reads exclude trashed records. Autosave cannot silently revive a trashed document; restoration is explicit.
- Expired local trash is purged when the recycle bin is read. Cloud expiry remains enforced by the backend.
- Installed System Packages, installed Resource Packages, Market Publications, and deletion of nodes inside a document are outside this recycle bin.
