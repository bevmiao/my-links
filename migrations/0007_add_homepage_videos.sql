-- Migration 0007: YouTube videos on the Work page.
-- Additive only. Nothing is deleted or changed.
--
-- Only the 11-character YouTube video ID and a title are stored (no uploads, no URLs).
-- Like the other lists, the table holds a 'draft' and a 'published' copy. No placeholder rows:
-- the "Videos" section starts hidden until the owner adds videos and turns it on.

CREATE TABLE IF NOT EXISTS homepage_videos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  state       TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  video_id    TEXT    NOT NULL CHECK (length(video_id) = 11),
  title       TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_homepage_videos_state ON homepage_videos (state, sort_order, id);
