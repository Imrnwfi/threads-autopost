// Halaman "Lagi": Kalendar, Produk & Komisen, Siri, Insight, Bank Hook, Tetapan
import { DEFAULT_MODELS, researchProduct, analyzeStyle } from './ai.js';
import { state, save, touch, removeFrom, exportAll, mergeAll, clearAll, onChange } from './store.js';
import { $, $$, esc, uid, nowIso, toast, busy, copyText, fmtTime, openSheet, myParts, download, TZ, prefs, setPref, haptic } from './util.js';
import { get, set, restore } from './store.js';
import { HOOK_GROUPS, upcomingEvents, daysUntil, DEFAULT_PLAN, SLOT_TYPES, DAY_NAMES } from './data.js';
import * as sync from './sync.js';

let A; // API daripada app.js
const S = () => state.settings;

export function initPages(api) {
  A = api;
  Object.assign(A.renderers, {
    kalendar: renderCalendar,
    produk: renderProducts,
    siri: renderSeries,
    insight: renderInsight,
    hook: renderHooks,
    tetapan: renderSettings,
  });
  initSettings();
  initSync();
}

// =========================================================
// KALENDAR
// =========================================================
const planDays = () => state.plan?.days || DEFAULT_PLAN;

function renderCalendar() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    days.push({ d, ...myParts(d) });
  }
  const events = upcomingEvents(new Date(), 120);
  $('#weekStrip').innerHTML = days.map(({ d, date, wd }, i) => {
    const slots = planDays()[wd] || [];
    const drafts = state.posts.filter((p) => p.status === 'draft' && p.planned_at && myParts(new Date(p.planned_at)).date === date);
    const evs = events.filter((e) => e.date === date);
    return `
      <div class="day ${i === 0 ? 'today' : ''}">
        <div class="day-head"><b>${i === 0 ? 'Hari ini' : i === 1 ? 'Esok' : DAY_NAMES[wd]}</b><span>${d.toLocaleDateString('ms-MY', { timeZone: TZ, day: 'numeric', month: 'short' })}</span></div>
        ${evs.map((e) => `<div class="day-ev">${e.emoji} ${esc(e.name)}</div>`).join('')}
        ${slots.map((s, j) => `<button class="day-slot" data-wd="${wd}" data-j="${j}"><span>${esc(s.time || '')}</span>${esc(SLOT_TYPES[s.type]?.label || s.type)}</button>`).join('')}
        ${drafts.map((p) => `<button class="day-slot draft" data-goto="draf"><span>${fmtTime(p.planned_at).split(', ').pop()}</span>📝 ${esc(p.parts[0].slice(0, 40))}</button>`).join('')}
        ${!slots.length && !drafts.length && !evs.length ? '<div class="muted small">Rehat 😌</div>' : ''}
      </div>`;
  }).join('');
  $('#weekStrip').onclick = (e) => {
    const b = e.target.closest('[data-wd]');
    if (b) A.startSlot(planDays()[b.dataset.wd][b.dataset.j]);
  };

  $('#eventList').innerHTML = events.slice(0, 12).map((ev, i) => {
    const n = daysUntil(ev.date);
    return `
      <div class="card ev">
        <div class="ev-top">
          <span class="ev-emoji">${ev.emoji}</span>
          <div><b>${esc(ev.name)}</b><small>${new Date(`${ev.date}T00:00:00`).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
          <span class="tag ${n <= 3 ? 'hot' : n <= 7 ? 'acc' : ''}">${n === 0 ? 'Hari ini' : `${n} hari`}</span>
        </div>
        ${n > 0 && n <= 7 ? '<p class="muted small">💡 Mula post 3–7 hari sebelum supaya pengikut sempat simpan & beli.</p>' : ''}
        <div class="chips">${ev.ideas.map((idea, k) => `<button class="chip sm" data-ev="${i}" data-idea="${k}">✨ ${esc(idea)}</button>`).join('')}</div>
      </div>`;
  }).join('');
  $('#eventList').onclick = (e) => {
    const b = e.target.closest('[data-ev]');
    if (!b) return;
    const ev = events[Number(b.dataset.ev)];
    const idea = ev.ideas[Number(b.dataset.idea)];
    const extra = `Sempena ${ev.name.replace('*', '')} (${ev.date}).`;
    if (ev.type === 'sale') {
      A.applyPreset({ mode: 'affiliate', multi: true, extra });
      $('#mTheme').value = `${idea} — ${ev.name}`;
      toast('Tambah produk untuk senarai jualan ini 🛒');
    } else {
      A.applyPreset({ mode: 'topic', format: 'thread', topic: `${ev.name.replace('*', '')}: ${idea}`, extra });
    }
    A.openTab('studio');
  };
}

