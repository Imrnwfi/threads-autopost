// Threads Post Generator — berjalan sepenuhnya dalam browser (GitHub Pages).
// Topik trending dikemas kini setiap jam oleh GitHub Actions -> data/trends.json

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const len = (s = '') => [...s].length;
const MAX_CHARS = 500;
const TZ = 'Asia/Kuala_Lumpur';
const threadsIntent = (text) => `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`;

// ---------- Storan tempatan ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`tpg_${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`tpg_${key}`, JSON.stringify(value)); } catch { toast('Storan browser penuh / disekat', true); }
  },
};

const DEFAULT_SETTINGS = { provider: 'gemini', apiKey: '', model: '', baseUrl: '', persona: '' };
let settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
let posts = store.get('posts', []);
const savePosts = () => { store.set('posts', posts); updatePill(); };

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

// ---------- Kategori (default; dikemas kini dari trends.json) ----------
let CATS = {
  finance: { label: 'Kewangan', emoji: '💰' },
  food: { label: 'Makanan', emoji: '🍜' },
  voucher: { label: 'Voucher & Promo', emoji: '🎟️' },
  bantuan: { label: 'Bantuan Kerajaan', emoji: '🏛️' },
  viral: { label: 'Info Viral', emoji: '🔥' },
  ai: { label: 'Info AI', emoji: '🤖' },
};

// ---------- UI utiliti ----------
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast${bad ? ' bad' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}
async function busy(btn, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Tunggu…';
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.innerHTML = old; }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('📋 Disalin!');
}
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('ms-MY', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}
const updatePill = () => { $('#draftPill').textContent = `📝 ${posts.filter((p) => p.status === 'draft').length} draf`; };

// ---------- Tab ----------
const TABS = ['trending', 'jana', 'draf', 'tetapan'];
function openTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  history.replaceState(null, '', `#${name}`);
  if (name === 'draf') renderPosts();
  if (name === 'tetapan') renderSettings();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openTab(b.dataset.tab); });
$('#draftPill').addEventListener('click', () => openTab('draf'));
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-goto]');
  if (a) { e.preventDefault(); openTab(a.dataset.goto); }
});

// ---------- AI ----------
const DEFAULT_MODELS = { gemini: 'gemini-3.6-flash', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' };
const KEY_HELP = {
  gemini: 'Dapatkan key percuma di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.',
  anthropic: 'Dapatkan key di <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Claude Console</a>.',
  openai: 'Guna key OpenAI, atau set Base URL untuk Groq/OpenRouter dll.',
};
const TONES = {
  santai: 'santai dan mesra macam borak dengan kawan, guna bahasa Melayu harian (boleh campur sikit English macam orang Malaysia biasa)',
  formal: 'profesional dan jelas, bahasa Melayu standard',
  lucu: 'kelakar dan bersahaja, tapi info tetap tepat',
  informatif: 'padat dengan info berguna, ringkas dan terus ke point',
};

function systemPrompt() {
  return `Kau penulis kandungan Threads untuk audiens Malaysia.
Peraturan WAJIB:
- Setiap post MESTI kurang daripada ${MAX_CHARS - 20} aksara (termasuk emoji & hashtag).
- Ayat pertama ialah "hook" yang buat orang berhenti scroll.
- Guna perenggan pendek / baris baru supaya senang baca di telefon.
- Maksimum 1-2 hashtag yang relevan, atau tiada langsung.
- JANGAN reka fakta, angka, tarikh, harga atau syarat kelayakan. Guna HANYA maklumat dalam tajuk/ringkasan sumber yang diberi. Jika maklumat tak lengkap, ajak pembaca semak sumber rasmi.
- Untuk bantuan kerajaan/kewangan: sebut supaya semak di laman rasmi dan jangan beri nasihat pelaburan.
- Jangan letak URL dalam teks melainkan diminta.
- Akhiri dengan soalan atau ajakan ringkas untuk engagement (jika sesuai).
${settings.persona ? `Persona/gaya akaun: ${settings.persona}` : ''}
Pulangkan HANYA JSON: {"posts": ["post 1", "post 2", ...]} tanpa teks lain.`;
}
function userPrompt({ topic, snippet, category, tone, count, extra, source }) {
  return `Kategori: ${CATS[category]?.label || category || 'umum'}
Topik: ${topic}
${snippet ? `Ringkasan sumber: ${snippet}` : ''}
${source ? `Sumber: ${source}` : ''}
Nada: ${TONES[tone] || tone}
${extra ? `Arahan tambahan: ${extra}` : ''}
Tulis ${count} variasi post Threads yang berbeza gaya hook.`;
}
function parsePosts(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  let list = [];
  try { list = JSON.parse(m ? m[0] : raw).posts || []; } catch { list = raw.split(/\n-{3,}\n/); }
  return list.map((p) => String(p).trim()).filter(Boolean)
    .map((p) => (len(p) > MAX_CHARS ? [...p].slice(0, MAX_CHARS - 1).join('').replace(/\s+\S*$/, '') + '…' : p));
}
async function readError(res, label) {
  const body = await res.json().catch(() => ({}));
  const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) return new Error(`${label}: API key tidak sah (${msg})`);
  if (res.status === 429) return new Error(`${label}: had penggunaan dicapai, cuba sebentar lagi`);
  return new Error(`${label}: ${msg}`);
}

