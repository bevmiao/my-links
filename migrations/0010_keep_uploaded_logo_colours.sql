-- Migration 0010: keep the colours of client logos that were uploaded before 0009.
-- Changes one flag on existing rows; nothing is deleted.
--
-- 0009 added logo_mono with a default of 1 (draw the logo in one colour). That suits the bundled
-- placeholders, but logos uploaded before 0009 were made to be shown as they are: some have solid
-- backgrounds (they would become a plain block) or two-tone marks (the inner shape would vanish).
-- So every uploaded logo goes back to its own colours. The owner can switch any of them to one
-- colour in the dashboard, which now suggests the right setting for each new upload.

UPDATE homepage_clients SET logo_mono = 0 WHERE logo_key LIKE 'client-logo/%';
