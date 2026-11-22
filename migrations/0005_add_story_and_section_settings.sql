-- Migration 0005: "My story" (where I grew up) and a section-settings table that can hold new sections.
-- Additive only. Nothing is deleted.
--
-- * homepage_story: a short personal story, shown on the About page and in a pop-up when a visitor
--   taps the location. Placeholder is inserted as a DRAFT only.
-- * homepage_section_settings replaces homepage_sections, whose CHECK constraint only allowed the
--   original six keys. Rows are copied over; homepage_sections stays in the database, unused.
--   Allowed keys are enforced by the app (shared/homepage.ts), so future sections need no rebuild.

CREATE TABLE IF NOT EXISTS homepage_story (
  state       TEXT NOT NULL PRIMARY KEY CHECK (state IN ('draft', 'published')),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO homepage_story (state, title, body) VALUES (
  'draft',
  'Where I grew up',
  'Placeholder: a few sentences about growing up in the San Gabriel Valley, what this place means to you, and how it shows up in the way you shoot.'
);

CREATE TABLE IF NOT EXISTS homepage_section_settings (
  state        TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  section_key  TEXT    NOT NULL CHECK (length(section_key) BETWEEN 1 AND 32),
  is_visible   INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (state, section_key)
);

INSERT OR IGNORE INTO homepage_section_settings (state, section_key, is_visible, sort_order)
SELECT state, section_key, is_visible, sort_order FROM homepage_sections;

-- Place "My story" right after About, in every copy (draft / published) that exists.
-- Ties on sort_order are broken by section_key ('intro' < 'story') until the next save renumbers.
INSERT OR IGNORE INTO homepage_section_settings (state, section_key, is_visible, sort_order)
SELECT state, 'story', 1, sort_order FROM homepage_section_settings WHERE section_key = 'intro';
