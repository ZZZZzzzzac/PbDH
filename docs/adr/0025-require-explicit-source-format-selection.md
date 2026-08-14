# Require Explicit Source Format Selection

Status: accepted

Every third-party resource conversion starts from an explicit Source Format selected by the user through a clearly labelled upload action such as “上传 dhsheet 格式” or “上传 ZZZ 格式”. Resource Conversion Core never runs cross-ecosystem detection, confidence scoring, or fallback. If the input does not satisfy the selected Adapter, conversion fails with that mismatch.

After a Source Format is fixed, its Adapter may distinguish supported containers and document subtypes such as JSON, ZIP, `.dhcb`, or a data-bearing image using signatures and validated structure. This is format-internal parsing, not source guessing.

## Consequences

- Player App and Creator App expose explicit format-labelled import entries and pass the selected stable format ID to the same Core API.
- A file valid for another format is not retried through that Adapter after the selected one rejects it.
- File extensions and declared MIME may help identify a container inside the selected format but never choose the Source Format.
- Adding a Source Format requires an explicit user-facing entry, Adapter registration, capability declaration, fixtures, and report vocabulary.
- Sheet's previous automatic competition among Resource Format Adapters is not retained for shared resource conversion.
- Character Format conversion remains Player-owned and is unaffected by this resource-conversion decision.
