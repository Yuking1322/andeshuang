CREATE TABLE IF NOT EXISTS local_auth_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  registration_mode TEXT NOT NULL,
  registration_limit INTEGER,
  invite_codes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
