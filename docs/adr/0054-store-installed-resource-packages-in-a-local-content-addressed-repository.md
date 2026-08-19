# Store Installed Resource Packages in a Local Content-addressed Repository

Status: accepted

Player App stores installed Resource Packages in a new PbDH-owned IndexedDB database through a Repository interface. The repository stores each complete logical Resource Package document by Package ID and stores normalized media bytes once by Asset ID. It does not reuse or extend the legacy `pbdh-sheet` database schema; legacy compatibility is a separate explicit migration concern.

Installing or updating a package writes the package document and all required media in one Dexie transaction. The repository replaces an existing Package ID only after validation and explicit user confirmation. A failed transaction leaves the previous snapshot intact. Media no longer referenced by any installed package is removed after replacement, while media shared by another package remains available.

Compatibility routes are derived from the installed document and the current System Package whenever the library is loaded or the current system changes. They are not persisted as a second authority. Package version, Snapshot Digest, license and source remain part of the installed record or its logical document; user-facing screens do not expose internal IDs or Digest unless technical details are requested.

## Consequences

- The initial database schema owns `installedResourcePackages` and `resourceMedia`; later Character Save, Creator Workspace and GM Tabletop persistence can add independently owned stores without placing their payloads inside Resource Packages.
- A complete installed package remains usable without Market, Creator, remote media or network access.
- Multiple packages referencing the same Asset ID share one local media record.
- Removing or updating a package performs reference-aware media cleanup in the same transaction.
- The application layer depends on a Resource Package Repository interface rather than Dexie directly.
