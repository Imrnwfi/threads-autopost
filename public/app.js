// ---------- Utiliti ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const len = (s = '') => [...s].length;

let STATUS = { categories: {}, max_chars: 500, timezone: 'Asia/Kuala_Lumpur' };
let selectedCats = new Set();
let postFilter = 'scheduled';
let autopilot = null;

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
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

async function busy(btn, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Tunggu…';
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.innerHTML = old; }
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
// Nilai lalai untuk <input type="datetime-local"> (+1 jam, waktu peranti)
function defaultWhen(offsetMin = 60) {
  const d = new Date(Date.now() + offsetMin * 60000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
}
const toIso = (local) => new Date(local).toISOString();

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
function openTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  if (name === 'jadual') loadPosts();
  if (name === 'autopilot') { loadAutopilot(); loadLogs(); }
  if (name === 'tetapan') renderSettings();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) { history.replaceState(null, '', `#${b.dataset.tab}`); openTab(b.dataset.tab); }
});

// ---------- Status ----------
async function loadStatus() {
  STATUS = await api('/api/status');
  const pill = $('#connPill');
  if (STATUS.threads.connected) {
    pill.className = 'pill ok';
    pill.textContent = STATUS.threads.username ? `@${STATUS.threads.username}` : 'Disambung';
  } else {
    pill.className = 'pill bad';
    pill.textContent = 'Threads belum disambung';
  }
}

// ---------- Trending ----------
function renderCatChips() {
  const box = $('#catChips');
  box.innerHTML = Object.entries(STATUS.categories).map(([k, c]) =>
    `<button class="chip ${selectedCats.has(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  const sel = $('#gCategory');
  sel.innerHTML = Object.entries(STATUS.categories).map(([k, c]) => `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('');
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
  history.replaceState(null, '', '#jana');
  $('#genForm').requestSubmit();
});

// ---------- Jana ----------
function draftCard(text, meta = {}) {
  const node = $('#draftTpl').content.firstElementChild.cloneNode(true);
  const ta = $('.draft-text', node);
  const counter = $('.counter', node);
  const update = () => {
    const n = len(ta.value);
    counter.textContent = `${n}/${STATUS.max_chars}`;
    counter.classList.toggle('over', n > STATUS.max_chars);
  };
  ta.value = text;
  ta.addEventListener('input', update);
  update();
  $('.act-when', node).value = defaultWhen();

  const save = (action, extra = {}) => api('/api/posts', {
    method: 'POST',
    body: { text: ta.value, category: meta.category, topic: meta.topic, source_url: meta.source_url, action, ...extra },
  });
  $('.act-now', node).addEventListener('click', (e) => busy(e.currentTarget, async () => {
    if (!confirm('Terbitkan post ini ke Threads sekarang?')) return;
    const { post } = await save('now');
    toast('✅ Diterbitkan ke Threads!');
    if (meta.manual) setTimeout(renderManual, 50);
    node.replaceWith(Object.assign(document.createElement('div'), { className: 'card', innerHTML: `✅ Diterbitkan. ${post.permalink ? `<a href="${esc(post.permalink)}" target="_blank">Lihat di Threads ↗</a>` : ''}` }));
    loadStatus();
  }));
  $('.act-schedule', node).addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const when = $('.act-when', node).value;
    if (!when) throw new Error('Pilih tarikh & masa.');
    if (Date.parse(when) < Date.now()) throw new Error('Masa sudah lepas.');
    const { post } = await save('schedule', { scheduled_at: toIso(when) });
    toast(`🗓️ Dijadualkan: ${fmtTime(post.scheduled_at)}`);
    node.remove();
    if (meta.manual) renderManual();
  }));
  $('.act-draft', node).addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await save('draft');
    toast('💾 Disimpan sebagai draf');
    node.remove();
    if (meta.manual) renderManual();
  }));
  return node;
}

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
      box.innerHTML = '<div class="section-head"><h3>Draf dijana</h3></div>';
      const meta = { category: body.category, topic: body.topic, source_url: $('#gSourceUrl').value };
      posts.forEach((p) => box.appendChild(draftCard(p, meta)));
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { box.innerHTML = ''; throw err; }
  });
});
$('#gTopic').addEventListener('input', () => { $('#gSourceUrl').value = ''; $('#gSource').value = ''; });

