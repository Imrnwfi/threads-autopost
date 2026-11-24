// Jana gambar kad petikan daripada post (canvas) — muat turun atau kongsi terus.
import { $, $$, openSheet, toast, download } from './util.js';

const SIZES = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };
const STYLES = {
  tema: { label: '🎨 Ikut tema' },
  gelap: { label: '🌑 Gelap', bg: ['#0b0b0c', '#1b1b1f'], text: '#f5f5f6', muted: '#9b9ba3', accent: ['#ffffff', '#bdbdc4'] },
  cerah: { label: '☀️ Cerah', bg: ['#ffffff', '#f2f2f3'], text: '#101012', muted: '#6b6b73', accent: ['#101012', '#3f3f46'] },
  sunset: { label: '🌅 Sunset', bg: ['#ff5f6d', '#ffc371'], text: '#ffffff', muted: 'rgba(255,255,255,.8)', accent: ['#ffffff', '#ffe7c2'] },
  ungu: { label: '🔮 Ungu', bg: ['#3a1c71', '#d76d77'], text: '#ffffff', muted: 'rgba(255,255,255,.75)', accent: ['#ffd27a', '#ffffff'] },
  kertas: { label: '📜 Kertas', bg: ['#f6efe3', '#efe4d0'], text: '#2b2118', muted: '#7a6a58', accent: ['#c2410c', '#ea580c'] },
  hijau: { label: '🌿 Hijau', bg: ['#0f3d3e', '#1f7a6a'], text: '#f2fff9', muted: 'rgba(242,255,249,.75)', accent: ['#c6ff3d', '#3dffd6'] },
};

function themeStyle() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(k).trim();
  return { bg: [v('--bg'), v('--panel-2')], text: v('--text'), muted: v('--muted'), accent: [v('--accent'), v('--accent-2')] };
}

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

