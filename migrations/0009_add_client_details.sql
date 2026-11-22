-- Migration 0009: details for each client in the "Worked with" strip.
-- Additive only. Nothing is deleted or changed except the sample text added to two placeholder
-- clients in the DRAFT (nothing published is touched).
--
-- Each client can open into a pop-up card with a title, a few bullet points, and up to four photos.
--   title        short line, e.g. "Brand film and launch photos"
--   bullets      JSON array of strings (what the owner worked on)
--   images       JSON array of { "key": "client-photo/<uuid>.<ext>", "alt": "..." } (R2 keys)
--   logo_mono    1 = draw the logo in one colour that follows the page's light/dark theme
--                (needs a transparent background); 0 = show the logo's own colours.

ALTER TABLE homepage_clients ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE homepage_clients ADD COLUMN bullets TEXT NOT NULL DEFAULT '[]';
ALTER TABLE homepage_clients ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
ALTER TABLE homepage_clients ADD COLUMN logo_mono INTEGER NOT NULL DEFAULT 1 CHECK (logo_mono IN (0, 1));

UPDATE homepage_clients
SET title = 'Placeholder: brand film and launch photos',
    bullets = '["Placeholder: directed and shot a 60-second brand film","Placeholder: product photos for the website and social","Placeholder: colour grade and edit"]'
WHERE state = 'draft' AND name = 'Placeholder Studio' AND title = '';

UPDATE homepage_clients
SET title = 'Placeholder: café opening campaign',
    bullets = '["Placeholder: photos of the space, food, and team","Placeholder: short reels for Instagram"]'
WHERE state = 'draft' AND name = 'Placeholder Coffee Co.' AND title = '';
