// ---------- Utiliti ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const len = (s = '') => [...s].length;
const threadsIntent = (text) => `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`;

let STATUS = { categories: {}, max_chars: 500, timezone: 'Asia/Kuala_Lumpur', counts: {} };
const selectedCats = new Set();
let postFilter = 'draft';
let autodraft = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Sila log masuk.'); }
  if (!res.ok) throw new Error(data.error || `Ralat ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast${bad ? ' bad' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

async function busy(btn, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Tunggu…';
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.innerHTML = old; }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('📋 Disalin!');
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ms-MY', { timeZone: STATUS.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}

// ---------- Log masuk ----------
function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#password').value } });
    $('#password').value = '';
    boot();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#logoutBtn').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin(); });

// ---------- Tab ----------
const TABS = ['trending', 'jana', 'draf', 'auto', 'tetapan'];
function openTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  history.replaceState(null, '', `#${name}`);
  if (name === 'draf') loadPosts();
  if (name === 'auto') { loadAutoDraft(); loadLogs(); }
  if (name === 'tetapan') renderSettings();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) openTab(b.dataset.tab);
});
$('#draftPill').addEventListener('click', () => openTab('draf'));

// ---------- Status ----------
async function loadStatus() {
  STATUS = await api('/api/status');
  const n = STATUS.counts.draft || 0;
  $('#draftPill').textContent = `📝 ${n} draf`;
}

// ---------- Kad post (dijana / draf) ----------
/**
 * @param {object} post  { id?, text, category, topic, source_url, status, origin, created_at, posted_at }
 * Jika post.id tiada = hasil jana yang belum disimpan.
 */
function postCard(post) {
  const card = document.createElement('div');
  card.className = 'card draft';
  const saved = !!post.id;
  const c = STATUS.categories[post.category] || {};
  card.innerHTML = `
    ${saved ? `<div class="post-meta">
      ${post.category ? `<span class="tag">${c.emoji || ''} ${esc(c.label || post.category)}</span>` : ''}
      ${post.origin === 'auto' ? '<span class="tag">🤖 Auto</span>' : ''}
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
    counter.textContent = `${n}/${STATUS.max_chars}`;
    counter.classList.toggle('over', n > STATUS.max_chars);
  };
  ta.addEventListener('input', update);
  update();

  // Simpan suntingan automatik untuk draf yang sudah disimpan
  if (saved) {
    ta.addEventListener('change', async () => {
      try { await api(`/api/posts/${post.id}`, { method: 'PUT', body: { text: ta.value } }); toast('Disimpan'); post.text = ta.value; }
      catch (e) { toast(e.message, true); }
    });
  }

  const meta = () => ({ text: ta.value, category: post.category, topic: post.topic, source_url: post.source_url });

  $('.act-threads', card).addEventListener('click', () => {
    if (len(ta.value) > STATUS.max_chars) return toast(`Teks melebihi ${STATUS.max_chars} aksara`, true);
    window.open(threadsIntent(ta.value), '_blank', 'noopener');
  });
  $('.act-copy', card).addEventListener('click', () => copyText(ta.value));

  $('.act-save', card)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const { post: p } = await api('/api/posts', { method: 'POST', body: meta() });
    card.replaceWith(postCard(p));
    toast('💾 Disimpan ke Draf');
    loadStatus();
  }));

  $('.act-posted', card)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    if (saved) {
      await api(`/api/posts/${post.id}`, { method: 'PUT', body: { text: ta.value, status: 'posted' } });
      card.remove();
    } else {
      const { post: p } = await api('/api/posts', { method: 'POST', body: { ...meta(), posted: true } });
      card.replaceWith(postCard(p));
    }
    toast('✓ Ditanda sudah post');
    loadStatus();
  }));

  $('.act-unpost', card)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await api(`/api/posts/${post.id}`, { method: 'PUT', body: { status: 'draft' } });
    card.remove();
    loadStatus();
  }));

  $('.act-delete', card)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    if (!confirm('Padam draf ini?')) return;
    await api(`/api/posts/${post.id}`, { method: 'DELETE' });
    card.remove();
    loadStatus();
  }));

  return card;
}

