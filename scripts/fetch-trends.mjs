// Dijalankan oleh GitHub Actions setiap jam: ambil topik trending -> site/data/trends.json
import fs from 'node:fs';
import path from 'node:path';
import { getTrending, CATEGORIES } from '../lib/trends.js';

const out = process.argv[2] || 'site/data/trends.json';
const data = await getTrending(Object.keys(CATEGORIES), 15);
data.labels = Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label, emoji: v.emoji }]));

const total = Object.values(data.categories).reduce((n, l) => n + l.length, 0);
if (!total) {
  console.error('Tiada topik diperoleh:', data.errors);
  // Kekalkan fail lama jika ada, supaya laman tidak kosong
  if (fs.existsSync(out)) process.exit(0);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
console.log(`✅ ${total} topik ditulis ke ${out}`, data.errors.length ? `(⚠️ ${data.errors.join('; ')})` : '');
