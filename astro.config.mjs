import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static pre-render: every page queries the SQLite DB at build time.
// DB path comes from DB_PATH env, defaults to the scraper repo location.
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
