# Count Owned Media, Not JSON, against Account Quota

Status: accepted

PbDH Account storage quota exists to limit user-controlled image storage. Only Managed Media Asset bytes owned by the account count toward the displayed account quota. Pure structured JSON for Creator Workspaces, GM tabletop documents, Character Saves, and their recycle-bin records does not consume that user quota.

For one account, each distinct normalized WebP is charged once by byte size regardless of how many cards, resources, documents, or publications reference its Asset ID. If two accounts independently own references to identical content-addressed bytes, each account is charged once even if the Backend physically deduplicates the blob. Installing another creator's Market resource does not create asset ownership, a cloud copy, or quota usage for the installer.

A Market publication remains an owning reference for its creator while that account exists. Publishing an asset therefore does not free the creator's quota, and withdrawing a publication does not free quota while another private or public owning reference remains. This prevents publication from becoming a way to store unlimited media outside account limits. If the account is deleted while the publication survives as read-only, its public reference becomes Platform-custodied and no longer belongs to or consumes quota for the deleted account.

## Consequences

- The current Cards workspace JSON byte quota is not retained as the user-facing storage model; media ownership and reference accounting must replace it.
- Upload and retry are idempotent. Reusing an Asset ID already owned by the account adds no usage, while acquiring ownership of new normalized bytes must pass an atomic quota check.
- Document APIs still enforce technical payload, collection, and validation limits against abuse or accidental huge JSON. Those hard limits are not account storage usage and are not shown as consumed quota.
- Quota failures block acquiring new cloud media but never block local editing or file export. Existing documents and asset references remain usable.
- Media retained through the 30-day cloud recycle bin continues to consume quota. Permanent deletion or recycle-bin expiry releases the account reference; an unreferenced blob can then be garbage-collected.
- Media usage is account-wide across Player, Creator, GM, and Market ownership rather than divided into separate App allowances.
- The numeric free quota and any paid tiers remain configuration and product-policy decisions, not contract constants.