async function callAI(system, user) {
  const { provider, apiKey } = settings;
  const model = settings.model || DEFAULT_MODELS[provider];
  if (provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw await readError(res, 'Gemini');
    const body = await res.json();
    return (body.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  }
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw await readError(res, 'Claude');
    const body = await res.json();
    return body.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  const base = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.9, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw await readError(res, 'AI');
  const body = await res.json();
  return body.choices?.[0]?.message?.content || '';
}

async function generatePosts(opts) {
  if (!settings.apiKey) { openTab('tetapan'); throw new Error('Masukkan API key AI dulu.'); }
  if (!opts.topic?.trim()) throw new Error('Topik diperlukan.');
  const list = parsePosts(await callAI(systemPrompt(), userPrompt(opts)));
  if (!list.length) throw new Error('AI tidak memulangkan post. Cuba lagi.');
  return list;
}

// ---------- Kad post ----------
function postCard(post) {
  const card = document.createElement('div');
  card.className = 'card draft';
  const saved = !!post.id;
  const c = CATS[post.category] || {};
  card.innerHTML = `
    ${saved ? `<div class="post-meta">
      ${post.category ? `<span class="tag">${c.emoji || ''} ${esc(c.label || post.category)}</span>` : ''}
      ${post.status === 'posted' ? `<span class="tag ok">✓ Sudah post ${esc(fmtTime(post.posted_at))}</span>` : `<span>${esc(ago(post.created_at))}</span>`}
    </div>` : ''}
    ${post.topic && saved ? `<div class="muted small topic">Topik: ${esc(post.topic)}</div>` : ''}
    <textarea class="draft-text" rows="7"></textarea>
    <div class="draft-meta"><span class="counter"></span></div>
    <div class="actions">
      <button class="btn primary act-threads">🧵 Buka di Threads</button>
      <button class="btn act-copy">📋 Salin</button>
      ${!saved ? '<button class="btn act-save">💾 Simpan draf</button>' : ''}
      ${post.status !== 'posted' ? '<button class="btn act-posted">✓ Sudah post</button>' : '<button class="btn act-unpost">↩︎ Belum post</button>'}
      ${post.source_url ? `<a class="btn" href="${esc(post.source_url)}" target="_blank" rel="noopener">Sumber ↗</a>` : ''}
      ${saved ? '<button class="btn danger act-delete" title="Padam">🗑️</button>' : ''}
    </div>`;

  const ta = $('.draft-text', card);
  const counter = $('.counter', card);
  ta.value = post.text;
  const update = () => {
    const n = len(ta.value);
    counter.textContent = `${n}/${MAX_CHARS}`;
    counter.classList.toggle('over', n > MAX_CHARS);
  };
  ta.addEventListener('input', update);
  update();

  const find = () => posts.find((p) => p.id === post.id);
  if (saved) ta.addEventListener('change', () => { const p = find(); if (p) { p.text = ta.value; savePosts(); toast('Disimpan'); } });

  const newPost = (status) => {
    const p = {
      id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
      text: ta.value.trim(), category: post.category, topic: post.topic, source_url: post.source_url,
      status, created_at: new Date().toISOString(), posted_at: status === 'posted' ? new Date().toISOString() : null,
    };
    posts.unshift(p);
    markUsed(post.topic);
    savePosts();
    return p;
  };

  $('.act-threads', card).addEventListener('click', () => {
    if (len(ta.value) > MAX_CHARS) return toast(`Teks melebihi ${MAX_CHARS} aksara`, true);
    window.open(threadsIntent(ta.value), '_blank', 'noopener');
  });
  $('.act-copy', card).addEventListener('click', () => copyText(ta.value));
  $('.act-save', card)?.addEventListener('click', () => {
    if (!ta.value.trim()) return toast('Teks kosong', true);
    card.replaceWith(postCard(newPost('draft')));
    toast('💾 Disimpan ke Draf');
  });
  $('.act-posted', card)?.addEventListener('click', () => {
    if (saved) {
      const p = find();
      Object.assign(p, { text: ta.value, status: 'posted', posted_at: new Date().toISOString() });
      savePosts();
      card.remove();
    } else {
      card.replaceWith(postCard(newPost('posted')));
    }
    toast('✓ Ditanda sudah post');
  });
  $('.act-unpost', card)?.addEventListener('click', () => {
    Object.assign(find(), { status: 'draft', posted_at: null });
    savePosts();
    card.remove();
  });
  $('.act-delete', card)?.addEventListener('click', () => {
    if (!confirm('Padam draf ini?')) return;
    posts = posts.filter((p) => p.id !== post.id);
    savePosts();
    card.remove();
  });
  return card;
}

// ---------- Trending ----------
const selectedCats = new Set(Object.keys(CATS));
let trendData = null;
let trendView = [];

function renderCatOptions() {
  $('#catChips').innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button class="chip ${selectedCats.has(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  $('#gCategory').innerHTML = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('');
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
  const list = $('#trendList');
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`data/trends.json${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trendData = await res.json();
    if (trendData.labels) { CATS = trendData.labels; renderCatOptions(); }
    renderTrending();
  } catch (e) {
    list.innerHTML = `<div class="empty">Data trending belum tersedia (${esc(e.message)}). Ia dikemas kini setiap jam oleh GitHub Actions.</div>`;
  }
}
function renderTrending() {
  if (!trendData) return;
  const used = usedTopics();
  const seen = new Set();
  trendView = Object.entries(trendData.categories)
    .filter(([k]) => selectedCats.has(k))
    .flatMap(([, l]) => l)
    .sort((a, b) => b.score - a.score)
    .filter((t) => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const max = Math.max(...trendView.map((t) => t.score), 1);
  $('#trendMeta').textContent = `Dikemas kini ${fmtTime(trendData.fetched_at)} (${ago(trendData.fetched_at)}) · Google Trends & Google News (MY)`;
  const list = $('#trendList');
  if (!trendView.length) { list.innerHTML = '<div class="empty">Tiada topik untuk kategori ini.</div>'; return; }
  list.innerHTML = trendView.map((t, i) => {
    const c = CATS[t.category] || {};
    return `<div class="card trend">
      <div class="trend-top">
        <span class="tag">${c.emoji || ''} ${esc(c.label || t.category)}</span>
        ${i < 3 ? '<span class="tag hot">🔥 Hangat</span>' : ''}
        ${used.has(topicKey(t.title)) ? '<span class="tag ok">✓ Sudah digunakan</span>' : ''}
        ${t.traffic ? `<span class="tag">${Number(t.traffic).toLocaleString()}+ carian</span>` : ''}
        <span class="muted small">${esc(ago(t.published))}</span>
      </div>
      <div class="trend-title">${esc(t.title)}</div>
      ${t.snippet && t.snippet !== t.title ? `<div class="trend-snippet">${esc(t.snippet)}</div>` : ''}
      <div class="heat"><i style="width:${Math.round((t.score / max) * 100)}%"></i></div>
      <div class="row wrap">
        <button class="btn primary sm" data-gen="${i}">✨ Jana post</button>
        ${t.link ? `<a class="btn sm" href="${esc(t.link)}" target="_blank" rel="noopener">Buka sumber ↗</a>` : ''}
        <span class="muted small">${esc((t.sources || []).join(', '))}</span>
      </div>
    </div>`;
  }).join('');
}
$('#refreshTrending').addEventListener('click', () => loadTrending(true));
$('#trendList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gen]');
  if (!b) return;
  const t = trendView[Number(b.dataset.gen)];
  $('#gTopic').value = t.title;
  $('#gSnippet').value = t.snippet && t.snippet !== t.title ? t.snippet : '';
  $('#gCategory').value = t.category;
  $('#gSourceUrl').value = t.link || '';
  $('#gSource').value = (t.sources || []).join(', ');
  openTab('jana');
  if (settings.apiKey) $('#genForm').requestSubmit();
  else toast('Masukkan API key AI di Tetapan dulu', true);
});

// ---------- Jana ----------
$('#genForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#genBtn'), async () => {
    const opts = {
      topic: $('#gTopic').value, snippet: $('#gSnippet').value, category: $('#gCategory').value,
      tone: $('#gTone').value, count: Number($('#gCount').value), extra: $('#gExtra').value, source: $('#gSource').value,
    };
    const box = $('#genResults');
    box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const list = await generatePosts(opts);
      box.innerHTML = '<div class="section-head"><h3>Hasil jana</h3></div>';
      list.forEach((text) => box.appendChild(postCard({ text, category: opts.category, topic: opts.topic, source_url: $('#gSourceUrl').value, status: 'draft' })));
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { box.innerHTML = ''; throw err; }
  });
});
$('#gTopic').addEventListener('input', () => { $('#gSourceUrl').value = ''; $('#gSource').value = ''; });

// ---------- Draf ----------
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
  list.innerHTML = items.length ? '' : `<div class="empty">${postFilter === 'draft' ? 'Tiada draf. Jana post dari tab Trending atau Jana.' : 'Belum ada post ditanda.'}</div>`;
  items.forEach((p) => list.appendChild(postCard(p)));
}

// ---------- Tetapan ----------
function renderSettings() {
  $('#sProvider').value = settings.provider;
  $('#sKey').value = settings.apiKey;
  $('#sModel').value = settings.model;
  $('#sBaseUrl').value = settings.baseUrl;
  $('#sPersona').value = settings.persona;
  syncProviderUI();
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
    provider: $('#sProvider').value,
    apiKey: $('#sKey').value.trim(),
    model: $('#sModel').value.trim(),
    baseUrl: $('#sBaseUrl').value.trim(),
    persona: $('#sPersona').value.trim().slice(0, 1000),
  };
  store.set('settings', settings);
  $('#setupBanner').classList.toggle('hidden', !!settings.apiKey);
  toast('💾 Tetapan disimpan');
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ posts }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `draf-threads-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = (data.posts || []).filter((p) => p && p.id && typeof p.text === 'string');
    const ids = new Set(posts.map((p) => p.id));
    posts = [...incoming.filter((p) => !ids.has(p.id)), ...posts];
    savePosts();
    toast(`⬆️ ${incoming.length} draf diimport`);
  } catch { toast('Fail tidak sah', true); }
  e.target.value = '';
});
$('#clearBtn').addEventListener('click', () => {
  if (!confirm('Padam SEMUA draf, tetapan dan API key dari browser ini?')) return;
  ['settings', 'posts', 'used'].forEach((k) => localStorage.removeItem(`tpg_${k}`));
  settings = { ...DEFAULT_SETTINGS };
  posts = [];
  updatePill();
  renderSettings();
  $('#setupBanner').classList.remove('hidden');
  toast('Semua data dipadam');
});

// ---------- Mula ----------
renderCatOptions();
updatePill();
$('#setupBanner').classList.toggle('hidden', !!settings.apiKey);
const startTab = location.hash.slice(1);
openTab(TABS.includes(startTab) ? startTab : 'trending');
loadTrending();
