// Modul AI: jana post / bebenang / ayat affiliate, dan cari maklumat produk.
// Semua panggilan dibuat terus dari browser menggunakan API key pengguna.

export const MAX_CHARS = 500;
export const DEFAULT_MODELS = { gemini: 'gemini-3.6-flash', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' };
export const LINK_TOKEN = '{LINK}';

export const TONES = {
  santai: { label: 'Santai', desc: 'santai dan mesra macam borak dengan kawan, bahasa Melayu harian (boleh campur sikit English macam orang Malaysia biasa)' },
  informatif: { label: 'Informatif', desc: 'padat dengan info berguna, ringkas dan terus ke point' },
  lucu: { label: 'Lucu', desc: 'kelakar dan bersahaja, tapi info tetap tepat' },
  formal: { label: 'Formal', desc: 'profesional dan jelas, bahasa Melayu standard' },
  hype: { label: 'Teruja', desc: 'penuh semangat dan teruja, banyak tenaga, tapi tidak berlebihan sampai nampak spam' },
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
  finance: 'Kewangan', food: 'Makanan', voucher: 'Voucher & Promo', bantuan: 'Bantuan Kerajaan', viral: 'Info Viral', ai: 'Info AI',
};

// ---------- Utiliti ----------
export const len = (s = '') => [...s].length;

export function extractJson(raw) {
  const s = String(raw);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Jawapan AI tidak dalam format dijangka. Cuba lagi.');
  return JSON.parse(s.slice(start, end + 1));
}

function clip(text) {
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
 * @param {object} opts { json: bool, web: bool (benarkan carian/baca web), maxTokens }
 */
export async function callAI(settings, system, user, { json = true, web = false, maxTokens = 8192 } = {}) {
  const { provider, apiKey } = settings;
  if (!apiKey) throw Object.assign(new Error('Masukkan API key AI di Tetapan dulu.'), { code: 'NO_KEY' });
  const model = settings.model || DEFAULT_MODELS[provider];

  if (provider === 'gemini') {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: web ? 0.3 : 0.9, maxOutputTokens: maxTokens },
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
  const body = { model, temperature: 0.9, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (json) body.response_format = { type: 'json_object' };
  let res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 400 && body.response_format) { // sesetengah penyedia tak sokong json_object
    delete body.response_format;
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw await readError(res, 'AI');
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------- Prompt ----------
function baseRules(persona) {
  return `Kau penulis kandungan Threads yang mahir untuk audiens Malaysia.
Peraturan WAJIB:
- Setiap bahagian/post MESTI kurang daripada ${MAX_CHARS - 30} aksara (termasuk emoji & hashtag).
- Ayat pertama ialah "hook" kuat yang buat orang berhenti scroll.
- Guna perenggan pendek / baris baru supaya senang baca di telefon. Emoji secukupnya.
- Maksimum 1-2 hashtag relevan untuk keseluruhan, atau tiada langsung.
- JANGAN reka fakta, angka, harga, tarikh, spesifikasi, diskaun atau syarat. Guna HANYA maklumat yang diberi. Jika tak pasti, tulis secara umum atau ajak pembaca semak sendiri.
- Jangan letak sebarang URL dalam teks post.
${persona ? `Persona/gaya akaun: ${persona}` : ''}`;
}

function formatRules({ format, parts, numbering }) {
  if (format !== 'thread') return 'FORMAT: satu post sahaja (parts mengandungi 1 item).';
  return `FORMAT: BEBENANG (thread) dengan TEPAT ${parts} bahagian yang bersambung.
- Bahagian 1: hook paling kuat + bayangan apa yang akan dikongsi (cth. "Thread 🧵👇").
- Bahagian tengah: setiap satu bawa SATU idea, mengalir lancar dari bahagian sebelumnya.
- Bahagian terakhir: rumusan + ajakan (soalan / follow / CTA).
${numbering ? `- Akhiri setiap bahagian dengan penomboran seperti "(1/${parts})".` : '- Jangan letak penomboran.'}`;
}

const OUTPUT_SPEC = (count) => `Tulis ${count} variasi yang BERBEZA gaya hook.
Pulangkan HANYA JSON tanpa teks lain:
{"variants":[{"parts":["bahagian 1", "..."],"comment":"teks komen pertama atau string kosong"}]}`;

/**
 * Jana variasi post / bebenang.
 * opts: { mode:'topic'|'affiliate', format:'single'|'thread', parts, count, tone, extra, numbering,
 *         topic, snippet, source, category,
 *         product:{ link, name, price, highlights, audience }, style, used, disclosure, persona }
 * @returns {Promise<Array<{parts:string[], comment:string}>>}
 */
export async function generate(settings, opts) {
  const parts = opts.format === 'thread' ? Math.min(Math.max(opts.parts || 4, 2), 8) : 1;
  const count = Math.min(Math.max(opts.count || 3, 1), opts.format === 'thread' ? 3 : 5);
  const tone = TONES[opts.tone]?.desc || opts.tone || TONES.santai.desc;

  let system = baseRules(opts.persona);
  let user = '';

  if (opts.mode === 'affiliate') {
    const p = opts.product || {};
    if (!p.link) throw new Error('Masukkan link produk.');
    if (!p.name) throw new Error('Nama produk diperlukan. Tekan "Isi automatik" atau taip sendiri.');
    system += `
Ini kandungan AFFILIATE untuk produk Shopee.
- Link produk akan diletak dalam KOMEN PERTAMA, bukan dalam post. Bahagian terakhir mesti ajak pembaca semak link di komen (cth. "Link aku letak kat komen 👇").
- "comment": tulis 1-2 baris ringkas untuk komen pertama yang mengandungi token ${LINK_TOKEN} tepat sekali (app akan gantikan dengan link sebenar). Contoh: "🛒 Link produk: ${LINK_TOKEN}".
- ${opts.used ? 'Penulis PERNAH guna produk ini; boleh tulis dari sudut pengalaman sendiri, tapi jangan reka butiran spesifik yang tidak diberi.' : 'Penulis BELUM tentu pernah guna produk ini. JANGAN dakwa "aku dah guna", "dah pakai 3 bulan" atau testimoni palsu. Fokus pada ciri, kegunaan dan sebab ia menarik.'}
${opts.disclosure ? '- Letak hashtag #affiliate di hujung bahagian terakhir (dikira dalam had hashtag).' : ''}`;
    user = `Produk: ${p.name}
${p.price ? `Harga: ${p.price}` : 'Harga: (tidak diberi — jangan sebut harga spesifik)'}
${p.highlights ? `Kelebihan / ciri: ${p.highlights}` : ''}
${p.audience ? `Sesuai untuk: ${p.audience}` : ''}
Gaya: ${AFF_STYLES[opts.style]?.desc || AFF_STYLES.wajib.desc}
Nada: ${tone}`;
  } else {
    if (!opts.topic?.trim()) throw new Error('Topik diperlukan.');
    system += `
- Untuk bantuan kerajaan/kewangan: ajak semak di laman rasmi dan jangan beri nasihat pelaburan.
- "comment": string kosong melainkan ada sebab kukuh untuk komen pertama.`;
    user = `Kategori: ${CAT_LABELS[opts.category] || opts.category || 'umum'}
Topik: ${opts.topic}
${opts.snippet ? `Ringkasan sumber: ${opts.snippet}` : ''}
${opts.source ? `Sumber: ${opts.source}` : ''}
Nada: ${tone}`;
  }

  system += `\n${formatRules({ format: opts.format, parts, numbering: opts.numbering })}\n${OUTPUT_SPEC(count)}`;
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
      if (!v.comment.includes(LINK_TOKEN)) v.comment = `🛒 Link produk: ${LINK_TOKEN}`;
      v.comment = v.comment.replaceAll(LINK_TOKEN, opts.product.link);
      if (opts.disclosure) {
        const last = v.parts.length - 1;
        if (!/#affiliate/i.test(v.parts.join(' '))) {
          if (len(v.parts[last]) + 12 <= MAX_CHARS) v.parts[last] += '\n\n#affiliate';
          else v.comment += '\n#affiliate';
        }
      }
    }
  }
  return variants;
}

/** Tulis semula satu bahagian sahaja dalam bebenang. */
export async function regeneratePart(settings, { parts, index, tone, persona, extra }) {
  const system = `${baseRules(persona)}
Kau akan tulis semula SATU bahagian dalam bebenang Threads supaya lebih menarik, sambil kekal sesuai dengan bahagian sebelum & selepasnya.
Kekalkan peranan bahagian itu (hook / isi / penutup), sebarang penomboran "(x/y)", dan maklumat fakta yang sama.
Pulangkan HANYA JSON: {"part":"teks baharu"}`;
  const user = `Bebenang penuh:
${parts.map((p, i) => `--- Bahagian ${i + 1}${i === index ? ' (TULIS SEMULA INI)' : ''} ---\n${p}`).join('\n')}

Nada: ${TONES[tone]?.desc || tone || TONES.santai.desc}
${extra ? `Arahan tambahan: ${extra}` : ''}`;
  const data = extractJson(await callAI(settings, system, user, { json: true, maxTokens: 2048 }));
  if (!data.part) throw new Error('AI tidak memulangkan teks.');
  return clip(data.part);
}

/**
 * Cari maklumat produk daripada link (guna carian/baca web jika penyedia menyokong).
 * @returns {Promise<{name, price, highlights, audience, found:boolean, note}>}
 */
export async function researchProduct(settings, link) {
  const guess = nameFromUrl(link);
  const system = `Kau pembantu penyelidik produk e-dagang Malaysia. Tugas: kenal pasti produk daripada link Shopee yang diberi.
Baca halaman link tersebut dan/atau cari di web (nama produk, harga semasa dalam RM, ciri utama).
JANGAN reka. Jika maklumat tidak dijumpai dengan yakin, biarkan medan itu kosong.
Pulangkan HANYA JSON:
{"found": true/false, "name": "nama produk ringkas (maks 80 aksara)", "price": "cth. RM39.90 atau kosong", "highlights": "3-5 ciri/kelebihan utama dipisah koma", "audience": "siapa sesuai guna (ringkas)"}`;
  const user = `Link: ${link}${guess ? `\nPetunjuk nama daripada URL: ${guess}` : ''}`;

  let data = null;
  let note = '';
  try {
    data = extractJson(await callAI(settings, system, user, { json: false, web: settings.provider !== 'openai', maxTokens: 4096 }));
  } catch (e) {
    const toolProblem = /web|tool|search|fetch|url/i.test(e.message);
    if (e.code === 'NO_KEY' || e.status === 401 || e.status === 429 || (e.status === 403 && !toolProblem)) throw e;
    note = 'Carian web tidak tersedia — maklumat diteka daripada link sahaja.';
  }

  if (!data || (!data.found && !data.name)) {
    if (!guess) {
      return { found: false, name: '', price: '', highlights: '', audience: '', note: note || 'Produk tidak dapat dikenal pasti. Sila taip nama produk.' };
    }
    // Tiada carian web: minta AI cadang ciri umum berdasarkan nama sahaja (tanpa harga)
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
