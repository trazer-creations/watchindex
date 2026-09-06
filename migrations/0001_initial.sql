-- D1 migration 0001: initial schema.
-- Mirrored from the scraper repo: /home/tharaka/projects/flixpatrol/migrations/0001_initial.sql
-- (which is ported from src/db.js SCHEMA). The scraper repo is the source of truth —
-- if the schema ever changes there, copy the new migration here to stay in sync.
-- Daily-grain storage for FlixPatrol Top 10 charts.
-- One fact row per (date x platform x location x content_type x rank).
-- Re-runs for the same date upsert (no duplicates).
-- D1 differences vs local: no `PRAGMA journal_mode = WAL` (D1-managed).

CREATE TABLE IF NOT EXISTS titles (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  first_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chart_entries (
  date          TEXT NOT NULL,
  platform      TEXT NOT NULL,
  location      TEXT NOT NULL DEFAULT 'world',
  content_type  TEXT NOT NULL CHECK (content_type IN ('movie', 'tv')),
  rank          INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
  title_slug    TEXT NOT NULL REFERENCES titles(slug),
  points        INTEGER NULL,
  days_in_top10 INTEGER NULL,
  scraped_at    TEXT NOT NULL,
  UNIQUE (date, platform, location, content_type, rank)
);

CREATE INDEX IF NOT EXISTS idx_chart_lookup
  ON chart_entries (platform, content_type, location, date DESC, rank);
CREATE INDEX IF NOT EXISTS idx_title_history
  ON chart_entries (title_slug, date DESC);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  strategy    TEXT NOT NULL,
  platforms   INTEGER NOT NULL,
  succeeded   INTEGER NOT NULL,
  failed      INTEGER NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL
);
