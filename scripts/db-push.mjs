import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

// Sync website data (titles + chart_entries) from the local scrape DB to D1 remote.
// Upserts only — re-running is a no-op. scrape_runs run-log is intentionally NOT
// synced (no UNIQUE constraint; re-pushing would duplicate history rows).
// Usage: DB_PATH=/path/to/flixpatrol.db npm run db:push
// Auth: needs `wrangler login` locally, or CLOUDFLARE_API_TOKEN in CI.

const DEFAULT_DB = '/home/tharaka/projects/flixpatrol/data/flixpatrol.db';
const dbPath = process.env.DB_PATH ?? DEFAULT_DB;
if (!fs.existsSync(dbPath)) {
  console.error(`[db:push] local DB not found at ${dbPath}. Set DB_PATH or scrape first.`);
  process.exit(1);
}

const q = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

// Numeric columns pass through unquoted; everything else is quoted.
const num = (v) => (v === null || v === undefined ? 'NULL' : String(v));

const db = new DatabaseSync(dbPath, { readOnly: true });
const titles = db.prepare('SELECT slug, title, url, first_seen FROM titles').all();
const entries = db.prepare(
  'SELECT date, platform, location, content_type, rank, title_slug, points, days_in_top10, scraped_at FROM chart_entries',
).all();
db.close();

const lines = [];
// NOTE: no BEGIN/COMMIT — `wrangler d1 execute --file` rejects explicit
// transactions; D1 applies the file atomically on its own.
for (const t of titles) {
  lines.push(
    `INSERT INTO titles (slug, title, url, first_seen) VALUES (${q(t.slug)}, ${q(t.title)}, ${q(t.url)}, ${q(t.first_seen)}) ` +
      `ON CONFLICT (slug) DO UPDATE SET title = excluded.title, url = excluded.url;`,
  );
}
for (const e of entries) {
  lines.push(
    `INSERT INTO chart_entries (date, platform, location, content_type, rank, title_slug, points, days_in_top10, scraped_at) ` +
      `VALUES (${q(e.date)}, ${q(e.platform)}, ${q(e.location)}, ${q(e.content_type)}, ${num(e.rank)}, ${q(e.title_slug)}, ${num(e.points)}, ${num(e.days_in_top10)}, ${q(e.scraped_at)}) ` +
      `ON CONFLICT (date, platform, location, content_type, rank) DO UPDATE SET title_slug = excluded.title_slug, points = excluded.points, days_in_top10 = excluded.days_in_top10, scraped_at = excluded.scraped_at;`,
  );
}
fs.mkdirSync('.d1', { recursive: true });
const out = path.resolve('.d1', 'push.sql');
fs.writeFileSync(out, lines.join('\n'));
console.log(`[db:push] ${titles.length} titles + ${entries.length} entries from ${dbPath} -> ${out}`);

execFileSync('npx', ['wrangler', 'd1', 'execute', 'flixpatrol', '--remote', `--file=${out}`], {
  stdio: 'inherit',
});
