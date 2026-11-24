// Threads Post Generator — aplikasi utama
import {
  MAX_CHARS, MAX_MULTI, TONES, LANGS, AFF_STYLES, QUICK_TRANSFORMS, len, nameFromUrl, firstUrl,
  generate, regeneratePart, researchProduct, transform, scoreHook, generateInfo, webLimited, markWebLimited,
} from './ai.js';
import { mountInfoEditor, openInfoSheet } from './infocard.js';
import { state, save, touch, removeFrom, restore, get, set, onChange } from './store.js';
import {
  $, $$, esc, uid, nowIso, toast, busy, copyText, fmtTime, ago, autosize, openSheet, myParts, setNoKeyHandler,
  haptic, confetti, typewriter,
} from './util.js';
import { icon, hydrateIcons } from './icons.js';
import { HOOK_GROUPS, upcomingEvents, daysUntil, DEFAULT_PLAN, SLOT_TYPES, DAY_NAMES, LABELS, GROUPS, CATEGORY_LABELS } from './data.js';
import { openImageCard } from './imagecard.js';
import { initPages } from './pages.js';
import { initUpdates } from './update.js';

const threadsIntent = (text) => `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`;
const S = () => state.settings;
const displayName = () => S().name || 'Nama Anda';
const userName = () => (S().user || 'username').replace(/^@/, '');
const aiCtx = () => ({ persona: S().persona, styleGuide: studio.useStyle ? S().styleGuide : '', lang: studio.lang });

// =========================================================
// Tema
// =========================================================
const THEMES = [
  { id: 'auto', name: 'Ikut peranti', sw: ['linear-gradient(135deg,#0b0b0c 50%,#fafafa 50%)', '#ff5a36', '#888'] },
  { id: 'minimal-dark', name: 'Threads Gelap', sw: ['#0b0b0c', '#ffffff', '#3a3a3f'] },
  { id: 'minimal-light', name: 'Threads Cerah', sw: ['#fafafa', '#101012', '#d4d4d8'] },
  { id: 'ceria', name: 'Kreator Ceria', sw: ['#fff7ef', '#ee4d2d', '#ff8a3d'] },
  { id: 'studio', name: 'Studio Pro', sw: ['#0a0d1a', '#7c5cff', '#3ba7ff'] },
  { id: 'pastel', name: 'Pastel Manis', sw: ['#fdf4fb', '#d946ef', '#f472b6'] },
  { id: 'neon', name: 'Neon Malam', sw: ['#050505', '#c6ff3d', '#3dffd6'] },
  { id: 'laut', name: 'Laut Biru', sw: ['#eef7fb', '#0e8fb8', '#18c6a3'] },
];
let themeChoice = get('theme', 'auto');
const mqLight = matchMedia('(prefers-color-scheme: light)');
function applyTheme(id = themeChoice) {
  themeChoice = id;
  set('theme', id);
  document.documentElement.dataset.theme = id === 'auto' ? (mqLight.matches ? 'minimal-light' : 'minimal-dark') : id;
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    $('meta[name=theme-color]')?.setAttribute('content', bg);
  });
  $$('.theme-grid').forEach(renderThemeGrid);
}
mqLight.addEventListener?.('change', () => { if (themeChoice === 'auto') applyTheme('auto'); });
function renderThemeGrid(el) {
  el.innerHTML = THEMES.map((t) => `
    <button class="theme-opt ${t.id === themeChoice ? 'on' : ''}" data-theme-id="${t.id}">
      <span class="swatch" style="background:${t.sw[0]}"><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[2]}"></i></span>
      ${esc(t.name)}
    </button>`).join('');
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-theme-id]');
  if (t) applyTheme(t.dataset.themeId);
});
$('#themeBtn').addEventListener('click', () => openSheet('🎨 Pilih tema', '<div class="theme-grid"></div>', { onMount: (p) => renderThemeGrid($('.theme-grid', p)) }));

// =========================================================
// Navigasi
// =========================================================
const MAIN_TABS = ['utama', 'trending', 'studio', 'draf', 'lagi'];
const PAGES = [...MAIN_TABS, 'kalendar', 'produk', 'siri', 'insight', 'hook', 'tetapan'];
const renderers = {};
export function openTab(name) {
  if (!PAGES.includes(name)) name = 'utama';
  const tab = MAIN_TABS.includes(name) ? name : 'lagi';
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.page').forEach((p) => p.classList.toggle('hidden', p.id !== `page-${name}`));
  history.replaceState(null, '', `#${name}`);
  renderers[name]?.();
  window.scrollTo({ top: 0 });
}
setNoKeyHandler(() => openTab('tetapan'));
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (PAGES.includes(h) && $(`#page-${h}`).classList.contains('hidden')) openTab(h);
});
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openTab(b.dataset.tab); });
$('#draftPill').addEventListener('click', () => openTab('draf'));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) { e.preventDefault(); openTab(g.dataset.goto); return; }
  const p = e.target.closest('[data-preset]');
  if (p) { applyPreset(JSON.parse(p.dataset.preset)); openTab('studio'); }
});

function refreshCounts() {
  $('#draftCount').textContent = state.posts.filter((p) => p.status === 'draft').length;
}

// =========================================================
// Trending
// =========================================================
let CATS = { ...CATEGORY_LABELS };
let GRPS = { ...GROUPS };
let trendData = null;
let trendView = [];
const trendFilter = { cat: 'semua', sub: null, src: 'semua' };
const SOURCES = { semua: 'Semua sumber', berita: '📰 Berita', Reddit: '👽 Reddit', Lowyat: '💬 Lowyat', YouTube: '▶️ YouTube' };
const groupOf = (cat) => CATS[cat]?.group;

const topicKey = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
function usedTopics() {
  const cutoff = Date.now() - 30 * 86400000;
  return new Set(get('used', []).filter((u) => u.at > cutoff).map((u) => u.k));
}
function markUsed(title) {
  if (!title) return;
  const cutoff = Date.now() - 30 * 86400000;
  const list = get('used', []).filter((u) => u.at > cutoff && u.k !== topicKey(title));
  list.push({ k: topicKey(title), at: Date.now() });
  set('used', list.slice(-500));
}
const kwMatch = (text, kws) => {
  const t = ` ${String(text).toLowerCase()} `;
  return kws.some((k) => k && new RegExp(`(^|[^a-z0-9])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(t));
};

export function allTrends() {
  if (!trendData) return [];
  let list = trendData.items;
  if (!list) {
    const seen = new Set();
    list = Object.values(trendData.categories).flat().sort((a, b) => b.score - a.score)
      .filter((t) => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // Hanya kewangan, bantuan kerajaan & e-wallet
  return list.filter((t) => CATS[t.category]);
}
function filteredTrends() {
  let list = allTrends();
  const c = trendFilter.cat;
  if (c === 'meletup') list = list.filter((t) => t.meletup || t.rising);
  else if (c.startsWith('custom:')) {
    const cc = state.customCats.find((x) => x.id === c.slice(7));
    list = cc ? list.filter((t) => kwMatch(`${t.title} ${t.snippet}`, cc.keywords)) : [];
  } else if (GRPS[c]) {
    list = list.filter((t) => groupOf(t.category) === c);
    if (trendFilter.sub) list = list.filter((t) => t.category === trendFilter.sub);
  }
  const s = trendFilter.src;
  if (s === 'berita') list = list.filter((t) => (t.origins || [t.origin]).some((o) => /Google/.test(o)));
  else if (s !== 'semua') list = list.filter((t) => (t.origins || [t.origin]).includes(s));
  return list;
}
function renderTrendChips() {
  const all = allTrends();
  const count = (fn) => all.filter(fn).length;
  const cats = [
    ['semua', '✨ Semua', all.length], ['meletup', '🚀 Meletup', count((t) => t.meletup || t.rising)],
    ...Object.entries(GRPS).map(([k, g]) => [k, `${g.emoji} ${g.label}`, count((t) => groupOf(t.category) === k)]),
    ...state.customCats.map((c) => [`custom:${c.id}`, `${c.emoji || '⭐'} ${c.name}`, null]),
  ];
  $('#catChips').innerHTML = cats.map(([k, l, n]) => `<button class="chip ${trendFilter.cat === k ? 'on' : ''}" data-cat="${esc(k)}" ${GRPS[k] ? `style="--lc:${GRPS[k].color}"` : ''}>${esc(l)}${trendData && n !== null ? ` <small>${n}</small>` : ''}</button>`).join('')
    + '<button class="chip dashed" data-addcat>＋ Kategori</button>';
  // Subkategori untuk kumpulan dipilih
  const g = GRPS[trendFilter.cat] ? trendFilter.cat : null;
  $('#subChips').classList.toggle('hidden', !g);
  if (g) {
    const subs = Object.entries(CATS).filter(([, c]) => c.group === g);
    $('#subChips').innerHTML = `<button class="chip ${!trendFilter.sub ? 'on' : ''}" data-sub="">Semua</button>`
      + subs.map(([k, c]) => `<button class="chip ${trendFilter.sub === k ? 'on' : ''}" data-sub="${k}">${c.emoji} ${esc(c.label)} <small>${count((t) => t.category === k)}</small></button>`).join('');
  }
  const avail = new Set(all.flatMap((t) => t.origins || [t.origin]));
  const extra = Object.keys(SOURCES).filter((k) => !['semua', 'berita'].includes(k) && avail.has(k));
  $('#srcChips').classList.toggle('hidden', !extra.length);
  $('#srcChips').innerHTML = Object.entries(SOURCES)
    .filter(([k]) => k === 'semua' || k === 'berita' || avail.has(k))
    .map(([k, l]) => `<button class="chip ${trendFilter.src === k ? 'on' : ''}" data-src="${k}">${l}</button>`).join('');
  const cur = $('#gCategory').value;
  $('#gCategory').innerHTML = Object.entries(GRPS).map(([gk, gr]) => `<optgroup label="${gr.emoji} ${esc(gr.label)}">${
    Object.entries(CATS).filter(([, c]) => c.group === gk).map(([k, c]) => `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('')}</optgroup>`).join('');
  if (CATS[cur]) $('#gCategory').value = cur;
}
$('#catChips').addEventListener('click', (e) => {
  if (e.target.closest('[data-addcat]')) return openCustomCat();
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  if (trendFilter.cat === b.dataset.cat && b.dataset.cat.startsWith('custom:')) return openCustomCat(b.dataset.cat.slice(7));
  trendFilter.cat = b.dataset.cat;
  trendFilter.sub = null;
  renderTrendChips(); renderTrending();
});
$('#subChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sub]');
  if (!b) return;
  trendFilter.sub = b.dataset.sub || null;
  renderTrendChips(); renderTrending();
});
$('#srcChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-src]');
  if (!b) return;
  trendFilter.src = b.dataset.src;
  renderTrendChips(); renderTrending();
});

