# Keep Assets Private until Market Publication

Status: accepted

Every Managed Media Asset is private by default. Reading it requires authorization through a private domain reference owned by the current PbDH Account, such as a Creator Workspace, GM tabletop document, or Character Save. A content hash is an identity and deduplication mechanism, not an access credential; possession or discovery of an Asset ID must not bypass authorization.

Publishing a Game Resource through Market creates a public publication reference to the same physical asset blob. It does not copy, re-encode, or re-upload the bytes. Public Market delivery can use long-lived public caching because the normalized content is immutable and addressed by hash. Private and public references remain separate records even when they resolve to the same physical blob.

When a user validly acquires a published resource and commits it into a durable Cloud Document, every referenced asset receives a document-bound private read reference. This reference is non-owning, does not count against the consumer's media quota, and is not an installation-history record. It exists so the document remains complete on a new device. Later withdrawal, moderation, copyright removal, author deletion, or any other loss of the Publication's public reference stops new public acquisition but cannot revoke the asset from an already valid private document—like withdrawing a book from sale cannot take away readers' existing copies.

This protects unpublished Creator material and private play data without paying duplicate image storage for Market publication. It also keeps visibility policy outside Resource and Workspace documents: those documents reference Asset IDs, while Backend authorization decides which private or public reference permits a read.

## Consequences

- The current Cards unauthenticated `/api/assets/{assetId}` behavior and unconditional `Cache-Control: public` cannot be reused for private assets.
- Private asset responses require account and domain authorization and must not be publicly cacheable.
- Market publication adds public references only when the Resource Package Snapshot, search index and Publication record commit successfully. A failed publication must not expose private assets or partial search results.
- Account deletion does not remove public references held by surviving read-only Market Publications. Those references become Platform-custodied rather than account-owned.
- Removing or withdrawing a Market publication removes its public Platform reference. The physical blob remains while any private or public reference is live.
- A valid Character Save, Creator Workspace, or GM Tabletop Document that acquired an asset while public keeps its document-bound private read reference after the Publication loses public availability. Existing local and cloud copies remain readable and recoverable across devices.
- A document-bound private read reference does not transfer media ownership, create consumer quota usage, permit unrelated documents to acquire the asset, or require Market to retain consumer installation history.
- Permanently deleting the document, or allowing its recycle-bin retention to expire, releases its document-bound references. Blob garbage collection still requires that no other private or public reference remains.
- Previously public bytes may remain in browser, proxy, or CDN caches after withdrawal. PbDH can stop new authorized delivery but cannot guarantee recall of content already delivered publicly.
- Garbage collection may delete a physical blob only after no private or public reference remains and the retention policy permits deletion.
- Self-contained Resource Package export is a transport operation: it reads authorized normalized blobs into the archive once per Asset ID. It does not make the Backend copy those blobs or turn private Asset IDs into public URLs.
