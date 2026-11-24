// Kad Info (infografik) — maklumat ringkas versi gambar untuk Story / Status / feed.
import { $, $$, esc, toast, copyText, download, openSheet, haptic } from './util.js';

export const INFO_SIZES = {
  '9:16': { w: 1080, h: 1920, label: '9:16 Story/Status' },
  '4:5': { w: 1080, h: 1350, label: '4:5 Threads/IG' },
  '1:1': { w: 1080, h: 1080, label: '1:1 Segi empat' },
};

const GROUP_PALETTE = {
  kewangan: ['#052e24', '#0f766e', '#34d399'],
  bantuan: ['#0b1f4d', '#1d4ed8', '#60a5fa'],
  ewallet: ['#2a0f57', '#6d28d9', '#c4b5fd'],
};
export const INFO_STYLES = {
  kategori: { label: '🎨 Ikut kategori' },
  tema: { label: '🖌️ Ikut tema app' },
  gelap: { label: '🌑 Gelap', bg: ['#0b0b0c', '#1c1c20'], text: '#f5f5f6', muted: '#a1a1aa', card: 'rgba(255,255,255,.07)', accent: '#facc15', accent2: '#fb923c' },
  cerah: { label: '☀️ Cerah', bg: ['#ffffff', '#f1f5f9'], text: '#0f172a', muted: '#64748b', card: 'rgba(15,23,42,.05)', accent: '#2563eb', accent2: '#7c3aed' },
  kertas: { label: '📜 Kertas', bg: ['#f7f0e3', '#efe3cc'], text: '#2b2118', muted: '#7a6a58', card: 'rgba(43,33,24,.06)', accent: '#c2410c', accent2: '#ea580c' },
  sunset: { label: '🌅 Sunset', bg: ['#ff5f6d', '#ffc371'], text: '#ffffff', muted: 'rgba(255,255,255,.85)', card: 'rgba(255,255,255,.16)', accent: '#ffffff', accent2: '#fff7cc' },
};

function resolveStyle(style, group) {
  if (style === 'kategori') {
    const [a, b, c] = GROUP_PALETTE[group] || GROUP_PALETTE.kewangan;
    return { bg: [a, b], text: '#ffffff', muted: 'rgba(255,255,255,.78)', card: 'rgba(255,255,255,.1)', accent: c, accent2: '#ffffff' };
  }
  if (style === 'tema') {
    const cs = getComputedStyle(document.documentElement);
    const v = (k) => cs.getPropertyValue(k).trim();
    return { bg: [v('--bg'), v('--panel-2')], text: v('--text'), muted: v('--muted'), card: v('--panel'), accent: v('--accent'), accent2: v('--accent-2') };
  }
  return INFO_STYLES[style] || INFO_STYLES.gelap;
}

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}

const FONT = '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';

