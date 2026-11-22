-- Migration 0002: homepage sections with draft / publish.
-- Additive only: new tables, no changes to existing ones.
--
-- Every homepage table stores two copies of its content, told apart by `state`:
--   'draft'      what the admin editor saves and previews
--   'published'  what the public site shows
-- Publishing copies draft rows over published rows in one atomic batch (worker/lib/homepage.ts).
-- The public API reads only 'published' rows, so unpublished edits never reach visitors.
--
-- This migration inserts PLACEHOLDER content as drafts only. Nothing is published, so applying
-- it to any database (including production) changes nothing visitors can see until the owner
-- presses Publish in the dashboard.

-- Intro / about: headline, short intro, longer bio, professional background, interests.
CREATE TABLE IF NOT EXISTS homepage_intro (
  state       TEXT NOT NULL PRIMARY KEY CHECK (state IN ('draft', 'published')),
  headline    TEXT NOT NULL DEFAULT '',
  intro       TEXT NOT NULL DEFAULT '',
  about       TEXT NOT NULL DEFAULT '',
  background  TEXT NOT NULL DEFAULT '',
  interests   TEXT NOT NULL DEFAULT '[]',   -- JSON array of short strings
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contact and professional links. LinkedIn is an external link only (no API).
-- The resume is a link (e.g. a Google Drive file); nothing is uploaded.
CREATE TABLE IF NOT EXISTS homepage_contact (
  state                  TEXT    NOT NULL PRIMARY KEY CHECK (state IN ('draft', 'published')),
  email                  TEXT    NOT NULL DEFAULT '',
  phone                  TEXT    NOT NULL DEFAULT '',
  location               TEXT    NOT NULL DEFAULT '',
  linkedin_url           TEXT    NOT NULL DEFAULT '',
  resume_url             TEXT    NOT NULL DEFAULT '',
  portfolio_url          TEXT    NOT NULL DEFAULT '',
  portfolio_coming_soon  INTEGER NOT NULL DEFAULT 1 CHECK (portfolio_coming_soon IN (0, 1)),
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS homepage_skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  state       TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  label       TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_homepage_skills_state ON homepage_skills (state, sort_order, id);

CREATE TABLE IF NOT EXISTS homepage_experience (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  state         TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  role          TEXT    NOT NULL,
  organization  TEXT    NOT NULL DEFAULT '',
  period        TEXT    NOT NULL DEFAULT '',   -- free text, e.g. '2021 – now'
  description   TEXT    NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_homepage_experience_state ON homepage_experience (state, sort_order, id);

-- "Open to" categories: employment, collaborations, freelance, and so on.
CREATE TABLE IF NOT EXISTS homepage_opportunities (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  state        TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_homepage_opportunities_state ON homepage_opportunities (state, sort_order, id);

-- Which sections show, and in what order. 'testimonials' is a placeholder slot (no content yet).
CREATE TABLE IF NOT EXISTS homepage_sections (
  state        TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  section_key  TEXT    NOT NULL CHECK (section_key IN ('intro', 'experience', 'skills', 'opportunities', 'contact', 'testimonials')),
  is_visible   INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (state, section_key)
);

-- ---------------------------------------------------------------------------
-- Placeholder drafts (not published). Replace them in the dashboard.
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO homepage_intro (state, headline, intro, about, background, interests) VALUES (
  'draft',
  'Photographer and videographer in Pasadena',
  'Hi! I photograph and film people, places, and the moments in between.',
  'I''m a photographer and videographer based in the San Gabriel Valley. I love working with people who care about the details, and I try to make every shoot feel relaxed and fun. (Placeholder: write this in your own words.)',
  'I started out shooting for friends and local businesses, and grew that into client work across events, brands, and personal projects. (Placeholder: add your story.)',
  '["Portraits","Short films","Live events","Street photography","Colour grading"]'
);

INSERT OR IGNORE INTO homepage_contact (state, email, phone, location, linkedin_url, resume_url, portfolio_url, portfolio_coming_soon) VALUES (
  'draft', 'hello@example.com', '', 'Pasadena, CA', 'https://www.linkedin.com/', '', 'https://example.com/portfolio', 1
);

-- Migrations run exactly once, so plain inserts are safe here.
INSERT INTO homepage_skills (state, label, sort_order) VALUES
  ('draft', 'Photography', 0),
  ('draft', 'Videography', 1),
  ('draft', 'Editing', 2),
  ('draft', 'Colour grading', 3),
  ('draft', 'Lighting', 4),
  ('draft', 'Storytelling', 5);

INSERT INTO homepage_experience (state, role, organization, period, description, sort_order) VALUES
  ('draft', 'Photographer and videographer', 'Flicks by Miao', '2020 – now',
   'I run my own studio, shooting portraits, events, and short films for clients. (Placeholder)', 0),
  ('draft', 'Your next role', 'Organisation', 'Year – Year',
   'A line about what you did and what you are proud of. (Placeholder)', 1);

INSERT INTO homepage_opportunities (state, title, description, sort_order) VALUES
  ('draft', 'Employment', 'Full-time or part-time roles where I can keep growing.', 0),
  ('draft', 'Collaborations', 'Creative projects with other artists and makers.', 1),
  ('draft', 'Networking', 'Coffee, calls, and good conversations.', 2),
  ('draft', 'Freelance', 'Photo and video for your event, brand, or project.', 3),
  ('draft', 'Business', 'Partnerships that make sense for both of us.', 4),
  ('draft', 'Creative partnerships', 'Long-term work with people who share a vision.', 5);

INSERT OR IGNORE INTO homepage_sections (state, section_key, is_visible, sort_order) VALUES
  ('draft', 'intro', 1, 0),
  ('draft', 'experience', 1, 1),
  ('draft', 'skills', 1, 2),
  ('draft', 'opportunities', 1, 3),
  ('draft', 'contact', 1, 4),
  ('draft', 'testimonials', 1, 5);