$('#editPlanBtn').addEventListener('click', () => {
  const days = JSON.parse(JSON.stringify(planDays()));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const typeOpts = (sel) => Object.entries(SLOT_TYPES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  const seriesOpts = (sel) => state.series.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const panel = openSheet('✏️ Pelan mingguan', '<div class="plan-edit"></div><button class="btn primary block pe-save">💾 Simpan pelan</button><button class="btn block pe-reset" style="margin-top:8px">Set semula ke cadangan</button>', { wide: true });
  const draw = () => {
    $('.plan-edit', panel).innerHTML = order.map((wd) => `
      <div class="pe-day"><div class="pe-head"><b>${DAY_NAMES[wd]}</b><button class="mini" data-add="${wd}">＋ Slot</button></div>
        ${(days[wd] || []).map((s, j) => `
          <div class="pe-slot" data-wd="${wd}" data-j="${j}">
            <input type="time" data-f="time" value="${esc(s.time || '')}" />
            <select data-f="type">${typeOpts(s.type)}</select>
            ${s.type === 'series' ? `<select data-f="series_id"><option value="">Pilih siri</option>${seriesOpts(s.series_id)}</select>` : ''}
            <button class="mini" data-del>✕</button>
          </div>`).join('') || '<div class="muted small">Tiada slot</div>'}
      </div>`).join('');
  };
  draw();
  panel.addEventListener('change', (e) => {
    const row = e.target.closest('.pe-slot');
    if (!row) return;
    days[row.dataset.wd][row.dataset.j][e.target.dataset.f] = e.target.value;
    if (e.target.dataset.f === 'type') draw();
  });
  panel.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { (days[add.dataset.add] ||= []).push({ type: 'viral', time: '20:00' }); draw(); }
    const del = e.target.closest('[data-del]');
    if (del) { const r = del.closest('.pe-slot'); days[r.dataset.wd].splice(r.dataset.j, 1); draw(); }
    if (e.target.closest('.pe-save')) {
      for (const k of Object.keys(days)) days[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      state.plan = touch({ days }); save('plan'); panel.close(); renderCalendar(); toast('🗓️ Pelan disimpan');
    }
    if (e.target.closest('.pe-reset')) { Object.assign(days, JSON.parse(JSON.stringify(DEFAULT_PLAN))); draw(); }
  });
});

