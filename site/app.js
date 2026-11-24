// Threads Post Generator — UI (berjalan sepenuhnya dalam browser)
import {
  MAX_CHARS, DEFAULT_MODELS, TONES, AFF_STYLES, len, generate, regeneratePart, researchProduct, nameFromUrl,
} from './ai.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Kuala_Lumpur';
const threadsIntent = (text) => `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// =========================================================
// Storan
// =========================================================
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`tpg_${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`tpg_${key}`, JSON.stringify(value)); } catch { toast('Storan browser penuh / disekat', true); }
  },
};

const DEFAULT_SETTINGS = { provider: 'gemini', apiKey: '', model: '', baseUrl: '', persona: '', name: '', user: '' };
let settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };

// Draf (dengan migrasi format lama {text} -> {parts})
let posts = store.get('posts', []).map((p) => (p.parts ? p : {
  ...p, parts: [p.text || ''], comment: '', kind: 'single', mode: 'topic',
}));
const savePosts = () => { store.set('posts', posts); refreshCounts(); };

const DEFAULT_STUDIO = { mode: 'topic', format: 'single', parts: 4, count: 3, tone: 'santai', style: 'wajib', numbering: true, disclosure: true };
const studio = { ...DEFAULT_STUDIO, ...store.get('studio', {}) };
const saveStudio = () => store.set('studio', studio);

const topicKey = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
function usedTopics() {
  const cutoff = Date.now() - 30 * 86400000;
  return new Set(store.get('used', []).filter((u) => u.at > cutoff).map((u) => u.k));
}
function markUsed(title) {
  if (!title) return;
  const cutoff = Date.now() - 30 * 86400000;
  const list = store.get('used', []).filter((u) => u.at > cutoff && u.k !== topicKey(title));
  list.push({ k: topicKey(title), at: Date.now() });
  store.set('used', list.slice(-500));
}

let CATS = {
  finance: { label: 'Kewangan', emoji: '💰' },
  food: { label: 'Makanan', emoji: '🍜' },
  voucher: { label: 'Voucher & Promo', emoji: '🎟️' },
  bantuan: { label: 'Bantuan Kerajaan', emoji: '🏛️' },
  viral: { label: 'Info Viral', emoji: '🔥' },
  ai: { label: 'Info AI', emoji: '🤖' },
};

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
let themeChoice = store.get('theme', 'auto');
const mqLight = matchMedia('(prefers-color-scheme: light)');
function applyTheme(id = themeChoice) {
  themeChoice = id;
  store.set('theme', id);
  const resolved = id === 'auto' ? (mqLight.matches ? 'minimal-light' : 'minimal-dark') : id;
  document.documentElement.dataset.theme = resolved;
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
  });
  renderThemeGrids();
}
mqLight.addEventListener?.('change', () => { if (themeChoice === 'auto') applyTheme('auto'); });
function renderThemeGrids() {
  const html = THEMES.map((t) => `
    <button class="theme-opt ${t.id === themeChoice ? 'on' : ''}" data-theme-id="${t.id}">
      <span class="swatch" style="background:${t.sw[0]}"><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[2]}"></i></span>
      ${esc(t.name)}
    </button>`).join('');
  $('#themeGrid').innerHTML = html;
  $('#themeGridSheet').innerHTML = html;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-theme-id]');
  if (t) applyTheme(t.dataset.themeId);
});
$('#themeBtn').addEventListener('click', () => $('#themeSheet').classList.remove('hidden'));
$('#themeSheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) $('#themeSheet').classList.add('hidden'); });

// =========================================================
// UI utiliti
// =========================================================
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast${bad ? ' bad' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}
async function busy(btn, fn, label = 'Tunggu…') {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin">⏳</span> ${label}`;
  try { return await fn(); } catch (e) {
    toast(e.message, true);
    if (e.code === 'NO_KEY') openTab('tetapan');
  } finally { btn.disabled = false; btn.innerHTML = old; }
}
async function copyText(text, msg = '📋 Disalin!') {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(msg);
}
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('ms-MY', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; }
const displayName = () => settings.name || 'Nama Anda';
const userName = () => (settings.user || 'username').replace(/^@/, '');

// =========================================================
// Navigasi
// =========================================================
const TABS = ['utama', 'trending', 'studio', 'draf', 'tetapan'];
function openTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  history.replaceState(null, '', `#${name}`);
  if (name === 'utama') renderHome();
  if (name === 'draf') renderPosts();
  if (name === 'tetapan') renderSettings();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openTab(b.dataset.tab); });
