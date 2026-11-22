-- Migration 0004: simpler, less resume-like homepage.
-- Additive only. Nothing is deleted.
--
-- * New table for the one-sentence "what I'm up for" line, which replaces the opportunity cards.
--   (homepage_opportunities and homepage_experience stay in the database but are no longer used.)
-- * Placeholder copy is refreshed ONLY in drafts that still contain the original pass-1 placeholder
--   text, so anything the owner has written is never overwritten. Published rows are not touched.

CREATE TABLE IF NOT EXISTS homepage_open_to (
  state       TEXT NOT NULL PRIMARY KEY CHECK (state IN ('draft', 'published')),
  sentence    TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO homepage_open_to (state, sentence) VALUES
  ('draft', 'Always up for freelance shoots, collabs, or just a coffee. Say hi!');

UPDATE homepage_intro
SET about = 'I shoot photos and video around Pasadena and the San Gabriel Valley. Mostly people, events, and the little in-between moments that are easy to miss. If you have something in mind, I''d love to hear about it.',
    updated_at = datetime('now')
WHERE state = 'draft'
  AND about = 'I''m a photographer and videographer based in the San Gabriel Valley. I love working with people who care about the details, and I try to make every shoot feel relaxed and fun. (Placeholder: write this in your own words.)';