function openCustomCat(id) {
  const cur = id ? state.customCats.find((c) => c.id === id) : null;
  const panel = openSheet(cur ? '✏️ Edit kategori' : '＋ Kategori sendiri', `
    <div class="form">
      <div class="row"><label style="flex:0 0 80px">Emoji <input class="cc-emoji" maxlength="4" value="${esc(cur?.emoji || '⭐')}" /></label>
      <label>Nama <input class="cc-name" placeholder="cth. Kereta" value="${esc(cur?.name || '')}" /></label></div>
      <label>Kata kunci <span class="muted">(pisah dengan koma)</span>
        <textarea class="cc-kw" rows="3" placeholder="cth. kereta, proton, perodua, myvi, EV, minyak">${esc(cur?.keywords.join(', ') || '')}</textarea></label>
      <p class="muted small">Topik yang mengandungi mana-mana kata kunci akan muncul dalam kategori ini.</p>
      <div class="row wrap"><button class="btn primary cc-save">💾 Simpan</button>${cur ? '<button class="btn danger cc-del">🗑️ Padam</button>' : ''}</div>
    </div>`);
  $('.cc-save', panel).addEventListener('click', () => {
    const name = $('.cc-name', panel).value.trim();
    const keywords = $('.cc-kw', panel).value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!name || !keywords.length) return toast('Isi nama & sekurang-kurangnya satu kata kunci', true);
    if (cur) Object.assign(cur, touch({ name, keywords, emoji: $('.cc-emoji', panel).value.trim() }));
    else state.customCats.push(touch({ id: uid(), name, keywords, emoji: $('.cc-emoji', panel).value.trim() }));
    save('customCats');
    trendFilter.cat = `custom:${(cur || state.customCats.at(-1)).id}`;
    panel.close(); renderTrendChips(); renderTrending();
  });
  $('.cc-del', panel)?.addEventListener('click', () => {
    removeFrom('customCats', cur.id);
    trendFilter.cat = 'semua';
    panel.close(); renderTrendChips(); renderTrending();
  });
}

