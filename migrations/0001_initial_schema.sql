-- Migration 0001: core schema for the link-in-bio site.
-- Apply with: npm run db:migrate:local   (or db:migrate:remote for production)

-- Single-owner site: exactly one profile row (id = 1).
CREATE TABLE IF NOT EXISTS profiles (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  username         TEXT    NOT NULL,
  display_name     TEXT    NOT NULL,
  bio              TEXT    NOT NULL DEFAULT '',
  avatar_key       TEXT,             -- R2 object key, e.g. avatar/<uuid>.webp
  background_key   TEXT,             -- R2 object key, e.g. background/<uuid>.jpg
  theme_mode       TEXT    NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'system')),
  accent_color     TEXT    NOT NULL DEFAULT '#6366f1',
  background_light TEXT    NOT NULL DEFAULT '#fafafa',
  background_dark  TEXT    NOT NULL DEFAULT '#09090b',
  button_style     TEXT    NOT NULL DEFAULT 'rounded' CHECK (button_style IN ('rounded', 'pill', 'square')),
  socials          TEXT    NOT NULL DEFAULT '[]',  -- JSON array of { platform, url }
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A minimal placeholder so the site renders before you customise it.
INSERT OR IGNORE INTO profiles (id, username, display_name, bio)
VALUES (1, 'yourname', 'Your Name', 'Edit your profile in the dashboard.');

CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  icon        TEXT    NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_links_order ON links (sort_order, id);

-- Raw, privacy-friendly events: no IP addresses or full user agents are stored.
CREATE TABLE IF NOT EXISTS analytics_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL CHECK (type IN ('view', 'click')),
  link_id    INTEGER REFERENCES links (id) ON DELETE SET NULL,
  referrer   TEXT,             -- referring hostname only (views)
  country    TEXT,             -- ISO country code from Cloudflare (request.cf.country)
  device     TEXT,             -- 'mobile' | 'tablet' | 'desktop'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))  -- UTC, 'YYYY-MM-DD HH:MM:SS'
);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON analytics_events (type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_link_time ON analytics_events (link_id, created_at);
