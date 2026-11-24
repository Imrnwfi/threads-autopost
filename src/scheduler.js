// Penjadual: terbitkan post berjadual + mod Autopilot (cari topik -> jana -> post)
import cron from 'node-cron';
import { db, getSetting, setSetting, log, markTopicUsed } from './db.js';
import { publishText, refreshIfNeeded, getAuth } from './threads.js';
import { generatePosts } from './ai.js';
import { pickTopic, CATEGORIES } from './trends.js';

export const TZ = process.env.TZ || 'Asia/Kuala_Lumpur';

export const DEFAULT_AUTOPILOT = {
  enabled: false,
  mode: 'review',                 // 'review' = simpan draf untuk diluluskan, 'auto' = terus post
  times: ['09:00', '13:00', '20:30'],
  categories: Object.keys(CATEGORIES),
  tone: 'santai',
  jitter_minutes: 10,             // lengah rawak supaya nampak natural
  extra: '',
};

export function getAutopilot() {
  return { ...DEFAULT_AUTOPILOT, ...(getSetting('autopilot') || {}) };
}

function localParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t) => f.find((p) => p.type === t)?.value;
  const hour = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hour}:${g('minute')}` };
}

// ---------- Terbitkan satu post ----------
export async function publishPost(id) {
  if (!getAuth()) throw Object.assign(new Error('Akaun Threads belum disambung. Pergi ke Tetapan.'), { status: 400 });
  // Kunci secara atomik supaya tak post dua kali
  const lock = db.prepare(
    "UPDATE posts SET status='publishing', error=NULL WHERE id=? AND status IN ('draft','scheduled','failed')"
  ).run(id);
  if (!lock.changes) throw new Error('Post sedang diproses atau sudah diterbitkan.');

  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(id);
  try {
    const res = await publishText(post.text);
    db.prepare("UPDATE posts SET status='posted', posted_at=?, threads_id=?, permalink=? WHERE id=?")
      .run(new Date().toISOString(), res.id, res.permalink, id);
    if (post.topic) markTopicUsed(post.topic);
    log('info', `Post #${id} diterbitkan (${res.id}).`);
    return db.prepare('SELECT * FROM posts WHERE id=?').get(id);
  } catch (e) {
    db.prepare("UPDATE posts SET status='failed', error=? WHERE id=?").run(e.message, id);
    log('error', `Post #${id} gagal: ${e.message}`);
    throw e;
  }
}

async function publishDue() {
  const due = db.prepare(
    "SELECT id FROM posts WHERE status='scheduled' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 5"
  ).all(new Date().toISOString());
  for (const { id } of due) {
    try { await publishPost(id); } catch { /* sudah di-log */ }
  }
}

// ---------- Autopilot ----------
export async function runAutopilotOnce({ force = false } = {}) {
  const ap = getAutopilot();
  const cats = ap.categories?.length ? ap.categories : Object.keys(CATEGORIES);

  // Giliran kategori
  const idx = (getSetting('autopilot_rotation', 0) || 0) % cats.length;
  let topic = null;
  let category = null;
  for (let i = 0; i < cats.length && !topic; i++) {
    category = cats[(idx + i) % cats.length];
    topic = await pickTopic(category).catch((e) => { log('warn', `Trending ${category}: ${e.message}`); return null; });
    if (topic) setSetting('autopilot_rotation', (idx + i + 1) % cats.length);
  }
  if (!topic) {
    log('warn', 'Autopilot: tiada topik baharu dijumpai.');
    return null;
  }

  const [text] = await generatePosts({
    topic: topic.title,
    snippet: topic.snippet,
    source: topic.sources?.join(', '),
    category,
    tone: ap.tone,
    count: 1,
    extra: ap.extra,
  });

  markTopicUsed(topic.title);
  const isAuto = ap.mode === 'auto' && !force;
  const jitter = Math.floor(Math.random() * ((ap.jitter_minutes || 0) + 1));
  const when = new Date(Date.now() + jitter * 60000).toISOString();

  const info = db.prepare(
    `INSERT INTO posts (text, category, topic, source_url, status, scheduled_at, origin)
     VALUES (?, ?, ?, ?, ?, ?, 'autopilot')`
  ).run(text, category, topic.title, topic.link, isAuto ? 'scheduled' : 'draft', isAuto ? when : null);

  log('info', `Autopilot: post #${info.lastInsertRowid} (${category}) ${isAuto ? `dijadual ${when}` : 'disimpan sebagai draf'}.`);
  return db.prepare('SELECT * FROM posts WHERE id=?').get(info.lastInsertRowid);
}

async function autopilotTick() {
  const ap = getAutopilot();
  if (!ap.enabled) return;
  const { date, time } = localParts();
  if (!ap.times.includes(time)) return;
  const slot = `${date} ${time}`;
  if (getSetting('autopilot_last_slot') === slot) return;
  setSetting('autopilot_last_slot', slot);
  if (ap.mode === 'auto' && !getAuth()) {
    log('warn', 'Autopilot: akaun Threads belum disambung.');
    return;
  }
  await runAutopilotOnce().catch((e) => log('error', `Autopilot gagal: ${e.message}`));
}

let started = false;
export function startScheduler() {
  if (started) return;
  started = true;
  // Pulihkan post yang tersekat 'publishing' (contoh: server restart)
  db.prepare("UPDATE posts SET status='failed', error='Terganggu semasa menerbitkan (server restart). Semak Threads sebelum cuba semula.' WHERE status='publishing'").run();

  cron.schedule('* * * * *', async () => {
    await publishDue().catch((e) => log('error', e.message));
    await autopilotTick().catch((e) => log('error', e.message));
  }, { timezone: TZ, noOverlap: true, name: 'tick' });

  cron.schedule('17 3 * * *', () => {
    refreshIfNeeded().catch((e) => log('error', `Refresh token: ${e.message}`));
  }, { timezone: TZ, name: 'refresh-token' });

  log('info', `Penjadual bermula (zon waktu ${TZ}).`);
}
