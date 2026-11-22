-- Migration 0008: client logo strip on the Home page.
-- Additive only. Nothing is deleted or changed.
--
-- Like the other lists, the table holds a 'draft' and a 'published' copy. Logos are stored in the
-- existing R2 bucket under client-logo/ (only the key is kept here). A NULL logo_key shows the
-- client's name as text instead.
--
-- Four placeholder clients go into the DRAFT only, using the placeholder logos bundled with the
-- site (public/placeholders/), plus one text-only client to show the fallback. Nothing is
-- published: the "Worked with" section starts hidden until the owner turns it on and publishes.

CREATE TABLE IF NOT EXISTS homepage_clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  state       TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  logo_key    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_homepage_clients_state ON homepage_clients (state, sort_order, id);

INSERT INTO homepage_clients (state, name, logo_key, sort_order)
SELECT 'draft', name, logo_key, sort_order
FROM (
  SELECT 'Placeholder Studio' AS name, 'placeholder/client-1.png' AS logo_key, 0 AS sort_order
  UNION ALL SELECT 'Placeholder Coffee Co.', 'placeholder/client-2.png', 1
  UNION ALL SELECT 'Placeholder Records', 'placeholder/client-3.png', 2
  UNION ALL SELECT 'Placeholder Outdoors', 'placeholder/client-4.png', 3
  UNION ALL SELECT 'Placeholder Agency', NULL, 4
)
WHERE NOT EXISTS (SELECT 1 FROM homepage_clients WHERE state = 'draft');