// =========================================================
// PRODUK & KOMISEN
// =========================================================
let productSort = 'komisen';
$('#productSort').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  productSort = b.dataset.s;
  $$('#productSort button').forEach((x) => x.classList.toggle('active', x === b));
  renderProducts();
});
const rm = (n) => `RM${(Number(n) || 0).toFixed(2)}`;
function renderProducts() {
  const ps = [...state.products];
  const tot = ps.reduce((a, p) => ({ c: a.c + (+p.clicks || 0), s: a.s + (+p.sales || 0), k: a.k + (+p.commission || 0) }), { c: 0, s: 0, k: 0 });
  $('#productTotals').innerHTML = `
    <div class="stat"><b>${tot.c}</b><span>Klik</span></div>
    <div class="stat"><b>${tot.s}</b><span>Jualan</span></div>
    <div class="stat"><b>${rm(tot.k)}</b><span>Komisen</span></div>`;
  ps.sort((a, b) => productSort === 'komisen' ? (+b.commission || 0) - (+a.commission || 0)
    : productSort === 'klik' ? (+b.clicks || 0) - (+a.clicks || 0)
      : (b.created_at || '').localeCompare(a.created_at || ''));
  if (!ps.length) {
    $('#productList').innerHTML = '<div class="empty"><span class="big">📦</span>Tiada produk lagi.<br>Produk disimpan automatik bila anda simpan draf affiliate, atau tekan <b>➕ Produk</b>.</div>';
    return;
  }
  const best = ps[0] && productSort === 'komisen' && +ps[0].commission > 0 ? ps[0].id : null;
  $('#productList').innerHTML = ps.map((p) => {
    const conv = +p.clicks ? ((+p.sales || 0) / +p.clicks * 100).toFixed(1) : null;
    return `
      <div class="card prod" data-id="${p.id}">
        <div class="prod-top">
          <div><b>${best === p.id ? '🏆 ' : ''}${esc(p.name || '(tiada nama)')}</b><small>${esc(p.price || '')}${p.posts ? ` · ${p.posts} post` : ''}${conv !== null ? ` · ${conv}% tukar` : ''}</small></div>
          <a class="mini" href="${esc(p.link)}" target="_blank" rel="noopener">↗</a>
        </div>
        <div class="prod-stats">
          <div><span>👆 Klik</span><b>${+p.clicks || 0}</b><button class="mini" data-inc="clicks">＋1</button></div>
          <div><span>🛒 Jualan</span><b>${+p.sales || 0}</b><button class="mini" data-inc="sales">＋1</button></div>
          <div><span>💰 Komisen</span><b>${rm(p.commission)}</b><button class="mini" data-edit>✏️</button></div>
        </div>
        <div class="row wrap">
          <button class="btn sm primary" data-gen>✨ Jana post</button>
          <button class="btn sm" data-edit>✏️ Edit</button>
          <button class="btn sm danger" data-del>🗑️</button>
        </div>
      </div>`;
  }).join('');
}
$('#productList').addEventListener('click', (e) => {
  const card = e.target.closest('.prod');
  if (!card) return;
  const p = state.products.find((x) => x.id === card.dataset.id);
  const inc = e.target.closest('[data-inc]');
  if (inc) { p[inc.dataset.inc] = (+p[inc.dataset.inc] || 0) + 1; touch(p); save('products'); renderProducts(); return; }
  if (e.target.closest('[data-gen]')) { A.applyPreset({ mode: 'affiliate', multi: false, product: p }); A.openTab('studio'); return; }
  if (e.target.closest('[data-edit]')) { productSheet(p); return; }
  if (e.target.closest('[data-del]')) {
    const r = removeFrom('products', p.id); renderProducts(); haptic(20);
    toast('🗑️ Produk dipadam', false, { action: { label: 'Buat asal', fn: () => { restore('products', r.item, r.index); renderProducts(); } } });
  }
});
$('#addProductBtn').addEventListener('click', () => productSheet(null));

function productSheet(p) {
  const v = p || { link: '', name: '', price: '', highlights: '', audience: '', clicks: 0, sales: 0, commission: 0 };
  const panel = openSheet(p ? '✏️ Edit produk' : '➕ Produk baharu', `
    <div class="form">
      <label>Link <div class="input-row"><input data-f="link" type="url" value="${esc(v.link)}" placeholder="https://shopee.com.my/..." /><button class="btn sm accent ps-auto">✨</button></div></label>
      <label>Nama <input data-f="name" value="${esc(v.name)}" /></label>
      <div class="row"><label>Harga <input data-f="price" value="${esc(v.price)}" /></label><label>Sesuai untuk <input data-f="audience" value="${esc(v.audience || '')}" /></label></div>
      <label>Kelebihan <textarea data-f="highlights" rows="2">${esc(v.highlights || '')}</textarea></label>
      <div class="field-label">📊 Prestasi (dari Shopee Affiliate)</div>
      <div class="row"><label>Klik <input data-f="clicks" type="number" min="0" value="${+v.clicks || 0}" /></label><label>Jualan <input data-f="sales" type="number" min="0" value="${+v.sales || 0}" /></label><label>Komisen (RM) <input data-f="commission" type="number" min="0" step="0.01" value="${+v.commission || 0}" /></label></div>
      <button class="btn primary ps-save">💾 Simpan</button>
    </div>`);
  const val = (f) => $(`[data-f="${f}"]`, panel).value.trim();
  $('.ps-auto', panel).addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const info = await researchProduct(S(), val('link'), val('name'));
    for (const f of ['name', 'price', 'highlights', 'audience']) if (info[f]) $(`[data-f="${f}"]`, panel).value = info[f];
    toast(info.note);
  }, ''));
  $('.ps-save', panel).addEventListener('click', () => {
    const data = { link: val('link'), name: val('name'), price: val('price'), audience: val('audience'), highlights: val('highlights'), clicks: +val('clicks') || 0, sales: +val('sales') || 0, commission: +val('commission') || 0 };
    if (!/^https?:\/\//.test(data.link) || !data.name) return toast('Isi link (https://) & nama', true);
    if (p) Object.assign(p, data, { updated_at: nowIso() });
    else state.products.unshift(touch({ id: uid(), posts: 0, created_at: nowIso(), ...data }));
    save('products'); panel.close(); renderProducts(); toast('📦 Disimpan');
  });
}

