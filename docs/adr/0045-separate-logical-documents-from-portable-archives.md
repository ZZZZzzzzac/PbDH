# Separate Logical Documents from Portable Archives

Status: accepted

Resource Package and Tabletop Document each have a pure-data logical document and a self-contained file Profile called a Portable Archive. Logical documents contain structured state and Asset ID references only. They are used inside Apps, local document stores, Backend APIs, Market records, and Cloud Sync payloads. Media bytes travel through the separate Managed Media Asset pipeline and live in content-addressed stores.

A Portable Archive is used only for explicit file export and import. It wraps one logical document together with every normalized media blob that document needs, once per unique Asset ID. Import separates the document and blobs again, validates both, and writes them to their proper domain and asset stores. The archive is a Profile of its existing Contract Family, not a sixth Contract Family or a runtime aggregate.

Resource Package Portable Archives make installed resources transferable and offline-complete. Tabletop Document Portable Archives similarly preserve every instance's private resource copy, runtime state, and required media without embedding those bytes into ordinary table documents or cloud JSON. Character Saves retain their separate policy and do not acquire Resource Package definitions or media through this decision.

## Consequences

- App-to-App and App-to-Backend payloads remain small, deduplicated pure data even when file exports are self-contained.
- Resource Package and Tabletop Document file Profiles define their own archive manifest and safety validation under their existing Contract Family versions.
- Local and cloud media bytes are uploaded, fetched, cached, retained, and garbage-collected independently from document JSON.
- Export writes each referenced blob once; repeated resources or instances do not multiply archive media.
- Import is incomplete until the document and all required blobs pass validation, after which commit is atomic.
