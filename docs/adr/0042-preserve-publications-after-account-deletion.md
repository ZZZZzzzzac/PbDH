# Preserve Publications after Account Deletion

Status: accepted

Deleting a PbDH Account and withdrawing a published Resource Package are separate lifecycle actions. Account deletion removes authentication, personal profile data, and private domain data according to their retention policies, but it does not cascade into Market Publications. Each surviving publication becomes a read-only artifact attributed to a deleted account. Its stable link, downloadable snapshot, and required public media remain available.

This treats Market publication as publishing a book rather than exposing a live view of the Creator Workspace. Consumers must not lose a public release because its author later leaves the platform. No deleted principal remains able to update the Resource Package ID, and the platform does not silently assign it to another account.

Public media referenced only by these surviving publications becomes Platform-custodied. The physical blob is still shared by content hash and is not copied. It no longer counts against a deleted account's quota, while private-only assets and private documents continue through the account-deletion cleanup path.

Unpublish, moderation takedown, and copyright removal remain explicit publication actions with their own audit and access effects. None can recall Resource Package snapshots or media bytes already downloaded to consumer devices.

## Consequences

- Account deletion cannot be implemented as a blind cascade over every record formerly owned by the Account ID.
- Market retains a non-personal ownership tombstone sufficient to keep the publication immutable and prevent ID takeover.
- Stable Market links and downloads continue to work for publications whose authors have deleted their accounts.
- Existing Player and GM local snapshots remain usable regardless of later account, publication, or moderation state.
- Ownership transfer, if introduced later, must be explicit and audited; deletion alone never transfers publishing authority.