// ---------- Jadual / senarai post ----------
$('#postFilter').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  postFilter = b.dataset.s;
  $$('#postFilter button').forEach((x) => x.classList.toggle('active', x === b));
  loadPosts();
});
$('#refreshPosts').addEventListener('click', () => loadPosts());

const STATUS_TAG = {
  draft: '<span class="tag">Draf</span>',
  scheduled: '<span class="tag warn">Berjadual</span>',
  publishing: '<span class="tag warn">Sedang terbit…</span>',
  posted: '<span class="tag ok">Diterbitkan</span>',
  failed: '<span class="tag bad">Gagal</span>',
};

async function loadPosts() {
  const list = $('#postList');
  list.innerHTML = '<div class="skeleton"></div>';
  const { posts } = await api(`/api/posts?status=${postFilter}`).catch((e) => { toast(e.message, true); return { posts: [] }; });
  if (postFilter === 'scheduled') posts.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  if (!posts.length) { list.innerHTML = '<div class="empty">Tiada post di sini.</div>'; return; }
  list.innerHTML = posts.map((p) => {
    const c = STATUS.categories[p.category] || {};
    const editable = !['posted', 'publishing'].includes(p.status);
    return `<div class="card" data-id="${p.id}">
      <div class="post-text">${esc(p.text)}</div>
      <div class="post-meta">
        ${STATUS_TAG[p.status] || ''}
        ${p.category ? `<span class="tag">${c.emoji || ''} ${esc(c.label || p.category)}</span>` : ''}
        ${p.origin === 'autopilot' ? '<span class="tag">🤖 Autopilot</span>' : ''}
        ${p.scheduled_at && p.status === 'scheduled' ? `<span>🗓️ ${fmtTime(p.scheduled_at)}</span>` : ''}
        ${p.posted_at ? `<span>✅ ${fmtTime(p.posted_at)}</span>` : ''}
        <span>${len(p.text)}/${STATUS.max_chars}</span>
      </div>
      ${p.error ? `<p class="err small">${esc(p.error)}</p>` : ''}
      <div class="row wrap">
        ${editable ? `
          <button class="btn primary sm" data-act="publish">🚀 Post sekarang</button>
          <button class="btn sm" data-act="edit">✏️ Edit</button>
          <input type="datetime-local" class="act-when sm" value="${p.scheduled_at ? (() => { const d = new Date(p.scheduled_at); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : defaultWhen()}" />
          <button class="btn sm" data-act="schedule">🗓️ ${p.status === 'scheduled' ? 'Tukar masa' : 'Jadualkan'}</button>
          ${p.status === 'scheduled' ? '<button class="btn sm" data-act="unschedule">↩︎ Jadi draf</button>' : ''}
        ` : ''}
        ${p.permalink ? `<a class="btn sm" href="${esc(p.permalink)}" target="_blank" rel="noopener">Lihat di Threads ↗</a>` : ''}
        ${p.source_url ? `<a class="btn sm" href="${esc(p.source_url)}" target="_blank" rel="noopener">Sumber ↗</a>` : ''}
        ${p.status !== 'publishing' ? '<button class="btn danger sm" data-act="delete">🗑️</button>' : ''}
      </div>
    </div>`;
  }).join('');
}

