# Map Source DTOs Directly to Template Candidates

Status: accepted

Each Resource Conversion Adapter parses untrusted input into a short-lived source-specific DTO, then maps that DTO directly to one or more Game Resource Candidates using registered Template IDs/versions or Free Template. PbDH will not introduce a universal intermediate model containing the union of every third-party format.

Conversion produces candidates, media candidates, and a session report only. Every source record reaches exactly one terminal status: converted, skipped, or failed. The report exposes normalization, defaults, splits, merges, flattening, unsupported records, media outcomes, and any other loss before the caller asks for confirmation.

## Consequences

- A Candidate receives final resource ID, ownership, Creator draft state, Resource Package membership, or Player installation state only after explicit caller confirmation.
- Source DTOs, raw archives, source IDs, source paths, hidden payloads, and complete reports are not persisted into Game Resources. Users may download the current report when needed.
- Adapter ID and exact SemVer version are recorded in the session report so identical input, options, Template Schemas, and Adapter version produce deterministic semantic candidates and report ordering.
- Improved mappings apply when the user reimports the original source through a newer Adapter. Existing Free Template or standard resources are never silently reconverted.
- Unsupported source types map to Free Template only when the Adapter declares an explicit visible-field mapping; otherwise they are skipped or failed with a stable reason.
- Partial batch success is allowed, but converted records preserve relative source order after skipped and failed records are removed.
- Resource and card conversion remains separate from Character Conversion, Workspace persistence, Resource Manager installation, Market publication, and Tabletop state.