async function loadTrending(force = false) {
  $('#trendList').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`data/trends.json${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trendData = await res.json();
    if (trendData.labels) CATS = Object.fromEntries(Object.entries(trendData.labels).filter(([, v]) => v.group));
    if (!Object.keys(CATS).length) CATS = { ...CATEGORY_LABELS };
    if (trendData.groups) GRPS = trendData.groups;
    renderTrendChips();
    renderTrending();
    if (!$('#page-utama').classList.contains('hidden')) renderHome();
  } catch (e) {
    $('#trendList').innerHTML = `<div class="empty"><span class="big">📡</span>Data trending belum tersedia (${esc(e.message)}).<br>Ia dikemas kini setiap jam.</div>`;
    $('#homeTrends').innerHTML = '';
  }
}
function trendTags(t, i, used) {
  const c = CATS[t.category] || {};
  const origins = t.origins || [t.origin];
  return [
    c.label ? `<span class="tag lbl" style="--lc:${GRPS[c.group]?.color || 'var(--muted)'}">${c.emoji || ''} ${esc(c.label)}</span>` : '',
    t.meletup ? '<span class="tag hot">🚀 Meletup</span>' : t.rising ? '<span class="tag hot">📈 Naik</span>' : i < 3 ? '<span class="tag hot">🔥 Hangat</span>' : '',
    origins.filter((o) => !/Google/.test(o)).map((o) => `<span class="tag">${esc(SOURCES[o] || o)}</span>`).join(''),
    used.has(topicKey(t.title)) ? '<span class="tag ok">✓ Digunakan</span>' : '',
    t.traffic ? `<span class="tag">${Number(t.traffic).toLocaleString()}+ ${origins.includes('YouTube') ? 'tontonan' : 'carian'}</span>` : '',
  ].join('');
}
function renderTrending() {
  if (!trendData) return;
  const used = usedTopics();
  trendView = filteredTrends().slice(0, 80);
  const max = Math.max(...trendView.map((t) => t.score), 1);
  const errs = trendData.errors?.length ? ` · ⚠️ ${trendData.errors.length} sumber gagal` : '';
  $('#trendMeta').textContent = `Dikemas kini ${ago(trendData.fetched_at)} · ${trendView.length} topik${errs}`;
  if (!trendView.length) {
    $('#trendList').innerHTML = `<div class="empty"><span class="big">🔍</span>${trendFilter.cat === 'meletup' ? 'Tiada topik meletup buat masa ini.' : 'Tiada topik untuk penapis ini.'}</div>`;
    return;
  }
  $('#trendList').innerHTML = trendView.map((t, i) => `
    <div class="card trend">
      <div class="trend-top">${trendTags(t, i, used)}<span class="muted small">${esc(ago(t.published))}</span></div>
      <div class="trend-main">
        <div class="trend-text">
          <div class="trend-title">${esc(t.title)}</div>
          ${t.snippet && t.snippet !== t.title ? `<div class="trend-snippet">${esc(t.snippet)}</div>` : ''}
        </div>
        ${t.image ? `<img class="thumb" src="${esc(t.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />` : ''}
      </div>
      <div class="heat"><i style="width:${Math.round((t.score / max) * 100)}%"></i></div>
      <div class="row">
        <button class="btn primary sm" data-gen="${i}">✨ Jana post</button>
        <button class="btn sm" data-info="${i}">🖼️ Kad info</button>
        ${t.link ? `<a class="btn sm" href="${esc(t.link)}" target="_blank" rel="noopener">Sumber ↗</a>` : ''}
        <span class="muted small ellip">${esc((t.sources || []).slice(0, 3).join(', '))}</span>
      </div>
    </div>`).join('');
}
$('#refreshTrending').addEventListener('click', () => loadTrending(true));
$('#trendList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gen]');
  if (b) useTrend(trendView[Number(b.dataset.gen)]);
  const k = e.target.closest('[data-info]');
  if (k) useTrend(trendView[Number(k.dataset.info)], 'info');
});
export function useTrend(t, mode = 'topic') {
  applyPreset({ mode: mode === 'info' ? 'info' : 'topic' });
  $('#gSeries').value = '';
  $('#gTopic').value = t.title;
  $('#gSnippet').value = t.snippet && t.snippet !== t.title ? t.snippet : '';
  if (CATS[t.category]) $('#gCategory').value = t.category;
  $('#gSourceUrl').value = t.link || '';
  $('#gSource').value = (t.sources || []).join(', ');
  openTab('studio');
  if (S().apiKey) $('#genForm').requestSubmit();
  else toast('Masukkan API key AI di Tetapan dulu', true);
}

// =========================================================
// Utama
// =========================================================
function renderHome() {
  const { hour, wd, date } = myParts();
  const salam = hour < 12 ? 'Selamat pagi' : hour < 15 ? 'Selamat tengah hari' : hour < 19 ? 'Selamat petang' : 'Selamat malam';
  $('#greeting').textContent = `${salam}${S().name ? `, ${S().name}` : ''} 👋`;
  $('#setupBanner').classList.toggle('hidden', !!S().apiKey);

  // Pelan hari ini
  const plan = (state.plan?.days || DEFAULT_PLAN)[wd] || [];
  const todays = state.posts.filter((p) => p.planned_at && p.status === 'draft' && myParts(new Date(p.planned_at)).date === date);
  $('#todayCard').innerHTML = plan.length || todays.length ? `
    <div class="card today">
      <div class="section-head tight"><h3>📅 Hari ini · ${DAY_NAMES[wd]}</h3><a class="link" href="#kalendar" data-goto="kalendar">Kalendar →</a></div>
      ${plan.map((s, i) => `<div class="slot-row"><span class="slot-time">${esc(s.time || '')}</span><span class="slot-type">${esc(SLOT_TYPES[s.type]?.label || s.type)}</span><button class="btn sm" data-slot="${i}">Mula ✨</button></div>`).join('')}
      ${todays.map((p) => `<div class="slot-row"><span class="slot-time">${fmtTime(p.planned_at).split(', ').pop()}</span><span class="slot-type ellip">📝 ${esc(p.parts[0].slice(0, 60))}</span><button class="btn sm" data-goto="draf">Buka</button></div>`).join('')}
    </div>` : '';
  $('#todayCard').onclick = (e) => {
    const b = e.target.closest('[data-slot]');
    if (b) startSlot(plan[Number(b.dataset.slot)]);
  };

  // Acara jualan seterusnya
  const ev = upcomingEvents(new Date(), 45)[0];
  $('#nextEvent').innerHTML = ev ? `
    <div class="event-card" data-goto="kalendar">
      <span class="ev-emoji">${ev.emoji}</span>
      <div><b>${esc(ev.name)}</b><small>${daysUntil(ev.date) === 0 ? 'Hari ini!' : `${daysUntil(ev.date)} hari lagi`} · ${esc(ev.ideas[0])}</small></div>
      <span class="go">→</span>
    </div>` : '';

  const posted = state.posts.filter((p) => p.status === 'posted');
  const komisen = state.products.reduce((s, p) => s + (Number(p.commission) || 0), 0);
  renderStreak(posted);
  $('#stats').innerHTML = `
    <div class="stat"><b>${state.posts.filter((p) => p.status === 'draft').length}</b><span>Draf</span></div>
    <div class="stat"><b>${posted.length}</b><span>Jumlah post</span></div>
    <div class="stat"><b>RM${komisen.toFixed(komisen >= 100 ? 0 : 2)}</b><span>Komisen</span></div>`;

  if (!trendData) { $('#homeTrends').innerHTML = '<div class="skeleton"></div>'; return; }
  const all = allTrends();
  const hot = all.filter((t) => t.meletup).slice(0, 3);
  $('#homeMeletup').innerHTML = hot.length ? `
    <div class="section-head"><h3>🚀 Sedang meletup</h3></div>
    <div class="list">${hot.map((t, i) => `<div class="mini-trend hot" data-hot="${i}"><span class="rank">🚀</span><span class="t">${esc(t.title)}</span><span class="go">Jana ✨</span></div>`).join('')}</div>` : '';
  $('#homeMeletup').onclick = (e) => { const r = e.target.closest('[data-hot]'); if (r) useTrend(hot[Number(r.dataset.hot)]); };
  const top = all.slice(0, 4);
  $('#homeTrends').innerHTML = top.map((t, i) => `
    <div class="mini-trend" data-home-gen="${i}"><span class="rank">${i + 1}</span><span class="t">${esc(t.title)}</span><span class="go">Jana ✨</span></div>`).join('');
  $('#homeTrends').onclick = (e) => { const r = e.target.closest('[data-home-gen]'); if (r) useTrend(top[Number(r.dataset.homeGen)]); };
}

// --- Streak & sasaran mingguan ---
export function streakInfo(posted = state.posts.filter((p) => p.status === 'posted')) {
  const days = new Set(posted.map((p) => myParts(new Date(p.posted_at)).date));
  const today = myParts().date;
  let d = new Date();
  if (!days.has(today)) d = new Date(Date.now() - 86400000);
  let streak = 0;
  while (days.has(myParts(d).date)) { streak++; d = new Date(d.getTime() - 86400000); }
  // Minggu bermula Isnin (waktu Malaysia)
  const { wd } = myParts();
  const startOffset = (wd + 6) % 7;
  const weekStart = new Date(Date.now() - startOffset * 86400000);
  const weekStartStr = myParts(weekStart).date;
  const thisWeek = posted.filter((p) => myParts(new Date(p.posted_at)).date >= weekStartStr).length;
  let best = 0, run = 0, prev = null;
  [...days].sort().forEach((ds) => {
    const cur = new Date(`${ds}T12:00:00`);
    run = prev && Math.round((cur - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = cur;
  });
  return { streak, postedToday: days.has(today), thisWeek, best };
}
function renderStreak(posted) {
  const goal = get('weeklyGoal', 5);
  const { streak, postedToday, thisWeek, best } = streakInfo(posted);
  const pct = Math.min(100, Math.round((thisWeek / goal) * 100));
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = myParts(new Date(Date.now() - (6 - i) * 86400000));
    const has = posted.some((p) => myParts(new Date(p.posted_at)).date === d.date);
    return `<i class="${has ? 'on' : ''}" title="${DAY_NAMES[d.wd]}">${DAY_NAMES[d.wd][0]}</i>`;
  }).join('');
  $('#streakCard').innerHTML = `
    <div class="streak">
      <div class="st-left">
        <span class="st-fire ${streak ? 'lit' : ''}">🔥</span>
        <div><b>${streak} hari</b><small>${streak ? (postedToday ? 'berturut-turut — hebat!' : 'Post hari ini untuk kekalkan streak!') : 'Mula streak dengan post hari ini'}${best > streak ? ` · rekod ${best}` : ''}</small></div>
      </div>
      <div class="st-week">${dots}</div>
      <div class="st-goal">
        <div class="st-goal-top"><span>🎯 Sasaran minggu ini</span><b>${thisWeek}/${goal}</b></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        ${thisWeek >= goal ? '<small>🏆 Sasaran tercapai!</small>' : ''}
      </div>
    </div>`;
}

export function startSlot(slot) {
  const preset = { ...(SLOT_TYPES[slot.type]?.studio || {}) };
  if (slot.type === 'series' && slot.series_id) preset.series = slot.series_id;
  applyPreset(preset);
  const st = SLOT_TYPES[slot.type] || {};
  if (st.pick) {
    const grp = st.group || slot.type;
    const match = (t) => st.pick === 'any' || (st.pick === 'group' ? groupOf(t.category) === grp : t.category === slot.type);
    const pick = allTrends().find((t) => match(t) && !usedTopics().has(topicKey(t.title)));
    if (pick) return useTrend(pick, st.studio?.mode === 'info' ? 'info' : undefined);
  }
  openTab('studio');
}

// =========================================================
// Studio
// =========================================================
const DEFAULT_STUDIO = { mode: 'topic', multi: false, format: 'single', parts: 4, count: 3, tone: 'santai', lang: 'ms', style: 'wajib', numbering: true, disclosure: true, hook: '', useStyle: false };
const studio = { ...DEFAULT_STUDIO, ...get('studio', {}) };
const saveStudio = () => set('studio', studio);
let multiProducts = get('multiDraft', []);
const saveMulti = () => set('multiDraft', multiProducts);

function setSeg(sel, v) { $$(`${sel} button`).forEach((b) => b.classList.toggle('active', b.dataset.v === v)); }
function syncStudioUI() {
  setSeg('#modeSeg', studio.mode);
  setSeg('#affSeg', studio.multi ? 'multi' : 'single');
  setSeg('#formatSeg', studio.format);
  const aff = studio.mode === 'affiliate';
  const info = studio.mode === 'info';
  const multi = aff && studio.multi;
  $('#topicFields').classList.toggle('hidden', aff);
  for (const id of ['#seriesRow', '#toneRow', '#hookBlock', '#countRow']) $(id).classList.toggle('hidden', info);
  $('#infoWebRow').classList.toggle('hidden', !info || S().provider === 'openai');
  const limited = webLimited();
  $('#infoWebNote').classList.toggle('hidden', !info || !limited || S().provider === 'openai');
  if (limited && !studio.webOverride) $('#infoWeb').checked = false;
  $('#infoHint').classList.toggle('hidden', !info);
  $('#genBtn').innerHTML = info ? '🖼️ Jana kad info' : '✨ Jana sekarang';
  $('#affFields').classList.toggle('hidden', !aff);
  $('#singleProduct').classList.toggle('hidden', multi);
  $('#multiProducts').classList.toggle('hidden', !multi);
  $('#formatBox').classList.toggle('hidden', multi || info);
  $('#threadOpts').classList.toggle('hidden', info || !(studio.format === 'thread' || multi));
  $('#partsOut').closest('.stepper-row').classList.toggle('hidden', multi);
  studio.count = Math.min(Math.max(studio.count, 1), studio.format === 'thread' || multi ? 3 : 5);
  $('#countOut').textContent = studio.count;
  $('#partsOut').textContent = studio.parts;
  $('#numberingLabel').textContent = `Tambah nombor (1/${studio.parts}, 2/${studio.parts}…)`;
  $('#numbering').checked = studio.numbering;
  $('#pDisclosure').checked = studio.disclosure;
  $('#useStyle').checked = studio.useStyle;
  $('#styleToggleRow').classList.toggle('hidden', !S().styleGuide);
  renderChips('#toneChips', TONES, 'tone');
  renderChips('#langChips', LANGS, 'lang');
  renderChips('#styleChips', AFF_STYLES, 'style');
  $('#hookRow').innerHTML = studio.hook
    ? `<span class="chip on hook-chip">🪝 ${esc(studio.hook)} <span class="x" data-clear-hook>✕</span></span>`
    : '<button type="button" class="btn sm" data-pick-hook>🪝 Pilih dari bank hook</button><span class="muted small">atau biar AI pilih</span>';
  renderSeriesSelect();
  if (multi) renderMultiList();
  saveStudio();
}
function renderChips(sel, items, key) {
  $(sel).innerHTML = Object.entries(items).map(([k, v]) => `<button type="button" class="chip ${k === studio[key] ? 'on' : ''}" data-k="${k}">${esc(v.label)}</button>`).join('');
  $(sel).onclick = (e) => { const b = e.target.closest('.chip'); if (b) { studio[key] = b.dataset.k; syncStudioUI(); } };
}
export function applyPreset(p = {}) {
  if (p.mode) studio.mode = p.mode;
  if ('multi' in p) studio.multi = p.multi;
  if (p.format) studio.format = p.format;
  if (p.category) setTimeout(() => { $('#gCategory').value = p.category; });
  if (p.series) { studio.mode = 'topic'; setTimeout(() => { $('#gSeries').value = p.series; onSeriesChange(); }); }
  if (p.hook !== undefined) studio.hook = p.hook;
  if (p.extra) $('#gExtra').value = p.extra;
  if (p.topic !== undefined) $('#gTopic').value = p.topic;
  if (p.product) fillProduct(p.product);
  syncStudioUI();
}
$('#modeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { studio.mode = b.dataset.v; syncStudioUI(); } });
$('#affSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { studio.multi = b.dataset.v === 'multi'; syncStudioUI(); } });
$('#formatSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { studio.format = b.dataset.v; syncStudioUI(); } });
$('#partsMinus').addEventListener('click', () => { studio.parts = Math.max(2, studio.parts - 1); syncStudioUI(); });
$('#partsPlus').addEventListener('click', () => { studio.parts = Math.min(8, studio.parts + 1); syncStudioUI(); });
$('#countMinus').addEventListener('click', () => { studio.count--; syncStudioUI(); });
$('#countPlus').addEventListener('click', () => { studio.count++; syncStudioUI(); });
$('#numbering').addEventListener('change', (e) => { studio.numbering = e.target.checked; saveStudio(); });
$('#pDisclosure').addEventListener('change', (e) => { studio.disclosure = e.target.checked; saveStudio(); });
$('#infoWeb').addEventListener('change', (e) => {
  if (e.target.checked && webLimited()) { markWebLimited(false); studio.webOverride = true; syncStudioUI(); toast('Akan cuba carian web semula'); }
});
$('#useStyle').addEventListener('change', (e) => { studio.useStyle = e.target.checked; saveStudio(); });
$('#hookRow').addEventListener('click', (e) => {
  if (e.target.closest('[data-clear-hook]')) { studio.hook = ''; syncStudioUI(); }
  if (e.target.closest('[data-pick-hook]')) openHookPicker();
});
function openHookPicker() {
  const panel = openSheet('🪝 Pilih hook', Object.values(HOOK_GROUPS).map((g) => `
    <div class="field-label">${esc(g.label)}</div>
    <div class="list hook-pick">${g.hooks.map((h) => `<button class="hook-item" data-hook="${esc(h)}">${esc(h)}</button>`).join('')}</div>`).join(''));
  panel.addEventListener('click', (e) => {
    const h = e.target.closest('[data-hook]');
    if (h) { studio.hook = h.dataset.hook; syncStudioUI(); panel.close(); }
  });
}

// --- Siri ---
function renderSeriesSelect() {
  const sel = $('#gSeries');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Tiada —</option>' + state.series.map((s) => `<option value="${s.id}">${esc(s.emoji || '📚')} ${esc(s.name)} (#${s.nextNo || 1})</option>`).join('');
  sel.value = state.series.some((s) => s.id === cur) ? cur : '';
}
function onSeriesChange() {
  const s = state.series.find((x) => x.id === $('#gSeries').value);
  $('#gTopic').placeholder = s ? `(kosongkan — AI pilih subtopik untuk ${s.name} #${s.nextNo || 1})` : 'cth. STR fasa 4 mula dibayar minggu ini';
  if (s) {
    if (s.category) $('#gCategory').value = s.category;
    if (s.format) { studio.format = s.format; }
    if (s.tone) studio.tone = s.tone;
    syncStudioUI();
  }
}
$('#gSeries').addEventListener('change', onSeriesChange);

// --- Produk tunggal ---
function readProduct() {
  return { link: $('#pLink').value.trim(), name: $('#pName').value.trim(), price: $('#pPrice').value.trim(), highlights: $('#pHighlights').value.trim(), audience: $('#pAudience').value.trim() };
}
export function fillProduct(p) {
  $('#pLink').value = p.link || '';
  $('#pName').value = p.name || '';
  $('#pPrice').value = p.price || '';
  $('#pHighlights').value = p.highlights || '';
  $('#pAudience').value = p.audience || '';
}
$('#pLink').addEventListener('change', () => {
  const guess = nameFromUrl($('#pLink').value.trim());
  if (guess && !$('#pName').value) $('#pName').value = guess;
});
async function autoFill(btn, link, hint, apply, noteEl) {
  return busy(btn, async () => {
    if (!/^https?:\/\/\S+$/i.test(link)) throw new Error('Tampal link produk yang sah dulu (bermula https://).');
    if (noteEl) noteEl.textContent = '🔎 AI sedang cari maklumat produk… (10–30 saat)';
    const info = await researchProduct(S(), link, hint);
    apply(info);
    if (noteEl) noteEl.textContent = `${info.found ? '✅' : '⚠️'} ${info.note}`;
    toast(info.found ? '✨ Maklumat produk diisi' : 'Sebahagian maklumat diisi — sila semak', !info.found && !info.name);
  }, 'Mencari…');
}
$('#autoFillBtn').addEventListener('click', (e) => autoFill(e.currentTarget, $('#pLink').value.trim(), $('#pName').value.trim(), (info) => {
  if (info.name) $('#pName').value = info.name;
  if (info.price) $('#pPrice').value = info.price;
  if (info.highlights) $('#pHighlights').value = info.highlights;
  if (info.audience) $('#pAudience').value = info.audience;
}, $('#autoFillNote')));

export function upsertProduct(p) {
  if (!p.link) return null;
  let rec = state.products.find((x) => x.link === p.link);
  if (rec) Object.assign(rec, Object.fromEntries(Object.entries(p).filter(([, v]) => v)), { updated_at: nowIso() });
  else {
    rec = touch({ id: uid(), clicks: 0, sales: 0, commission: 0, posts: 0, created_at: nowIso(), ...p });
    state.products.unshift(rec);
  }
  save('products');
  return rec;
}
$('#saveProductBtn').addEventListener('click', () => {
  const p = readProduct();
  if (!p.link || !p.name) return toast('Isi link & nama produk dulu', true);
  upsertProduct(p);
  toast('📦 Produk disimpan');
});
function pickProducts(multi, onPick) {
  if (!state.products.length) return toast('Simpanan produk kosong. Simpan produk dulu.', true);
  const panel = openSheet('📦 Pilih produk', `
    <div class="list">${state.products.map((p) => `
      <label class="pick-row"><input type="${multi ? 'checkbox' : 'radio'}" name="pp" value="${p.id}" />
        <span><b>${esc(p.name)}</b><small>${esc(p.price || '')} ${p.commission ? `· RM${Number(p.commission).toFixed(2)} komisen` : ''}</small></span></label>`).join('')}</div>
    <button class="btn primary block pp-ok" style="margin-top:12px">Guna</button>`);
  $('.pp-ok', panel).addEventListener('click', () => {
    const ids = $$('input:checked', panel).map((i) => i.value);
    onPick(state.products.filter((p) => ids.includes(p.id)));
    panel.close();
  });
}
$('#pickProductBtn').addEventListener('click', () => pickProducts(false, ([p]) => { if (p) fillProduct(p); }));

// --- Banyak produk ---
function renderMultiList() {
  if (!multiProducts.length) multiProducts = [{ link: '', name: '', price: '', highlights: '' }, { link: '', name: '', price: '', highlights: '' }];
  $('#multiList').innerHTML = multiProducts.map((p, i) => `
    <div class="mp" data-i="${i}">
      <div class="mp-head"><b>${i + 1}️⃣ Produk ${i + 1}</b><button type="button" class="mini" data-mp-del>✕</button></div>
      <div class="input-row"><input data-f="link" type="url" placeholder="Link Shopee" value="${esc(p.link)}" /><button type="button" class="btn sm accent" data-mp-auto>✨</button></div>
      <input data-f="name" placeholder="Nama produk" value="${esc(p.name)}" />
      <div class="row"><input data-f="price" placeholder="Harga" value="${esc(p.price)}" /><input data-f="highlights" placeholder="Kelebihan ringkas" value="${esc(p.highlights)}" /></div>
    </div>`).join('');
}
$('#multiList').addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const i = Number(e.target.closest('.mp').dataset.i);
  multiProducts[i][f] = e.target.value;
  if (f === 'link' && !multiProducts[i].name) {
    const g = nameFromUrl(e.target.value);
    if (g) { multiProducts[i].name = g; $('[data-f=name]', e.target.closest('.mp')).value = g; }
  }
  saveMulti();
});
$('#multiList').addEventListener('click', (e) => {
  const mp = e.target.closest('.mp');
  if (!mp) return;
  const i = Number(mp.dataset.i);
  if (e.target.closest('[data-mp-del]')) { multiProducts.splice(i, 1); saveMulti(); renderMultiList(); }
  const a = e.target.closest('[data-mp-auto]');
  if (a) {
    autoFill(a, multiProducts[i].link, multiProducts[i].name, (info) => {
      Object.assign(multiProducts[i], Object.fromEntries(Object.entries({ name: info.name, price: info.price, highlights: info.highlights, audience: info.audience }).filter(([, v]) => v)));
      saveMulti(); renderMultiList();
    });
  }
});
$('#addMultiBtn').addEventListener('click', () => {
  if (multiProducts.length >= MAX_MULTI) return toast(`Maksimum ${MAX_MULTI} produk`, true);
  multiProducts.push({ link: '', name: '', price: '', highlights: '' }); saveMulti(); renderMultiList();
});
$('#pickMultiBtn').addEventListener('click', () => pickProducts(true, (list) => {
  multiProducts = [...multiProducts.filter((p) => p.link || p.name), ...list.map(({ link, name, price, highlights, audience }) => ({ link, name, price, highlights, audience }))].slice(0, MAX_MULTI);
  saveMulti(); renderMultiList();
}));

