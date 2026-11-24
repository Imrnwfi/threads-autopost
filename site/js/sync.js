// Sync draf & data antara peranti melalui Google Drive (folder appDataFolder tersembunyi).
// Perlu Google OAuth Client ID (jenis "Web application") — lihat README.
import { state, exportAll, mergeAll, set, get } from './store.js';
import { nowIso } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'threads-post-generator-sync.json';
let token = null;
let tokenExp = 0;
let gisLoaded = null;
let syncing = false;
export const isSyncing = () => syncing;

function loadGis() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoaded = null; reject(new Error('Gagal memuatkan Google Sign-In.')); };
    document.head.appendChild(s);
  });
  return gisLoaded;
}

export const isConnected = () => !!token && Date.now() < tokenExp;
export const lastSync = () => get('lastSync', null);

/** Minta token (mesti dipanggil daripada tindakan pengguna, cth. tekan butang). */
export async function connect({ silent = false } = {}) {
  const clientId = state.settings.googleClientId?.trim();
  if (!clientId) throw new Error('Masukkan Google Client ID dulu (lihat panduan).');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      prompt: silent ? '' : undefined,
      callback: (resp) => {
        if (resp.error) return reject(new Error(`Google: ${resp.error_description || resp.error}`));
        token = resp.access_token;
        tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
        set('syncEnabled', true);
        resolve();
      },
      error_callback: (err) => reject(new Error(err?.message || 'Log masuk Google dibatalkan.')),
    });
    client.requestAccessToken();
  });
}

export function disconnect() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null; tokenExp = 0;
  set('syncEnabled', false);
}

async function api(path, opts = {}) {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { token = null; throw new Error('Sesi Google tamat. Tekan Sync semula.'); }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(`Google Drive: ${b?.error?.message || res.status}`);
  }
  return res;
}

async function findFile() {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const r = await (await api(`/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)).json();
  return r.files?.[0] || null;
}

/** Muat turun data awan, gabung dengan data tempatan, kemudian muat naik hasil gabungan. */
export async function syncNow() {
  if (!isConnected()) await connect();
  syncing = true;
  try { return await doSync(); } finally { syncing = false; }
}

async function doSync() {
  const file = await findFile();
  if (file) {
    const remote = await (await api(`/drive/v3/files/${file.id}?alt=media`)).json().catch(() => null);
    if (remote) mergeAll(remote);
  }
  const body = JSON.stringify(exportAll({ includeKey: false }));
  if (file) {
    await api(`/upload/drive/v3/files/${file.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const boundary = `tpg${Date.now()}`;
    const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    await api('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
  }
  set('lastSync', nowIso());
  return { posts: state.posts.length, products: state.products.length };
}
