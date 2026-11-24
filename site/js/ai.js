// Modul AI: jana post / bebenang / affiliate (satu & banyak produk) / siri,
// skor hook, tukar nada & bahasa, analisis gaya tulisan, cari maklumat produk.
// Semua panggilan dibuat terus dari browser menggunakan API key pengguna.

export const MAX_CHARS = 500;
export const DEFAULT_MODELS = { gemini: 'gemini-3.6-flash', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' };
export const LINK_TOKEN = '{LINK}';
export const MAX_MULTI = 6;

export const TONES = {
  santai: { label: 'Santai', desc: 'santai dan mesra macam borak dengan kawan' },
  informatif: { label: 'Informatif', desc: 'padat dengan info berguna, ringkas dan terus ke point' },
  lucu: { label: 'Lucu', desc: 'kelakar dan bersahaja, tapi info tetap tepat' },
  formal: { label: 'Formal', desc: 'profesional dan jelas' },
  hype: { label: 'Teruja', desc: 'penuh semangat dan teruja, tapi tidak berlebihan sampai nampak spam' },
};

export const LANGS = {
  ms: { label: '🇲🇾 Melayu', desc: 'Bahasa Melayu harian Malaysia yang santai dan mudah faham. Elak ayat bahasa Inggeris; hanya istilah biasa (nama app, produk, cashback) boleh dikekalkan' },
  baku: { label: '📘 BM baku', desc: 'Bahasa Melayu baku/standard yang betul tatabahasanya' },
  utara: { label: '🌾 Utara', desc: 'loghat Utara (Kedah/Penang/Perlis), cth. "hang", "pi", "awat", "cek", "habaq"' },
  kelantan: { label: '🪁 Kelantan', desc: 'loghat Kelantan, cth. "demo", "gapo", "kito", "sokmo", "molek"' },
  sabah: { label: '🏔️ Sabah', desc: 'bahasa/loghat Sabah, cth. "bah", "kunun", "sia", "ko", "palui"' },
  sarawak: { label: '🌴 Sarawak', desc: 'bahasa Sarawak, cth. "kamek", "kitak", "sik", "kenak", "nyaman"' },
};

export const QUICK_TRANSFORMS = {
  pendek: { label: '✂️ Pendek', ins: 'Pendekkan setiap bahagian kira-kira 40%, kekalkan isi penting dan hook.' },
  lucu: { label: '😂 Lucu', ins: 'Jadikan lebih kelakar dan bersahaja, tapi fakta kekal sama.' },
  yakin: { label: '💪 Yakin', ins: 'Jadikan nada lebih yakin, tegas dan berautoriti. Buang ayat ragu-ragu.' },
  emoji: { label: '✨ +Emoji', ins: 'Tambah emoji yang sesuai secara sederhana untuk menarik perhatian (jangan berlebihan).' },
  kurangEmoji: { label: '🧹 −Emoji', ins: 'Buang kebanyakan emoji, jadikan lebih bersih dan kemas.' },
  hook: { label: '🪝 Hook kuat', ins: 'Tulis semula ayat pertama supaya hook jauh lebih kuat dan buat orang berhenti scroll. Bahagian lain kekal.' },
  cta: { label: '📣 CTA', ins: 'Kuatkan ajakan bertindak (CTA) di bahagian terakhir — ajak komen, follow atau semak link.' },
};

export const AFF_STYLES = {
  wajib: { label: '⭐ Wajib ada', desc: 'barang "wajib ada" — terangkan kenapa produk ini berbaloi dimiliki' },
  bajet: { label: '💸 Bawah bajet', desc: 'fokus pada nilai untuk harga — murah tapi berbaloi' },
  masalah: { label: '🧩 Masalah → solusi', desc: 'mula dengan masalah harian yang relatable, kemudian produk sebagai penyelesaian' },
  pov: { label: '🎬 POV / cerita', desc: 'format "POV:" atau cerita situasi harian yang relatable' },
  senarai: { label: '📋 Senarai sebab', desc: 'senarai ringkas sebab/kelebihan bernombor' },
  pendapat: { label: '💬 Pendapat jujur', desc: 'pendapat jujur dan seimbang — kelebihan dan perkara yang perlu dipertimbang' },
  promo: { label: '⚡ Promo', desc: 'nada promosi segera (gunakan maklumat diskaun HANYA jika diberi)' },
};

const CAT_LABELS = {
  pelaburan: 'Kewangan › Pelaburan', tipslabur: 'Kewangan › Tips Labur', applabur: 'Kewangan › App Pelaburan',
  simpan: 'Kewangan › Tips Simpan & Jimat', bank: 'Kewangan › Bank', duitonline: 'Kewangan › Duit Tambahan',
  tunai: 'Bantuan Kerajaan › Bantuan Tunai', subsidi: 'Bantuan Kerajaan › Subsidi', pendidikan: 'Bantuan Kerajaan › Pendidikan & Belia',
  program: 'Bantuan Kerajaan › Belanjawan & Program', promo: 'E-Wallet › Promo & Cashback', percuma: 'E-Wallet › Duit & Topup Percuma',
  tipsewallet: 'E-Wallet › Tips & Berita', scam: 'E-Wallet › Amaran Penipuan',
};
export const catLabel = (k) => CAT_LABELS[k] || k || 'umum';

// ---------- Utiliti ----------
export const len = (s = '') => [...s].length;

export function extractJson(raw) {
  const s = String(raw);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Jawapan AI tidak dalam format dijangka. Cuba lagi.');
  return JSON.parse(s.slice(start, end + 1));
}

export function clip(text) {
  const t = String(text).trim();
  return len(t) > MAX_CHARS ? [...t].slice(0, MAX_CHARS - 1).join('').replace(/\s+\S*$/, '') + '…' : t;
}

/** Teka nama produk daripada URL Shopee panjang: shopee.com.my/Nama-Produk-i.123.456 */
export function nameFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean)[0] || '');
    const m = seg.match(/^(.*)-i\.\d+\.\d+$/);
    const raw = m ? m[1] : (/shopee/.test(u.hostname) && seg.length > 15 ? seg : '');
    return raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  } catch { return ''; }
}

