import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, log } from './src/db.js';
import * as threads from './src/threads.js';
import { generatePosts } from './src/ai.js';
import { getTrending, CATEGORIES } from './src/trends.js';
import { startScheduler, publishPost, getAutopilot, runAutopilotOnce, DEFAULT_AUTOPILOT, TZ } from './src/scheduler.js';

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
function setCookie(res, name, value, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' || (process.env.THREADS_REDIRECT_URI || '').startsWith('https');
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`);
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
  setCookie(res, COOKIE, makeSession(), SESSION_DAYS * 86400);
  res.json({ ok: true });
});

app.post('/api/logout', (_req, res) => {
  setCookie(res, COOKIE, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authenticated: isAuthed(req) }));

// ---------- Threads OAuth ----------
app.get('/auth/threads', (req, res) => {
  if (!isAuthed(req)) return res.redirect('/');
  if (!process.env.THREADS_APP_ID || !process.env.THREADS_REDIRECT_URI) {
    return res.status(400).send('THREADS_APP_ID / THREADS_REDIRECT_URI belum ditetapkan dalam .env');
  }
  const state = crypto.randomBytes(16).toString('hex');
  setCookie(res, 'tap_oauth_state', state, 600);
  res.redirect(threads.authorizeUrl(state));
});

app.get('/auth/threads/callback', async (req, res) => {
  if (!isAuthed(req)) return res.redirect('/');
  const { code, state, error_description } = req.query;
  if (error_description) return res.redirect(`/#tetapan?err=${encodeURIComponent(error_description)}`);
  if (!state || state !== readCookie(req, 'tap_oauth_state')) return res.status(400).send('State OAuth tidak sah. Cuba sambung semula.');
  setCookie(res, 'tap_oauth_state', '', 0);
  try {
    const auth = await threads.exchangeCode(String(code).replace(/#_$/, ''));
    log('info', `Akaun Threads disambung: @${auth.username || auth.user_id}`);
    res.redirect('/#tetapan?ok=1');
  } catch (e) {
    log('error', `OAuth gagal: ${e.message}`);
    res.redirect(`/#tetapan?err=${encodeURIComponent(e.message)}`);
  }
});

// Semua /api selepas ini perlukan log masuk
app.use('/api', requireAuth);

app.get('/api/status', async (_req, res) => {
  const auth = threads.getAuth();
  res.json({
    threads: auth ? { connected: true, username: auth.username, user_id: auth.user_id, expires_at: auth.expires_at, source: auth.source } : { connected: false },
    oauth_configured: !!(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET && process.env.THREADS_REDIRECT_URI),
    ai: { provider: process.env.AI_PROVIDER || 'anthropic', model: process.env.AI_MODEL || null, configured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) },
    timezone: TZ,
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label, emoji: v.emoji }])),
    counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM posts GROUP BY status').all().map((r) => [r.status, r.n])),
    max_chars: threads.MAX_CHARS,
  });
});

app.post('/api/threads/token', async (req, res) => {
  const token = String(req.body?.access_token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token diperlukan.' });
  const profile = await threads.getProfile(token);
  let auth = threads.saveAuth({ access_token: token, user_id: profile.id, username: profile.username });
  // Cuba tukar/refresh supaya dapat token 60 hari & tarikh luput
  try { auth = await threads.refreshToken(); } catch {
    if (process.env.THREADS_APP_SECRET) {
      try {
        const p = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: process.env.THREADS_APP_SECRET, access_token: token });
        const r = await fetch(`https://graph.threads.net/access_token?${p}`).then((x) => x.json());
        if (r.access_token) auth = threads.saveAuth({ access_token: r.access_token, user_id: profile.id, username: profile.username, expires_in: r.expires_in });
      } catch { /* abaikan */ }
    }
  }
  log('info', `Token Threads disimpan untuk @${profile.username}`);
  res.json({ ok: true, username: auth.username, expires_at: auth.expires_at });
});

app.post('/api/threads/refresh', async (_req, res) => {
  const auth = await threads.refreshToken();
  res.json({ ok: true, expires_at: auth.expires_at });
});

app.post('/api/threads/disconnect', (_req, res) => {
  threads.clearAuth();
  res.json({ ok: true });
});

app.get('/api/threads/limit', async (_req, res) => res.json(await threads.getPublishingLimit()));

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