// --- Jana ---
let lastGen = null;
$('#genForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#genBtn'), async () => {
    const series = studio.mode === 'topic' ? state.series.find((s) => s.id === $('#gSeries').value) : null;
    const opts = {
      ...aiCtx(), mode: studio.mode, format: studio.format, parts: studio.parts, count: studio.count,
      tone: studio.tone, numbering: studio.numbering, hook: studio.hook, extra: $('#gExtra').value.trim(),
    };
    if (studio.mode === 'affiliate') {
      Object.assign(opts, { style: studio.style, used: $('#pUsed').checked, disclosure: studio.disclosure });
      if (studio.multi) {
        const list = multiProducts.filter((p) => p.link || p.name);
        if (list.length < 2) throw new Error('Tambah sekurang-kurangnya 2 produk.');
        if (list.some((p) => !/^https?:\/\//i.test(p.link))) throw new Error('Setiap produk perlu link yang sah (https://).');
        opts.products = list; opts.topic = $('#mTheme').value.trim();
      } else {
        opts.product = readProduct();
        if (opts.product.link && !/^https?:\/\//i.test(opts.product.link)) throw new Error('Link mesti bermula dengan https://');
      }
    } else {
      Object.assign(opts, { topic: $('#gTopic').value.trim(), snippet: $('#gSnippet').value.trim(), category: $('#gCategory').value, source: $('#gSource').value });
      if (series) opts.series = { name: series.name, emoji: series.emoji, desc: series.desc, no: series.nextNo || 1, history: (series.history || []).map((h) => h.topic) };
    }
    if (studio.mode === 'info') return makeInfo();
    const box = $('#genResults');
    box.innerHTML = '<div class="section-head"><h3>Sedang menulis…</h3></div><div class="skeleton" style="height:240px"></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const res = await generate(S(), opts);
      const multi = !!opts.products;
      const meta = {
        kind: multi || studio.format === 'thread' ? 'thread' : 'single', mode: studio.mode, tone: studio.tone, lang: studio.lang,
        category: studio.mode === 'topic' ? opts.category : 'affiliate',
        topic: studio.mode === 'topic' ? (opts.topic || res.topic || '') : multi ? (opts.topic || opts.products.map((p) => p.name).join(', ')) : opts.product.name,
        source_url: studio.mode === 'topic' ? $('#gSourceUrl').value : multi ? '' : opts.product.link,
        products: studio.mode === 'affiliate' ? (multi ? opts.products : [opts.product]) : null,
        series_id: series?.id || null, series_no: series ? (series.nextNo || 1) : null,
      };
      lastGen = res.variants.map((v) => ({ ...meta, ...v }));
      renderVariants(lastGen);
    } catch (err) { box.innerHTML = ''; throw err; }
  }, 'AI sedang menulis…');
});

