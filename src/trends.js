// Cari topik viral/trending di Malaysia dari sumber RSS percuma (tanpa API key):
//  - Google Trends "Trending now" (geo=MY)
//  - Google News carian ikut kategori (BM + English, 48 jam terakhir)
import Parser from 'rss-parser';
import { isTopicUsed } from './db.js';

const parser = new Parser({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:news_item', 'newsItems', { keepArray: true }],
      ['source', 'source'],
    ],
  },
});

export const CATEGORIES = {
  finance: {
    label: 'Kewangan',
    emoji: '💰',
    query: 'KWSP OR EPF OR "Bursa Malaysia" OR ringgit OR pinjaman OR cukai OR LHDN OR "kadar faedah" OR OPR OR pelaburan',
    keywords: ['kwsp', 'epf', 'bursa', 'ringgit', 'saham', 'pinjaman', 'cukai', 'lhdn', 'opr', 'bank', 'pelaburan', 'gaji', 'harga', 'minyak', 'ron95', 'kewangan', 'finance', 'loan', 'tax', 'invest', 'crypto', 'bitcoin', 'emas', 'gold', 'asb', 'tabung haji'],
  },
  food: {
    label: 'Makanan',
    emoji: '🍜',
    query: '"makanan viral" OR "kedai makan" OR resepi OR "menu baru" OR "food viral" OR mamak OR "nasi lemak"',
    keywords: ['makan', 'makanan', 'resepi', 'kedai', 'restoran', 'menu', 'food', 'nasi', 'mamak', 'kopi', 'kafe', 'cafe', 'mcd', 'kfc', 'burger', 'mee', 'roti', 'durian', 'bazar', 'buffet'],
  },
  voucher: {
    label: 'Voucher & Promo',
    emoji: '🎟️',
    query: 'baucar OR voucher OR promosi OR diskaun OR cashback OR "jualan murah" OR "kod promo" OR "free"',
    keywords: ['baucar', 'voucher', 'promo', 'promosi', 'diskaun', 'discount', 'cashback', 'sale', 'percuma', 'free', 'murah', 'shopee', 'lazada', 'tiktok shop', 'grab', 'tng', 'touch n go', 'kupon', 'rebat'],
  },
  bantuan: {
    label: 'Bantuan Kerajaan',
    emoji: '🏛️',
    query: '"bantuan kerajaan" OR STR OR SARA OR "Sumbangan Tunai Rahmah" OR BUDI95 OR "e-Tunai" OR "bantuan Madani" OR JKM OR "Belanjawan 2027"',
    keywords: ['bantuan', 'str', 'sara', 'rahmah', 'budi', 'e-tunai', 'madani', 'jkm', 'subsidi', 'belanjawan', 'bajet', 'kerajaan', 'permohonan', 'mohon', 'kelayakan', 'perkeso', 'mykasih', 'padu'],
  },
  viral: {
    label: 'Info Viral',
    emoji: '🔥',
    query: 'viral Malaysia OR tular OR netizen',
    keywords: ['viral', 'tular', 'netizen', 'heboh', 'trending'],
  },
  ai: {
    label: 'Info AI',
    emoji: '🤖',
    query: '"kecerdasan buatan" OR "artificial intelligence" OR ChatGPT OR OpenAI OR Gemini OR Claude OR Anthropic OR "AI tool"',
    keywords: ['ai', 'kecerdasan buatan', 'chatgpt', 'openai', 'gemini', 'claude', 'anthropic', 'llm', 'copilot', 'deepseek', 'grok', 'meta ai', 'robot', 'automation', 'nvidia'],
  },
};

const cache = new Map(); // url -> { at, items }
const CACHE_MS = 10 * 60 * 1000;

async function fetchFeed(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (threads-autopost)' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const items = feed.items || [];
  cache.set(url, { at: Date.now(), items });
  return items;
}

function newsUrl(query, lang = 'ms') {
  const q = encodeURIComponent(`${query} when:2d`);
  return lang === 'ms'
    ? `https://news.google.com/rss/search?q=${q}&hl=ms&gl=MY&ceid=MY:ms`
    : `https://news.google.com/rss/search?q=${q}&hl=en-MY&gl=MY&ceid=MY:en`;
}

function parseTraffic(s) {
  if (!s) return 0;
  const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  if (/k/i.test(m[2] || '')) n *= 1e3;
  if (/m/i.test(m[2] || '')) n *= 1e6;
  return n;
}