/** Lukis kad info. o: { size, style, group, groupLabel, groupEmoji, subLabel, subEmoji, name, user, showName } */
export async function drawInfo(canvas, data, o) {
  const { w: W, h: H } = INFO_SIZES[o.size] || INFO_SIZES['9:16'];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const st = resolveStyle(o.style, o.group);
  try { await document.fonts.load(`800 48px ${FONT}`); } catch { /* fon sistem */ }

  // Latar
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.18; ctx.fillStyle = st.accent;
  ctx.beginPath(); ctx.arc(W * 0.95, H * 0.06, W * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.1;
  ctx.beginPath(); ctx.arc(W * 0.02, H * 0.98, W * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  const story = o.size === '9:16';
  const pad = 72;
  const top = story ? 190 : 80;          // ruang selamat UI Story di atas
  const bottom = story ? 230 : 70;       // ruang selamat (balas/kongsi) di bawah
  const innerW = W - pad * 2;
  const avail = H - top - bottom;

  // Susun atur dengan skala s; dry=true hanya ukur ketinggian
  function pass(s, dry, offsetY = 0) {
    let y = top + offsetY;
    ctx.textBaseline = 'top';
    // 1) Lencana kategori
    const badge = `${o.groupEmoji || ''} ${o.groupLabel || ''}${o.subLabel ? `  ·  ${o.subLabel}` : ''}`.trim();
    if (badge) {
      ctx.font = `700 ${Math.round(30 * s)}px ${FONT}`;
      const bw = Math.min(ctx.measureText(badge).width + 48 * s, innerW);
      const bh = 62 * s;
      if (!dry) {
        ctx.fillStyle = st.card; rr(ctx, pad, y, bw, bh, bh / 2); ctx.fill();
        ctx.fillStyle = st.text; ctx.fillText(badge, pad + 24 * s, y + (bh - 30 * s) / 2 - 2 * s, innerW - 48 * s);
      }
      y += bh + 34 * s;
    }
    // 2) Tajuk
    ctx.font = `800 ${Math.round(80 * s)}px ${FONT}`;
    const tl = wrap(ctx, data.title, innerW).slice(0, 4);
    const tlh = 80 * s * 1.14;
    if (!dry) { ctx.fillStyle = st.text; tl.forEach((l, i) => ctx.fillText(l, pad, y + i * tlh)); }
    y += tl.length * tlh + 30 * s;
    // 3) Sorotan angka
    if (data.highlight) {
      const hh = (data.highlight_label ? 54 : 0) * s + 120 * s + 44 * s;
      if (!dry) {
        const hg = ctx.createLinearGradient(pad, y, pad + innerW, y + hh);
        hg.addColorStop(0, st.accent); hg.addColorStop(1, st.accent2);
        ctx.globalAlpha = 0.16; ctx.fillStyle = hg; rr(ctx, pad, y, innerW, hh, 28 * s); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = st.accent; ctx.lineWidth = 3 * s; rr(ctx, pad, y, innerW, hh, 28 * s); ctx.stroke();
        let hy = y + 22 * s;
        if (data.highlight_label) {
          ctx.fillStyle = st.muted; ctx.font = `700 ${Math.round(32 * s)}px ${FONT}`;
          ctx.fillText(data.highlight_label, pad + 32 * s, hy, innerW - 64 * s); hy += 54 * s;
        }
        ctx.fillStyle = st.accent; ctx.font = `800 ${Math.round(112 * s)}px ${FONT}`;
        ctx.fillText(data.highlight, pad + 32 * s, hy - 6 * s, innerW - 64 * s);
      }
      y += hh + 30 * s;
    }
    // 4) Poin
    const fs = 38 * s, lh = fs * 1.32, ep = 30 * s, emojiW = 70 * s;
    for (const p of data.points || []) {
      ctx.font = `600 ${Math.round(fs)}px ${FONT}`;
      const lines = wrap(ctx, p.text, innerW - emojiW - ep * 2);
      const ch = Math.max(lines.length * lh, 56 * s) + ep * 1.4;
      if (!dry) {
        ctx.fillStyle = st.card; rr(ctx, pad, y, innerW, ch, 24 * s); ctx.fill();
        ctx.font = `${Math.round(44 * s)}px ${FONT}`;
        ctx.fillStyle = st.text; // legap supaya emoji tidak pudar
        ctx.fillText(p.emoji || '•', pad + ep * 0.8, y + ep * 0.6, emojiW);
        ctx.fillStyle = st.text; ctx.font = `600 ${Math.round(fs)}px ${FONT}`;
        lines.forEach((l, i) => ctx.fillText(l, pad + ep + emojiW, y + ep * 0.7 + i * lh));
      }
      y += ch + 16 * s;
    }
    // 5) Nota
    if (data.note) {
      y += 10 * s;
      ctx.font = `600 ${Math.round(30 * s)}px ${FONT}`;
      const nl = wrap(ctx, `⚠️ ${data.note}`, innerW).slice(0, 3);
      if (!dry) { ctx.fillStyle = st.muted; nl.forEach((l, i) => ctx.fillText(l, pad, y + i * 30 * s * 1.3)); }
      y += nl.length * 30 * s * 1.3;
    }
    return y - top - offsetY;
  }

  const footerH = (o.showName ? 96 : 0) + (data.source ? 46 : 0);
  let s = 1;
  for (; s > 0.5; s -= 0.04) if (pass(s, true) <= avail - footerH - 20) break;
  const used = pass(s, true);
  const offset = Math.max(0, Math.min((avail - footerH - used) / 2, story ? 120 : 60));
  pass(s, false, offset);

  // Kaki: nama & sumber
  let fy = H - bottom - footerH + 10;
  ctx.textBaseline = 'top';
  if (data.source) {
    ctx.fillStyle = st.muted; ctx.font = `500 26px ${FONT}`;
    ctx.fillText(`Sumber: ${data.source}`, pad, fy, innerW);
    fy += 46;
  }
  if (o.showName) {
    ctx.fillStyle = st.accent; ctx.beginPath(); ctx.arc(pad + 34, fy + 40, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = st.bg[0]; ctx.font = `800 32px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText((o.name?.[0] || '?').toUpperCase(), pad + 34, fy + 23);
    ctx.textAlign = 'left';
    ctx.fillStyle = st.text; ctx.font = `800 32px ${FONT}`; ctx.fillText(o.name || '', pad + 84, fy + 8);
    ctx.fillStyle = st.muted; ctx.font = `500 26px ${FONT}`; ctx.fillText(`@${o.user || ''}  ·  Save & share 🔖`, pad + 84, fy + 46);
  }
}

/**
 * Pasang editor kad info dalam `root`.
 * ctx: { meta: {group, groupLabel, groupEmoji, subLabel, subEmoji}, name, user, onSave(data) }
 */
export function mountInfoEditor(root, data, ctx) {
  const opts = { size: '9:16', style: 'kategori', showName: true };
  root.classList.add('info-editor');
  root.innerHTML = `
    ${data.verified === false ? '<div class="banner warn-banner"><span>⚠️</span><div>Sebahagian fakta <b>tidak dapat disahkan</b>. Semak dengan sumber rasmi sebelum kongsi.</div></div>' : ''}
    <div class="ic-wrap"><canvas class="info-canvas"></canvas></div>
    <div class="chips ie-sizes">${Object.entries(INFO_SIZES).map(([k, v]) => `<button type="button" class="chip ${k === opts.size ? 'on' : ''}" data-size="${k}">${esc(v.label)}</button>`).join('')}</div>
    <div class="chips scroll-x ie-styles">${Object.entries(INFO_STYLES).map(([k, v]) => `<button type="button" class="chip ${k === opts.style ? 'on' : ''}" data-style="${k}">${esc(v.label)}</button>`).join('')}</div>
    <div class="tactions">
      <button type="button" class="btn primary ie-share">📤 Kongsi ke Story / Status</button>
      <button type="button" class="btn ie-dl">⬇️ Muat turun</button>
      <button type="button" class="btn ie-cap">📋 Salin kapsyen</button>
      ${ctx.onSave ? '<button type="button" class="btn ie-save wide">💾 Simpan ke Draf</button>' : ''}
    </div>
    <details class="ie-edit">
      <summary>✏️ Edit kandungan kad</summary>
      <div class="form">
        <label>Tajuk <input data-f="title" maxlength="70" /></label>
        <div class="row"><label>Label sorotan <input data-f="highlight_label" maxlength="34" placeholder="cth. Bayaran Fasa 4" /></label>
          <label>Sorotan <input data-f="highlight" maxlength="18" placeholder="cth. RM500" /></label></div>
        <div class="field-label">Poin</div>
        <div class="ie-points"></div>
        <button type="button" class="btn sm ie-add">＋ Tambah poin</button>
        <label>Nota / peringatan <input data-f="note" maxlength="90" /></label>
        <label>Sumber <input data-f="source" maxlength="80" /></label>
        <label class="check"><input type="checkbox" class="ie-name" checked /> Tunjuk nama & username</label>
        <label>Kapsyen <textarea data-f="caption" rows="4"></textarea></label>
      </div>
    </details>`;

  const canvas = $('.info-canvas', root);
  const render = () => drawInfo(canvas, data, { ...opts, ...ctx.meta, name: ctx.name, user: ctx.user });
  let t;
  const later = () => { clearTimeout(t); t = setTimeout(render, 150); };

  const fill = () => {
    $$('[data-f]', root).forEach((el) => { el.value = data[el.dataset.f] || ''; });
    $('.ie-points', root).innerHTML = data.points.map((p, i) => `
      <div class="ie-point" data-i="${i}"><input class="ie-emoji" value="${esc(p.emoji)}" maxlength="4" /><input class="ie-text" value="${esc(p.text)}" maxlength="100" /><button type="button" class="mini" data-del>✕</button></div>`).join('');
  };
  fill();
  render();

  root.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f) { data[f] = e.target.value; if (f !== 'caption') later(); return; }
    const row = e.target.closest('.ie-point');
    if (row) {
      const p = data.points[Number(row.dataset.i)];
      if (e.target.matches('.ie-emoji')) p.emoji = e.target.value;
      else p.text = e.target.value;
      later();
    }
  });
  root.addEventListener('change', (e) => { if (e.target.matches('.ie-name')) { opts.showName = e.target.checked; render(); } });
  root.addEventListener('click', async (e) => {
    const sz = e.target.closest('[data-size]');
    const sy = e.target.closest('[data-style]');
    if (sz || sy) {
      if (sz) opts.size = sz.dataset.size; else opts.style = sy.dataset.style;
      const sel = sz ? '.ie-sizes' : '.ie-styles';
      $$(`${sel} .chip`, root).forEach((c) => c.classList.toggle('on', c === (sz || sy)));
      return render();
    }
    if (e.target.closest('[data-del]')) {
      if (data.points.length <= 1) return toast('Perlu sekurang-kurangnya 1 poin', true);
      data.points.splice(Number(e.target.closest('.ie-point').dataset.i), 1); fill(); return render();
    }
    if (e.target.closest('.ie-add')) {
      if (data.points.length >= 6) return toast('Maksimum 6 poin', true);
      data.points.push({ emoji: '✅', text: 'Poin baharu' }); fill(); return render();
    }
    const fname = () => `kad-info-${(data.title || 'info').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${opts.size.replace(':', 'x')}.png`;
    const blob = () => new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (e.target.closest('.ie-dl')) { download(fname(), await blob()); haptic(); return toast('⬇️ Gambar dimuat turun'); }
    if (e.target.closest('.ie-cap')) return copyText(data.caption || data.title, '📋 Kapsyen disalin');
    if (e.target.closest('.ie-save')) { ctx.onSave(data); haptic(); return; }
    if (e.target.closest('.ie-share')) {
      const file = new File([await blob()], fname(), { type: 'image/png' });
      if (data.caption) { try { await navigator.clipboard.writeText(data.caption); } catch { /* abaikan */ } }
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: data.title }); if (data.caption) toast('📋 Kapsyen dah disalin — tampal bila perlu'); } catch { /* dibatalkan */ }
      } else {
        download(file.name, file);
        toast('Peranti tak sokong kongsi terus — gambar dimuat turun');
      }
    }
  });
  return { render };
}

/** Buka editor dalam lembaran (dari draf / kad post) */
export function openInfoSheet(data, ctx) {
  const panel = openSheet('🖼️ Kad Info', '<div class="ie-root"></div>', { wide: true });
  mountInfoEditor($('.ie-root', panel), data, { ...ctx, onSave: ctx.onSave ? (d) => { ctx.onSave(d); panel.close(); } : null });
  return panel;
}
