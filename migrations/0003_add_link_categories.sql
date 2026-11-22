-- Migration 0003: optional category for links (e.g. "Social", "Work", "Elsewhere").
-- Additive only. Existing links get '' (uncategorised) and keep their order.
ALTER TABLE links ADD COLUMN category TEXT NOT NULL DEFAULT '';
