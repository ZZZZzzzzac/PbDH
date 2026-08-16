# Version Character Saves as an Independent Contract Family

Status: accepted

Character Saves cross durable boundaries independently of both System Packages and Backend APIs: they are stored locally, exported as files, synchronized as private cloud documents, and reopened by later Player App versions. PbDH therefore makes Character Save the fifth independently versioned Contract Family alongside Resource Package, System Package, Tabletop Document, and Backend API.

The Character Save Contract governs the platform-owned envelope: its own Contract version, stable save identity, System Package ID and recorded version, and the contained Character Data payload. Per ADR-0052, resource-backed character fields are already materialized inside that payload and the envelope carries no Game Resource References or Resource Package dependency metadata for them. The target System Package continues to own the schema and semantics of the payload. Transporting the save through Backend API does not make the API Contract its data format, and changing a System Package does not implicitly change the Character Save envelope Contract.

## Consequences

- Character Save Contract and System Package Contract evolve independently and declare their own supported versions.
- Opening a save validates the envelope first, then resolves and validates its Character Data against the referenced System Package and its projection or migration rules.
- Backend sync endpoints transport Character Save documents without becoming their schema authority.
- File import/export and cloud synchronization use the same Character Save Contract instead of defining parallel formats.
- Third-party character formats require an explicit conversion boundary before they can become Character Saves; Adapter ownership and trust are decided separately.