// ---------- Trending ----------
function renderCatChips() {
  $('#catChips').innerHTML = Object.entries(STATUS.categories).map(([k, c]) =>
    `<button class="chip ${selectedCats.has(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  $('#gCategory').innerHTML = Object.entries(STATUS.categories).map(([k, c]) => `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('');
}
$('#catChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  const k = b.dataset.k;
  if (selectedCats.has(k) && selectedCats.size > 1) selectedCats.delete(k); else selectedCats.add(k);
  renderCatChips();
  loadTrending();
});

let trendCache = [];
async function loadTrending() {
  const list = $('#trendList');
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const data = await api(`/api/trending?categories=${[...selectedCats].join(',')}&limit=10`);
    const seen = new Set();
    trendCache = Object.values(data.categories).flat().sort((a, b) => b.score - a.score)
      .filter((t) => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const max = Math.max(...trendCache.map((t) => t.score), 1);
    $('#trendMeta').textContent = `Dikemas kini ${fmtTime(data.fetched_at)} · Sumber: Google Trends & Google News (MY)` +
      (data.errors?.length ? ` · ⚠️ ${data.errors.length} sumber gagal` : '');
    if (!trendCache.length) { list.innerHTML = '<div class="empty">Tiada topik dijumpai. Cuba muat semula.</div>'; return; }
    list.innerHTML = trendCache.map((t, i) => {
      const c = STATUS.categories[t.category] || {};
      return `<div class="card trend">
        <div class="trend-top">
          <span class="tag">${c.emoji || ''} ${esc(c.label || t.category)}</span>
          ${i < 3 ? '<span class="tag hot">🔥 Hangat</span>' : ''}
          ${t.used ? '<span class="tag ok">✓ Sudah digunakan</span>' : ''}
          ${t.traffic ? `<span class="tag">${Number(t.traffic).toLocaleString()}+ carian</span>` : ''}
          <span class="muted small">${esc(ago(t.published))}</span>
        </div>
        <div class="trend-title">${esc(t.title)}</div>
        ${t.snippet && t.snippet !== t.title ? `<div class="trend-snippet">${esc(t.snippet)}</div>` : ''}
        <div class="heat"><i style="width:${Math.round((t.score / max) * 100)}%"></i></div>
        <div class="row wrap">
          <button class="btn primary sm" data-gen="${i}">✨ Jana post</button>
          ${t.link ? `<a class="btn sm" href="${esc(t.link)}" target="_blank" rel="noopener">Buka sumber ↗</a>` : ''}
          <span class="muted small">${esc(t.sources.join(', '))}</span>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty">Gagal memuat trending: ${esc(e.message)}</div>`;
  }
}
$('#refreshTrending').addEventListener('click', loadTrending);
$('#trendList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gen]');
  if (!b) return;
  const t = trendCache[Number(b.dataset.gen)];
  $('#gTopic').value = t.title;
  $('#gSnippet').value = t.snippet && t.snippet !== t.title ? t.snippet : '';
  $('#gCategory').value = t.category;
  $('#gSourceUrl').value = t.link || '';
  $('#gSource').value = t.sources.join(', ');
  openTab('jana');
  $('#genForm').requestSubmit();
});

// ---------- Jana ----------
$('#genForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#genBtn'), async () => {
    const body = {
      topic: $('#gTopic').value, snippet: $('#gSnippet').value, category: $('#gCategory').value,
      tone: $('#gTone').value, count: $('#gCount').value, extra: $('#gExtra').value, source: $('#gSource').value,
    };
    const box = $('#genResults');
    box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const { posts } = await api('/api/generate', { method: 'POST', body });
      box.innerHTML = '<div class="section-head"><h3>Hasil jana</h3></div>';
      posts.forEach((text) => box.appendChild(postCard({
        text, category: body.category, topic: body.topic, source_url: $('#gSourceUrl').value, status: 'draft',
      })));
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { box.innerHTML = ''; throw err; }
  });
});
$('#gTopic').addEventListener('input', () => { $('#gSourceUrl').value = ''; $('#gSource').value = ''; });

// ---------- Draf ----------
$('#postFilter').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  postFilter = b.dataset.s;
  $$('#postFilter button').forEach((x) => x.classList.toggle('active', x === b));
  loadPosts();
});
$('#refreshPosts').addEventListener('click', () => loadPosts());