$('#draftPill').addEventListener('click', () => openTab('draf'));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) { e.preventDefault(); openTab(g.dataset.goto); return; }
  const s = e.target.closest('[data-studio]');
  if (s) {
    const v = s.dataset.studio;
    if (v === 'affiliate') setMode('affiliate');
    if (v === 'topic') { setMode('topic'); setFormat('single'); }
    if (v === 'thread') setFormat('thread');
    openTab('studio');
  }
});

function refreshCounts() {
  $('#draftPill').textContent = `📝 ${posts.filter((p) => p.status === 'draft').length}`;
}

// =========================================================
// Utama
// =========================================================
function renderHome() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
  const salam = h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
  $('#greeting').textContent = `${salam}${settings.name ? `, ${settings.name}` : ''} 👋`;
  $('#setupBanner').classList.toggle('hidden', !!settings.apiKey);
  const weekAgo = Date.now() - 7 * 86400000;
  const drafts = posts.filter((p) => p.status === 'draft').length;
  const week = posts.filter((p) => p.status === 'posted' && Date.parse(p.posted_at) > weekAgo).length;
  const aff = posts.filter((p) => p.mode === 'affiliate').length;
  $('#stats').innerHTML = `
    <div class="stat"><b>${drafts}</b><span>Draf</span></div>
    <div class="stat"><b>${week}</b><span>Minggu ini</span></div>
    <div class="stat"><b>${aff}</b><span>Affiliate</span></div>`;
  renderHomeTrends();
}
function renderHomeTrends() {
  const box = $('#homeTrends');
  if (!trendData) { box.innerHTML = '<div class="skeleton"></div>'; return; }
  const top = allTrends().slice(0, 4);
  box.innerHTML = top.map((t, i) => `
    <div class="mini-trend" data-home-gen="${i}">
      <span class="rank">${i + 1}</span>
      <span class="t">${esc(t.title)}</span>
      <span class="go">Jana ✨</span>
    </div>`).join('') || '<div class="empty">Tiada data trending.</div>';
  box.onclick = (e) => {
    const r = e.target.closest('[data-home-gen]');
    if (r) useTrend(top[Number(r.dataset.homeGen)]);
  };
}

// =========================================================
// Trending
// =========================================================
const selectedCats = new Set(Object.keys(CATS));
let trendData = null;
let trendView = [];