$('#postList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const card = b.closest('[data-id]');
  const id = card.dataset.id;
  const act = b.dataset.act;
  if (act === 'edit') {
    const textEl = $('.post-text', card);
    if (textEl.tagName === 'TEXTAREA') {
      return busy(b, async () => {
        await api(`/api/posts/${id}`, { method: 'PUT', body: { text: textEl.value } });
        toast('Disimpan'); loadPosts();
      });
    }
    const ta = document.createElement('textarea');
    ta.className = 'post-text'; ta.rows = 7; ta.value = textEl.textContent;
    textEl.replaceWith(ta); ta.focus();
    b.innerHTML = '💾 Simpan';
    return;
  }
  busy(b, async () => {
    if (act === 'publish') {
      if (!confirm('Terbitkan post ini ke Threads sekarang?')) return;
      const ta = $('textarea.post-text', card);
      if (ta) await api(`/api/posts/${id}`, { method: 'PUT', body: { text: ta.value } });
      await api(`/api/posts/${id}/publish`, { method: 'POST' });
      toast('✅ Diterbitkan!');
    }
    if (act === 'schedule') {
      const when = $('.act-when', card).value;
      if (!when || Date.parse(when) < Date.now()) throw new Error('Pilih masa akan datang.');
      const ta = $('textarea.post-text', card);
      await api(`/api/posts/${id}`, { method: 'PUT', body: { status: 'scheduled', scheduled_at: toIso(when), ...(ta ? { text: ta.value } : {}) } });
      toast(`🗓️ Dijadualkan: ${fmtTime(toIso(when))}`);
    }
    if (act === 'unschedule') await api(`/api/posts/${id}`, { method: 'PUT', body: { status: 'draft' } });
    if (act === 'delete') {
      if (!confirm('Padam post ini?')) return;
      await api(`/api/posts/${id}`, { method: 'DELETE' });
    }
    loadPosts();
    loadStatus();
  });
});

