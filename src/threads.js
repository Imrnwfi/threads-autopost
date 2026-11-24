// Klien ringkas untuk Threads API rasmi Meta (graph.threads.net)
import { getSetting, setSetting, log } from './db.js';

const GRAPH = 'https://graph.threads.net';
const API = `${GRAPH}/v1.0`;
export const MAX_CHARS = 500;
const SCOPES = 'threads_basic,threads_content_publish';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`Threads API: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ---------- Token ----------
export function getAuth() {
  const stored = getSetting('threads_auth');
  if (stored?.access_token) return stored;
  if (process.env.THREADS_ACCESS_TOKEN) {
    return {
      access_token: process.env.THREADS_ACCESS_TOKEN,
      user_id: process.env.THREADS_USER_ID || 'me',
      expires_at: null,
      source: 'env',
    };
  }
  return null;
}

export function saveAuth({ access_token, user_id, expires_in, username }) {
  const auth = {
    access_token,
    user_id: user_id || 'me',
    username: username || null,
    expires_at: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
    source: 'app',
  };
  setSetting('threads_auth', auth);
  return auth;
}

export function clearAuth() {
  setSetting('threads_auth', null);
}

export function authorizeUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID || '',
    redirect_uri: process.env.THREADS_REDIRECT_URI || '',
    scope: SCOPES,
    response_type: 'code',
    state,
  });
  return `https://threads.net/oauth/authorize?${p}`;
}

export async function exchangeCode(code) {
  // 1) code -> token jangka pendek (1 jam)
  const form = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID,
    client_secret: process.env.THREADS_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: process.env.THREADS_REDIRECT_URI,
    code,
  });
  const short = await call(`${GRAPH}/oauth/access_token`, { method: 'POST', body: form });
  // 2) token pendek -> token jangka panjang (60 hari)
  const p = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: process.env.THREADS_APP_SECRET,
    access_token: short.access_token,
  });
  const long = await call(`${GRAPH}/access_token?${p}`);
  const profile = await getProfile(long.access_token).catch(() => ({}));
  return saveAuth({
    access_token: long.access_token,
    user_id: String(short.user_id || profile.id || 'me'),
    expires_in: long.expires_in,
    username: profile.username,
  });
}

export async function refreshToken() {
  const auth = getAuth();
  if (!auth) throw new Error('Akaun Threads belum disambung.');
  const p = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: auth.access_token });
  const res = await call(`${GRAPH}/refresh_access_token?${p}`);
  log('info', 'Token Threads diperbaharui.');
  return saveAuth({ ...auth, access_token: res.access_token, expires_in: res.expires_in });
}

/** Perbaharui token jika tinggal kurang 7 hari (dipanggil setiap hari). */
export async function refreshIfNeeded() {
  const auth = getAuth();
  if (!auth || !auth.expires_at) return;
  const daysLeft = (new Date(auth.expires_at) - Date.now()) / 86400000;
  if (daysLeft < 7) await refreshToken();
}

export async function getProfile(token = getAuth()?.access_token) {
  if (!token) throw new Error('Akaun Threads belum disambung.');
  const p = new URLSearchParams({ fields: 'id,username,name,threads_profile_picture_url', access_token: token });
  return call(`${API}/me?${p}`);
}

export async function getPublishingLimit() {
  const auth = getAuth();
  const p = new URLSearchParams({ fields: 'quota_usage,config', access_token: auth.access_token });
  return call(`${API}/${auth.user_id}/threads_publishing_limit?${p}`);
}

// ---------- Publish ----------
/**
 * Terbitkan post teks. Jika ada imageUrl (URL awam), jadi post gambar.
 * Proses 2 langkah: cipta container -> publish.
 */
export async function publishText(text, { imageUrl, linkAttachment } = {}) {
  const auth = getAuth();
  if (!auth) throw new Error('Akaun Threads belum disambung. Pergi ke Tetapan.');
  if (!text?.trim()) throw new Error('Teks kosong.');
  if ([...text].length > MAX_CHARS) throw new Error(`Teks melebihi ${MAX_CHARS} aksara.`);

  const userId = auth.user_id || 'me';
  const params = new URLSearchParams({
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
    text,
    access_token: auth.access_token,
  });
  if (imageUrl) params.set('image_url', imageUrl);
  if (linkAttachment && !imageUrl) params.set('link_attachment', linkAttachment);

  const container = await call(`${API}/${userId}/threads`, { method: 'POST', body: params });

  // Meta cadangkan tunggu sebelum publish; untuk teks biasanya cepat.
  await waitForContainer(container.id, auth.access_token, imageUrl ? 30000 : 8000);

  const pub = await call(`${API}/${userId}/threads_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: container.id, access_token: auth.access_token }),
  });

  let permalink = null;
  try {
    const p = new URLSearchParams({ fields: 'permalink', access_token: auth.access_token });
    permalink = (await call(`${API}/${pub.id}?${p}`)).permalink || null;
  } catch { /* tak kritikal */ }

  return { id: pub.id, permalink };
}

async function waitForContainer(id, token, maxMs) {
  const start = Date.now();
  await sleep(2000);
  while (Date.now() - start < maxMs) {
    try {
      const p = new URLSearchParams({ fields: 'status,error_message', access_token: token });
      const s = await call(`${API}/${id}?${p}`);
      if (s.status === 'FINISHED' || s.status === 'PUBLISHED') return;
      if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new Error(`Container ${s.status}: ${s.error_message || ''}`);
    } catch (e) {
      if (String(e.message).startsWith('Container')) throw e;
      return; // endpoint status mungkin tak tersedia; teruskan publish
    }
    await sleep(3000);
  }
}
