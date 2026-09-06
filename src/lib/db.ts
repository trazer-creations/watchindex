import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export type ContentType = 'movie' | 'tv';

export interface ChartRow {
  rank: number;
  title: string;
  slug: string;
  url: string;
  points: number | null;
  days_in_top10: number | null;
}

export interface Title {
  slug: string;
  title: string;
  url: string;
  first_seen: string;
}

export interface HistoryRow {
  date: string;
  platform: string;
  location: string;
  content_type: ContentType;
  rank: number;
  points: number | null;
  days_in_top10: number | null;
}

const DEFAULT_DB = '/home/tharaka/projects/flixpatrol/data/flixpatrol.db';

export function resolveDbPath(): string {
  return process.env.DB_PATH ?? DEFAULT_DB;
}

function openReadDb(): DatabaseSync {
  const p = resolveDbPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `[flixpatrol-front] SQLite DB not found at ${p}. Set DB_PATH env or run the scraper first (node src/top.js --all world --flare --save).`,
    );
  }
  return new DatabaseSync(p, { readOnly: true });
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = openReadDb();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function getLatestDate(): string {
  return withDb((db) => {
    const row = db.prepare('SELECT date FROM chart_entries ORDER BY date DESC LIMIT 1').get() as
      | { date: string }
      | undefined;
    if (!row) throw new Error('[flixpatrol-front] chart_entries is empty — scrape data first.');
    return row.date;
  });
}

export function getDates(): string[] {
  return withDb((db) =>
    (
      db.prepare('SELECT DISTINCT date FROM chart_entries ORDER BY date DESC').all() as {
        date: string;
      }[]
    ).map((r) => r.date),
  );
}

export function getPlatforms(): string[] {
  return withDb((db) =>
    (
      db.prepare('SELECT DISTINCT platform FROM chart_entries ORDER BY platform').all() as {
        platform: string;
      }[]
    ).map((r) => r.platform),
  );
}

export function getPlatformDates(platform: string): string[] {
  return withDb((db) =>
    (
      db
        .prepare('SELECT DISTINCT date FROM chart_entries WHERE platform = ? ORDER BY date DESC')
        .all(platform) as { date: string }[]
    ).map((r) => r.date),
  );
}

export interface PlatformStat {
  platform: string;
  dates: number;
  entries: number;
  latestDate: string | null;
}

export function getPlatformStats(): PlatformStat[] {
  return withDb(
    (db) =>
      db
        .prepare(
          `SELECT platform, COUNT(DISTINCT date) AS dates, COUNT(*) AS entries,
                  MAX(date) AS latestDate
           FROM chart_entries GROUP BY platform ORDER BY platform`,
        )
        .all() as PlatformStat[],
  );
}

export const FEATURED_PLATFORMS = [
  'netflix',
  'hbo-max',
  'disney',
  'amazon-prime',
  'paramount-plus',
  'apple-tv',
];

export function getChart(
  platform: string,
  contentType: ContentType,
  date: string,
  location = 'world',
): ChartRow[] {
  return withDb((db) =>
    db
      .prepare(
        `SELECT e.rank, t.title, t.slug, t.url, e.points, e.days_in_top10
         FROM chart_entries e JOIN titles t ON t.slug = e.title_slug
         WHERE e.platform = ? AND e.content_type = ? AND e.location = ? AND e.date = ?
         ORDER BY e.rank`,
      )
      .all(platform, contentType, location, date) as ChartRow[],
  );
}

export function getTitle(slug: string): Title | undefined {
  return withDb((db) =>
    db.prepare('SELECT slug, title, url, first_seen FROM titles WHERE slug = ?').get(slug) as
      | Title
      | undefined,
  );
}

export function getAllTitleSlugs(): string[] {
  return withDb((db) =>
    (db.prepare('SELECT slug FROM titles ORDER BY title').all() as { slug: string }[]).map(
      (r) => r.slug,
    ),
  );
}

export function getAllTitles(): Title[] {
  return withDb((db) =>
    db.prepare('SELECT slug, title, url, first_seen FROM titles ORDER BY title').all() as Title[],
  );
}

export function getTitleHistory(slug: string, limit = 365): HistoryRow[] {
  return withDb((db) =>
    db
      .prepare(
        `SELECT date, platform, location, content_type, rank, points, days_in_top10
         FROM chart_entries WHERE title_slug = ? ORDER BY date DESC LIMIT ?`,
      )
      .all(slug, limit) as HistoryRow[],
  );
}

export interface HistorySummary {
  days: number;
  platforms: number;
  bestRank: number;
  latest: HistoryRow | null;
  types: ContentType[];
}

export function summarizeHistory(rows: HistoryRow[]): HistorySummary {
  if (rows.length === 0) {
    return { days: 0, platforms: 0, bestRank: 0, latest: null, types: [] };
  }
  const dates = new Set(rows.map((r) => r.date));
  const plats = new Set(rows.map((r) => r.platform));
  const types = [...new Set(rows.map((r) => r.content_type))] as ContentType[];
  return {
    days: dates.size,
    platforms: plats.size,
    bestRank: Math.min(...rows.map((r) => r.rank)),
    latest: rows[0],
    types,
  };
}