async function loadPosts() {
  const list = $('#postList');
  list.innerHTML = '<div class="skeleton"></div>';
  try {
    const { posts } = await api(`/api/posts?status=${postFilter}`);
    list.innerHTML = posts.length ? '' : `<div class="empty">${postFilter === 'draft' ? 'Tiada draf. Jana post dari tab Trending atau Jana.' : 'Belum ada post ditanda.'}</div>`;
    posts.forEach((p) => list.appendChild(postCard(p)));
  } catch (e) {
    list.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ---------- Draf automatik ----------
function renderAutoDraft() {
  const ad = autodraft;
  $('#adEnabled').checked = ad.enabled;
  $('#adTimes').innerHTML = ad.times.length
    ? ad.times.map((t) => `<span class="chip on" data-t="${t}">${t}<span class="x">✕</span></span>`).join('')
    : '<span class="muted small">Belum ada masa.</span>';
  $('#adCats').innerHTML = Object.entries(STATUS.categories).map(([k, c]) =>
    `<button type="button" class="chip ${ad.categories.includes(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  $('#adTone').value = ad.tone;
  $('#adExtra').value = ad.extra || '';
  $('#tzLabel').textContent = STATUS.timezone;
}
async function loadAutoDraft() {
  autodraft = await api('/api/autodraft');
  renderAutoDraft();
}
$('#adTimes').addEventListener('click', (e) => {
  const c = e.target.closest('[data-t]');
  if (!c) return;
  autodraft.times = autodraft.times.filter((t) => t !== c.dataset.t);
  renderAutoDraft();
});
$('#adAddTime').addEventListener('click', () => {
  const v = $('#adTimeInput').value;
  if (!v) return toast('Pilih masa dulu', true);
  if (!autodraft.times.includes(v)) autodraft.times = [...autodraft.times, v].sort();
  renderAutoDraft();
});
$('#adCats').addEventListener('click', (e) => {
  const c = e.target.closest('[data-k]');
  if (!c) return;
  const k = c.dataset.k;
  autodraft.categories = autodraft.categories.includes(k) ? autodraft.categories.filter((x) => x !== k) : [...autodraft.categories, k];
  renderAutoDraft();
});
$('#adForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#adForm button[type=submit]'), async () => {
    autodraft = await api('/api/autodraft', {
      method: 'PUT',
      body: { enabled: $('#adEnabled').checked, times: autodraft.times, categories: autodraft.categories, tone: $('#adTone').value, extra: $('#adExtra').value },
    });
    renderAutoDraft();
    toast(autodraft.enabled ? '🤖 Draf automatik aktif' : 'Disimpan (tidak aktif)');
    loadLogs();
  });
});
$('#adRunNow').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  await api('/api/autodraft/run', { method: 'POST' });
  toast('📝 Draf baharu dicipta — lihat tab Draf');
  loadLogs();
  loadStatus();
}));

async function loadLogs() {
  const { logs } = await api('/api/logs').catch(() => ({ logs: [] }));
  $('#logList').innerHTML = logs.length
    ? logs.map((l) => `<div class="${l.level}"><span class="muted">${fmtTime(l.created_at)}</span> ${esc(l.message)}</div>`).join('')
    : '<div class="muted">Tiada log.</div>';
}
$('#refreshLogs').addEventListener('click', loadLogs);

// ---------- Tetapan ----------
async function renderSettings() {
  await loadStatus();
  $('#aiInfo').innerHTML = `<p>${STATUS.ai.configured ? '✅' : '⚠️'} Penyedia: <b>${esc(STATUS.ai.provider)}</b>${STATUS.ai.model ? ` · ${esc(STATUS.ai.model)}` : ''}
    ${STATUS.ai.configured ? '' : '<br><span class="err small">API key AI belum ditetapkan dalam .env</span>'}</p>`;
  const s = await api('/api/settings');
  $('#persona').value = s.persona || '';
}
$('#personaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy($('#personaForm button'), async () => {
    await api('/api/settings', { method: 'PUT', body: { persona: $('#persona').value } });
    toast('Persona disimpan');
  });
});

// ---------- Mula ----------
async function boot() {
  const me = await fetch('/api/me').then((r) => r.json());
  if (!me.authenticated) return showLogin();
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await loadStatus();
  if (!selectedCats.size) Object.keys(STATUS.categories).forEach((k) => selectedCats.add(k));
  renderCatChips();
  const tab = location.hash.slice(1).split('?')[0];
  openTab(TABS.includes(tab) ? tab : 'trending');
  loadTrending();
}
boot();
