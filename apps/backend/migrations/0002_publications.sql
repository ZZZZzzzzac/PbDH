CREATE TABLE package_ownership (
    package_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT
);

CREATE TABLE publications (
    publication_id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL UNIQUE,
    contract_version TEXT NOT NULL,
    package_version TEXT NOT NULL,
    snapshot_digest TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    language TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    cover_asset_id TEXT NOT NULL,
    logical_document_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (package_id) REFERENCES package_ownership(package_id) ON DELETE RESTRICT
);

CREATE TABLE publication_resources (
    publication_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    path TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version TEXT NOT NULL,
    search_text TEXT NOT NULL,
    PRIMARY KEY (publication_id, resource_id),
    FOREIGN KEY (publication_id) REFERENCES publications(publication_id) ON DELETE CASCADE
);

CREATE TABLE media_blobs (
    asset_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL,
    byte_length INTEGER NOT NULL,
    bytes BLOB NOT NULL
);

CREATE TABLE publication_media (
    publication_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    PRIMARY KEY (publication_id, asset_id),
    FOREIGN KEY (publication_id) REFERENCES publications(publication_id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES media_blobs(asset_id) ON DELETE RESTRICT
);

CREATE INDEX idx_publications_updated_at
ON publications(updated_at DESC, publication_id);

CREATE INDEX idx_publication_resources_search
ON publication_resources(search_text);