// =========================================================
// SIRI
// =========================================================
function renderSeries() {
  if (!state.series.length) {
    $('#seriesList').innerHTML = `<div class="empty"><span class="big">📚</span>Belum ada siri.<br>Contoh: <b>"Tips Jimat #1, #2…"</b> atau <b>"AI Tool Minggu Ni"</b>.<br><br><button class="btn primary" data-new-series>➕ Cipta siri pertama</button></div>`;
    return;
  }
  $('#seriesList').innerHTML = state.series.map((s) => `
    <div class="card series" data-id="${s.id}">
      <div class="prod-top"><div><b>${esc(s.emoji || '📚')} ${esc(s.name)}</b><small>${esc(s.desc || '')}</small></div><span class="tag acc">#${s.nextNo || 1} seterusnya</span></div>
      ${(s.history || []).length ? `<div class="ep-list">${s.history.slice(-4).reverse().map((h) => `<div><span>#${h.no}</span>${esc(h.topic)}</div>`).join('')}</div>` : '<p class="muted small">Belum ada episod.</p>'}
      <div class="row wrap">
        <button class="btn sm primary" data-gen>✨ Jana episod #${s.nextNo || 1}</button>
        <button class="btn sm" data-edit>✏️ Edit</button>
        <button class="btn sm danger" data-del>🗑️</button>
      </div>
    </div>`).join('');
}
$('#seriesList').addEventListener('click', (e) => {
  if (e.target.closest('[data-new-series]')) return seriesSheet(null);
  const card = e.target.closest('.series');
  if (!card) return;
  const s = state.series.find((x) => x.id === card.dataset.id);
  if (e.target.closest('[data-gen]')) { A.applyPreset({ series: s.id, topic: '' }); A.openTab('studio'); }
  if (e.target.closest('[data-edit]')) seriesSheet(s);
  if (e.target.closest('[data-del]')) {
    const r = removeFrom('series', s.id); renderSeries(); haptic(20);
    toast(`🗑️ Siri "${s.name}" dipadam`, false, { action: { label: 'Buat asal', fn: () => { restore('series', r.item, r.index); renderSeries(); } } });
  }
});
$('#addSeriesBtn').addEventListener('click', () => seriesSheet(null));

