CREATE TABLE IF NOT EXISTS local_auth_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  code_normalized TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_local_auth_invites_code_normalized
ON local_auth_invites (code_normalized);
