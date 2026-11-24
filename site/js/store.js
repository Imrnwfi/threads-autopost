// Storan tempatan (localStorage) + perubahan untuk sync
import { nowIso } from './util.js';

const P = 'tpg_';
export function get(key, fallback) {
  try { const v = localStorage.getItem(P + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function set(key, value) {
  try { localStorage.setItem(P + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function remove(key) { localStorage.removeItem(P + key); }

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
function emit(kind) { listeners.forEach((fn) => fn(kind)); }

export const DEFAULT_SETTINGS = {
  provider: 'gemini', apiKey: '', model: '', baseUrl: '', persona: '', name: '', user: '',
  styleSamples: '', styleGuide: '', useStyle: false, lang: 'ms', googleClientId: '', readerUrl: '',
};

/** Keadaan aplikasi — koleksi disimpan berasingan dalam localStorage */
export const state = {
  settings: { ...DEFAULT_SETTINGS, ...get('settings', {}) },
  posts: get('posts', []).map(migratePost),
  products: get('products', []),
  series: get('series', []),
  plan: get('plan', null),
  customCats: get('customCats', []),
  deleted: get('deleted', {}), // id -> masa dipadam (untuk sync)
};

function migratePost(p) {
  const out = p.parts ? { ...p } : { ...p, parts: [p.text || ''], comment: '', kind: 'single', mode: 'topic' };
  delete out.text;
  out.updated_at = out.updated_at || out.posted_at || out.created_at || nowIso();
  return out;
}

const SYNCED = ['posts', 'products', 'series', 'plan', 'customCats', 'deleted', 'settings'];
export function save(kind) {
  if (!set(kind, state[kind])) throw new Error('Storan browser penuh / disekat');
  set('localUpdated', nowIso());
  emit(kind);
}
export function touch(obj) { obj.updated_at = nowIso(); return obj; }

/** Padam rekod dari koleksi & catat batu nisan untuk sync */
export function removeFrom(kind, id) {
  const index = state[kind].findIndex((x) => x.id === id);
  const item = state[kind][index];
  state[kind] = state[kind].filter((x) => x.id !== id);
  state.deleted[id] = nowIso();
  save(kind);
  save('deleted');
  return { item, index };
}

/** Kembalikan rekod yang dipadam (buat asal) */
export function restore(kind, item, index = 0) {
  delete state.deleted[item.id];
  state[kind].splice(Math.min(index, state[kind].length), 0, item);
  save(kind);
  save('deleted');
}

export function exportAll({ includeKey = false } = {}) {
  const settings = { ...state.settings };
  if (!includeKey) delete settings.apiKey;
  return { version: 2, exported_at: nowIso(), posts: state.posts, products: state.products, series: state.series, plan: state.plan, customCats: state.customCats, deleted: state.deleted, settings };
}

/** Gabung data luar (import / sync). Rekod lebih baharu menang; batu nisan dihormati. */
export function mergeAll(data) {
  const deleted = { ...state.deleted, ...(data.deleted || {}) };
  const mergeList = (a = [], b = []) => {
    const map = new Map();
    for (const x of [...a, ...b]) {
      if (!x?.id) continue;
      const cur = map.get(x.id);
      if (!cur || (x.updated_at || '') > (cur.updated_at || '')) map.set(x.id, x);
    }
    return [...map.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= (x.updated_at || '')));
  };
  state.posts = mergeList(state.posts, (data.posts || []).map(migratePost)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  state.products = mergeList(state.products, data.products);
  state.series = mergeList(state.series, data.series);
  state.customCats = mergeList(state.customCats, data.customCats);
  if (data.plan && (!state.plan || (data.plan.updated_at || '') > (state.plan.updated_at || ''))) state.plan = data.plan;
  if (data.settings && (data.settings.updated_at || '') > (state.settings.updated_at || '')) {
    state.settings = { ...state.settings, ...data.settings, apiKey: state.settings.apiKey || data.settings.apiKey || '' };
  }
  state.deleted = deleted;
  SYNCED.forEach((k) => save(k));
}

export function clearAll() {
  Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
}