function seriesSheet(s) {
  const v = s || { name: '', emoji: '📌', desc: '', category: 'finance', format: 'single', tone: 'santai', nextNo: 1 };
  const cats = A.getCats();
  const panel = openSheet(s ? '✏️ Edit siri' : '📚 Siri baharu', `
    <div class="form">
      <div class="row"><label style="flex:0 0 80px">Emoji <input data-f="emoji" maxlength="4" value="${esc(v.emoji)}" /></label><label>Nama siri <input data-f="name" value="${esc(v.name)}" placeholder="cth. Tips Jimat" /></label></div>
      <label>Penerangan / tema <textarea data-f="desc" rows="2" placeholder="cth. Satu tips jimat duit praktikal setiap episod untuk anak muda">${esc(v.desc)}</textarea></label>
      <div class="row">
        <label>Kategori <select data-f="category">${Object.entries(cats).map(([k, c]) => `<option value="${k}" ${k === v.category ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}</select></label>
        <label>Format <select data-f="format"><option value="single" ${v.format === 'single' ? 'selected' : ''}>Satu post</option><option value="thread" ${v.format === 'thread' ? 'selected' : ''}>Bebenang</option></select></label>
      </div>
      <label>Nombor episod seterusnya <input data-f="nextNo" type="number" min="1" value="${v.nextNo || 1}" /></label>
      <button class="btn primary ss-save">💾 Simpan</button>
    </div>`);
  $('.ss-save', panel).addEventListener('click', () => {
    const val = (f) => $(`[data-f="${f}"]`, panel).value.trim();
    const data = { name: val('name'), emoji: val('emoji') || '📌', desc: val('desc'), category: val('category'), format: val('format'), nextNo: Math.max(1, +val('nextNo') || 1) };
    if (!data.name) return toast('Isi nama siri', true);
    if (s) Object.assign(s, data, { updated_at: nowIso() });
    else state.series.unshift(touch({ id: uid(), tone: 'santai', history: [], created_at: nowIso(), ...data }));
    save('series'); panel.close(); renderSeries(); toast('📚 Siri disimpan');
  });
}

// =========================================================
// INSIGHT
// =========================================================
const BLOCKS = [[0, 6, 'Tengah malam (12–6 pg)'], [6, 9, 'Pagi (6–9 pg)'], [9, 12, 'Lewat pagi (9–12 tgh)'], [12, 15, 'Tengah hari (12–3 ptg)'], [15, 18, 'Petang (3–6 ptg)'], [18, 21, 'Senja (6–9 mlm)'], [21, 24, 'Malam (9–12 mlm)']];
const engScore = (e = {}) => (e.likes || 0) + 2 * (e.replies || 0) + 3 * (e.reposts || 0) + (e.views || 0) / 100;

function bars(rows, best) {
  const max = Math.max(...rows.map((r) => r.avg), 1);
  return rows.map((r) => `
    <div class="bar-row ${r.key === best ? 'best' : ''}">
      <span class="bar-label">${esc(r.label)}</span>
      <span class="bar"><i style="width:${(r.avg / max) * 100}%"></i></span>
      <span class="bar-val">${r.n ? Math.round(r.avg) : '–'}<small>${r.n ? ` (${r.n})` : ''}</small></span>
    </div>`).join('');
}
function group(list, keyFn, defs) {
  return defs.map(([key, label]) => {
    const g = list.filter((p) => keyFn(p) === key);
    return { key, label, n: g.length, avg: g.length ? g.reduce((s, p) => s + p.score, 0) / g.length : 0 };
  });
}
function renderInsight() {
  const posted = state.posts.filter((p) => p.status === 'posted');
  const data = posted.filter((p) => p.engagement && Object.values(p.engagement).some((v) => v != null))
    .map((p) => {
      const mp = myParts(new Date(p.posted_at));
      return { ...p, score: engScore(p.engagement), hour: mp.hour, wd: mp.wd };
    });
  const weeks = [0, 1, 2, 3].map((w) => posted.filter((p) => {
    const age = (Date.now() - Date.parse(p.posted_at)) / 86400000;
    return age >= w * 7 && age < (w + 1) * 7;
  }).length);

  const freq = `
    <div class="card"><h3>📆 Kekerapan post</h3>
      <div class="stats">${['Minggu ini', 'Minggu lepas', '2 minggu lalu'].map((l, i) => `<div class="stat"><b>${weeks[i]}</b><span>${l}</span></div>`).join('')}</div>
    </div>`;

  if (data.length < 1) {
    $('#insightBody').innerHTML = `${freq}
      <div class="empty"><span class="big">📊</span><b>Belum cukup data.</b><br>Selepas post, buka draf di <b>Draf → Sudah post</b> dan isi ❤️ suka, 💬 balasan, 🔁 kongsi & 👁️ tontonan (dari Threads Insights).<br><br>Selepas 5+ post, app akan cadangkan masa terbaik untuk anda.</div>`;
    return;
  }
  const byBlock = group(data, (p) => BLOCKS.findIndex(([a, b]) => p.hour >= a && p.hour < b), BLOCKS.map((b, i) => [i, b[2]]));
  const byDay = group(data, (p) => p.wd, [1, 2, 3, 4, 5, 6, 0].map((d) => [d, DAY_NAMES[d]]));
  const byType = group(data, (p) => (p.mode === 'affiliate' ? 'aff' : p.parts.length > 1 ? 'thread' : 'single'), [['single', '📄 Satu post'], ['thread', '🧵 Bebenang'], ['aff', '🛍️ Affiliate']]);
  const pick = (rows) => rows.filter((r) => r.n >= (data.length >= 10 ? 2 : 1)).sort((a, b) => b.avg - a.avg)[0];
  const bb = pick(byBlock), bd = pick(byDay), bt = pick(byType);
  const top = [...data].sort((a, b) => b.score - a.score).slice(0, 3);
  const avg = data.reduce((s, p) => s + p.score, 0) / data.length;

  $('#insightBody').innerHTML = `
    <div class="card reco">
      <h3>🎯 Cadangan untuk anda</h3>
      ${data.length < 5 ? `<p class="muted small">Berdasarkan ${data.length} post — cadangan lebih tepat selepas 5+ post.</p>` : ''}
      <div class="reco-grid">
        <div><span>⏰ Masa terbaik</span><b>${esc(bb?.label || '–')}</b></div>
        <div><span>📅 Hari terbaik</span><b>${esc(bd?.label || '–')}</b></div>
        <div><span>✨ Format terbaik</span><b>${esc(bt?.label || '–')}</b></div>
        <div><span>⚡ Purata skor</span><b>${Math.round(avg)}</b></div>
      </div>
      <p class="muted small">Skor = suka + 2×balasan + 3×kongsi + tontonan/100</p>
    </div>
    <div class="card"><h3>⏰ Ikut masa</h3>${bars(byBlock, bb?.key)}</div>
    <div class="card"><h3>📅 Ikut hari</h3>${bars(byDay, bd?.key)}</div>
    <div class="card"><h3>✨ Ikut format</h3>${bars(byType, bt?.key)}</div>
    <div class="card"><h3>🏆 Post terbaik</h3>
      ${top.map((p, i) => `<div class="top-post"><span class="rank">${i + 1}</span><div><div class="ellip2">${esc(p.parts[0])}</div><small class="muted">⚡ ${Math.round(p.score)} · ${fmtTime(p.posted_at)}</small></div></div>`).join('')}
    </div>
    ${freq}`;
}

// =========================================================
// BANK HOOK
// =========================================================
function renderHooks() {
  $('#hookList').innerHTML = Object.values(HOOK_GROUPS).map((g) => `
    <div class="card"><h3>${esc(g.label)}</h3>
      ${g.hooks.map((h) => `<div class="hook-row"><span>${esc(h)}</span><button class="mini" data-copy="${esc(h)}">📋</button><button class="mini accent" data-use="${esc(h)}">Guna</button></div>`).join('')}
    </div>`).join('');
}
$('#hookList').addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]');
  if (c) copyText(c.dataset.copy);
  const u = e.target.closest('[data-use]');
  if (u) { A.applyPreset({ hook: u.dataset.use }); A.openTab('studio'); toast('🪝 Hook dipilih'); }
});

// =========================================================
// TETAPAN
// =========================================================
const KEY_HELP = {
  gemini: 'Dapatkan key percuma di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>. Sokong carian web untuk "Isi automatik".',
  anthropic: 'Dapatkan key di <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Claude Console</a>. Carian web perlu diaktifkan dalam Console.',
  openai: 'Guna key OpenAI, atau set Base URL untuk Groq/OpenRouter. (Tiada carian web — "Isi automatik" hanya teka dari link.)',
};
function renderSettings() {
  const s = S();
  $('#sName').value = s.name; $('#sUser').value = s.user;
  $('#sProvider').value = s.provider; $('#sKey').value = s.apiKey;
  $('#sModel').value = s.model; $('#sBaseUrl').value = s.baseUrl; $('#sPersona').value = s.persona;
  $('#styleSamples').value = s.styleSamples || ''; $('#styleGuide').value = s.styleGuide || ''; $('#sUseStyle').checked = !!s.useStyle;
  $('#sClientId').value = s.googleClientId || '';
  syncProviderUI();
  const fs = String(get('fontScale', 1));
  $$('#fontSeg button').forEach((b) => b.classList.toggle('active', b.dataset.v === fs));
  $('#sHaptic').checked = prefs.haptic;
  $('#sAnim').checked = prefs.anim;
  $('#goalOut').textContent = get('weeklyGoal', 5);
  updateSyncStatus();
}
function syncProviderUI() {
  const p = $('#sProvider').value;
  $('#sModel').placeholder = DEFAULT_MODELS[p];
  $('#keyHelp').innerHTML = KEY_HELP[p];
  $('#baseUrlRow').classList.toggle('hidden', p !== 'openai');
}
function initSettings() {
  $('#sProvider').addEventListener('change', syncProviderUI);
  $('#fontSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set('fontScale', Number(b.dataset.v));
    document.documentElement.style.setProperty('--ui-zoom', b.dataset.v);
    $$('#fontSeg button').forEach((x) => x.classList.toggle('active', x === b));
  });
  $('#sHaptic').addEventListener('change', (e) => { setPref('haptic', e.target.checked); haptic(20); });
  $('#sAnim').addEventListener('change', (e) => setPref('anim', e.target.checked));
  const setGoal = (n) => { const g = Math.min(Math.max(n, 1), 50); set('weeklyGoal', g); $('#goalOut').textContent = g; };
  $('#goalMinus').addEventListener('click', () => setGoal(get('weeklyGoal', 5) - 1));
  $('#goalPlus').addEventListener('click', () => setGoal(get('weeklyGoal', 5) + 1));
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    Object.assign(state.settings, {
      name: $('#sName').value.trim().slice(0, 40),
      user: $('#sUser').value.trim().replace(/^@/, '').slice(0, 30),
      provider: $('#sProvider').value,
      apiKey: $('#sKey').value.trim(),
      model: $('#sModel').value.trim(),
      baseUrl: $('#sBaseUrl').value.trim(),
      persona: $('#sPersona').value.trim().slice(0, 1000),
    });
    touch(state.settings); save('settings');
    toast('💾 Tetapan disimpan');
  });
  $('#analyzeStyleBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const guide = await analyzeStyle(S(), $('#styleSamples').value);
    $('#styleGuide').value = guide;
    Object.assign(state.settings, { styleSamples: $('#styleSamples').value, styleGuide: guide, useStyle: true });
    $('#sUseStyle').checked = true;
    touch(state.settings); save('settings');
    A.setStudio({ useStyle: true });
    toast('✍️ Gaya tulisan dianalisis & disimpan');
  }, 'Menganalisis…'));
  $('#saveStyleBtn').addEventListener('click', () => {
    Object.assign(state.settings, { styleSamples: $('#styleSamples').value, styleGuide: $('#styleGuide').value.trim(), useStyle: $('#sUseStyle').checked });
    touch(state.settings); save('settings');
    A.setStudio({ useStyle: $('#sUseStyle').checked });
    toast('💾 Gaya disimpan');
  });
  $('#exportBtn').addEventListener('click', () => {
    download(`threads-gen-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' }));
  });
  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      mergeAll(Array.isArray(data) ? { posts: data } : data);
      A.refreshCounts();
      toast('⬆️ Data diimport');
    } catch { toast('Fail tidak sah', true); }
    e.target.value = '';
  });
  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('Padam SEMUA draf, produk, siri, tetapan dan API key dari browser ini?')) return;
    clearAll();
    location.reload();
  });
}

