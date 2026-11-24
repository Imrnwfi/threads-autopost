// Dijalankan oleh GitHub Actions setiap jam: ambil topik trending -> site/data/trends.json
import fs from 'node:fs';
import path from 'node:path';
import { getTrending, CATEGORIES, markVelocity } from '../lib/trends.js';

const out = process.argv[2] || 'site/data/trends.json';

// Data larian sebelumnya (untuk kesan topik "meletup")
async function previous() {
  const repo = process.env.GITHUB_REPOSITORY; // owner/nama
  const url = process.env.PREV_TRENDS_URL || (repo ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/data/trends.json` : null);
  try {
    if (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.json();
    }
  } catch { /* abaikan */ }
  try { return JSON.parse(fs.readFileSync(out, 'utf8')); } catch { return null; }
}

const prev = await previous();
const data = await getTrending(Object.keys(CATEGORIES), 15, { extras: true });
data.labels = Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label, emoji: v.emoji }]));
markVelocity(data.items || [], prev?.items || []);

const total = (data.items || []).length;
if (!total) {
  console.error('Tiada topik diperoleh:', data.errors);
  if (fs.existsSync(out)) process.exit(0);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
const hot = (data.items || []).filter((i) => i.meletup).length;
console.log(`✅ ${total} topik (${hot} meletup) ditulis ke ${out}`, data.source_counts || '', data.errors.length ? `⚠️ ${data.errors.join('; ')}` : '');