const kwRegex = new Map();
function hasWord(text, k) {
  if (!kwRegex.has(k)) {
    const e = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    kwRegex.set(k, new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i'));
  }
  return kwRegex.get(k).test(text);
}

export function guessCategory(text) {
  const t = String(text).toLowerCase();
  let best = 'viral';
  let bestScore = 0;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (key === 'viral') continue;
    const score = cat.keywords.reduce((s, k) => s + (hasWord(t, k) ? 1 : 0), 0);
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

// Buang " - Nama Akhbar" di hujung tajuk Google News
function cleanTitle(title = '') {
  return title.replace(/\s+-\s+[^-]{2,60}$/, '').trim();
}

const STOP = new Set('yang dan di ke dari untuk ini itu dengan pada akan the a of to in for on is are with as by at kepada oleh tidak juga lebih'.split(' '));
function tokens(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * Gabung tajuk yang serupa jadi satu topik. Skor viral =
 * bilangan sumber yang lapor + trafik Google Trends + kebaharuan.
 */
function clusterAndScore(items) {
  const clusters = [];
  for (const it of items) {
    const c = clusters.find((cl) => similarity(cl.title, it.title) >= 0.5);
    if (c) {
      c.sources.add(it.source);
      c.count++;
      c.traffic = Math.max(c.traffic, it.traffic || 0);
      if (it.date > c.date) c.date = it.date;
      if (!c.snippet && it.snippet) c.snippet = it.snippet;
    } else {
      clusters.push({ ...it, sources: new Set([it.source]), count: 1, traffic: it.traffic || 0 });
    }
  }
  const now = Date.now();
  return clusters.map((c) => {
    const ageH = c.date ? Math.max(0, (now - c.date) / 3600000) : 24;
    const recency = Math.max(0, 48 - ageH) / 48; // 1 = baru, 0 = >48j
    const score = Math.round(
      c.sources.size * 15 + (c.traffic ? Math.log10(c.traffic + 1) * 20 : 0) + recency * 30
    );
    return {
      title: c.title,
      snippet: c.snippet || '',
      link: c.link,
      category: c.category,
      sources: [...c.sources].filter(Boolean).slice(0, 5),
      traffic: c.traffic || null,
      published: c.date ? new Date(c.date).toISOString() : null,
      origin: c.origin,
      score,
      used: isTopicUsed(c.title),
    };
  }).sort((a, b) => b.score - a.score);
}

async function googleTrends() {
  const items = await fetchFeed('https://trends.google.com/trending/rss?geo=MY');
  return items.map((it) => {
    const news = (it.newsItems || [])[0] || {};
    const newsTitle = [].concat(news['ht:news_item_title'] || [])[0] || '';
    const newsUrlV = [].concat(news['ht:news_item_url'] || [])[0] || '';
    const newsSource = [].concat(news['ht:news_item_source'] || [])[0] || 'Google Trends';
    const text = `${it.title} ${newsTitle}`;
    return {
      title: newsTitle ? `${it.title}: ${cleanTitle(newsTitle)}` : it.title,
      snippet: newsTitle,
      link: newsUrlV || `https://trends.google.com/trends/explore?geo=MY&q=${encodeURIComponent(it.title)}`,
      source: newsSource,
      traffic: parseTraffic(it.approxTraffic),
      date: it.pubDate ? Date.parse(it.pubDate) : Date.now(),
      category: guessCategory(text),
      origin: 'Google Trends',
    };
  });
}

async function googleNews(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  const feeds = await Promise.allSettled([fetchFeed(newsUrl(cat.query, 'ms')), fetchFeed(newsUrl(cat.query, 'en'))]);
  const items = feeds.flatMap((f) => (f.status === 'fulfilled' ? f.value : []));
  return items.map((it) => ({
    title: cleanTitle(it.title),
    snippet: (it.contentSnippet || '').replace(/\s+/g, ' ').slice(0, 300),
    link: it.link,
    source: typeof it.source === 'string' ? it.source : it.source?._ || (it.title.split(' - ').pop() || 'Google News'),
    date: it.pubDate ? Date.parse(it.pubDate) : null,
    category: categoryKey,
    origin: 'Google News',
  }));
}

/**
 * Dapatkan topik trending.
 * @param {string[]} categories - senarai kategori (default semua)
 * @param {number} limit - bilangan per kategori
 */
export async function getTrending(categories = Object.keys(CATEGORIES), limit = 10) {
  const errors = [];
  const [trends, ...newsLists] = await Promise.all([
    googleTrends().catch((e) => { errors.push(`Google Trends: ${e.message}`); return []; }),
    ...categories.map((c) => googleNews(c).catch((e) => { errors.push(`Google News (${c}): ${e.message}`); return []; })),
  ]);

  const result = {};
  categories.forEach((c, i) => {
    const pool = [...newsLists[i], ...trends.filter((t) => t.category === c)];
    result[c] = clusterAndScore(pool).slice(0, limit);
  });
  return { categories: result, errors, fetched_at: new Date().toISOString() };
}

/** Pilih satu topik terbaik yang belum pernah digunakan untuk kategori. */
export async function pickTopic(category) {
  const { categories } = await getTrending([category], 15);
  return (categories[category] || []).find((t) => !t.used) || null;
}
