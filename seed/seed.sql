-- ============================================================================
-- SAMPLE DATA — for local development and first-run demos only.
-- Replaces the profile details and ALL links. It does not touch analytics,
-- uploaded images, R2, or homepage sections (those start as placeholder drafts;
-- press Publish in the dashboard's Homepage tab to see them). Everything here can be edited from the dashboard.
--   Local:      npm run db:seed:local
--   Production: npm run db:seed:remote   (only if you want the demo content live)
-- ============================================================================

UPDATE profiles SET
  username         = 'alexrivera',
  display_name     = 'Alex Rivera',
  bio              = 'Designer & developer building calm, useful things on the web. (Sample profile — edit me in the dashboard.)',
  theme_mode       = 'system',
  accent_color     = '#6366f1',
  background_light = '#fafafa',
  background_dark  = '#09090b',
  button_style     = 'rounded',
  socials          = '[{"platform":"github","url":"https://github.com/"},{"platform":"x","url":"https://x.com/"},{"platform":"instagram","url":"https://instagram.com/"},{"platform":"linkedin","url":"https://www.linkedin.com/"},{"platform":"email","url":"mailto:hello@example.com"}]',
  updated_at       = datetime('now')
WHERE id = 1;

DELETE FROM links;
INSERT INTO links (title, url, description, icon, category, is_active, sort_order) VALUES
  ('Portfolio',              'https://example.com/',               'Selected work, 2019 – today',         'sparkles',  '',      1, 0),
  ('Read my newsletter',     'https://example.com/newsletter',     'Notes on design & engineering, monthly', 'newspaper', 'Read',  1, 1),
  ('Latest video',           'https://www.youtube.com/',           'How I design a component library',     'youtube',   'Watch', 1, 2),
  ('Open-source projects',   'https://github.com/',                '',                                     'github',    'Build', 1, 3),
  ('Book a 30-min call',     'https://example.com/book',           'Mentoring & consulting',               'calendar',  '',      1, 4),
  ('Draft: upcoming course', 'https://example.com/course',         'Hidden until launch',                  'education', '',      0, 5);