// ---------- Post ----------
const validText = (t) => {
  if (!t || !String(t).trim()) throw Object.assign(new Error('Teks kosong.'), { status: 400 });
  if ([...String(t)].length > threads.MAX_CHARS) throw Object.assign(new Error(`Teks melebihi ${threads.MAX_CHARS} aksara.`), { status: 400 });
};
const validDate = (d) => {
  const t = Date.parse(d);
  if (Number.isNaN(t)) throw Object.assign(new Error('Tarikh/masa tidak sah.'), { status: 400 });
  return new Date(t).toISOString();
};

app.get('/api/posts', (req, res) => {
  const status = String(req.query.status || '');
  const rows = status
    ? db.prepare(`SELECT * FROM posts WHERE status IN (${status.split(',').map(() => '?').join(',')}) ORDER BY COALESCE(scheduled_at, posted_at, created_at) DESC LIMIT 200`).all(...status.split(','))
    : db.prepare('SELECT * FROM posts ORDER BY id DESC LIMIT 200').all();
  res.json({ posts: rows });
});

app.post('/api/posts', async (req, res) => {
  const { text, category, topic, source_url, scheduled_at, action = 'draft' } = req.body || {};
  validText(text);
  let status = 'draft';
  let when = null;
  if (action === 'schedule') { status = 'scheduled'; when = validDate(scheduled_at); }
  const info = db.prepare('INSERT INTO posts (text, category, topic, source_url, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(text).trim(), category || null, topic || null, source_url || null, status, when);
  const id = info.lastInsertRowid;
  if (action === 'now') {
    const post = await publishPost(id);
    return res.json({ post });
  }
  res.json({ post: db.prepare('SELECT * FROM posts WHERE id=?').get(id) });
});

app.put('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post tidak dijumpai.' });
  if (['posted', 'publishing'].includes(post.status)) return res.status(400).json({ error: 'Post ini sudah/sedang diterbitkan.' });
  const { text = post.text, scheduled_at, status } = req.body || {};
  validText(text);
  let newStatus = post.status;
  let when = post.scheduled_at;
  if (status === 'scheduled') { newStatus = 'scheduled'; when = validDate(scheduled_at || post.scheduled_at); }
  if (status === 'draft') { newStatus = 'draft'; when = null; }
  db.prepare('UPDATE posts SET text=?, status=?, scheduled_at=?, error=NULL WHERE id=?').run(String(text).trim(), newStatus, when, post.id);
  res.json({ post: db.prepare('SELECT * FROM posts WHERE id=?').get(post.id) });
});

app.delete('/api/posts/:id', (req, res) => {
  db.prepare("DELETE FROM posts WHERE id=? AND status != 'publishing'").run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/publish', async (req, res) => {
  res.json({ post: await publishPost(Number(req.params.id)) });
});

// ---------- Autopilot & tetapan ----------
app.get('/api/autopilot', (_req, res) => res.json(getAutopilot()));

app.put('/api/autopilot', (req, res) => {
  const b = req.body || {};
  const cur = getAutopilot();
  const next = {
    enabled: typeof b.enabled === 'boolean' ? b.enabled : cur.enabled,
    mode: ['auto', 'review'].includes(b.mode) ? b.mode : cur.mode,
    times: Array.isArray(b.times) ? [...new Set(b.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort() : cur.times,
    categories: Array.isArray(b.categories) ? b.categories.filter((c) => CATEGORIES[c]) : cur.categories,
    tone: typeof b.tone === 'string' ? b.tone.slice(0, 50) : cur.tone,
    jitter_minutes: Number.isFinite(+b.jitter_minutes) ? Math.min(Math.max(+b.jitter_minutes, 0), 60) : cur.jitter_minutes,
    extra: typeof b.extra === 'string' ? b.extra.slice(0, 500) : cur.extra,
  };
  if (!next.categories.length) next.categories = DEFAULT_AUTOPILOT.categories;
  setSetting('autopilot', next);
  log('info', `Autopilot dikemas kini: ${next.enabled ? 'AKTIF' : 'tidak aktif'} (${next.mode}) pada ${next.times.join(', ')}`);
  res.json(next);
});

app.post('/api/autopilot/run', async (_req, res) => {
  // Jana satu draf sekarang (sentiasa sebagai draf untuk semakan)
  const post = await runAutopilotOnce({ force: true });
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
  const status = err.status && err.status < 600 ? (err.status >= 500 ? 502 : err.status) : 500;
  if (status >= 500) log('error', err.message);
  res.status(status).json({ error: err.message || 'Ralat tidak diketahui.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Threads Autopost berjalan di http://localhost:${PORT}`);
  startScheduler();
});
