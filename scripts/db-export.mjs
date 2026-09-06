import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

// Download the D1 remote DB and materialize it as a local SQLite file for the build.
// `wrangler d1 export` produces a SQL *dump*, not a binary db — so we replay it
// into .d1/flixpatrol.sqlite via node:sqlite. The dump's d1_migrations table is
// kept; site queries never touch it.
// Usage: npm run db:export   (needs `wrangler login` or CLOUDFLARE_API_TOKEN)

fs.mkdirSync('.d1', { recursive: true });
const dumpPath = '.d1/dump.sql';
const outPath = '.d1/flixpatrol.sqlite';

execFileSync(
  'npx',
  ['wrangler', 'd1', 'export', 'flixpatrol', '--remote', `--output=${dumpPath}`],
  { stdio: 'inherit' },
);

if (fs.existsSync(outPath)) fs.rmSync(outPath);
const sql = fs.readFileSync(dumpPath, 'utf8');
const db = new DatabaseSync(outPath);
db.exec(sql);
const check = db.prepare('SELECT COUNT(*) AS c FROM chart_entries').get();
db.close();
console.log(`[db:export] materialized ${outPath} (${check.c} chart_entries)`);
