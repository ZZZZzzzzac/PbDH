CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    auth_subject TEXT NOT NULL UNIQUE,
    username TEXT,
    username_key TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE active_sessions (
    session_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL UNIQUE,
    claimed_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_accounts_username_key
ON accounts(username_key)
WHERE deleted_at IS NULL;