function renderVariants(items) {
  const box = $('#genResults');
  box.innerHTML = `
    <div class="variants-head">
      <h3>✨ ${items.length} variasi${items[0].series_no ? ` · Episod #${items[0].series_no}` : ''}</h3>
      <div class="dots">${items.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    ${items[0].series_id && items[0].topic ? `<p class="muted small">Subtopik: ${esc(items[0].topic)}</p>` : ''}
    <div class="carousel"></div>
    ${items.length > 1 ? '<p class="swipe-hint">← Leret untuk lihat variasi lain →</p>' : ''}`;
  const car = $('.carousel', box);
  items.forEach((it, i) => car.appendChild(threadCard(it, { label: `Variasi ${i + 1}` })));
  requestAnimationFrame(() => {
    $$('.tpart, .tcomment textarea', car).forEach(autosize);
    const first = car.firstElementChild;
    if (first) typewriter($$('.tpart', first), (ta) => autosize(ta)).then(() => $$('.tpart', first).forEach(autosize));
  });
  const dots = $$('.dots i', box);
  car.addEventListener('scroll', () => {
    const w = car.firstElementChild?.getBoundingClientRect().width || 1;
    const idx = Math.round(car.scrollLeft / (w + 12));
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
  }, { passive: true });
}

// =========================================================
// Kad pratonton Threads
// =========================================================
function recordSaved(item, status) {
  const p = touch({
    id: uid(), kind: item.kind, mode: item.mode || 'topic', tone: item.tone, lang: item.lang,
    category: item.category, topic: item.topic, source_url: item.source_url,
    product_ids: [], series_id: item.series_id || null, series_no: item.series_no || null,
    parts: item.parts, comment: item.comment || '', status, info: item.info || null,
    created_at: nowIso(), posted_at: status === 'posted' ? nowIso() : null, planned_at: null, engagement: null,
  });
  if (item.products?.length) {
    p.product_ids = item.products.filter((x) => x.link).map((x) => { const r = upsertProduct(x); r.posts = (r.posts || 0) + 1; return r.id; });
    save('products');
  }
  if (item.series_id) {
    const s = state.series.find((x) => x.id === item.series_id);
    if (s && !(s.history || []).some((h) => h.no === item.series_no)) {
      s.history = [...(s.history || []), { no: item.series_no, topic: item.topic || p.parts[0].slice(0, 80), post_id: p.id, at: nowIso() }];
      s.nextNo = Math.max(s.nextNo || 1, item.series_no + 1);
      touch(s); save('series');
    }
  }
  if (item.mode !== 'affiliate') markUsed(item.topic);
  state.posts.unshift(p);
  save('posts');
  return p;
}

export function threadCard(item, { saved = false, label = '', onRemoved } = {}) {
  const card = document.createElement('div');
  card.className = 'tcard';
  let history = null; // untuk "Asal" selepas ubah
  let nextIdx = 0;     // untuk "Salin seterusnya"
  const initial = (displayName()[0] || '?').toUpperCase();
  const steps = () => [...item.parts.map((_, i) => i), ...(item.comment ? ['c'] : [])];
  const nextLabel = () => {
    const st = steps();
    if (nextIdx >= st.length) return `${icon('refresh', 16)} Mula semula`;
    return st[nextIdx] === 'c' ? `${icon('message', 16)} Salin komen` : `${icon('next', 16)} Salin ${st[nextIdx] + 1}/${item.parts.length}`;
  };

  function render() {
    const n = item.parts.length;
    const hasComment = !!item.comment || item.mode === 'affiliate';
    const e = item.engagement || {};
    card.innerHTML = `
      <div class="tcard-meta">
        ${label ? `<span class="tag acc">${esc(label)}</span>` : ''}
        ${item.mode === 'affiliate' ? `<span class="tag">🛍️ ${item.products?.length > 1 || item.product_ids?.length > 1 ? 'Senarai produk' : 'Affiliate'}</span>` : ''}
        ${item.series_no ? `<span class="tag">📚 #${item.series_no}</span>` : ''}
        ${n > 1 ? `<span class="tag">🧵 ${n} bahagian</span>` : ''}
        ${item.planned_at && item.status === 'draft' ? `<span class="tag acc">📅 ${esc(fmtTime(item.planned_at))}</span>` : ''}
        ${item.label && LABELS[item.label] ? `<span class="tag lbl" style="--lc:${LABELS[item.label].color}">● ${esc(LABELS[item.label].name)}</span>` : ''}
        ${item.status === 'posted' ? `<span class="tag ok">✓ Dipost ${esc(fmtTime(item.posted_at))}</span>` : ''}
      </div>
      ${n > 1 ? '<div class="thread-tip">💡 <b>Buka di Threads</b> untuk bahagian 1. Bahagian seterusnya: <b>Salin</b> → tampal di <b>"Tambah ke bebenang"</b>.</div>' : ''}
      ${item.parts.map((p, i) => `
        <div class="tpost${i === n - 1 && !hasComment ? ' last' : ''}" data-i="${i}">
          <div class="tleft"><div class="avatar">${esc(initial)}</div><div class="tline"></div></div>
          <div class="tbody">
            <div class="thead"><b>${esc(displayName())}</b><span class="muted">@${esc(userName())}${n > 1 ? ` · ${i + 1}/${n}` : ''}</span></div>
            <textarea class="tpart" rows="2" spellcheck="false"></textarea>
            ${i === 0 ? '<div class="hook-score"></div>' : ''}
            <div class="tfoot">
              <span class="counter"></span>
              <button type="button" class="mini act-regen" title="Tulis semula bahagian ini">↻</button>
              <button type="button" class="mini act-copy-part">📋 Salin</button>
            </div>
          </div>
        </div>`).join('')}
      ${hasComment ? `
        <div class="tcomment">
          <div class="tc-label"><span>💬 Komen pertama ${item.mode === 'affiliate' ? '(link di sini)' : ''}</span><button type="button" class="mini act-copy-comment">📋 Salin</button></div>
          <textarea rows="1" spellcheck="false"></textarea>
        </div>` : ''}
      <div class="quick">
        ${Object.entries(QUICK_TRANSFORMS).map(([k, v]) => `<button type="button" class="chip sm" data-tf="${k}">${v.label}</button>`).join('')}
        <button type="button" class="chip sm" data-lang-menu>🌐 Bahasa</button>
        ${history ? '<button type="button" class="chip sm on" data-undo>↩︎ Asal</button>' : ''}
      </div>
      ${item.status === 'posted' && saved ? `
        <div class="engage">
          <div class="field-label">📊 Prestasi post (untuk Insight)</div>
          <div class="eg-grid">
            <label>❤️<input type="number" min="0" inputmode="numeric" data-eg="likes" value="${e.likes ?? ''}" placeholder="Suka" /></label>
            <label>💬<input type="number" min="0" inputmode="numeric" data-eg="replies" value="${e.replies ?? ''}" placeholder="Balas" /></label>
            <label>🔁<input type="number" min="0" inputmode="numeric" data-eg="reposts" value="${e.reposts ?? ''}" placeholder="Kongsi" /></label>
            <label>👁️<input type="number" min="0" inputmode="numeric" data-eg="views" value="${e.views ?? ''}" placeholder="Tontonan" /></label>
          </div>
        </div>` : ''}
      <div class="tactions">
        <button type="button" class="btn primary act-threads">${icon('thread', 18)} Buka di Threads</button>
        ${n > 1 ? `<button type="button" class="btn accent act-next wide">${nextLabel()}</button>` : ''}
        <button type="button" class="btn act-copy-all">${icon('copy', 16)} Salin${n > 1 ? ' semua' : ''}</button>
        <button type="button" class="btn act-preview">${icon('phone', 16)} Pratonton</button>
        <button type="button" class="btn act-score">${icon('target', 16)} Skor hook</button>
        <button type="button" class="btn act-info">${icon('chart', 16)} Kad info</button>
        <button type="button" class="btn act-image">${icon('image', 16)} Kad petikan</button>
        ${saved ? '' : `<button type="button" class="btn act-save">${icon('bookmark', 16)} Simpan</button>`}
        ${saved && item.status === 'draft' ? `<button type="button" class="btn act-plan">${icon('calendar', 16)} Jadual</button>` : ''}
        ${saved ? `<button type="button" class="btn act-label">${icon('tag', 16)} Label</button>` : ''}
        ${item.status === 'posted' ? `<button type="button" class="btn act-unpost">${icon('undo', 16)} Belum post</button>` : `<button type="button" class="btn act-posted">${icon('check', 16)} Sudah post</button>`}
        ${saved ? `<button type="button" class="btn danger act-delete">${icon('trash', 16)} Padam</button>` : ''}
        ${item.source_url ? `<a class="btn wide" href="${esc(item.source_url)}" target="_blank" rel="noopener">${icon('external', 16)} ${item.mode === 'affiliate' ? 'Buka produk' : 'Sumber'}</a>` : ''}
      </div>`;

    const tas = $$('.tpart', card);
    tas.forEach((ta, i) => { ta.value = item.parts[i]; updateCounter(ta); });
    const cta = $('.tcomment textarea', card);
    if (cta) cta.value = item.comment || '';
    if (card.isConnected) requestAnimationFrame(() => $$('.tpart, .tcomment textarea', card).forEach(autosize));
  }

  const tas = () => $$('.tpart', card);
  const current = () => ({ parts: tas().map((t) => t.value), comment: $('.tcomment textarea', card)?.value || '' });
  function updateCounter(ta) {
    const c = $('.counter', ta.closest('.tbody'));
    const k = len(ta.value);
    c.textContent = `${k}/${MAX_CHARS}`;
    c.classList.toggle('over', k > MAX_CHARS);
  }
  let saveTimer;
  function persist() {
    Object.assign(item, current());
    if (!saved) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const p = state.posts.find((x) => x.id === item.id);
      if (p) { Object.assign(p, current()); touch(p); save('posts'); }
    }, 500);
  }
  const tooLong = () => tas().some((t) => len(t.value) > MAX_CHARS);

  card.addEventListener('input', (e) => {
    if (e.target.matches('.tpart')) { autosize(e.target); updateCounter(e.target); persist(); }
    if (e.target.matches('.tcomment textarea')) { autosize(e.target); persist(); }
    if (e.target.matches('[data-eg]')) {
      const p = state.posts.find((x) => x.id === item.id);
      if (!p) return;
      p.engagement = { ...(p.engagement || {}), [e.target.dataset.eg]: e.target.value === '' ? null : Number(e.target.value) };
      item.engagement = p.engagement;
      touch(p);
      clearTimeout(saveTimer); saveTimer = setTimeout(() => save('posts'), 500);
    }
  });

  card.addEventListener('click', async (e) => {
    const t = e.target;
    const btn = t.closest('button');
    if (!btn) return;

    if (btn.matches('.act-copy-part')) {
      const i = Number(btn.closest('.tpost').dataset.i);
      const n = item.parts.length;
      return copyText(tas()[i].value, n > 1 ? `📋 Bahagian ${i + 1}/${n} disalin` : '📋 Disalin!');
    }
    if (btn.matches('.act-copy-comment')) return copyText($('.tcomment textarea', card).value, '📋 Komen disalin');
    if (btn.matches('.act-regen')) {
      return busy(btn, async () => {
        const i = Number(btn.closest('.tpost').dataset.i);
        history = { parts: [...current().parts], comment: current().comment };
        const text = await regeneratePart(S(), { ...aiCtx(), lang: item.lang || studio.lang, parts: current().parts, index: i, tone: item.tone });
        item.parts = current().parts; item.parts[i] = text; item.comment = current().comment;
        render(); persist(); toast('↻ Ditulis semula');
      }, '');
    }
    const tf = btn.dataset.tf;
    if (tf) {
      return busy(btn, async () => {
        const cur = current();
        history = { parts: [...cur.parts], comment: cur.comment };
        const out = await transform(S(), { ...aiCtx(), lang: item.lang || studio.lang, parts: cur.parts, comment: cur.comment, instruction: QUICK_TRANSFORMS[tf].ins });
        Object.assign(item, out);
        render(); persist(); toast('✨ Dikemas kini');
      }, '');
    }
    if (btn.matches('[data-lang-menu]')) {
      const panel = openSheet('🌐 Tukar bahasa / loghat', `<div class="chips">${Object.entries(LANGS).map(([k, v]) => `<button class="chip" data-lang="${k}">${esc(v.label)}</button>`).join('')}</div>`);
      panel.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-lang]');
        if (!b) return;
        busy(b, async () => {
          const cur = current();
          history = { parts: [...cur.parts], comment: cur.comment };
          const out = await transform(S(), { ...aiCtx(), lang: b.dataset.lang, parts: cur.parts, comment: cur.comment, instruction: `Tukar keseluruhan post ke ${LANGS[b.dataset.lang].desc}.` });
          Object.assign(item, out, { lang: b.dataset.lang });
          render(); persist(); panel.close(); toast('🌐 Bahasa ditukar');
        }, '');
      });
      return;
    }
    if (btn.matches('[data-undo]')) {
      Object.assign(item, history); history = null; render(); persist(); return toast('↩︎ Dikembalikan');
    }
    if (btn.matches('.act-score')) {
      return busy(btn, async () => {
        const r = await scoreHook(S(), { text: tas()[0].value, mode: item.mode });
        const box = $('.hook-score', card);
        const col = r.score >= 8 ? 'ok' : r.score >= 5 ? 'warn' : 'bad';
        box.innerHTML = `
          <div class="hs">
            <div class="hs-top"><span class="hs-score ${col}">${r.score}<small>/10</small></span><span>${esc(r.verdict)}</span><button type="button" class="mini" data-hs-close>✕</button></div>
            ${r.good.length ? `<div class="hs-list ok">${r.good.map((g) => `<div>✅ ${esc(g)}</div>`).join('')}</div>` : ''}
            ${r.tips.length ? `<div class="hs-list">${r.tips.map((g) => `<div>💡 ${esc(g)}</div>`).join('')}</div>` : ''}
            ${r.better.length ? `<div class="field-label" style="margin:8px 0 4px">Hook alternatif — tekan untuk guna:</div>${r.better.map((b) => `<button type="button" class="hook-item" data-use-hook="${esc(b)}">${esc(b)}</button>`).join('')}` : ''}
          </div>`;
      }, 'Menilai…');
    }
    if (btn.matches('[data-hs-close]')) { $('.hook-score', card).innerHTML = ''; return; }
    if (btn.matches('[data-use-hook]')) {
      const ta = tas()[0];
      const lines = ta.value.split('\n');
      history = { parts: [...current().parts], comment: current().comment };
      lines[0] = btn.dataset.useHook;
      ta.value = lines.join('\n');
      autosize(ta); updateCounter(ta); persist();
      $('.hook-score', card).innerHTML = '';
      return toast('🪝 Hook ditukar');
    }
    if (btn.matches('.act-image')) return openImageCard({ parts: current().parts, name: displayName(), user: userName() });
    if (btn.matches('.act-info')) {
      const onSave = saved ? (d) => {
        const p = state.posts.find((x) => x.id === item.id);
        if (p) { p.info = d; item.info = d; touch(p); save('posts'); toast('💾 Kad info disimpan dalam draf'); }
      } : null;
      if (item.info) return openInfoSheet(JSON.parse(JSON.stringify(item.info)), { ...infoCtx(item.category), onSave });
      return busy(btn, async () => {
        const d = await generateInfo(S(), { ...aiCtx(), topic: current().parts.join('\n\n'), fromPost: true, category: item.category });
        item.info = d;
        openInfoSheet(d, { ...infoCtx(item.category), onSave });
      }, 'Menyusun…');
    }
    if (btn.matches('.act-threads')) {
      if (len(tas()[0].value) > MAX_CHARS) return toast(`Bahagian 1 melebihi ${MAX_CHARS} aksara`, true);
      haptic();
      nextIdx = 1;
      const nb = $('.act-next', card);
      if (nb) nb.innerHTML = nextLabel();
      return window.open(threadsIntent(tas()[0].value), '_blank', 'noopener');
    }
    if (btn.matches('.act-next')) {
      const st = steps();
      if (nextIdx >= st.length) { nextIdx = 0; btn.innerHTML = nextLabel(); return; }
      const step = st[nextIdx];
      const c = current();
      if (step === 'c') copyText(c.comment, '💬 Komen disalin — tampal sebagai komen pertama');
      else copyText(c.parts[step], `📋 Bahagian ${step + 1}/${c.parts.length} disalin${step > 0 ? ' — tampal di "Tambah ke bebenang"' : ''}`);
      nextIdx++;
      btn.innerHTML = nextLabel();
      return;
    }
    if (btn.matches('.act-preview')) return openPhonePreview({ ...item, ...current() });
    if (btn.matches('.act-label')) {
      const p = state.posts.find((x) => x.id === item.id);
      const panel = openSheet('🏷️ Label', `<div class="label-grid">${Object.entries(LABELS).map(([k, l]) => `<button class="label-opt ${p.label === k ? 'on' : ''}" data-label="${k}" style="--lc:${l.color}"><i></i>${esc(l.name)}</button>`).join('')}
        <button class="label-opt ${!p.label ? 'on' : ''}" data-label=""><i style="background:transparent;border:2px dashed var(--line)"></i>Tiada label</button></div>`);
      panel.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-label]');
        if (!b) return;
        p.label = b.dataset.label || null; item.label = p.label;
        touch(p); save('posts'); haptic(); panel.close(); render();
      });
      return;
    }
    if (btn.matches('.act-copy-all')) {
      const c = current();
      return copyText(c.parts.join('\n\n— — —\n\n') + (c.comment ? `\n\n💬 Komen:\n${c.comment}` : ''), '📋 Semua disalin');
    }
    if (btn.matches('.act-save')) {
      if (tooLong()) return toast(`Ada bahagian melebihi ${MAX_CHARS} aksara`, true);
      const p = recordSaved({ ...item, ...current() }, 'draft');
      const fresh = threadCard(p, { saved: true, label: '💾 Disimpan' });
      card.replaceWith(fresh);
      haptic();
      return toast('💾 Disimpan ke Draf');
    }
    if (btn.matches('.act-posted')) {
      if (tooLong()) return toast(`Ada bahagian melebihi ${MAX_CHARS} aksara`, true);
      if (saved) {
        const p = state.posts.find((x) => x.id === item.id);
        Object.assign(p, current(), { status: 'posted', posted_at: nowIso() });
        touch(p); save('posts');
        onRemoved?.();
      } else {
        const p = recordSaved({ ...item, ...current() }, 'posted');
        card.replaceWith(threadCard(p, { saved: true }));
      }
      return celebratePosted();
    }
    if (btn.matches('.act-unpost')) {
      const p = state.posts.find((x) => x.id === item.id);
      Object.assign(p, { status: 'draft', posted_at: null }); touch(p); save('posts');
      return onRemoved?.();
    }
    if (btn.matches('.act-delete')) {
      deletePostWithUndo(item.id);
      return onRemoved?.();
    }
    if (btn.matches('.act-plan')) {
      const p = state.posts.find((x) => x.id === item.id);
      const base = p.planned_at ? new Date(p.planned_at) : new Date(Date.now() + 3600000);
      const local = new Date(base - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const panel = openSheet('📅 Jadualkan draf', `
        <div class="form">
          <label>Tarikh & masa <input type="datetime-local" class="pl-when" value="${local}" /></label>
          <p class="muted small">Draf akan muncul dalam Kalendar & "Hari ini" di Utama. App tidak post secara automatik.</p>
          <div class="row wrap"><button class="btn primary pl-ok">📅 Simpan</button>${p.planned_at ? '<button class="btn pl-clear">Buang jadual</button>' : ''}</div>
        </div>`);
      $('.pl-ok', panel).addEventListener('click', () => {
        const v = $('.pl-when', panel).value;
        if (!v) return toast('Pilih tarikh & masa', true);
        p.planned_at = new Date(v).toISOString(); item.planned_at = p.planned_at;
        touch(p); save('posts'); panel.close(); render(); toast(`📅 Dijadual ${fmtTime(p.planned_at)}`);
      });
      $('.pl-clear', panel)?.addEventListener('click', () => {
        p.planned_at = null; item.planned_at = null; touch(p); save('posts'); panel.close(); render();
      });
    }
  });

  render();
  return card;
}

// --- Onboarding 3 langkah ---
function openOnboarding() {
  let step = 0;
  const panel = openSheet('👋 Selamat datang!', '<div class="ob"></div>', { wide: true });
  panel.classList.add('onboarding');
  const origClose = panel.close;
  panel.close = () => { set('onboarded', true); origClose(); };
  const draw = () => {
    const dots = [0, 1, 2].map((i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('');
    const body = [
      `<div class="ob-hero">🧵</div>
       <h2>Jom setup dalam 1 minit</h2>
       <p class="muted">App ni bantu cari info terkini kewangan, bantuan kerajaan & e-wallet, tulis post & bebenang Threads, dan buat kad info untuk Story/Status. Mula dengan nama anda (untuk pratonton post).</p>
       <label>Nama paparan <input class="ob-name" placeholder="cth. Imran" value="${esc(S().name)}" /></label>
       <label>Username Threads <input class="ob-user" placeholder="cth. imrnwfi" value="${esc(S().user)}" /></label>`,
      `<h2>Pilih gaya anda 🎨</h2><p class="muted">Boleh tukar bila-bila masa melalui butang palet di atas.</p><div class="theme-grid"></div>`,
      `<h2>Sambung AI 🔑</h2>
       <p class="muted">Gemini ada tier <b>percuma</b>. Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> → <b>Create API key</b> → salin & tampal di sini.</p>
       <label>Penyedia <select class="ob-prov"><option value="gemini">Google Gemini (percuma)</option><option value="anthropic">Anthropic Claude</option><option value="openai">OpenAI / serasi</option></select></label>
       <label>API key <input class="ob-key" type="password" autocomplete="off" placeholder="AIza…" value="${esc(S().apiKey)}" /></label>
       <p class="muted small">🔒 Disimpan dalam browser ini sahaja.</p>`,
    ][step];
    $('.ob', panel).innerHTML = `<div class="ob-dots">${dots}</div>${body}
      <div class="ob-nav">
        ${step > 0 ? '<button class="btn ob-back">← Kembali</button>' : '<button class="btn ob-skip">Langkau</button>'}
        <button class="btn primary ob-next">${step < 2 ? 'Seterusnya →' : 'Mula guna 🚀'}</button>
      </div>`;
    if (step === 1) renderThemeGrid($('.theme-grid', panel));
    if (step === 2) $('.ob-prov', panel).value = S().provider;
  };
  const collect = () => {
    if (step === 0) Object.assign(state.settings, { name: $('.ob-name', panel).value.trim().slice(0, 40), user: $('.ob-user', panel).value.trim().replace(/^@/, '').slice(0, 30) });
    if (step === 2) Object.assign(state.settings, { provider: $('.ob-prov', panel).value, apiKey: $('.ob-key', panel).value.trim() });
    touch(state.settings); save('settings');
  };
  const finish = () => { set('onboarded', true); panel.close(); renderHome(); };
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.ob-skip')) return finish();
    if (e.target.closest('.ob-back')) { collect(); step--; return draw(); }
    if (e.target.closest('.ob-next')) {
      collect();
      if (step < 2) { step++; return draw(); }
      finish();
      toast(S().apiKey ? '🚀 Siap! Pilih topik terkini untuk mula.' : 'Boleh masukkan API key kemudian di Tetapan.');
    }
  });
  draw();
}

// --- Kad Info ---
function infoCtx(category) {
  const c = CATS[category] || {};
  const g = GRPS[c.group] || {};
  return { meta: { group: c.group, groupLabel: g.label, groupEmoji: g.emoji, subLabel: c.label, subEmoji: c.emoji }, name: displayName(), user: userName() };
}
async function makeInfo() {
  const topic = $('#gTopic').value.trim();
  if (!topic) throw new Error('Masukkan topik atau pilih dari Trending.');
  const category = $('#gCategory').value;
  const box = $('#genResults');
  box.innerHTML = '<div class="section-head"><h3>Sedang menyusun kad info…</h3></div><div class="skeleton" style="height:420px"></div>';
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const data = await generateInfo(S(), {
      ...aiCtx(), topic, snippet: $('#gSnippet').value.trim(), source: $('#gSource').value, category,
      web: $('#infoWeb').checked,
    });
    if (data.webSkipped) { toast('Carian web tak tersedia untuk API key ini — kad dijana tanpa pengesahan web', true); syncStudioUI(); }
    box.innerHTML = '<div class="variants-head"><h3>🖼️ Kad Info</h3><span class="muted small">Leret gaya & saiz di bawah</span></div><div class="ie-root"></div>';
    mountInfoEditor($('.ie-root', box), data, {
      ...infoCtx(category),
      onSave: (d) => {
        const caption = d.caption || [d.title, ...d.points.map((p) => `${p.emoji} ${p.text}`)].join('\n');
        recordSaved({ kind: 'info', mode: 'info', category, topic, source_url: $('#gSourceUrl').value, parts: [caption.slice(0, MAX_CHARS)], comment: '', info: d }, 'draft');
        markUsed(topic);
        toast('💾 Kad info disimpan ke Draf');
      },
    });
  } catch (err) { box.innerHTML = ''; throw err; }
}

function celebratePosted() {
  haptic(30);
  confetti();
  const { streak, thisWeek } = streakInfo();
  const goal = get('weeklyGoal', 5);
  toast(streak > 1 ? `🔥 ${streak} hari berturut-turut! (${thisWeek}/${goal} minggu ini)` : `✓ Ditanda sudah post 🎉 (${thisWeek}/${goal} minggu ini)`);
}
function deletePostWithUndo(id) {
  const { item, index } = removeFrom('posts', id);
  haptic(20);
  toast('🗑️ Draf dipadam', false, {
    action: { label: 'Buat asal', fn: () => { restore('posts', item, index); toast('↩︎ Dikembalikan'); if (!$('#page-draf').classList.contains('hidden')) renderPosts(); } },
  });
}

/** Pratonton dalam bingkai telefon macam suapan Threads */
function openPhonePreview(item) {
  const initial = (displayName()[0] || '?').toUpperCase();
  const post = (text, i, n, reply) => `
    <div class="pp-post ${reply ? 'reply' : ''}">
      <div class="pp-left"><div class="avatar sm">${esc(initial)}</div>${i < n - 1 ? '<div class="tline"></div>' : ''}</div>
      <div class="pp-body">
        <div class="pp-head"><b>${esc(userName())}</b><span>${i === 0 ? '1m' : 'Baru'}</span><span class="pp-dots">···</span></div>
        <div class="pp-text">${esc(text).replace(/(#\w+)/g, '<span class="pp-tag">$1</span>').replace(/\n/g, '<br>')}</div>
        <div class="pp-icons">${icon('heart', 19)}${icon('message', 19)}${icon('repost', 19)}${icon('send', 19)}</div>
      </div>
    </div>`;
  const all = [...item.parts, ...(item.comment ? [item.comment] : [])];
  openSheet('📱 Pratonton', `
    <div class="phone">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="pp-bar"><span class="pp-logo">${icon('thread', 22)}</span></div>
        ${all.map((t, i) => post(t, i, all.length, item.comment && i === all.length - 1)).join('')}
        <div class="pp-more">Lihat aktiviti</div>
      </div>
    </div>
    <p class="muted small center">Anggaran rupa dalam suapan Threads. Rupa sebenar mungkin sedikit berbeza.</p>`, { wide: true });
}

// =========================================================
// Draf
// =========================================================
let postFilter = 'draft';
$('#postFilter').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  postFilter = b.dataset.s;
  $$('#postFilter button').forEach((x) => x.classList.toggle('active', x === b));
  renderPosts();
});
const draftQuery = { q: '', chip: 'semua' };
$('#draftSearch').addEventListener('input', (e) => { draftQuery.q = e.target.value.trim().toLowerCase(); renderPosts(); });
$('#draftChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dchip]');
  if (!b) return;
  draftQuery.chip = b.dataset.dchip; renderPosts();
});
function renderDraftChips() {
  const usedLabels = new Set(state.posts.map((p) => p.label).filter(Boolean));
  const chips = [['semua', 'Semua'], ['affiliate', '🛍️ Affiliate'], ['topic', '💡 Topik'], ['thread', '🧵 Bebenang'], ['series', '📚 Siri'],
    ...[...usedLabels].filter((k) => LABELS[k]).map((k) => [`label:${k}`, `● ${LABELS[k].name}`, LABELS[k].color])];
  $('#draftChips').innerHTML = chips.map(([k, l, c]) => `<button class="chip ${draftQuery.chip === k ? 'on' : ''}" data-dchip="${k}" ${c ? `style="--lc:${c}"` : ''}>${esc(l)}</button>`).join('');
}
function matchDraft(p) {
  const c = draftQuery.chip;
  if (c === 'affiliate' && p.mode !== 'affiliate') return false;
  if (c === 'topic' && p.mode === 'affiliate') return false;
  if (c === 'thread' && p.parts.length < 2) return false;
  if (c === 'series' && !p.series_id) return false;
  if (c.startsWith('label:') && p.label !== c.slice(6)) return false;
  if (draftQuery.q) {
    const hay = `${p.parts.join(' ')} ${p.comment || ''} ${p.topic || ''}`.toLowerCase();
    if (!draftQuery.q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function emptyDrafts() {
  const top = allTrends()[0];
  return `
    <div class="empty rich">
      <span class="big">📝</span>
      <b>Tiada draf lagi</b>
      <p>Pilih satu untuk mula — AI akan tulis dalam beberapa saat.</p>
      <div class="empty-actions">
        ${top ? `<button class="btn primary" data-empty="trend">🔥 Tulis tentang: ${esc(top.title.slice(0, 50))}${top.title.length > 50 ? '…' : ''}</button>` : ''}
        <button class="btn" data-preset='{"mode":"affiliate","multi":false}'>🛍️ Ayat affiliate dari link Shopee</button>
        <button class="btn" data-preset='{"mode":"topic","format":"thread"}'>🧵 Tulis bebenang</button>
        <button class="btn" data-goto="hook">🪝 Cari idea dalam Bank Hook</button>
      </div>
      <div class="example">
        <div class="field-label">Contoh hasil:</div>
        <div class="example-post">Ramai tak tahu pasal Akaun Fleksibel KWSP ni… 👀<br><br>Korang boleh keluarkan bila-bila masa, tapi ada 3 benda kena faham dulu 🧵👇</div>
      </div>
    </div>`;
}

function renderPosts() {
  renderDraftChips();
  const list = $('#postList');
  let items;
  if (postFilter === 'scheduled') items = state.posts.filter((p) => p.status === 'draft' && p.planned_at).sort((a, b) => a.planned_at.localeCompare(b.planned_at));
  else if (postFilter === 'posted') items = state.posts.filter((p) => p.status === 'posted').sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));
  else items = state.posts.filter((p) => p.status === 'draft');
  const total = items.length;
  items = items.filter(matchDraft);
  $('.swipe-tip').classList.toggle('hidden', !items.length);
  if (!items.length) {
    if (total) { list.innerHTML = '<div class="empty"><span class="big">🔍</span>Tiada draf sepadan dengan carian / penapis.<br><button class="btn sm" data-clear-filter style="margin-top:10px">Kosongkan penapis</button></div>'; }
    else if (postFilter === 'draft') list.innerHTML = emptyDrafts();
    else if (postFilter === 'scheduled') list.innerHTML = '<div class="empty rich"><span class="big">📅</span><b>Tiada draf dijadual</b><p>Buka mana-mana draf → tekan <b>Jadual</b> untuk rancang bila nak post. Ia akan muncul dalam Kalendar & "Hari ini".</p><div class="empty-actions"><button class="btn" data-goto="kalendar">🗓️ Lihat Kalendar</button></div></div>';
    else list.innerHTML = '<div class="empty rich"><span class="big">🎉</span><b>Belum ada post ditanda</b><p>Selepas post di Threads, tekan <b>Sudah post</b> (atau leret draf ke kanan). Isi suka & balasan untuk dapat Insight masa terbaik.</p></div>';
    list.onclick = (e) => {
      if (e.target.closest('[data-empty=trend]')) useTrend(allTrends()[0]);
      if (e.target.closest('[data-clear-filter]')) { draftQuery.q = ''; draftQuery.chip = 'semua'; $('#draftSearch').value = ''; renderPosts(); }
    };
    return;
  }
  list.onclick = null;
  list.innerHTML = '';
  for (const p of items) {
    const wrap = document.createElement('div');
    wrap.className = 'dcard';
    const c = CATS[p.category] || {};
    const eng = p.engagement ? (p.engagement.likes || 0) + (p.engagement.replies || 0) * 2 + (p.engagement.reposts || 0) * 3 : null;
    const lbl = p.label && LABELS[p.label];
    wrap.innerHTML = `
      <div class="swipe-bg"><span class="sw-right">${p.status === 'draft' ? `${icon('check', 18)} Sudah post` : ''}</span><span class="sw-left">Padam ${icon('trash', 18)}</span></div>
      <div class="dsum" ${lbl ? `style="--lc:${lbl.color}"` : ''}>
        <div class="meta">
          ${lbl ? `<span class="tag lbl" style="--lc:${lbl.color}">● ${esc(lbl.name)}</span>` : ''}
          ${p.mode === 'affiliate' ? '<span class="tag">🛍️ Affiliate</span>' : p.category && c.label ? `<span class="tag">${c.emoji || ''} ${esc(c.label)}</span>` : ''}
          ${p.info ? '<span class="tag acc">🖼️ Kad Info</span>' : ''}
          ${p.series_no ? `<span class="tag">📚 #${p.series_no}</span>` : ''}
          ${p.parts.length > 1 ? `<span class="tag">🧵 ${p.parts.length}</span>` : ''}
          ${p.planned_at && p.status === 'draft' ? `<span class="tag acc">📅 ${esc(fmtTime(p.planned_at))}</span>` : ''}
          ${eng !== null ? `<span class="tag ok">⚡ ${eng}</span>` : ''}
          <span>${esc(p.status === 'posted' ? `Dipost ${ago(p.posted_at)}` : ago(p.created_at))}</span>
          <span class="toggle">Buka ▾</span>
        </div>
        <div class="t">${esc(p.parts[0])}</div>
      </div>`;
    const sum = $('.dsum', wrap);
    let open = false;
    const toggle = () => {
      open = !open;
      $('.toggle', wrap).textContent = open ? 'Tutup ▴' : 'Buka ▾';
      wrap.classList.toggle('open', open);
      if (!open) { $('.tcard', wrap)?.remove(); $('.dsum .t', wrap).textContent = state.posts.find((x) => x.id === p.id)?.parts[0] || ''; return; }
      const tc = threadCard(p, { saved: true, onRemoved: () => { wrap.remove(); if (!$('#postList .dcard')) renderPosts(); } });
      wrap.appendChild(tc);
      requestAnimationFrame(() => $$('.tpart, .tcomment textarea', tc).forEach(autosize));
    };
    attachSwipe(sum, wrap, {
      onTap: toggle,
      onLeft: () => { wrap.remove(); deletePostWithUndo(p.id); if (!$('#postList .dcard')) renderPosts(); },
      onRight: p.status === 'draft' ? () => {
        const rec = state.posts.find((x) => x.id === p.id);
        Object.assign(rec, { status: 'posted', posted_at: nowIso() }); touch(rec); save('posts');
        wrap.remove(); celebratePosted(); if (!$('#postList .dcard')) renderPosts();
      } : null,
    });
    list.appendChild(wrap);
  }
}

/** Leret kiri/kanan pada kad draf */
function attachSwipe(el, wrap, { onTap, onLeft, onRight }) {
  let x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false, horiz = false, locked = false;
  const TH = 90;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) { dragging = false; return; }
    locked = wrap.classList.contains('open');
    x0 = e.clientX; y0 = e.clientY; dx = 0; dragging = true; decided = false; horiz = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      decided = true; horiz = !locked && Math.abs(mx) > Math.abs(my);
      if (horiz) { el.setPointerCapture(e.pointerId); wrap.classList.add('swiping'); }
    }
    if (!horiz) return;
    dx = !onRight && mx > 0 ? mx * 0.2 : mx;
    el.style.transform = `translateX(${dx}px)`;
    wrap.classList.toggle('sw-l', dx < -TH);
    wrap.classList.toggle('sw-r', dx > TH);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('swiping', 'sw-l', 'sw-r');
    if (horiz && dx < -TH) { haptic(); el.style.transform = 'translateX(-110%)'; setTimeout(onLeft, 150); return; }
    if (horiz && dx > TH && onRight) { haptic(); el.style.transform = 'translateX(110%)'; setTimeout(onRight, 150); return; }
    el.style.transform = '';
    if (!horiz && !decided) onTap();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { dragging = false; el.style.transform = ''; wrap.classList.remove('swiping', 'sw-l', 'sw-r'); });
}

// =========================================================
// Kongsi ke app (share target) & PWA
// =========================================================
function handleShare() {
  const q = new URLSearchParams(location.search);
  if (!q.has('share') && !q.has('url') && !q.has('text')) return false;
  const text = [q.get('title'), q.get('text')].filter(Boolean).join(' ');
  const link = q.get('url') || firstUrl(text);
  history.replaceState(null, '', location.pathname + '#studio');
  if (!link) { toast('Tiada link dalam kongsian', true); return false; }
  const hint = text.replace(link, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (studio.mode === 'affiliate' && studio.multi) {
    multiProducts = [...multiProducts.filter((p) => p.link || p.name), { link, name: nameFromUrl(link) || hint, price: '', highlights: '' }].slice(0, MAX_MULTI);
    saveMulti();
    applyPreset({ mode: 'affiliate', multi: true });
    openTab('studio');
    toast('🛒 Produk ditambah ke senarai');
    return true;
  }
  applyPreset({ mode: 'affiliate', multi: false, product: { link, name: nameFromUrl(link) || '' } });
  openTab('studio');
  if (S().apiKey) $('#autoFillBtn').click();
  else if (hint) $('#pName').value = hint;
  return true;
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (!get('installDismissed', false)) $('#installBanner').classList.remove('hidden');
  $('#installTile').classList.remove('hidden');
});
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isIOS && !standalone) $('#installTile').classList.remove('hidden');
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-install]')) {
    if (deferredInstall) {
      deferredInstall.prompt();
      const r = await deferredInstall.userChoice;
      if (r.outcome === 'accepted') { $('#installBanner').classList.add('hidden'); $('#installTile').classList.add('hidden'); }
      deferredInstall = null;
    } else {
      openSheet('📲 Pasang app', `<ol class="steps">
        <li>Buka laman ini dalam <b>${isIOS ? 'Safari' : 'Chrome'}</b>.</li>
        <li>Tekan ${isIOS ? 'butang <b>Kongsi</b> (□↑)' : 'menu <b>⋮</b>'}.</li>
        <li>Pilih <b>${isIOS ? 'Add to Home Screen' : 'Pasang aplikasi / Add to Home screen'}</b>.</li></ol>
        <p class="muted small">Selepas dipasang (Android), anda boleh tekan <b>Kongsi</b> dalam app Shopee dan pilih <b>Threads Gen</b> — link terus masuk ke mod Affiliate.</p>`);
    }
  }
  if (e.target.closest('[data-dismiss-install]')) { set('installDismissed', true); $('#installBanner').classList.add('hidden'); }
});

// =========================================================
// Mula
// =========================================================
renderers.utama = renderHome;
renderers.draf = renderPosts;
renderers.studio = () => syncStudioUI();
renderers.trending = () => { renderTrendChips(); renderTrending(); };

onChange((k) => { if (k === 'posts') refreshCounts(); });

hydrateIcons();
initUpdates();
applyTheme(themeChoice);
renderTrendChips();
syncStudioUI();
refreshCounts();
initPages({ openTab, renderers, applyPreset, fillProduct, startSlot, useTrend, upsertProduct, threadCard, refreshCounts, syncStudioUI, getCats: () => CATS, getGroups: () => GRPS, setStudio: (p) => { Object.assign(studio, p); syncStudioUI(); } });
if (!handleShare()) {
  const start = location.hash.slice(1);
  openTab(PAGES.includes(start) ? start : 'utama');
}
loadTrending();
if (!get('onboarded', false) && !S().apiKey && !state.posts.length) setTimeout(openOnboarding, 400);