// ---------- Autopilot ----------
function renderAutopilot() {
  const ap = autopilot;
  $('#apEnabled').checked = ap.enabled;
  $$('input[name=apMode]').forEach((r) => { r.checked = r.value === ap.mode; });
  $('#apTimes').innerHTML = ap.times.length
    ? ap.times.map((t) => `<span class="chip on" data-t="${t}">${t}<span class="x">✕</span></span>`).join('')
    : '<span class="muted small">Belum ada masa.</span>';
  $('#apCats').innerHTML = Object.entries(STATUS.categories).map(([k, c]) =>
    `<button type="button" class="chip ${ap.categories.includes(k) ? 'on' : ''}" data-k="${k}">${c.emoji} ${esc(c.label)}</button>`).join('');
  $('#apTone').value = ap.tone;
  $('#apJitter').value = ap.jitter_minutes;
  $('#apExtra').value = ap.extra || '';
  $('#tzLabel').textContent = STATUS.timezone;
}
async function loadAutopilot() {
  autopilot = await api('/api/autopilot');
  renderAutopilot();
}
$('#apTimes').addEventListener('click', (e) => {
  const c = e.target.closest('[data-t]');
  if (!c) return;
  autopilot.times = autopilot.times.filter((t) => t !== c.dataset.t);
  renderAutopilot();
});
$('#apAddTime').addEventListener('click', () => {
  const v = $('#apTimeInput').value;
  if (!v) return toast('Pilih masa dulu', true);
  if (!autopilot.times.includes(v)) autopilot.times = [...autopilot.times, v].sort();
  renderAutopilot();
});
$('#apCats').addEventListener('click', (e) => {
  const c = e.target.closest('[data-k]');
  if (!c) return;
  const k = c.dataset.k;
  autopilot.categories = autopilot.categories.includes(k) ? autopilot.categories.filter((x) => x !== k) : [...autopilot.categories, k];
  renderAutopilot();
});
$('#apForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy(e.submitter || $('#apForm button[type=submit]'), async () => {
    const mode = $('input[name=apMode]:checked')?.value || 'review';
    if ($('#apEnabled').checked && mode === 'auto' && !STATUS.threads.connected) throw new Error('Sambung akaun Threads dulu di Tetapan.');
    autopilot = await api('/api/autopilot', {
      method: 'PUT',
      body: {
        enabled: $('#apEnabled').checked, mode, times: autopilot.times, categories: autopilot.categories,
        tone: $('#apTone').value, jitter_minutes: Number($('#apJitter').value), extra: $('#apExtra').value,
      },
    });
    renderAutopilot();
    toast(autopilot.enabled ? '🤖 Autopilot aktif' : 'Disimpan (autopilot tidak aktif)');
    loadLogs();
  });
});
$('#apRunNow').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const { post } = await api('/api/autopilot/run', { method: 'POST' });
  toast('📝 Draf baharu dicipta — semak di tab Jadual › Draf');
  loadLogs();
  return post;
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
  const t = STATUS.threads;
  const exp = t.expires_at ? Math.round((Date.parse(t.expires_at) - Date.now()) / 86400000) : null;
  $('#threadsInfo').innerHTML = t.connected
    ? `<p>✅ Disambung sebagai <b>@${esc(t.username || t.user_id)}</b>${exp !== null ? `<br><span class="muted small">Token luput dalam ${exp} hari (auto-diperbaharui)</span>` : ''}</p>`
    : '<p class="muted">Belum disambung.</p>';
  $('#oauthBox').classList.toggle('hidden', !STATUS.oauth_configured || t.connected);
  $('#manualTokenBox').open = !STATUS.oauth_configured && !t.connected;
  $('#threadsActions').innerHTML = t.connected
    ? `<button class="btn sm" id="btnRefreshTok">↻ Perbaharui token</button><button class="btn sm" id="btnLimit">Kuota post</button><button class="btn danger sm" id="btnDisconnect">Putuskan</button>`
    : '';
  $('#aiInfo').innerHTML = `<p>${STATUS.ai.configured ? '✅' : '⚠️'} Penyedia: <b>${esc(STATUS.ai.provider)}</b>${STATUS.ai.model ? ` · ${esc(STATUS.ai.model)}` : ''}
    ${STATUS.ai.configured ? '' : '<br><span class="err small">API key AI belum ditetapkan dalam .env</span>'}</p>`;
  const s = await api('/api/settings');
  $('#persona').value = s.persona || '';

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if (params.get('ok')) toast('✅ Akaun Threads disambung!');
  if (params.get('err')) toast(params.get('err'), true);
  if (params.toString()) history.replaceState(null, '', '#tetapan');
}
$('#threadsActions').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  busy(b, async () => {
    if (b.id === 'btnRefreshTok') { await api('/api/threads/refresh', { method: 'POST' }); toast('Token diperbaharui'); }
    if (b.id === 'btnLimit') {
      const r = await api('/api/threads/limit');
      const d = r.data?.[0] || {};
      toast(`Kuota 24 jam: ${d.quota_usage ?? '?'} / ${d.config?.quota_total ?? 250} post`);
      return;
    }
    if (b.id === 'btnDisconnect') {
      if (!confirm('Putuskan akaun Threads?')) return;
      await api('/api/threads/disconnect', { method: 'POST' });
    }
    renderSettings();
  });
});
$('#tokenForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy(e.submitter, async () => {
    const r = await api('/api/threads/token', { method: 'POST', body: { access_token: $('#tokenInput').value } });
    $('#tokenInput').value = '';
    toast(`✅ Disambung sebagai @${r.username}`);
    renderSettings();
  });
});
$('#personaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  busy(e.submitter, async () => {
    await api('/api/settings', { method: 'PUT', body: { persona: $('#persona').value } });
    toast('Persona disimpan');
  });
});

// ---------- Draf manual ----------
function renderManual() {
  const box = $('#manualDraft');
  box.innerHTML = '';
  box.appendChild(draftCard('', { category: null, manual: true }));
}

// ---------- Mula ----------
async function boot() {
  const me = await fetch('/api/me').then((r) => r.json());
  if (!me.authenticated) return showLogin();
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await loadStatus();
  if (!selectedCats.size) Object.keys(STATUS.categories).forEach((k) => selectedCats.add(k));
  renderCatChips();
  renderManual();
  const tab = (location.hash.slice(1).split('?')[0]) || 'trending';
  openTab(['trending', 'jana', 'jadual', 'autopilot', 'tetapan'].includes(tab) ? tab : 'trending');
  loadTrending();
}
boot();