/** Ambil URL pertama dalam teks (untuk "Kongsi ke app" dari Shopee). */
export function firstUrl(text = '') {
  const m = String(text).match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, '') : '';
}

// ---------- Carian web (grounding) ----------
// API key Gemini percuma tiada kuota carian Google → bila ditolak (429), app ingat selama 12 jam
const WEB_KEY = 'tpg_webLimited';
export function webLimited() {
  try { return Date.now() - Number(localStorage.getItem(WEB_KEY) || 0) < 12 * 3600000; } catch { return false; }
}
export function markWebLimited(on = true) {
  try { if (on) localStorage.setItem(WEB_KEY, String(Date.now())); else localStorage.removeItem(WEB_KEY); } catch { /* abaikan */ }
}

// ---------- Penyedia AI ----------
async function readError(res, label) {
  const body = await res.json().catch(() => ({}));
  const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
  const err = new Error(
    res.status === 401 || res.status === 403 ? `${label}: API key tidak sah atau tiada akses (${msg})`
      : res.status === 429 ? `${label}: had penggunaan dicapai, cuba sebentar lagi`
        : `${label}: ${msg}`
  );
  err.status = res.status;
  return err;
}

/**
 * @param {object} settings { provider, apiKey, model, baseUrl }
 * @param {object} opts { json, web (benarkan carian/baca web), maxTokens, temperature }
 */
