// Draf Automatik: pada masa ditetapkan, cari topik viral -> jana post -> simpan sebagai draf.
// App ini TIDAK post ke Threads. Anda semak draf dan post sendiri.
import cron from 'node-cron';
import { db, getSetting, setSetting, log, markTopicUsed } from './db.js';
import { generatePosts } from './ai.js';
import { pickTopic, CATEGORIES } from './trends.js';

export const TZ = process.env.TZ || 'Asia/Kuala_Lumpur';

export const DEFAULT_AUTODRAFT = {
  enabled: false,
  times: ['08:00', '12:00', '19:00'],
  categories: Object.keys(CATEGORIES),
  tone: 'santai',
  extra: '',
};

export function getAutoDraft() {
  return { ...DEFAULT_AUTODRAFT, ...(getSetting('autodraft') || {}) };
}

function localParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t) => f.find((p) => p.type === t)?.value;
  const hour = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hour}:${g('minute')}` };
}

/** Jana satu draf daripada topik viral seterusnya (kategori bergilir). */
export async function createAutoDraft() {
  const cfg = getAutoDraft();
  const cats = cfg.categories?.length ? cfg.categories : Object.keys(CATEGORIES);

  const idx = (getSetting('autodraft_rotation', 0) || 0) % cats.length;
  let topic = null;
  let category = null;
  for (let i = 0; i < cats.length && !topic; i++) {
    category = cats[(idx + i) % cats.length];
    topic = await pickTopic(category).catch((e) => { log('warn', `Trending ${category}: ${e.message}`); return null; });
    if (topic) setSetting('autodraft_rotation', (idx + i + 1) % cats.length);
  }
  if (!topic) {
    log('warn', 'Draf automatik: tiada topik baharu dijumpai.');
    return null;
  }

  const [text] = await generatePosts({
    topic: topic.title,
    snippet: topic.snippet,
    source: topic.sources?.join(', '),
    category,
    tone: cfg.tone,
    count: 1,
    extra: cfg.extra,
  });

  markTopicUsed(topic.title);
  const info = db.prepare(
    "INSERT INTO posts (text, category, topic, source_url, status, origin) VALUES (?, ?, ?, ?, 'draft', 'auto')"
  ).run(text, category, topic.title, topic.link);

  log('info', `Draf automatik #${info.lastInsertRowid} (${category}): ${topic.title}`);
  return db.prepare('SELECT * FROM posts WHERE id=?').get(info.lastInsertRowid);
}

async function tick() {
  const cfg = getAutoDraft();
  if (!cfg.enabled) return;
  const { date, time } = localParts();
  if (!cfg.times.includes(time)) return;
  const slot = `${date} ${time}`;
  if (getSetting('autodraft_last_slot') === slot) return;
  setSetting('autodraft_last_slot', slot);
  await createAutoDraft().catch((e) => log('error', `Draf automatik gagal: ${e.message}`));
}

let started = false;
export function startScheduler() {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', () => tick().catch((e) => log('error', e.message)), { timezone: TZ, noOverlap: true, name: 'autodraft' });
  log('info', `Penjadual draf automatik bermula (zon waktu ${TZ}).`);
}
