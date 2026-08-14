# Make Resource Package Files Self-contained

Status: accepted

A Resource Package logical document is pure structured data containing Asset ID references. When explicitly exported or imported as a file, its Portable Archive is a self-contained snapshot carrying that document and the normalized WebP bytes for every referenced Asset ID, with each unique blob included at most once. A valid archive cannot require a remote image URL, Market availability, or the original Creator account in order to render after installation.

Self-contained file transport does not change runtime, App-to-App, or cloud representation. Game Resources still reference Asset IDs rather than embedding bytes. Online APIs transfer logical documents separately from media; Market Backend and local clients store immutable blobs in content-addressed stores and deduplicate them by Asset ID. Exporting bytes into a Portable Archive is not another cloud upload or another physical Backend copy.

Import validates the Contract, resources, declared Asset IDs, media types, hashes, and archive safety before committing the new local package snapshot. Market installation follows the same completeness boundary. A failed or incomplete transfer leaves the previous installed snapshot intact.

## Consequences

- Installed Resource Packages remain usable offline after Creator deletion, publication withdrawal, Market outage, or remote cache loss.
- Third-party remote image URLs must be fetched, normalized, and admitted as media candidates before a PbDH Resource Package can be created. Failure is explicit conversion loss, not a hidden online dependency.
- Local storage deduplicates the same normalized image across resources and packages even though each separately exported archive must carry the bytes needed for its own portability.
- Archive path traversal, duplicate normalized paths, entry count, compressed and expanded byte limits, media dimensions, media hashes, and atomic import require contract fixtures and security tests.
- Lazy Market browsing may use remote thumbnails, but an installation cannot be declared complete until its required package snapshot and media are locally available.
