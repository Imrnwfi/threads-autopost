// Utiliti UI kongsi
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const TZ = 'Asia/Kuala_Lumpur';
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const nowIso = () => new Date().toISOString();

// Pilihan paparan (tidak di-sync)
export const prefs = (() => { try { return { haptic: true, anim: true, ...JSON.parse(localStorage.getItem('tpg_prefs') || '{}') }; } catch { return { haptic: true, anim: true }; } })();
export function setPref(k, v) { prefs[k] = v; localStorage.setItem('tpg_prefs', JSON.stringify(prefs)); }
const reduceMotion = () => !prefs.anim || matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(ms = 12) { if (prefs.haptic) navigator.vibrate?.(ms); }

let toastTimer;
/** toast(mesej, ralat?, { action: { label, fn }, ms }) */
export function toast(msg, bad = false, { action, ms } = {}) {
  const t = $('#toast');
  t.className = `toast${bad ? ' bad' : ''}`;
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}`;
  if (action) $('.toast-act', t).onclick = () => { t.classList.add('hidden'); action.fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || (action ? 6000 : 3200));
}

/** Confetti ringan tanpa pustaka */
export function confetti() {
  if (reduceMotion()) return;
  const cs = getComputedStyle(document.documentElement);
  const colors = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2'), '#ffcc00', '#ff5a36', '#34d399', '#60a5fa'].map((c) => c.trim());
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    p.style.setProperty('--r', `${Math.random() * 900 - 450}deg`);
    p.style.animationDelay = `${Math.random() * 0.25}s`;
    p.style.animationDuration = `${1.2 + Math.random() * 0.9}s`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

/** Animasi "menaip" untuk senarai textarea */
export async function typewriter(textareas, onTick) {
  if (reduceMotion()) return;
  const targets = textareas.map((ta) => ({ ta, full: ta.value }));
  targets.forEach(({ ta }) => { ta.value = ''; ta.readOnly = true; ta.classList.add('typing'); });
  const total = targets.reduce((n, t) => n + [...t.full].length, 0);
  const step = Math.max(2, Math.ceil(total / 70)); // ~70 bingkai
  for (const t of targets) {
    const chars = [...t.full];
    for (let i = 0; i < chars.length; i += step) {
      t.ta.value = chars.slice(0, i + step).join('');
      onTick?.(t.ta);
      await new Promise((r) => requestAnimationFrame(r));
    }
    t.ta.value = t.full; onTick?.(t.ta);
  }
  targets.forEach(({ ta }) => { ta.readOnly = false; ta.classList.remove('typing'); });
}

let onNoKey = () => {};
export function setNoKeyHandler(fn) { onNoKey = fn; }

export async function busy(btn, fn, label = 'Tunggu…') {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin">⏳</span> ${label}`;
  try { return await fn(); } catch (e) {
    console.error(e);
    toast(e.message, true);
    if (e.code === 'NO_KEY') onNoKey();
  } finally { btn.disabled = false; btn.innerHTML = old; }
}

export async function copyText(text, msg = '📋 Disalin!') {
  haptic();
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(msg);
}

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('ms-MY', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ms-MY', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '');
export function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}
/** Bahagian tarikh/masa waktu Malaysia */
export function myParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(date);
  const g = (t) => f.find((p) => p.type === t)?.value;
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) % 24, minute: Number(g('minute')), wd: wdMap[g('weekday')] };
}
export function autosize(ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; }

/** Lembaran bawah generik. Pulangkan elemen panel; tutup dengan .close() */
export function openSheet(title, html, { onMount, wide } = {}) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="sheet-panel${wide ? ' wide' : ''}">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><h3>${title}</h3><button class="icon-btn sm" data-close aria-label="Tutup">✕</button></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(sheet);
  document.body.classList.add('no-scroll');
  const panel = $('.sheet-panel', sheet);
  panel.close = () => { sheet.remove(); if (!$('.sheet')) document.body.classList.remove('no-scroll'); };
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) panel.close(); });
  onMount?.(panel);
  return panel;
}

export function download(filename, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
