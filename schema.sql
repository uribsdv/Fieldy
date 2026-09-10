-- Fieldy D1 schema. Safe to run against an existing database: every
-- statement is CREATE TABLE IF NOT EXISTS, so the three original tables are
-- left untouched and only the two push tables are added.
--
--   wrangler d1 execute <database_name> --remote --file schema.sql
--
-- (or paste into the D1 console in the Cloudflare dashboard).

-- One-row snapshot of the app state (id = 'default').
CREATE TABLE IF NOT EXISTS app_state (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT
);

-- Append-only event log (site_created, task_completed, mood_logged, ...).
CREATE TABLE IF NOT EXISTS history (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      TEXT NOT NULL,
  type    TEXT NOT NULL,
  payload TEXT
);

-- Latest daily insights (id = 'latest').
CREATE TABLE IF NOT EXISTS insights (
  id           TEXT PRIMARY KEY,
  data         TEXT NOT NULL,
  generated_at TEXT
);

-- Web Push: one row per phone/browser that enabled notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  device     TEXT,
  created_at TEXT,
  last_ok_at TEXT,
  failures   INTEGER DEFAULT 0
);

-- Web Push: dedupe of reminders already sent (key = what + when), pruned
-- after 30 days by the Worker itself.
CREATE TABLE IF NOT EXISTS push_sent (
  key     TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
