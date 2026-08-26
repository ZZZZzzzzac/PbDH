CREATE TABLE cloud_documents (
    document_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    document_kind TEXT NOT NULL CHECK (
        document_kind IN ('creator-workspace', 'gm-tabletop-document', 'character-save')
    ),
    contract_family TEXT NOT NULL,
    contract_version TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    purge_after TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT
);

CREATE TABLE cloud_document_media (
    document_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    PRIMARY KEY (document_id, asset_id),
    FOREIGN KEY (document_id) REFERENCES cloud_documents(document_id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES media_blobs(asset_id) ON DELETE RESTRICT
);

CREATE TABLE cloud_document_mutations (
    account_id TEXT NOT NULL,
    mutation_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (account_id, mutation_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (document_id) REFERENCES cloud_documents(document_id) ON DELETE CASCADE
);

CREATE INDEX idx_cloud_documents_owner_kind_updated
ON cloud_documents(account_id, document_kind, updated_at DESC, document_id);

CREATE INDEX idx_cloud_documents_recycle_bin
ON cloud_documents(account_id, purge_after)
WHERE deleted_at IS NOT NULL;