async function draw(canvas, { text, name, user, size, style, showName }) {
  const [W, H] = SIZES[size];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const s = style === 'tema' ? themeStyle() : STYLES[style];
  const font = '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
  try { await document.fonts.load(`700 48px ${font}`); } catch { /* fon sistem */ }

  // Latar
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Hiasan bulatan lembut
  ctx.globalAlpha = 0.12;
  const ag = ctx.createLinearGradient(W * 0.6, 0, W, H * 0.4);
  ag.addColorStop(0, s.accent[0]); ag.addColorStop(1, s.accent[1]);
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(W * 0.92, H * 0.08, W * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.05, H * 0.97, W * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  const pad = 96;
  const footerH = showName ? 150 : 40;
  const boxW = W - pad * 2;
  const boxTop = pad + 90;
  const boxH = H - boxTop - footerH - pad;

  // Petikan besar
  ctx.fillStyle = s.accent[0];
  ctx.font = `800 160px Georgia, serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('“', pad - 10, pad - 30);

  // Saiz fon automatik
  let fs = 76, lines = [];
  for (; fs >= 30; fs -= 2) {
    ctx.font = `700 ${fs}px ${font}`;
    lines = wrap(ctx, text, boxW);
    if (lines.length * fs * 1.38 <= boxH) break;
  }
  const lh = fs * 1.38;
  const totalH = lines.length * lh;
  let y = boxTop + Math.max(0, (boxH - totalH) / 2);
  ctx.fillStyle = s.text;
  ctx.font = `700 ${fs}px ${font}`;
  for (const line of lines) {
    if (y + lh > boxTop + boxH + lh * 0.3) { ctx.fillText('…', pad, y); break; }
    ctx.fillText(line, pad, y);
    y += lh;
  }

  if (showName) {
    const fy = H - pad - 80;
    const ig = ctx.createLinearGradient(pad, fy, pad + 80, fy + 80);
    ig.addColorStop(0, s.accent[0]); ig.addColorStop(1, s.accent[1]);
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(pad + 40, fy + 40, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.bg[0];
    ctx.font = `800 38px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText((name[0] || '?').toUpperCase(), pad + 40, fy + 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = s.text;
    ctx.font = `800 36px ${font}`;
    ctx.fillText(name, pad + 104, fy + 4);
    ctx.fillStyle = s.muted;
    ctx.font = `500 30px ${font}`;
    ctx.fillText(`@${user}`, pad + 104, fy + 46);
  }
}

/**
 * Buka lembaran pencipta kad gambar.
 * @param {object} o { parts: string[], name, user }
 */
export function openImageCard({ parts, name, user }) {
  const opts = { size: '4:5', style: 'tema', showName: true, part: 0 };
  const cleaned = (t) => t.replace(/\s*\(\d+\/\d+\)\s*$/, '').replace(/\n*#affiliate\s*$/i, '').trim();
  let text = cleaned(parts[0] || '');

  const panel = openSheet('🖼️ Kad gambar', `
    <div class="ic-wrap"><canvas class="ic-canvas"></canvas></div>
    ${parts.length > 1 ? `<div class="field-label">Bahagian</div><div class="chips ic-parts">${parts.map((_, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-part="${i}">${i + 1}</button>`).join('')}</div>` : ''}
    <label>Teks pada gambar <textarea class="ic-text" rows="4"></textarea></label>
    <div class="field-label">Gaya</div>
    <div class="chips ic-styles">${Object.entries(STYLES).map(([k, v]) => `<button class="chip ${k === 'tema' ? 'on' : ''}" data-style="${k}">${v.label}</button>`).join('')}</div>
    <div class="field-label">Saiz</div>
    <div class="chips ic-sizes">${Object.keys(SIZES).map((k) => `<button class="chip ${k === '4:5' ? 'on' : ''}" data-size="${k}">${k}${k === '4:5' ? ' (Threads)' : k === '9:16' ? ' (Story)' : ''}</button>`).join('')}</div>
    <label class="check"><input type="checkbox" class="ic-name" checked /> Tunjuk nama & username</label>
    <div class="tactions">
      <button class="btn primary ic-share">📤 Kongsi gambar</button>
      <button class="btn ic-dl wide">⬇️ Muat turun PNG</button>
    </div>`, { wide: true });

  const canvas = $('.ic-canvas', panel);
  const ta = $('.ic-text', panel);
  ta.value = text;
  const render = () => draw(canvas, { text, name, user, size: opts.size, style: opts.style, showName: opts.showName });
  render();

  let t;
  ta.addEventListener('input', () => { text = ta.value; clearTimeout(t); t = setTimeout(render, 150); });
  panel.addEventListener('click', (e) => {
    const p = e.target.closest('[data-part]');
    if (p) { opts.part = +p.dataset.part; text = cleaned(parts[opts.part]); ta.value = text; }
    const st = e.target.closest('[data-style]');
    if (st) opts.style = st.dataset.style;
    const sz = e.target.closest('[data-size]');
    if (sz) opts.size = sz.dataset.size;
    for (const [attr, sel] of [['data-part', '.ic-parts'], ['data-style', '.ic-styles'], ['data-size', '.ic-sizes']]) {
      const hit = e.target.closest(`[${attr}]`);
      if (hit) $$(`${sel} .chip`, panel).forEach((c) => c.classList.toggle('on', c === hit));
    }
    if (p || st || sz) render();
  });
  $('.ic-name', panel).addEventListener('change', (e) => { opts.showName = e.target.checked; render(); });

  const toBlob = () => new Promise((r) => canvas.toBlob(r, 'image/png'));
  const fname = () => `threads-kad-${Date.now()}.png`;
  $('.ic-dl', panel).addEventListener('click', async () => { download(fname(), await toBlob()); toast('⬇️ Gambar dimuat turun'); });
  $('.ic-share', panel).addEventListener('click', async () => {
    const file = new File([await toBlob()], fname(), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: parts.join('\n\n') }); } catch { /* dibatalkan */ }
    } else {
      download(file.name, file);
      toast('Peranti tak sokong kongsi terus — gambar dimuat turun');
    }
  });
}

