import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, log } from './src/db.js';
import { generatePosts, MAX_CHARS } from './src/ai.js';
import { getTrending, CATEGORIES } from './src/trends.js';
import { startScheduler, getAutoDraft, createAutoDraft, DEFAULT_AUTODRAFT, TZ } from './src/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ---------- Kata laluan & sesi ----------
let APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
  APP_PASSWORD = crypto.randomBytes(9).toString('base64url');
  console.warn(`\n⚠️  APP_PASSWORD tidak ditetapkan. Kata laluan sementara: ${APP_PASSWORD}\n   Tetapkan APP_PASSWORD dalam .env untuk kekal.\n`);
}
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update(`tap:${APP_PASSWORD}`).digest('hex');
const COOKIE = 'tap_session';
const SESSION_DAYS = 30;

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeSession() {
  const exp = String(Date.now() + SESSION_DAYS * 86400000);
  return `${exp}.${sign(exp)}`;
}
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isAuthed(req) {
  const v = readCookie(req, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig) return false;
  const expected = sign(exp);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(exp) > Date.now();
}
function setCookie(req, res, name, value, maxAgeSec) {
  const secure = req.secure ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Sila log masuk.' });
}

const loginAttempts = new Map();

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'Terlalu banyak cubaan. Cuba lagi sebentar.' });
  const ok = typeof req.body?.password === 'string'
    && crypto.timingSafeEqual(
      crypto.createHash('sha256').update(req.body.password).digest(),
      crypto.createHash('sha256').update(APP_PASSWORD).digest()
    );
  if (!ok) {
    a.n++;
    if (a.n >= 5) { a.until = Date.now() + 5 * 60000; a.n = 0; }
    loginAttempts.set(ip, a);
    return res.status(401).json({ error: 'Kata laluan salah.' });
  }
  loginAttempts.delete(ip);
  setCookie(req, res, COOKIE, makeSession(), SESSION_DAYS * 86400);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  setCookie(req, res, COOKIE, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authenticated: isAuthed(req) }));

// Semua /api selepas ini perlukan log masuk
app.use('/api', requireAuth);

app.get('/api/status', (_req, res) => {
  res.json({
    ai: { provider: process.env.AI_PROVIDER || 'anthropic', model: process.env.AI_MODEL || null, configured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) },
    timezone: TZ,
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label, emoji: v.emoji }])),
    counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM posts GROUP BY status').all().map((r) => [r.status, r.n])),
    max_chars: MAX_CHARS,
  });
});

// ---------- Trending ----------
app.get('/api/trending', async (req, res) => {
  const cats = String(req.query.categories || '').split(',').filter((c) => CATEGORIES[c]);
  res.json(await getTrending(cats.length ? cats : undefined, Number(req.query.limit) || 10));
});

// ---------- Jana post ----------
app.post('/api/generate', async (req, res) => {
  const { topic, snippet, category, tone, count, extra, source } = req.body || {};
  const posts = await generatePosts({ topic, snippet, category, tone, extra, source, count: Math.min(Math.max(Number(count) || 3, 1), 5) });
  res.json({ posts });
});

// ---------- Draf ----------
const validText = (t) => {
  if (!t || !String(t).trim()) throw Object.assign(new Error('Teks kosong.'), { status: 400 });
  if ([...String(t)].length > MAX_CHARS) throw Object.assign(new Error(`Teks melebihi ${MAX_CHARS} aksara.`), { status: 400 });
};
const getPost = (id) => db.prepare('SELECT * FROM posts WHERE id=?').get(id);

app.get('/api/posts', (req, res) => {
  const status = req.query.status === 'posted' ? 'posted' : 'draft';
  const order = status === 'posted' ? 'posted_at DESC' : 'id DESC';
  res.json({ posts: db.prepare(`SELECT * FROM posts WHERE status=? ORDER BY ${order} LIMIT 200`).all(status) });
});

app.post('/api/posts', (req, res) => {
  const { text, category, topic, source_url, posted } = req.body || {};
  validText(text);
  const info = db.prepare('INSERT INTO posts (text, category, topic, source_url, status, posted_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(text).trim(), category || null, topic || null, source_url || null, posted ? 'posted' : 'draft', posted ? new Date().toISOString() : null);
  res.json({ post: getPost(info.lastInsertRowid) });
});

app.put('/api/posts/:id', (req, res) => {
  const post = getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Draf tidak dijumpai.' });
  const { text = post.text, status = post.status } = req.body || {};
  validText(text);
  const newStatus = status === 'posted' ? 'posted' : 'draft';
  const postedAt = newStatus === 'posted' ? (post.posted_at || new Date().toISOString()) : null;
  db.prepare('UPDATE posts SET text=?, status=?, posted_at=? WHERE id=?').run(String(text).trim(), newStatus, postedAt, post.id);
  res.json({ post: getPost(post.id) });
});

app.delete('/api/posts/:id', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Draf automatik & tetapan ----------
app.get('/api/autodraft', (_req, res) => res.json(getAutoDraft()));

app.put('/api/autodraft', (req, res) => {
  const b = req.body || {};
  const cur = getAutoDraft();
  const next = {
    enabled: typeof b.enabled === 'boolean' ? b.enabled : cur.enabled,
    times: Array.isArray(b.times) ? [...new Set(b.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort() : cur.times,
    categories: Array.isArray(b.categories) ? b.categories.filter((c) => CATEGORIES[c]) : cur.categories,
    tone: typeof b.tone === 'string' ? b.tone.slice(0, 50) : cur.tone,
    extra: typeof b.extra === 'string' ? b.extra.slice(0, 500) : cur.extra,
  };
  if (!next.categories.length) next.categories = DEFAULT_AUTODRAFT.categories;
  setSetting('autodraft', next);
  log('info', `Draf automatik: ${next.enabled ? 'AKTIF' : 'tidak aktif'} pada ${next.times.join(', ')}`);
  res.json(next);
});

app.post('/api/autodraft/run', async (_req, res) => {
  const post = await createAutoDraft();
  if (!post) return res.status(404).json({ error: 'Tiada topik baharu dijumpai.' });
  res.json({ post });
});

app.get('/api/settings', (_req, res) => res.json({ persona: getSetting('persona', '') }));
app.put('/api/settings', (req, res) => {
  if (typeof req.body?.persona === 'string') setSetting('persona', req.body.persona.slice(0, 1000));
  res.json({ persona: getSetting('persona', '') });
});

app.get('/api/logs', (_req, res) => res.json({ logs: db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 100').all() }));

// ---------- Ralat ----------
app.use((err, _req, res, _next) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) log('error', err.message);
  res.status(status).json({ error: err.message || 'Ralat tidak diketahui.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Threads Post Generator berjalan di http://localhost:${PORT}`);
  startScheduler();
});