function allTrends(cats = Object.keys(CATS)) {
  if (!trendData) return [];
  const seen = new Set();
  return Object.entries(trendData.categories)
    .filter(([k]) => cats.includes(k))
    .flatMap(([, l]) => l)
    .sort((a, b) => b.score - a.score)
    .filter((t) => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function renderCatOptions() {
  $('#catChips').innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button class="chip ${selectedCats.has(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  const cur = $('#gCategory').value;
  $('#gCategory').innerHTML = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('');
  if (cur) $('#gCategory').value = cur;
}
$('#catChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  const k = b.dataset.k;
  if (selectedCats.has(k) && selectedCats.size > 1) selectedCats.delete(k); else selectedCats.add(k);
  renderCatOptions();
  renderTrending();
});
async function loadTrending(force = false) {
  $('#trendList').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`data/trends.json${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trendData = await res.json();
    if (trendData.labels) { CATS = trendData.labels; renderCatOptions(); }
    renderTrending();
    if (!$('#tab-utama').classList.contains('hidden')) renderHomeTrends();
  } catch (e) {
    $('#trendList').innerHTML = `<div class="empty"><span class="big">📡</span>Data trending belum tersedia (${esc(e.message)}).<br>Ia dikemas kini setiap jam.</div>`;
    $('#homeTrends').innerHTML = '';
  }
}
function renderTrending() {
  if (!trendData) return;
  const used = usedTopics();
  trendView = allTrends([...selectedCats]);
  const max = Math.max(...trendView.map((t) => t.score), 1);
  $('#trendMeta').textContent = `Dikemas kini ${ago(trendData.fetched_at)} · Google Trends & Google News (MY)`;
  if (!trendView.length) { $('#trendList').innerHTML = '<div class="empty">Tiada topik untuk kategori ini.</div>'; return; }
  $('#trendList').innerHTML = trendView.map((t, i) => {
    const c = CATS[t.category] || {};
    return `<div class="card trend">
      <div class="trend-top">
        <span class="tag">${c.emoji || ''} ${esc(c.label || t.category)}</span>
        ${i < 3 ? '<span class="tag hot">🔥 Hangat</span>' : ''}
        ${used.has(topicKey(t.title)) ? '<span class="tag ok">✓ Digunakan</span>' : ''}
        ${t.traffic ? `<span class="tag">${Number(t.traffic).toLocaleString()}+ carian</span>` : ''}
        <span class="muted small">${esc(ago(t.published))}</span>
      </div>
      <div class="trend-title">${esc(t.title)}</div>
      ${t.snippet && t.snippet !== t.title ? `<div class="trend-snippet">${esc(t.snippet)}</div>` : ''}
      <div class="heat"><i style="width:${Math.round((t.score / max) * 100)}%"></i></div>
      <div class="row">
        <button class="btn primary sm" data-gen="${i}">✨ Jana post</button>
        ${t.link ? `<a class="btn sm" href="${esc(t.link)}" target="_blank" rel="noopener">Sumber ↗</a>` : ''}
        <span class="muted small">${esc((t.sources || []).slice(0, 3).join(', '))}</span>
      </div>
    </div>`;
  }).join('');
}
$('#refreshTrending').addEventListener('click', () => loadTrending(true));
$('#trendList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gen]');
  if (b) useTrend(trendView[Number(b.dataset.gen)]);
});
function useTrend(t) {
  setMode('topic');
  $('#gTopic').value = t.title;
  $('#gSnippet').value = t.snippet && t.snippet !== t.title ? t.snippet : '';
  $('#gCategory').value = t.category;
  $('#gSourceUrl').value = t.link || '';
  $('#gSource').value = (t.sources || []).join(', ');
  openTab('studio');
  if (settings.apiKey) $('#genForm').requestSubmit();
  else toast('Masukkan API key AI di Tetapan dulu', true);
}

// =========================================================
// Studio
// =========================================================
function setSeg(sel, value) { $$(`${sel} button`).forEach((b) => b.classList.toggle('active', b.dataset.v === value)); }
function setMode(mode) {
  studio.mode = mode; saveStudio();
  setSeg('#modeSeg', mode);
  $('#topicFields').classList.toggle('hidden', mode !== 'topic');
  $('#affFields').classList.toggle('hidden', mode !== 'affiliate');
}
function setFormat(format) {
  studio.format = format; saveStudio();
  setSeg('#formatSeg', format);
  $('#threadOpts').classList.toggle('hidden', format !== 'thread');
  setCount(studio.count);
}
const maxCount = () => (studio.format === 'thread' ? 3 : 5);
function setCount(n) { studio.count = Math.min(Math.max(n, 1), maxCount()); $('#countOut').textContent = studio.count; saveStudio(); }
function setParts(n) {
  studio.parts = Math.min(Math.max(n, 2), 8); $('#partsOut').textContent = studio.parts; saveStudio();
  $('#numbering').parentElement.lastChild.textContent = ` Tambah nombor (1/${studio.parts}, 2/${studio.parts}…)`;
}

$('#modeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
$('#formatSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setFormat(b.dataset.v); });
$('#partsMinus').addEventListener('click', () => setParts(studio.parts - 1));
$('#partsPlus').addEventListener('click', () => setParts(studio.parts + 1));
$('#countMinus').addEventListener('click', () => setCount(studio.count - 1));
$('#countPlus').addEventListener('click', () => setCount(studio.count + 1));
$('#numbering').addEventListener('change', (e) => { studio.numbering = e.target.checked; saveStudio(); });
$('#pDisclosure').addEventListener('change', (e) => { studio.disclosure = e.target.checked; saveStudio(); });

function renderChips(sel, items, current, key) {
  $(sel).innerHTML = Object.entries(items).map(([k, v]) => `<button type="button" class="chip ${k === current ? 'on' : ''}" data-k="${k}">${esc(v.label)}</button>`).join('');
  $(sel).onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    studio[key] = b.dataset.k; saveStudio();
    renderChips(sel, items, studio[key], key);
  };
}

$('#gTopic').addEventListener('input', () => { $('#gSourceUrl').value = ''; $('#gSource').value = ''; });
$('#pLink').addEventListener('change', () => {
  const guess = nameFromUrl($('#pLink').value.trim());
  if (guess && !$('#pName').value) $('#pName').value = guess;
});

$('#autoFillBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const link = $('#pLink').value.trim();
  if (!/^https?:\/\/\S+$/i.test(link)) throw new Error('Tampal link produk yang sah dulu (bermula https://).');
  $('#autoFillNote').textContent = '🔎 AI sedang cari maklumat produk… (boleh ambil 10–30 saat)';
  const info = await researchProduct(settings, link);
  if (info.name) $('#pName').value = info.name;
  if (info.price) $('#pPrice').value = info.price;
  if (info.highlights) $('#pHighlights').value = info.highlights;
  if (info.audience) $('#pAudience').value = info.audience;
  $('#autoFillNote').textContent = `${info.found ? '✅' : '⚠️'} ${info.note}`;
  toast(info.found ? '✨ Maklumat produk diisi' : 'Sebahagian maklumat diisi — sila semak', !info.found && !info.name);
}, 'Mencari…'));

$('#genForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#genBtn'), async () => {
    const opts = {
      mode: studio.mode, format: studio.format, parts: studio.parts, count: studio.count,
      tone: studio.tone, numbering: studio.numbering, extra: $('#gExtra').value.trim(), persona: settings.persona,
    };
    if (studio.mode === 'affiliate') {
      Object.assign(opts, {
        style: studio.style, used: $('#pUsed').checked, disclosure: studio.disclosure,
        product: {
          link: $('#pLink').value.trim(), name: $('#pName').value.trim(), price: $('#pPrice').value.trim(),
          highlights: $('#pHighlights').value.trim(), audience: $('#pAudience').value.trim(),
        },
      });
      if (opts.product.link && !/^https?:\/\//i.test(opts.product.link)) throw new Error('Link mesti bermula dengan https://');
    } else {
      Object.assign(opts, {
        topic: $('#gTopic').value.trim(), snippet: $('#gSnippet').value.trim(), category: $('#gCategory').value, source: $('#gSource').value,
      });
    }
    const box = $('#genResults');
    box.innerHTML = '<div class="section-head"><h3>Sedang menulis…</h3></div><div class="skeleton" style="height:220px"></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const variants = await generate(settings, opts);
      const meta = {
        kind: studio.format === 'thread' ? 'thread' : 'single', mode: studio.mode, tone: studio.tone,
        category: studio.mode === 'topic' ? opts.category : null,
        topic: studio.mode === 'topic' ? opts.topic : opts.product.name,
        source_url: studio.mode === 'topic' ? $('#gSourceUrl').value : opts.product.link,
        product: studio.mode === 'affiliate' ? opts.product : null,
      };
      renderVariants(variants.map((v) => ({ ...meta, ...v })));
    } catch (err) { box.innerHTML = ''; throw err; }
  }, 'AI sedang menulis…');
});

function renderVariants(items) {
  const box = $('#genResults');
  box.innerHTML = `
    <div class="variants-head">
      <h3>✨ ${items.length} variasi</h3>
      <div class="dots">${items.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div class="carousel"></div>
    ${items.length > 1 ? '<p class="swipe-hint">← Leret untuk lihat variasi lain →</p>' : ''}`;
  const car = $('.carousel', box);
  items.forEach((it, i) => car.appendChild(threadCard(it, { label: `Variasi ${i + 1}` })));
  $$('.tpart, .tcomment textarea', car).forEach(autosize);
  const dots = $$('.dots i', box);
  car.addEventListener('scroll', () => {
    const w = car.firstElementChild?.getBoundingClientRect().width || 1;
    const idx = Math.round(car.scrollLeft / (w + 12));
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
  }, { passive: true });
}

// =========================================================
// Kad pratonton Threads (dijana atau draf disimpan)
// =========================================================
function threadCard(item, { saved = false, label = '', onChange } = {}) {
  const card = document.createElement('div');
  card.className = 'tcard';
  const n = item.parts.length;
  const initial = (displayName()[0] || '?').toUpperCase();

  const metaTags = [
    label ? `<span class="tag acc">${esc(label)}</span>` : '',
    item.mode === 'affiliate' ? '<span class="tag">🛍️ Affiliate</span>' : '',
    n > 1 ? `<span class="tag">🧵 ${n} bahagian</span>` : '',
    item.status === 'posted' ? `<span class="tag ok">✓ Sudah post ${esc(fmtTime(item.posted_at))}</span>` : '',
  ].join('');

  card.innerHTML = `
    <div class="tcard-meta">${metaTags}</div>
    ${n > 1 ? '<div class="thread-tip">💡 Tekan <b>Buka di Threads</b> untuk bahagian 1. Untuk bahagian seterusnya, tekan <b>Salin</b> dan tampal di <b>"Tambah ke bebenang"</b>.</div>' : ''}
    ${item.parts.map((p, i) => `
      <div class="tpost${i === n - 1 && !(item.comment || item.mode === 'affiliate') ? ' last' : ''}" data-i="${i}">
        <div class="tleft"><div class="avatar">${esc(initial)}</div><div class="tline"></div></div>
        <div class="tbody">
          <div class="thead"><b>${esc(displayName())}</b><span class="muted">@${esc(userName())}${n > 1 ? ` · ${i + 1}/${n}` : ''}</span></div>
          <textarea class="tpart" rows="2" spellcheck="false"></textarea>
          <div class="tfoot">
            <span class="counter"></span>
            <button type="button" class="mini act-regen" title="Tulis semula bahagian ini">↻ Tulis semula</button>
            <button type="button" class="mini act-copy-part">📋 Salin</button>
          </div>
        </div>
      </div>`).join('')}
    ${item.comment || item.mode === 'affiliate' ? `
      <div class="tcomment">
        <div class="tc-label"><span>💬 Komen pertama ${item.mode === 'affiliate' ? '(link di sini)' : ''}</span><button type="button" class="mini act-copy-comment">📋 Salin</button></div>
        <textarea rows="1" spellcheck="false"></textarea>
      </div>` : ''}
    <div class="tactions">
      <button type="button" class="btn primary act-threads">🧵 Buka di Threads</button>
      ${n > 1 ? '<button type="button" class="btn act-copy-all">📋 Salin semua</button>' : '<button type="button" class="btn act-copy-all">📋 Salin</button>'}
      ${saved ? '' : '<button type="button" class="btn act-save">💾 Simpan</button>'}
      ${item.status === 'posted' ? '<button type="button" class="btn act-unpost">↩︎ Belum post</button>' : '<button type="button" class="btn act-posted">✓ Sudah post</button>'}
      ${saved ? '<button type="button" class="btn danger act-delete">🗑️ Padam</button>' : ''}
      ${item.source_url ? `<a class="btn wide" href="${esc(item.source_url)}" target="_blank" rel="noopener">${item.mode === 'affiliate' ? '🛒 Buka produk' : '🔗 Sumber'} ↗</a>` : ''}
    </div>`;

  const tas = $$('.tpart', card);
  const commentTa = $('.tcomment textarea', card);
  tas.forEach((ta, i) => { ta.value = item.parts[i]; });
  if (commentTa) commentTa.value = item.comment || '';

  const current = () => ({ parts: tas.map((t) => t.value), comment: commentTa ? commentTa.value : '' });
  const updateCounter = (ta) => {
    const c = $('.counter', ta.closest('.tbody'));
    const k = len(ta.value);
    c.textContent = `${k}/${MAX_CHARS}`;
    c.classList.toggle('over', k > MAX_CHARS);
  };
  let saveTimer;
  const persist = () => {
    if (!saved) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const p = posts.find((x) => x.id === item.id);
      if (p) { Object.assign(p, current()); savePosts(); onChange?.(); }
    }, 500);
  };
  tas.forEach((ta) => {
    updateCounter(ta);
    ta.addEventListener('input', () => { autosize(ta); updateCounter(ta); persist(); });
  });
  commentTa?.addEventListener('input', () => { autosize(commentTa); persist(); });

  const tooLong = () => tas.some((t) => len(t.value) > MAX_CHARS);

  // Tindakan per bahagian
  card.addEventListener('click', (e) => {
    const post = e.target.closest('.tpost');
    if (e.target.closest('.act-copy-part')) {
      const i = Number(post.dataset.i);
      copyText(tas[i].value, n > 1 ? `📋 Bahagian ${i + 1}/${n} disalin` : '📋 Disalin!');
    }
    if (e.target.closest('.act-copy-comment')) copyText(commentTa.value, '📋 Komen disalin');
  });
  $$('.act-regen', card).forEach((btn) => btn.addEventListener('click', () => busy(btn, async () => {
    const i = Number(btn.closest('.tpost').dataset.i);
    const text = await regeneratePart(settings, { parts: current().parts, index: i, tone: item.tone, persona: settings.persona });
    tas[i].value = text;
    autosize(tas[i]); updateCounter(tas[i]); persist();
    toast('↻ Ditulis semula');
  }, '…')));

  // Tindakan utama
  $('.act-threads', card).addEventListener('click', () => {
    if (len(tas[0].value) > MAX_CHARS) return toast(`Bahagian 1 melebihi ${MAX_CHARS} aksara`, true);
    window.open(threadsIntent(tas[0].value), '_blank', 'noopener');
  });
  $('.act-copy-all', card).addEventListener('click', () => {
    const c = current();
    copyText(c.parts.join('\n\n— — —\n\n') + (c.comment ? `\n\n💬 Komen:\n${c.comment}` : ''), '📋 Semua disalin');
  });

  const toSaved = (status) => {
    if (tooLong()) { toast(`Ada bahagian melebihi ${MAX_CHARS} aksara`, true); return null; }
    const p = {
      id: uid(), kind: item.kind || (n > 1 ? 'thread' : 'single'), mode: item.mode || 'topic', tone: item.tone,
      category: item.category, topic: item.topic, source_url: item.source_url, product: item.product || null,
      ...current(), status, created_at: new Date().toISOString(), posted_at: status === 'posted' ? new Date().toISOString() : null,
    };
    posts.unshift(p);
    if (item.mode !== 'affiliate') markUsed(item.topic);
    savePosts();
    return p;
  };
  $('.act-save', card)?.addEventListener('click', () => {
    const p = toSaved('draft');
    if (!p) return;
    const fresh = threadCard(p, { saved: true, label: '💾 Disimpan' });
    card.replaceWith(fresh);
    $$('.tpart, .tcomment textarea', fresh).forEach(autosize);
    toast('💾 Disimpan ke Draf');
  });
  $('.act-posted', card)?.addEventListener('click', () => {
    if (saved) {
      const p = posts.find((x) => x.id === item.id);
      Object.assign(p, current(), { status: 'posted', posted_at: new Date().toISOString() });
      savePosts();
      onChange?.('removed');
    } else {
      const p = toSaved('posted');
      if (!p) return;
      const fresh = threadCard(p, { saved: true });
      card.replaceWith(fresh);
      $$('.tpart, .tcomment textarea', fresh).forEach(autosize);
    }
    toast('✓ Ditanda sudah post 🎉');
  });
  $('.act-unpost', card)?.addEventListener('click', () => {
    const p = posts.find((x) => x.id === item.id);
    Object.assign(p, { status: 'draft', posted_at: null });
    savePosts();
    onChange?.('removed');
  });
  $('.act-delete', card)?.addEventListener('click', () => {
    if (!confirm('Padam draf ini?')) return;
    posts = posts.filter((x) => x.id !== item.id);
    savePosts();
    onChange?.('removed');
  });
  return card;
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
function renderPosts() {
  const list = $('#postList');
  const items = posts.filter((p) => p.status === postFilter);
  if (postFilter === 'posted') items.sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));
  if (!items.length) {
    list.innerHTML = postFilter === 'draft'
      ? '<div class="empty"><span class="big">📝</span>Tiada draf lagi.<br><a href="#studio" data-goto="studio">Buka Studio</a> untuk mula menulis.</div>'
      : '<div class="empty"><span class="big">🎉</span>Belum ada post ditanda "Sudah post".</div>';
    return;
  }
  list.innerHTML = '';
  for (const p of items) {
    const wrap = document.createElement('div');
    wrap.className = 'dcard';
    const c = CATS[p.category] || {};
    wrap.innerHTML = `
      <div class="dsum">
        <div class="meta">
          ${p.mode === 'affiliate' ? '<span class="tag">🛍️ Affiliate</span>' : p.category ? `<span class="tag">${c.emoji || ''} ${esc(c.label || p.category)}</span>` : ''}
          ${p.parts.length > 1 ? `<span class="tag">🧵 ${p.parts.length}</span>` : ''}
          <span>${esc(p.status === 'posted' ? `Dipost ${ago(p.posted_at)}` : ago(p.created_at))}</span>
          <span style="margin-left:auto">Buka ▾</span>
        </div>
        <div class="t">${esc(p.parts[0])}</div>
      </div>`;
    let open = false;
    $('.dsum', wrap).addEventListener('click', () => {
      open = !open;
      $('.meta span:last-child', wrap).textContent = open ? 'Tutup ▴' : 'Buka ▾';
      const existing = $('.tcard', wrap);
      if (!open) { existing?.remove(); $('.dsum .t', wrap).textContent = posts.find((x) => x.id === p.id)?.parts[0] || ''; return; }
      const tc = threadCard(p, {
        saved: true,
        onChange: (ev) => {
          if (ev === 'removed') { wrap.remove(); if (!$('#postList .dcard')) renderPosts(); }
        },
      });
      wrap.appendChild(tc);
      $$('.tpart, .tcomment textarea', tc).forEach(autosize);
    });
    list.appendChild(wrap);
  }
}

// =========================================================
// Tetapan
// =========================================================
const KEY_HELP = {
  gemini: 'Dapatkan key percuma di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>. Sokong carian web untuk "Isi automatik".',
  anthropic: 'Dapatkan key di <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Claude Console</a>. Carian web perlu diaktifkan dalam Console.',
  openai: 'Guna key OpenAI, atau set Base URL untuk Groq/OpenRouter. (Tiada carian web — "Isi automatik" hanya teka dari link.)',
};
function renderSettings() {
  $('#sName').value = settings.name;
  $('#sUser').value = settings.user;
  $('#sProvider').value = settings.provider;
  $('#sKey').value = settings.apiKey;
  $('#sModel').value = settings.model;
  $('#sBaseUrl').value = settings.baseUrl;
  $('#sPersona').value = settings.persona;
  syncProviderUI();
  renderThemeGrids();
}
function syncProviderUI() {
  const p = $('#sProvider').value;
  $('#sModel').placeholder = DEFAULT_MODELS[p];
  $('#keyHelp').innerHTML = KEY_HELP[p];
  $('#baseUrlRow').classList.toggle('hidden', p !== 'openai');
}
$('#sProvider').addEventListener('change', syncProviderUI);
$('#settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  settings = {
    name: $('#sName').value.trim().slice(0, 40),
    user: $('#sUser').value.trim().replace(/^@/, '').slice(0, 30),
    provider: $('#sProvider').value,
    apiKey: $('#sKey').value.trim(),
    model: $('#sModel').value.trim(),
    baseUrl: $('#sBaseUrl').value.trim(),
    persona: $('#sPersona').value.trim().slice(0, 1000),
  };
  store.set('settings', settings);
  toast('💾 Tetapan disimpan');
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ posts }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `draf-threads-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = (data.posts || [])
      .filter((p) => p && p.id && (Array.isArray(p.parts) || typeof p.text === 'string'))
      .map((p) => (p.parts ? p : { ...p, parts: [p.text], comment: '', kind: 'single', mode: 'topic' }));
    const ids = new Set(posts.map((p) => p.id));
    posts = [...incoming.filter((p) => !ids.has(p.id)), ...posts];
    savePosts();
    toast(`⬆️ ${incoming.length} draf diimport`);
  } catch { toast('Fail tidak sah', true); }
  e.target.value = '';
});
$('#clearBtn').addEventListener('click', () => {
  if (!confirm('Padam SEMUA draf, tetapan dan API key dari browser ini?')) return;
  ['settings', 'posts', 'used', 'studio'].forEach((k) => localStorage.removeItem(`tpg_${k}`));
  settings = { ...DEFAULT_SETTINGS };
  posts = [];
  refreshCounts();
  renderSettings();
  toast('Semua data dipadam');
});

// =========================================================
// Mula
// =========================================================
applyTheme(themeChoice);
renderCatOptions();
renderChips('#toneChips', TONES, studio.tone, 'tone');
renderChips('#styleChips', AFF_STYLES, studio.style, 'style');
setMode(studio.mode);
setFormat(studio.format);
setParts(studio.parts);
$('#numbering').checked = studio.numbering;
$('#pDisclosure').checked = studio.disclosure;
refreshCounts();
const startTab = location.hash.slice(1);
openTab(TABS.includes(startTab) ? startTab : 'utama');
loadTrending();
