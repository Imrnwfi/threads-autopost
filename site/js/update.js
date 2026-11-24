// Kemas kini app: semak versi baharu, tunjuk butang "Kemas kini", dan kemas kini automatik dengan selamat.
import { APP_VERSION, isDev } from './version.js';
import { $, toast, prefs, setPref, fmtTime, esc } from './util.js';

const CHECK_EVERY = 30 * 60 * 1000; // 30 minit
let reg = null;
let waiting = null;        // service worker baharu yang menunggu
let remote = null;         // { version, built_at, notes } dari version.json
let reloading = false;
let lastCheck = null;
const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
const hasUnsavedWork = () => !!document.querySelector('#genResults .act-save') || !!document.querySelector('.sheet');

export const currentVersion = () => (isDev ? 'dev' : APP_VERSION);
export const updateAvailable = () => !!waiting || (!!remote && !isDev && remote.version !== APP_VERSION);

async function fetchRemote() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) remote = await res.json();
  } catch { /* luar talian */ }
  lastCheck = new Date().toISOString();
  return remote;
}

function applyUpdate() {
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange akan muat semula; sandaran jika tidak berlaku
    setTimeout(() => { if (!reloading) location.reload(); }, 3000);
  } else {
    location.reload();
  }
}

function showBar() {
  const bar = $('#updateBar');
  const notes = remote?.notes ? `<small>${esc(remote.notes)}</small>` : '';
  bar.innerHTML = `
    <div class="ub-text"><b>✨ Versi baharu tersedia${remote?.version ? ` (${esc(remote.version)})` : ''}</b>${notes}</div>
    <button class="btn sm primary" data-update-now>Kemas kini</button>
    <button class="icon-btn sm" data-update-later aria-label="Nanti">✕</button>`;
  bar.classList.remove('hidden');
  document.body.classList.add('has-update');
  renderSettingsBox();
}

async function onUpdateFound() {
  await fetchRemote();
  // Kemas kini automatik: terus guna jika app baru dibuka (tiada kerja sedang dibuat)
  if (prefs.autoUpdate !== false && performance.now() < 8000 && !hasUnsavedWork()) return applyUpdate();
  showBar();
}

export async function checkForUpdate({ manual = false } = {}) {
  try { await reg?.update(); } catch { /* luar talian */ }
  await fetchRemote();
  if (!reg && remote && !isDev && remote.version !== APP_VERSION) showBar(); // tanpa service worker
  if (manual) {
    if (updateAvailable()) { showBar(); toast('✨ Kemas kini tersedia'); }
    else if (!remote) toast('Tak dapat semak — periksa sambungan internet', true);
    else toast(`✅ Anda guna versi terkini (${currentVersion()})`);
  }
  renderSettingsBox();
}

export function renderSettingsBox() {
  const box = $('#updateBox');
  if (!box) return;
  const avail = updateAvailable();
  box.innerHTML = `
    <div class="ver-row"><span>Versi semasa</span><b>${esc(currentVersion())}</b></div>
    ${remote ? `<div class="ver-row"><span>Versi terkini</span><b>${esc(remote.version)}${remote.built_at ? ` <small>· ${esc(fmtTime(remote.built_at))}</small>` : ''}</b></div>` : ''}
    ${avail && remote?.notes ? `<p class="muted small">Apa yang baru: ${esc(remote.notes)}</p>` : ''}
    <label class="check"><input type="checkbox" id="autoUpdate" ${prefs.autoUpdate !== false ? 'checked' : ''} /> Kemas kini automatik (bila app dibuka semula / ditutup)</label>
    <div class="row wrap">
      ${avail ? '<button class="btn primary" data-update-now>✨ Kemas kini sekarang</button>' : ''}
      <button class="btn" data-update-check>🔄 Semak kemas kini</button>
    </div>
    <p class="muted small">${lastCheck ? `Disemak ${esc(fmtTime(lastCheck))}` : ''}</p>`;
}

export function initUpdates() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-update-now]')) { e.target.closest('button').disabled = true; applyUpdate(); }
    if (e.target.closest('[data-update-later]')) { $('#updateBar').classList.add('hidden'); document.body.classList.remove('has-update'); }
    if (e.target.closest('[data-update-check]')) checkForUpdate({ manual: true });
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'autoUpdate') setPref('autoUpdate', e.target.checked);
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => {
      reg = r;
      if (r.waiting && navigator.serviceWorker.controller) { waiting = r.waiting; onUpdateFound(); }
      r.addEventListener('updatefound', () => {
        const nw = r.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) { waiting = nw; onUpdateFound(); }
        });
      });
    }).catch(() => {});
  }

  // Semak berkala & bila app dibuka semula
  setTimeout(() => checkForUpdate(), 4000);
  setInterval(() => checkForUpdate(), CHECK_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
    // Kemas kini automatik bila app disembunyikan (pengguna tidak sedang menggunakannya)
    else if (waiting && prefs.autoUpdate !== false && !hasUnsavedWork()) waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}
