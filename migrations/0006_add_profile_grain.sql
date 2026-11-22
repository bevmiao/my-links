-- Migration 0006: owner setting for the film grain on the public site.
-- Additive only. Existing profiles keep the current look ('moving').
--   'moving'  animated film grain (default)
--   'still'   grain texture without the flicker
--   'off'     no grain
ALTER TABLE profiles ADD COLUMN grain TEXT NOT NULL DEFAULT 'moving' CHECK (grain IN ('off', 'still', 'moving'));
