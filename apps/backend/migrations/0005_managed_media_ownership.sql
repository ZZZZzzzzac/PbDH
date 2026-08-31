CREATE TABLE account_media_ownership (
    account_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    acquired_at TEXT NOT NULL,
    PRIMARY KEY (account_id, asset_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (asset_id) REFERENCES media_blobs(asset_id) ON DELETE RESTRICT
);

ALTER TABLE cloud_document_media
ADD COLUMN owns_asset INTEGER NOT NULL DEFAULT 1 CHECK (owns_asset IN (0, 1));

INSERT OR IGNORE INTO account_media_ownership(account_id, asset_id, acquired_at)
SELECT DISTINCT d.account_id, m.asset_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM cloud_document_media m
JOIN cloud_documents d ON d.document_id = m.document_id;

INSERT OR IGNORE INTO account_media_ownership(account_id, asset_id, acquired_at)
SELECT DISTINCT o.account_id, m.asset_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM publication_media m
JOIN publications p ON p.publication_id = m.publication_id
JOIN package_ownership o ON o.package_id = p.package_id;

CREATE INDEX account_media_ownership_asset_idx
ON account_media_ownership(asset_id);
