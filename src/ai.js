// Jana post Threads menggunakan AI.
// Sokong: Anthropic Claude (default) atau mana-mana API serasi OpenAI
// (OpenAI, Google Gemini, Groq, OpenRouter, dll.)
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES } from './trends.js';
import { getSetting } from './db.js';

// Had aksara post Threads
export const MAX_CHARS = 500;

const PROVIDER = () => (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

const TONES = {
  santai: 'santai dan mesra macam borak dengan kawan, guna bahasa Melayu harian (boleh campur sikit English macam orang Malaysia biasa)',
  formal: 'profesional dan jelas, bahasa Melayu standard',
  lucu: 'kelakar dan bersahaja, tapi info tetap tepat',
  informatif: 'padat dengan info berguna, ringkas dan terus ke point',
};

function systemPrompt() {
  const persona = getSetting('persona', '') || process.env.AI_PERSONA || '';
  return `Kau penulis kandungan Threads untuk audiens Malaysia.
Peraturan WAJIB:
- Setiap post MESTI kurang daripada ${MAX_CHARS - 20} aksara (termasuk emoji & hashtag).
- Ayat pertama ialah "hook" yang buat orang berhenti scroll.
- Guna perenggan pendek / baris baru supaya senang baca di telefon.
- Maksimum 1-2 hashtag yang relevan, atau tiada langsung.
- JANGAN reka fakta, angka, tarikh, harga atau syarat kelayakan. Guna HANYA maklumat dalam tajuk/ringkasan sumber yang diberi. Jika maklumat tak lengkap, ajak pembaca semak sumber rasmi.
- Untuk bantuan kerajaan/kewangan: sebut supaya semak di laman rasmi (cth. portal agensi berkaitan) dan jangan beri nasihat pelaburan.
- Jangan letak URL dalam teks melainkan diminta.
- Akhiri dengan soalan atau ajakan ringkas untuk engagement (jika sesuai).
${persona ? `Persona/gaya akaun: ${persona}` : ''}
Pulangkan HANYA JSON: {"posts": ["post 1", "post 2", ...]} tanpa teks lain.`;
}

function userPrompt({ topic, snippet, category, tone = 'santai', count = 3, extra = '', source }) {
  const cat = CATEGORIES[category];
  return `Kategori: ${cat ? cat.label : category || 'umum'}
Topik: ${topic}
${snippet ? `Ringkasan sumber: ${snippet}` : ''}
${source ? `Sumber: ${source}` : ''}
Nada: ${TONES[tone] || tone}
${extra ? `Arahan tambahan: ${extra}` : ''}
Tulis ${count} variasi post Threads yang berbeza gaya hook.`;
}

function parsePosts(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  let posts = [];
  try { posts = JSON.parse(m ? m[0] : raw).posts || []; } catch {
    posts = raw.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
  }
  return posts
    .map((p) => String(p).trim())
    .filter(Boolean)
    .map((p) => ([...p].length > MAX_CHARS ? [...p].slice(0, MAX_CHARS - 1).join('').replace(/\s+\S*$/, '') + '…' : p));
}

async function callAnthropic(system, user) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY belum ditetapkan dalam .env');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-5-5',
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function callOpenAICompatible(system, user) {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY belum ditetapkan dalam .env');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.9,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`AI API: ${body?.error?.message || res.status}`);
  return body.choices?.[0]?.message?.content || '';
}

/**
 * @returns {Promise<string[]>} senarai draf post
 */
export async function generatePosts(opts) {
  if (!opts.topic?.trim()) throw new Error('Topik diperlukan.');
  const system = systemPrompt();
  const user = userPrompt(opts);
  const raw = PROVIDER() === 'anthropic' ? await callAnthropic(system, user) : await callOpenAICompatible(system, user);
  const posts = parsePosts(raw);
  if (!posts.length) throw new Error('AI tidak memulangkan post. Cuba lagi.');
  return posts;
}