// =========================================================
// SYNC GOOGLE DRIVE
// =========================================================
function updateSyncStatus() {
  const last = sync.lastSync();
  $('#syncStatus').textContent = sync.isConnected()
    ? `✅ Disambung. Sync terakhir: ${last ? fmtTime(last) : 'belum'}`
    : last ? `Sync terakhir: ${fmtTime(last)}. Tekan Sync untuk sambung semula.` : 'Belum disambung.';
  $('#syncBtn').classList.toggle('hidden', !S().googleClientId);
  $('#syncBtn').classList.toggle('on', sync.isConnected());
}
async function doSync(btn) {
  return busy(btn, async () => {
    const r = await sync.syncNow();
    A.refreshCounts();
    updateSyncStatus();
    toast(`☁️ Sync selesai · ${r.posts} draf, ${r.products} produk`);
    const page = location.hash.slice(1);
    A.renderers[page]?.();
  }, 'Sync…');
}
function initSync() {
  $('#syncNowBtn').addEventListener('click', (e) => {
    const id = $('#sClientId').value.trim();
    if (id !== (S().googleClientId || '')) { state.settings.googleClientId = id; touch(state.settings); save('settings'); }
    doSync(e.currentTarget);
  });
  $('#syncOffBtn').addEventListener('click', () => { sync.disconnect(); updateSyncStatus(); toast('Sync diputuskan'); });
  $('#syncBtn').addEventListener('click', (e) => doSync(e.currentTarget));
  // Sync automatik selepas perubahan (jika sudah disambung)
  let t;
  onChange((k) => {
    if (sync.isSyncing() || !sync.isConnected() || !['posts', 'products', 'series', 'plan', 'customCats'].includes(k)) return;
    clearTimeout(t);
    t = setTimeout(() => sync.syncNow().then(updateSyncStatus).catch(() => {}), 8000);
  });
  updateSyncStatus();
}
