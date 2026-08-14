# Keep Assets Private until Market Publication

Status: accepted

Every Managed Media Asset is private by default. Reading it requires authorization through a private domain reference owned by the current PbDH Account, such as a Creator Workspace, GM tabletop document, or Character Save. A content hash is an identity and deduplication mechanism, not an access credential; possession or discovery of an Asset ID must not bypass authorization.

Publishing a Game Resource through Market creates a public publication reference to the same physical asset blob. It does not copy, re-encode, or re-upload the bytes. Public Market delivery can use long-lived public caching because the normalized content is immutable and addressed by hash. Private and public references remain separate records even when they resolve to the same physical blob.

This protects unpublished Creator material and private play data without paying duplicate image storage for Market publication. It also keeps visibility policy outside Resource and Workspace documents: those documents reference Asset IDs, while Backend authorization decides which private or public reference permits a read.

## Consequences

- The current Cards unauthenticated `/api/assets/{assetId}` behavior and unconditional `Cache-Control: public` cannot be reused for private assets.
- Private asset responses require account and domain authorization and must not be publicly cacheable.
- Market publication adds public references only after publication succeeds. A failed publication must not expose private assets.
- Account deletion does not remove public references held by surviving read-only Market Publications. Those references become Platform-custodied rather than account-owned.
- Removing or withdrawing a Market publication removes its public Platform reference. The physical blob remains while any private or public reference is live.
- Previously public bytes may remain in browser, proxy, or CDN caches after withdrawal. PbDH can stop new authorized delivery but cannot guarantee recall of content already delivered publicly.
- Garbage collection may delete a physical blob only after no private or public reference remains and the retention policy permits deletion.
- Self-contained Resource Package export is a transport operation: it reads authorized normalized blobs into the archive once per Asset ID. It does not make the Backend copy those blobs or turn private Asset IDs into public URLs.