export async function callAI(settings, system, user, { json = true, web = false, maxTokens = 8192, temperature } = {}) {
  const { provider, apiKey } = settings;
  if (!apiKey) throw Object.assign(new Error('Masukkan API key AI di Tetapan dulu.'), { code: 'NO_KEY' });
  const model = settings.model || DEFAULT_MODELS[provider];
  const temp = temperature ?? (web ? 0.3 : 0.9);

  if (provider === 'gemini') {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
    };
    if (web) body.tools = [{ url_context: {} }, { google_search: {} }];
    else if (json) body.generationConfig.responseMimeType = 'application/json';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await readError(res, 'Gemini');
    const data = await res.json();
    const cand = data.candidates?.[0];
    if (!cand) throw new Error(`Gemini: tiada jawapan (${data.promptFeedback?.blockReason || 'tidak diketahui'})`);
    return (cand.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  }

  if (provider === 'anthropic') {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
    if (web) {
      headers['anthropic-beta'] = 'web-fetch-2025-09-10';
      body.tools = [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3 },
      ];
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw await readError(res, 'Claude');
    const data = await res.json();
    return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }

  // API serasi OpenAI (tiada carian web)
  const base = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const body = { model, temperature: temp, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (json) body.response_format = { type: 'json_object' };
  const post = () => fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  let res = await post();
  if (res.status === 400 && body.response_format) { delete body.response_format; res = await post(); }
  if (!res.ok) throw await readError(res, 'AI');
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------- Prompt asas ----------
function baseRules({ persona, styleGuide, lang } = {}) {
  return `Kau penulis kandungan Threads yang mahir untuk audiens Malaysia.
Peraturan WAJIB:
- Setiap bahagian/post MESTI kurang daripada ${MAX_CHARS - 30} aksara (termasuk emoji & hashtag).
- Ayat pertama ialah "hook" kuat yang buat orang berhenti scroll.
- Guna perenggan pendek / baris baru supaya senang baca di telefon.
- Maksimum 1-2 hashtag relevan untuk keseluruhan, atau tiada langsung.
- JANGAN reka fakta, angka, harga, tarikh, spesifikasi, diskaun atau syarat. Guna HANYA maklumat yang diberi. Jika tak pasti, tulis secara umum atau ajak pembaca semak sendiri.
- Jangan letak sebarang URL dalam teks post.
- Bahasa: ${LANGS[lang]?.desc || LANGS.ms.desc}.
${persona ? `- Persona/gaya akaun: ${persona}` : ''}
${styleGuide ? `- TIRU GAYA PENULIS INI dengan rapat (ini analisis gaya tulisan sebenar penulis):\n${styleGuide}` : ''}`;
}

function formatRules({ format, parts, numbering }) {
  if (format !== 'thread') return 'FORMAT: satu post sahaja (parts mengandungi 1 item).';
  return `FORMAT: BEBENANG (thread) dengan TEPAT ${parts} bahagian yang bersambung.
- Bahagian 1: hook paling kuat + bayangan apa yang akan dikongsi (cth. "Thread 🧵👇").
- Bahagian tengah: setiap satu bawa SATU idea, mengalir lancar dari bahagian sebelumnya.
- Bahagian terakhir: rumusan + ajakan (soalan / follow / CTA).
${numbering ? `- Akhiri setiap bahagian dengan penomboran seperti "(1/${parts})".` : '- Jangan letak penomboran.'}`;
}

const OUTPUT_SPEC = (count, withTopic) => `Tulis ${count} variasi yang BERBEZA gaya hook.
Pulangkan HANYA JSON tanpa teks lain:
{${withTopic ? '"topic":"subtopik yang dipilih",' : ''}"variants":[{"parts":["bahagian 1", "..."],"comment":"teks komen pertama atau string kosong"}]}`;

/**
 * Jana variasi post / bebenang.
 * opts: { mode:'topic'|'affiliate', format:'single'|'thread', parts, count, tone, lang, extra, numbering, hook,
 *         topic, snippet, source, category,
 *         product:{ link, name, price, highlights, audience },  // satu produk
 *         products:[...],                                     // banyak produk
 *         style, used, disclosure, persona, styleGuide,
 *         series:{ name, emoji, desc, no, history:[] } }
 * @returns {Promise<{topic?:string, variants:Array<{parts:string[], comment:string}>}>}
 */
export async function generate(settings, opts) {
  const multi = opts.mode === 'affiliate' && Array.isArray(opts.products) && opts.products.length > 1;
  const format = multi ? 'thread' : opts.format;
  const parts = multi
    ? Math.min(opts.products.length + 2, 8)
    : format === 'thread' ? Math.min(Math.max(opts.parts || 4, 2), 8) : 1;
  const count = Math.min(Math.max(opts.count || 3, 1), format === 'thread' ? 3 : 5);
  const tone = TONES[opts.tone]?.desc || opts.tone || TONES.santai.desc;

  let system = baseRules(opts);
  let user = '';
  const withTopic = !!opts.series && !opts.topic?.trim();

  if (opts.mode === 'affiliate') {
    const usedRule = opts.used
      ? '- Penulis PERNAH guna produk ini; boleh tulis dari sudut pengalaman sendiri, tapi jangan reka butiran spesifik yang tidak diberi.'
      : '- Penulis BELUM tentu pernah guna produk ini. JANGAN dakwa "aku dah guna", "dah pakai 3 bulan" atau testimoni palsu. Fokus pada ciri, kegunaan dan sebab ia menarik.';
    if (multi) {
      const list = opts.products.slice(0, MAX_MULTI);
      if (list.some((p) => !p.name)) throw new Error('Setiap produk perlu ada nama.');
      system += `
Ini kandungan AFFILIATE: SENARAI ${list.length} produk dalam satu bebenang.
- Bahagian 1: hook + tema senarai (cth. "${list.length} barang dapur bawah RM30 yang berbaloi 🧵👇").
- Bahagian 2 hingga ${list.length + 1}: SATU produk setiap bahagian, ikut susunan diberi, mula dengan nombor emoji (1️⃣, 2️⃣…) + nama ringkas + kenapa best.
- Bahagian terakhir: rumusan + "Link semua produk aku letak kat komen 👇".
- "comment": string kosong (app akan sediakan senarai link).
${usedRule}
${opts.disclosure ? '- Letak hashtag #affiliate di hujung bahagian terakhir.' : ''}`;
      user = `Produk:\n${list.map((p, i) => `${i + 1}. ${p.name}${p.price ? ` — ${p.price}` : ''}${p.highlights ? ` — ${p.highlights}` : ''}${p.audience ? ` — sesuai: ${p.audience}` : ''}`).join('\n')}
${opts.topic ? `Tema senarai: ${opts.topic}` : ''}
Gaya: ${AFF_STYLES[opts.style]?.desc || AFF_STYLES.senarai.desc}
Nada: ${tone}`;
    } else {
      const p = opts.product || {};
      if (!p.link) throw new Error('Masukkan link produk.');
      if (!p.name) throw new Error('Nama produk diperlukan. Tekan "Isi automatik" atau taip sendiri.');
      system += `
Ini kandungan AFFILIATE untuk produk Shopee.
- Link produk akan diletak dalam KOMEN PERTAMA, bukan dalam post. Bahagian terakhir mesti ajak pembaca semak link di komen (cth. "Link aku letak kat komen 👇").
- "comment": 1-2 baris ringkas untuk komen pertama yang mengandungi token ${LINK_TOKEN} tepat sekali (app akan gantikan dengan link sebenar). Contoh: "🛒 Link produk: ${LINK_TOKEN}".
${usedRule}
${opts.disclosure ? '- Letak hashtag #affiliate di hujung bahagian terakhir (dikira dalam had hashtag).' : ''}`;
      user = `Produk: ${p.name}
${p.price ? `Harga: ${p.price}` : 'Harga: (tidak diberi — jangan sebut harga spesifik)'}
${p.highlights ? `Kelebihan / ciri: ${p.highlights}` : ''}
${p.audience ? `Sesuai untuk: ${p.audience}` : ''}
Gaya: ${AFF_STYLES[opts.style]?.desc || AFF_STYLES.wajib.desc}
Nada: ${tone}`;
    }
  } else {
    if (!opts.topic?.trim() && !opts.series) throw new Error('Topik diperlukan.');
    system += `
- Untuk bantuan kerajaan/kewangan: ajak semak di laman rasmi dan jangan beri nasihat pelaburan.
- "comment": string kosong melainkan ada sebab kukuh untuk komen pertama.`;
    user = `Kategori: ${catLabel(opts.category)}
${opts.topic ? `Topik: ${opts.topic}` : ''}
${opts.snippet ? `Ringkasan sumber: ${opts.snippet}` : ''}
${opts.source ? `Sumber: ${opts.source}` : ''}
Nada: ${tone}`;
  }

  if (opts.series) {
    const s = opts.series;
    system += `
Ini EPISOD #${s.no} dalam siri kandungan "${s.name}"${s.desc ? ` (${s.desc})` : ''}.
- Bahagian 1 MESTI bermula dengan "${s.emoji || '📌'} ${s.name} #${s.no}".
${withTopic ? '- Pilih SATU subtopik baharu yang sesuai dengan siri ini dan BERBEZA daripada episod sebelum. Masukkan subtopik dalam medan "topic".' : ''}
${s.history?.length ? `- Episod sebelum (jangan ulang): ${s.history.slice(-15).join('; ')}` : ''}`;
  }
  if (opts.hook) system += `\n- Gunakan struktur hook ini untuk ayat pertama (sesuaikan dengan topik): "${opts.hook}"`;

  system += `\n${formatRules({ format, parts, numbering: opts.numbering })}\n${OUTPUT_SPEC(count, withTopic)}`;
  if (opts.extra) user += `\nArahan tambahan: ${opts.extra}`;

  const data = extractJson(await callAI(settings, system, user, { json: true }));
  const variants = (data.variants || [])
    .map((v) => ({
      parts: (Array.isArray(v.parts) ? v.parts : [v.parts]).map(clip).filter(Boolean),
      comment: String(v.comment || '').trim(),
    }))
    .filter((v) => v.parts.length);
  if (!variants.length) throw new Error('AI tidak memulangkan post. Cuba lagi.');

  if (opts.mode === 'affiliate') {
    for (const v of variants) {
      if (multi) {
        v.comment = `🛒 Link produk:\n${opts.products.slice(0, MAX_MULTI).map((p, i) => `${i + 1}. ${p.name.slice(0, 50)}: ${p.link}`).join('\n')}`;
      } else {
        if (!v.comment.includes(LINK_TOKEN)) v.comment = `🛒 Link produk: ${LINK_TOKEN}`;
        v.comment = v.comment.replaceAll(LINK_TOKEN, opts.product.link);
      }
      if (opts.disclosure && !/#affiliate/i.test(v.parts.join(' '))) {
        const last = v.parts.length - 1;
        if (len(v.parts[last]) + 12 <= MAX_CHARS) v.parts[last] += '\n\n#affiliate';
        else v.comment += '\n#affiliate';
      }
    }
  }
  return { topic: data.topic ? String(data.topic).slice(0, 200) : undefined, variants };
}

/** Tulis semula satu bahagian sahaja dalam bebenang. */
export async function regeneratePart(settings, { parts, index, tone, persona, styleGuide, lang }) {
  const system = `${baseRules({ persona, styleGuide, lang })}
Kau akan tulis semula SATU bahagian dalam bebenang Threads supaya lebih menarik, sambil kekal sesuai dengan bahagian sebelum & selepasnya.
Kekalkan peranan bahagian itu (hook / isi / penutup), sebarang penomboran "(x/y)", hashtag #affiliate jika ada, dan maklumat fakta yang sama.
Pulangkan HANYA JSON: {"part":"teks baharu"}`;
  const user = `Bebenang penuh:
${parts.map((p, i) => `--- Bahagian ${i + 1}${i === index ? ' (TULIS SEMULA INI)' : ''} ---\n${p}`).join('\n')}

Nada: ${TONES[tone]?.desc || tone || TONES.santai.desc}`;
  const data = extractJson(await callAI(settings, system, user, { json: true, maxTokens: 2048 }));
  if (!data.part) throw new Error('AI tidak memulangkan teks.');
  return clip(data.part);
}

/** Ubah keseluruhan post/bebenang ikut arahan (nada, panjang, bahasa…). */
export async function transform(settings, { parts, comment, instruction, persona, styleGuide, lang }) {
  const system = `${baseRules({ persona, styleGuide, lang })}
Ubah post Threads di bawah mengikut arahan. Kekalkan bilangan bahagian (${parts.length}), penomboran "(x/y)" jika ada, hashtag #affiliate jika ada, dan SEMUA fakta/angka/harga yang sama. Jangan tambah fakta baharu.
Jika ada komen pertama yang mengandungi link, kekalkan link itu TEPAT seperti asal.
Pulangkan HANYA JSON: {"parts":["..."],"comment":"..."}`;
  const user = `Arahan: ${instruction}

${parts.map((p, i) => `--- Bahagian ${i + 1} ---\n${p}`).join('\n')}
${comment ? `--- Komen pertama ---\n${comment}` : ''}`;
  const data = extractJson(await callAI(settings, system, user, { json: true, temperature: 0.7 }));
  const out = (Array.isArray(data.parts) ? data.parts : []).map(clip).filter(Boolean);
  if (out.length !== parts.length) throw new Error('AI tukar bilangan bahagian. Cuba lagi.');
  // Pastikan link dalam komen tidak berubah
  let newComment = comment ? String(data.comment ?? comment) : '';
  const links = (comment || '').match(/https?:\/\/\S+/g) || [];
  if (links.some((l) => !newComment.includes(l))) newComment = comment;
  return { parts: out, comment: newComment };
}

/** Skor ayat pertama (hook) 1-10 dengan tips. */
export async function scoreHook(settings, { text, mode }) {
  const system = `Kau pakar copywriting Threads untuk audiens Malaysia. Nilai "hook" (ayat/baris pertama) post di bawah.
Kriteria: rasa ingin tahu, relevan dengan audiens Malaysia, kejelasan, emosi, kepadatan (ringkas), dan janji nilai.
Pulangkan HANYA JSON:
{"score": nombor 1-10, "verdict": "satu ayat ringkas", "good": ["apa yang bagus", "..."], "tips": ["cadangan penambahbaikan spesifik", "..."], "better": ["hook alternatif 1", "hook alternatif 2", "hook alternatif 3"]}
Hook alternatif mesti dalam bahasa & gaya yang sama, maksimum 120 aksara, dan TIDAK menambah fakta baharu.`;
  const user = `Jenis: ${mode === 'affiliate' ? 'post affiliate' : 'post biasa'}\n\nPost:\n${text}`;
  const d = extractJson(await callAI(settings, system, user, { json: true, maxTokens: 2048, temperature: 0.5 }));
  return {
    score: Math.min(Math.max(Math.round(Number(d.score) || 0), 1), 10),
    verdict: String(d.verdict || ''),
    good: (d.good || []).map(String).slice(0, 4),
    tips: (d.tips || []).map(String).slice(0, 4),
    better: (d.better || []).map(String).filter(Boolean).slice(0, 3),
  };
}

/** Analisis gaya tulisan daripada contoh post pengguna. */
export async function analyzeStyle(settings, samples) {
  const clean = String(samples).trim();
  if (len(clean) < 150) throw new Error('Tampal sekurang-kurangnya 3–5 post (lebih banyak lebih tepat).');
  const system = `Kau penganalisis gaya penulisan. Baca contoh post Threads seorang penulis dan hasilkan PANDUAN GAYA ringkas (8-12 poin) yang boleh digunakan oleh penulis lain untuk meniru gaya ini dengan tepat.
Sentuh: panjang ayat, struktur perenggan, cara buka (hook), cara tutup, kata ganti diri (aku/saya/korang/kita), slang & loghat, campuran bahasa, penggunaan emoji (jenis & kekerapan), tanda baca, huruf besar, hashtag, nada & personaliti, perkataan/frasa kegemaran.
Pulangkan HANYA JSON: {"guide":"- poin 1\\n- poin 2\\n..."}`;
  const d = extractJson(await callAI(settings, system, `Contoh post:\n${clean.slice(0, 8000)}`, { json: true, maxTokens: 2048, temperature: 0.3 }));
  if (!d.guide) throw new Error('AI tidak memulangkan panduan gaya.');
  return String(d.guide).slice(0, 2000);
}

/**
 * Cari maklumat produk daripada link (guna carian/baca web jika penyedia menyokong).
 * @returns {Promise<{name, price, highlights, audience, found:boolean, note}>}
 */
export async function researchProduct(settings, link, hint = '') {
  const guess = nameFromUrl(link) || hint;
  const system = `Kau pembantu penyelidik produk e-dagang Malaysia. Tugas: kenal pasti produk daripada link Shopee yang diberi.
Baca halaman link tersebut dan/atau cari di web (nama produk, harga semasa dalam RM, ciri utama).
JANGAN reka. Jika maklumat tidak dijumpai dengan yakin, biarkan medan itu kosong.
Pulangkan HANYA JSON:
{"found": true/false, "name": "nama produk ringkas (maks 80 aksara)", "price": "cth. RM39.90 atau kosong", "highlights": "3-5 ciri/kelebihan utama dipisah koma", "audience": "siapa sesuai guna (ringkas)"}`;
  const user = `Link: ${link}${guess ? `\nPetunjuk nama: ${guess}` : ''}`;

  let data = null;
  let note = '';
  try {
    const web = settings.provider !== 'openai' && !webLimited();
    if (!web) throw Object.assign(new Error('web off'), { skipWeb: true });
    data = extractJson(await callAI(settings, system, user, { json: false, web: true, maxTokens: 4096 }));
  } catch (e) {
    const toolProblem = /web|tool|search|fetch|url|ground/i.test(e.message);
    if (e.status === 429 && settings.provider === 'gemini') markWebLimited();
    else if (e.code === 'NO_KEY' || e.status === 401 || (e.status === 403 && !toolProblem)) throw e;
    note = e.skipWeb || e.status === 429
      ? 'Carian web tidak tersedia untuk API key ini — maklumat diteka daripada link sahaja.'
      : 'Carian web tidak tersedia — maklumat diteka daripada link sahaja.';
  }

  if (!data || (!data.found && !data.name)) {
    if (!guess) {
      return { found: false, name: '', price: '', highlights: '', audience: '', note: note || 'Produk tidak dapat dikenal pasti. Sila taip nama produk.' };
    }
    try {
      const d2 = extractJson(await callAI(settings,
        `Berdasarkan nama produk sahaja, cadangkan ciri/kegunaan UMUM yang biasa bagi produk jenis ini (tanpa angka spesifik, tanpa harga).
Pulangkan HANYA JSON: {"highlights":"3-4 ciri umum dipisah koma","audience":"siapa sesuai guna"}`,
        `Nama produk: ${guess}`, { json: true, maxTokens: 1024 }));
      return { found: false, name: guess, price: '', highlights: d2.highlights || '', audience: d2.audience || '', note: note || 'Maklumat dianggar daripada nama produk. Semak & betulkan jika perlu.' };
    } catch {
      return { found: false, name: guess, price: '', highlights: '', audience: '', note: note || 'Nama diteka daripada link. Sila lengkapkan maklumat lain.' };
    }
  }
  return {
    found: !!data.found,
    name: String(data.name || guess || '').slice(0, 120),
    price: String(data.price || ''),
    highlights: String(data.highlights || ''),
    audience: String(data.audience || ''),
    note: data.found ? 'Maklumat dicari oleh AI — semak harga di Shopee sebelum post.' : 'Maklumat tidak lengkap. Semak & betulkan.',
  };
}

/**
 * Ringkaskan maklumat jadi Kad Info (infografik) untuk Story / Status.
 * opts: { topic, snippet, source, category, web, lang, persona, fromPost }
 * @returns {Promise<{title, highlight, highlight_label, points:[{emoji,text}], note, source, caption, verified}>}
 */
export async function generateInfo(settings, opts) {
  if (!opts.topic?.trim()) throw new Error('Topik diperlukan.');
  const wantWeb = opts.web && settings.provider !== 'openai';
  let canWeb = wantWeb && !webLimited();
  let webSkipped = wantWeb && !canWeb;
  const buildSystem = (canWeb) => `Kau pereka kandungan infografik untuk audiens Malaysia (kewangan, bantuan kerajaan, e-wallet).
Tugas: ringkaskan maklumat jadi KAD INFO yang padat untuk dikongsi di Story / Status.
Peraturan WAJIB:
- Bahasa: ${LANGS[opts.lang]?.desc || LANGS.ms.desc}. Ayat pendek, mudah faham sekali pandang.
- "title": tajuk menarik, MAKSIMUM 50 aksara.
- "highlight": SATU angka/tarikh/jumlah paling penting (cth. "RM500", "15 Dis", "4.25%") maksimum 16 aksara, atau "" jika tiada fakta angka yang pasti.
- "highlight_label": label ringkas untuk highlight (maks 30 aksara), cth. "Bayaran Fasa 4".
- "points": 3 hingga 5 poin. Setiap poin {"emoji":"satu emoji","text":"maks 80 aksara"}. Poin praktikal: apa, siapa layak, bila, cara, tips.
- "note": peringatan ringkas maks 70 aksara (cth. "Semak status di laman rasmi sebelum memohon").
- "source": nama sumber (agensi/laman rasmi/akhbar), maks 60 aksara.
- "caption": kapsyen untuk Threads/Instagram, maks 350 aksara, dengan ajakan (save/share/komen) dan 1-2 hashtag.
- "verified": true jika fakta disahkan daripada sumber, false jika tidak pasti.
- JANGAN reka angka, tarikh, kadar, syarat atau nama program. ${canWeb ? 'Gunakan carian web untuk SAHKAN dan lengkapkan fakta daripada sumber rasmi/berita terkini. Jika tidak dapat disahkan, tulis secara umum dan set verified=false.' : 'Guna HANYA maklumat yang diberi. Jika tidak cukup, tulis secara umum dan ajak semak laman rasmi.'}
- Untuk pelaburan: tiada janji pulangan, tiada nasihat beli/jual.
${opts.persona ? `- Persona akaun: ${opts.persona}` : ''}
Pulangkan HANYA JSON:
{"title":"","highlight":"","highlight_label":"","points":[{"emoji":"","text":""}],"note":"","source":"","caption":"","verified":true}`;
  let system = buildSystem(canWeb);
  const user = `Kategori: ${catLabel(opts.category)}
${opts.fromPost ? 'Kandungan post asal' : 'Topik'}: ${opts.topic}
${opts.snippet ? `Ringkasan / fakta: ${opts.snippet}` : ''}
${opts.source ? `Sumber: ${opts.source}` : ''}`;

  let raw;
  try {
    raw = await callAI(settings, system, user, { json: !canWeb, web: canWeb, maxTokens: 4096, temperature: 0.5 });
  } catch (e) {
    const toolProblem = /web|tool|search|fetch|url|ground/i.test(e.message);
    if (!canWeb || !(toolProblem || e.status === 429)) throw e;
    // Carian web ditolak (biasanya API key percuma) → cuba semula tanpa carian web
    if (e.status === 429 && settings.provider === 'gemini') markWebLimited();
    canWeb = false; webSkipped = true;
    system = buildSystem(false);
    raw = await callAI(settings, system, user, { json: true, maxTokens: 4096, temperature: 0.5 });
  }
  const d = extractJson(raw);
  const cut = (s, n) => { const a = [...String(s || '').trim()]; return a.length > n ? `${a.slice(0, n - 1).join('')}…` : a.join(''); };
  const points = (Array.isArray(d.points) ? d.points : [])
    .map((p) => (typeof p === 'string' ? { emoji: '•', text: p } : p))
    .map((p) => ({ emoji: cut(p.emoji || '•', 4), text: cut(p.text, 90) }))
    .filter((p) => p.text)
    .slice(0, 5);
  if (!d.title || !points.length) throw new Error('AI tidak memulangkan kad info. Cuba lagi.');
  return {
    title: cut(d.title, 60),
    highlight: cut(d.highlight, 18),
    highlight_label: cut(d.highlight_label, 34),
    points,
    note: cut(d.note, 80),
    source: cut(d.source || opts.source, 70),
    caption: cut(d.caption, 450),
    verified: !webSkipped && d.verified !== false,
    webSkipped,
  };
}

/**
 * Pecahkan teks kongsi Shopee kepada { link, name, price }.
 * cth. "Check out Blender Mini 600ml for RM29.90. Get it on Shopee now! https://s.shopee.com.my/AbC12"
 *      "Lihat Blender Mini dengan harga RM29.90 di Shopee! https://s.shopee.com.my/AbC12"
 */
export function parseShareText(text = '') {
  const raw = String(text).trim();
  const link = firstUrl(raw);
  const priceM = raw.match(/RM\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?-\s?RM\s?\d[\d,]*(?:\.\d{1,2})?)?/i);
  let name = raw
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/RM\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?-\s?RM\s?\d[\d,]*(?:\.\d{1,2})?)?/gi, ' ')
    .replace(/\b(check out|lihat|semak|dapatkan|get it|buy|beli)\b/gi, ' ')
    .replace(/\b(on|di|from|dari)\s+shopee\b.*$/i, ' ')
    .replace(/\b(for|dengan harga|pada harga|only|hanya|now|sekarang)\b/gi, ' ')
    .replace(/\bshopee\b/gi, ' ')
    .replace(/[!|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,:;–-]+|[\s.,:;–-]+$/g, '')
    .trim();
  if (name.length < 3) name = '';
  return { link, name: name.slice(0, 120), price: priceM ? priceM[0].replace(/\s+/g, '') : '' };
}
