// Cari topik viral/trending di Malaysia dari sumber RSS percuma:
//  - Google Trends "Trending now" (geo=MY)
//  - Google News carian ikut kategori (BM + English, 48 jam terakhir) + berita utama & seksyen
//  - Reddit (r/malaysia, r/MalaysianPF), forum Lowyat (Kopitiam)
//  - YouTube Trending MY (pilihan, perlu YOUTUBE_API_KEY)
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:news_item', 'newsItems', { keepArray: true }],
      ['ht:picture', 'picture'],
      ['source', 'source'],
      ['source', 'sourceRaw', { keepArray: true }],
    ],
  },
});

// Kumpulan utama — app HANYA papar topik dalam kumpulan ini.
export const GROUPS = {
  kewangan: { label: 'Kewangan', emoji: '💰', color: '#10b981' },
  bantuan: { label: 'Bantuan Kerajaan', emoji: '🏛️', color: '#2563eb' },
  ewallet: { label: 'E-Wallet', emoji: '📲', color: '#8b5cf6' },
};

// Subkategori (berdasarkan topik channel YouTube Imran Wafi: Tutorial | Financial —
// tips jimat, eWallet, topup percuma, duit percuma, bank, buat duit online)
export const CATEGORIES = {
  // ---------- 💰 KEWANGAN ----------
  pelaburan: {
    group: 'kewangan', label: 'Pelaburan', emoji: '📈',
    query: 'saham OR "Bursa Malaysia" OR ASB OR ASNB OR "unit amanah" OR dividen OR "pelaburan emas" OR REIT OR KLCI',
    keywords: ['saham', 'bursa malaysia', 'klci', '=ASB', '=ASNB', 'amanah saham', 'unit amanah', 'dividen', 'dividend', 'pelaburan emas', 'harga emas', '=REIT', 'pelaburan', 'melabur', 'invest', 'investment', 'bitcoin', 'crypto', 'kripto', '=ETF', 'sukuk', 'tabung haji', 'patuh syariah'],
  },
  tipslabur: {
    group: 'kewangan', label: 'Tips Labur', emoji: '🎯', days: 7,
    query: '"cara melabur" OR "mula melabur" OR "tips pelaburan" OR "pelabur baru" OR "how to invest" OR "beginner investor" Malaysia',
    keywords: ['cara melabur', 'mula melabur', 'tips pelaburan', 'tips labur', 'pelabur baru', 'pemula', 'beginner', 'dca', 'dollar cost', 'portfolio', 'risiko', 'pulangan', 'compound', 'kompaun', 'pasif', 'passive income', 'financial freedom', 'kebebasan kewangan'],
  },
  applabur: {
    group: 'kewangan', label: 'App Pelaburan', emoji: '📱', weight: 2, days: 7,
    query: 'StashAway OR Versa OR Wahed OR Luno OR moomoo OR "Rakuten Trade" OR "Kenanga Digital" OR Webull OR "Public Gold" OR "Mplus" OR "robo-advisor" Malaysia',
    keywords: ['stashaway', '=Versa', 'wahed', 'luno', 'moomoo', 'rakuten trade', 'kenanga digital', 'webull', 'mplus', 'public gold', 'robo-advisor', 'robo advisor', 'aplikasi pelaburan', 'app pelaburan', 'tiger brokers', 'interactive brokers', 'myasnb', 'go+', 'goplus', '=KDI', 'raiz', 'suruhanjaya sekuriti'],
  },
  simpan: {
    group: 'kewangan', label: 'Tips Simpan & Jimat', emoji: '🐷',
    query: '"tips jimat" OR "simpan duit" OR "tabung kecemasan" OR bajet OR KWSP OR EPF OR "akaun fleksibel" OR "kos sara hidup"',
    keywords: ['jimat', 'berjimat', 'simpan', 'simpanan', 'menabung', 'tabung', 'bajet', 'budget', 'kecemasan', 'emergency fund', 'kwsp', 'epf', 'akaun fleksibel', 'akaun 3', 'gaji', 'hutang', 'kos sara hidup', 'saving', 'savings', 'frugal', 'perbelanjaan', 'tips shopping'],
  },
  bank: {
    group: 'kewangan', label: 'Bank & Bank Digital', emoji: '🏦',
    query: '"bank digital" OR GXBank OR "AEON Bank" OR "Boost Bank" OR "Ryt Bank" OR "kadar faedah" OR OPR OR "Bank Negara" OR "simpanan tetap"',
    keywords: ['bank', 'gxbank', 'gx bank', 'aeon bank', 'boost bank', 'ryt bank', 'bank digital', 'digital bank', '=OPR', 'kadar faedah', 'interest rate', 'bank negara', '=BNM', 'simpanan tetap', 'fixed deposit', 'kad kredit', 'credit card', 'kad debit', 'duitnow', 'maybank', 'cimb', 'public bank', '=RHB', 'bank islam', '=BSN'],
  },
  duitonline: {
    group: 'kewangan', label: 'Duit Tambahan', emoji: '💻', days: 7,
    query: '"buat duit online" OR "pendapatan sampingan" OR "side income" OR "kerja sambilan" OR freelance OR "gig economy" Malaysia',
    keywords: ['buat duit', 'duit online', 'pendapatan sampingan', 'pendapatan tambahan', 'side income', 'side hustle', 'kerja sambilan', 'part time', 'freelance', 'gig', 'p-hailing', 'e-hailing', 'affiliate', 'jual online', 'dropship'],
  },

  // ---------- 🏛️ BANTUAN KERAJAAN ----------
  tunai: {
    group: 'bantuan', label: 'Bantuan Tunai', emoji: '💵', weight: 1.2,
    query: 'STR OR "Sumbangan Tunai Rahmah" OR SARA OR "Sumbangan Asas Rahmah" OR "bantuan tunai" OR JKM OR "bantuan Madani"',
    keywords: ['=STR', 'sumbangan tunai rahmah', '=SARA', 'sumbangan asas rahmah', 'bantuan tunai', '=JKM', 'bantuan madani', 'bantuan', 'sumbangan', 'mykasih', 'bayaran fasa', 'penerima', 'kelayakan', 'semak status', 'permohonan', 'bantuan kerajaan'],
  },
  subsidi: {
    group: 'bantuan', label: 'Subsidi', emoji: '⛽', weight: 1.5,
    query: 'BUDI95 OR RON95 OR "subsidi bersasar" OR "subsidi diesel" OR "Budi Madani" OR PADU OR "subsidi elektrik" OR "harga minyak"',
    keywords: ['budi95', 'budi 95', 'ron95', 'ron 95', 'subsidi', 'budi madani', 'diesel', '=PADU', 'harga minyak', 'harga petrol', 'tarif elektrik', 'subsidi elektrik', 'fleet card', 'subsidi bersasar'],
  },
  pendidikan: {
    group: 'bantuan', label: 'Pendidikan & Belia', emoji: '🎓', days: 7,
    query: '"bantuan awal persekolahan" OR PTPTN OR biasiswa OR MARA OR "bantuan pelajar" OR "Rahmah Pelajar" OR "e-Belia" OR "Rebat Belia"',
    keywords: ['bantuan awal persekolahan', '=BAP', 'ptptn', 'biasiswa', 'pinjaman pendidikan', 'bantuan pelajar', 'rahmah pelajar', 'e-belia', 'rebat belia', 'belia rahmah', 'sspn', 'bantuan persekolahan', 'yuran percuma'],
  },
  program: {
    group: 'bantuan', label: 'Belanjawan & Program', emoji: '📜',
    query: '"Belanjawan 2027" OR "Belanjawan 2026" OR PERKESO OR "insentif kerajaan" OR "pelepasan cukai" OR LHDN OR "program kerajaan" OR "Rahmah"',
    keywords: ['belanjawan', 'bajet 2026', 'bajet 2027', 'perkeso', 'socso', 'insentif', 'pelepasan cukai', 'lhdn', 'cukai pendapatan', 'e-filing', 'program kerajaan', 'menu rahmah', 'jualan rahmah', 'skim', 'geran', 'kementerian'],
  },

  // ---------- 📲 E-WALLET ----------
  promo: {
    group: 'ewallet', label: 'Promo & Cashback', emoji: '🎁', days: 7,
    query: '"e-wallet" cashback OR "kod promo" OR rebat OR baucar OR "Touch n Go" promo OR GrabPay promo OR ShopeePay promo OR Boost cashback',
    keywords: ['cashback', 'kod promo', 'promo code', 'rebat', 'rebate', 'baucar', 'voucher', 'diskaun', 'discount', 'promosi', 'promo', 'tawaran', 'deal', 'shopeepay', 'spaylater'],
  },
  percuma: {
    group: 'ewallet', label: 'Duit & Topup Percuma', emoji: '🆓', weight: 1.5, days: 7,
    query: '"kredit percuma" OR "topup percuma" OR "duit percuma" OR eMadani OR ePemula OR "e-Tunai" OR "kredit e-wallet" OR "free credit" e-wallet',
    keywords: ['percuma', 'topup percuma', 'top up percuma', 'duit percuma', 'kredit percuma', 'emadani', 'e-madani', 'epemula', 'e-pemula', 'e-tunai', 'etunai', 'kredit e-wallet', 'free credit', 'angpau', 'ang pau', 'tebus', 'claim', 'tuntut'],
  },
  tipsewallet: {
    group: 'ewallet', label: 'Tips & Berita E-Wallet', emoji: '💳', days: 7,
    query: '"Touch n Go eWallet" OR "TNG eWallet" OR GrabPay OR "Boost e-wallet" OR ShopeePay OR "MAE" OR BigPay OR Setel OR "e-dompet"',
    keywords: ['e-wallet', 'ewallet', 'e-dompet', 'touch n go', "touch 'n go", '=TNG', 'grabpay', 'boost e-wallet', 'aplikasi boost', 'shopeepay', '=MAE', 'aplikasi mae', 'mae maybank', 'bigpay', 'aplikasi setel', 'reload', 'top up', 'topup', 'duitnow qr', 'tanpa tunai', 'cashless', 'gopayz'],
  },
  scam: {
    group: 'ewallet', label: 'Amaran Penipuan', emoji: '🚨', weight: 2, days: 7,
    query: 'scam e-wallet OR penipuan e-wallet OR "macau scam" OR phishing bank OR "akaun digodam" OR "scam alert" Malaysia',
    keywords: ['scam', 'penipuan', 'menipu', 'scammer', 'macau scam', 'phishing', 'godam', 'digodam', 'hacked', 'apk', 'pautan palsu', 'link palsu', 'amaran', 'mule', 'akaun keldai', 'semakmule'],
  },
};

const cache = new Map(); // url -> { at, items }
const CACHE_MS = 10 * 60 * 1000;

async function fetchFeed(url, headers = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (threads-autopost)', ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const items = feed.items || [];
  cache.set(url, { at: Date.now(), items });
  return items;
}

function newsUrl(query, lang = 'ms', days = 2) {
  const q = encodeURIComponent(`(${query}) when:${days}d`);
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
function hasWord(text, k, original = text) {
  // '=ABC' = padanan tepat ikut huruf besar/kecil (singkatan: STR, SARA, MAE…)
  if (k.startsWith('=')) {
    if (!kwRegex.has(k)) kwRegex.set(k, new RegExp(`(^|[^A-Za-z0-9])${k.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`));
    return kwRegex.get(k).test(original);
  }
  if (!kwRegex.has(k)) {
    const e = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    kwRegex.set(k, new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i'));
  }
  return kwRegex.get(k).test(text);
}

// Berita luar negara (India, UK dll.) yang terlepas masuk — buang kecuali jelas tentang Malaysia
const FOREIGN = /\b(lakh|crore|inshorts|sensex|nifty|ftse|india|indian|pakistan|bangladesh|philippines|indonesia|singapore|hong kong|australia|nigeria|kenya)\b/i;
const FOREIGN_CS = /(\bRs\.?\s?\d|\bPLC\b|\bREG - |\bUK\b|\bNHS\b|\bHMRC\b)/;
const MALAYSIA = /\b(malaysia|malaysian|bursa|klci|ringgit|kwsp|madani|kerajaan|sabah|sarawak|johor|selangor|kuala lumpur|putrajaya|lhdn|perkeso|tng|touch ?['’]?n ?go|maybank|duitnow|bnm|bank negara|budi95)\b|\bRM\s?\d/i;
const MALAYSIA_CS = /\b(STR|SARA|MAE|TNG)\b/;
const isMY = (t = '') => MALAYSIA.test(t) || MALAYSIA_CS.test(t);
export function isForeign(text = '') {
  const t = String(text);
  return (FOREIGN.test(t) || FOREIGN_CS.test(t)) && !isMY(t);
}

// Penerbit Malaysia sahaja (domain .my / .gov.my + media utama tanpa .my)
const MY_HOSTS = [
  'malaymail.com', 'freemalaysiatoday.com', 'theedgemalaysia.com', 'theedgemarkets.com', 'malaysiakini.com', 'bernama.com',
  'astroawani.com', 'says.com', 'soyacincau.com', 'lowyat.net', 'ringgitplus.com', 'therakyatpost.com', 'worldofbuzz.com',
  'malaysianow.com', 'thevibes.com', 'theborneopost.com', 'focusmalaysia.my', 'vocket.com', 'ohbulan.com', 'rotikaya.com',
  'editormalaysia.com', 'malaysiagazette.com', 'kosmo.com.my', 'harakahdaily.net', 'buletintv3.my', 'mstar.com.my',
  'theiskandarian.com', 'loanstreet.com.my', 'imoney.my', 'fintechnews.my', 'digitalnewsasia.com', 'paultan.org',
  'malaysiandigest.com', 'technave.com', 'vulcanpost.com', 'zing.my', 'iluminasi.com', 'utusan.com.my', 'nst.com.my', 'thestar.com.my', 'sinarharian.com.my', 'hmetro.com.my', 'bharian.com.my',
];
export function isMalaysianSource(url = '') {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return h.endsWith('.my') || h.includes('malaysia') || MY_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch { return false; }
}
const sourceUrl = (it) => it.sourceRaw?.[0]?.$?.url || (typeof it.source === 'object' ? it.source?.$?.url : '') || '';

/** Pastikan tajuk betul-betul berkaitan kategori (buang hasil carian yang tersasar). */
export function matchesCategory(text, key) {
  const t = String(text).toLowerCase();
  return CATEGORIES[key].keywords.some((k) => hasWord(t, k, String(text)));
}

/** Teka subkategori. Pulangkan null jika topik bukan kewangan / bantuan / e-wallet. */
export function guessCategory(text, fallback = null, minScore = 1) {
  const t = String(text).toLowerCase();
  const orig = String(text);
  let best = fallback;
  let bestScore = 0;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    // kata kunci berbilang perkataan lebih spesifik → berat lebih
    const score = (cat.weight || 1) * cat.keywords.reduce((s, k) => s + (hasWord(t, k, orig) ? (k.includes(' ') || k.startsWith('=') ? 1.5 : 1) : 0), 0);
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return bestScore >= minScore ? best : fallback;
}

// Buang " - Nama Akhbar" di hujung tajuk Google News
function cleanTitle(title = '') {
  return title.replace(/\s+-\s+[^-]{2,60}$/, '').trim();
}

const STOP = new Set('yang dan di ke dari untuk ini itu dengan pada akan the a of to in for on is are with as by at kepada oleh tidak juga lebih'.split(' '));
function tokens(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
export function similarity(a, b) {
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
      c.origins.add(it.origin);
      c.count++;
      c.traffic = Math.max(c.traffic, it.traffic || 0);
      if (it.date > c.date) c.date = it.date;
      if (!c.snippet && it.snippet) c.snippet = it.snippet;
      if (!c.image && it.image) c.image = it.image;
    } else {
      clusters.push({ ...it, sources: new Set([it.source]), origins: new Set([it.origin]), count: 1, traffic: it.traffic || 0 });
    }
  }
  const now = Date.now();
  return clusters.map((c) => {
    const ageH = c.date ? Math.max(0, (now - c.date) / 3600000) : 24;
    const recency = Math.max(0, 48 - ageH) / 48; // 1 = baru, 0 = >48j
    const score = Math.round(
      c.sources.size * 15 + (c.traffic ? Math.log10(c.traffic + 1) * 20 : 0) + recency * 30 + (c.boost || 0)
    );
    return {
      title: c.title,
      snippet: c.snippet || '',
      link: c.link,
      category: c.category,
      group: c.group || CATEGORIES[c.category]?.group,
      sources: [...c.sources].filter(Boolean).slice(0, 5),
      traffic: c.traffic || null,
      published: c.date ? new Date(c.date).toISOString() : null,
      origin: c.origin,
      origins: [...c.origins],
      ...(c.image ? { image: c.image } : {}),
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

async function googleTrends() {
  const items = await fetchFeed('https://trends.google.com/trending/rss?geo=MY');
  return items.map((it) => {
    const news = (it.newsItems || [])[0] || {};
    const newsTitle = [].concat(news['ht:news_item_title'] || [])[0] || '';
    const newsUrlV = [].concat(news['ht:news_item_url'] || [])[0] || '';
    if (newsUrlV && !isMalaysianSource(newsUrlV)) return null;
    const newsSource = [].concat(news['ht:news_item_source'] || [])[0] || 'Google Trends';
    const picture = [].concat(it.picture || [])[0] || [].concat(news['ht:news_item_picture'] || [])[0] || '';
    const text = `${it.title} ${newsTitle}`;
    return {
      title: newsTitle ? `${it.title}: ${cleanTitle(newsTitle)}` : it.title,
      snippet: newsTitle,
      link: newsUrlV || `https://trends.google.com/trends/explore?geo=MY&q=${encodeURIComponent(it.title)}`,
      source: newsSource,
      traffic: parseTraffic(it.approxTraffic),
      date: it.pubDate ? Date.parse(it.pubDate) : Date.now(),
      category: guessCategory(text, null, 2),
      origin: 'Google Trends',
      ...(picture ? { image: String(picture) } : {}),
    };
  }).filter(Boolean);
}

async function googleNews(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  const feeds = await Promise.allSettled([fetchFeed(newsUrl(cat.query, 'ms', cat.days || 2)), fetchFeed(newsUrl(cat.query, 'en', cat.days || 2))]);
  const items = feeds.flatMap((f) => (f.status === 'fulfilled' ? f.value : []));
  return items.filter((it) => (isMalaysianSource(sourceUrl(it)) || isMY(it.title || '')) && matchesCategory(`${cleanTitle(it.title)} ${it.contentSnippet || ''}`, categoryKey)).map((it) => ({
    title: cleanTitle(it.title),
    snippet: (it.contentSnippet || '').replace(/\s+/g, ' ').slice(0, 300),
    link: it.link,
    source: typeof it.source === 'string' ? it.source : it.source?._ || (it.title.split(' - ').pop() || 'Google News'),
    date: it.pubDate ? Date.parse(it.pubDate) : null,
    category: guessCategory(`${cleanTitle(it.title)} ${it.contentSnippet || ''}`) || categoryKey,
    origin: 'Google News',
  }));
}


// ---------- Sumber tambahan ----------
const GN_SECTIONS = ['BUSINESS', 'TECHNOLOGY', 'ENTERTAINMENT', 'HEALTH'];

async function googleNewsGeneral() {
  const urls = [
    'https://news.google.com/rss?hl=ms&gl=MY&ceid=MY:ms',
    'https://news.google.com/rss?hl=en-MY&gl=MY&ceid=MY:en',
    ...GN_SECTIONS.map((t) => `https://news.google.com/rss/headlines/section/topic/${t}?hl=en-MY&gl=MY&ceid=MY:en`),
  ];
  const feeds = await Promise.allSettled(urls.map(fetchFeed));
  if (feeds.every((f) => f.status === 'rejected')) throw new Error(feeds[0].reason?.message || 'gagal');
  return feeds.flatMap((f) => (f.status === 'fulfilled' ? f.value : [])).filter((it) => isMalaysianSource(sourceUrl(it))).map((it) => {
    const title = cleanTitle(it.title);
    return {
      title,
      snippet: (it.contentSnippet || '').replace(/\s+/g, ' ').slice(0, 300),
      link: it.link,
      source: typeof it.source === 'string' ? it.source : it.source?._ || 'Google News',
      date: it.pubDate ? Date.parse(it.pubDate) : null,
      category: guessCategory(title, null, 2),
      origin: 'Google News',
    };
  });
}

function stripHtml(s = '') {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function imgFrom(html = '') {
  const m = String(html).match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}

const REDDIT_UA = { 'User-Agent': 'web:threads-post-generator:v1.0 (by github.com/Imrnwfi/threads-autopost)' };
async function redditFeed(sub) {
  let lastErr;
  for (const host of ['www.reddit.com', 'old.reddit.com']) {
    try { return await fetchFeed(`https://${host}/r/${sub}/hot/.rss?limit=25`, REDDIT_UA); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function reddit() {
  // Reddit menyekat kebanyakan pelayan awan (termasuk GitHub Actions) — aktifkan dengan ENABLE_REDDIT=1
  if (process.env.ENABLE_REDDIT !== '1') return [];
  const subs = ['malaysia', 'MalaysianPF'];
  const feeds = await Promise.allSettled(subs.map(redditFeed));
  if (feeds.every((f) => f.status === 'rejected')) throw new Error(feeds[0].reason?.message || 'gagal');
  return feeds.flatMap((f, i) => (f.status === 'fulfilled' ? f.value.map((it) => ({ it, sub: subs[i] })) : []))
    .filter(({ it }) => !/megathread|daily|weekly|random discussion/i.test(it.title || ''))
    .map(({ it, sub }) => ({
      title: (it.title || '').trim(),
      snippet: stripHtml(it.content || it.contentSnippet || '').slice(0, 300),
      link: it.link,
      source: `r/${sub}`,
      date: it.isoDate ? Date.parse(it.isoDate) : it.pubDate ? Date.parse(it.pubDate) : null,
      category: guessCategory(it.title || '', sub === 'MalaysianPF' ? 'simpan' : null, 2),
      origin: 'Reddit',
      boost: 8,
      ...(imgFrom(it.content) ? { image: imgFrom(it.content) } : {}),
    }));
}

async function lowyat() {
  // Pilihan: tetapkan LOWYAT_RSS (URL suapan RSS forum Lowyat) sebagai secret/variable GitHub
  if (!process.env.LOWYAT_RSS) return [];
  const items = await fetchFeed(process.env.LOWYAT_RSS);
  if (!items.length) throw new Error('suapan kosong');
  return items.map((it) => ({
    title: stripHtml(it.title || ''),
    snippet: stripHtml(it.contentSnippet || '').slice(0, 300),
    link: it.link,
    source: 'Lowyat Kopitiam',
    date: it.pubDate ? Date.parse(it.pubDate) : null,
    category: guessCategory(it.title || '', null, 2),
    origin: 'Lowyat',
    boost: 5,
  }));
}

async function youtube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=MY&maxResults=30&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((v) => ({
    title: v.snippet.title,
    snippet: (v.snippet.description || '').replace(/\s+/g, ' ').slice(0, 200),
    link: `https://www.youtube.com/watch?v=${v.id}`,
    source: v.snippet.channelTitle,
    date: Date.parse(v.snippet.publishedAt),
    traffic: Number(v.statistics?.viewCount || 0),
    category: guessCategory(`${v.snippet.title} ${v.snippet.tags?.join(' ') || ''}`, null, 2),
    origin: 'YouTube',
    image: v.snippet.thumbnails?.medium?.url,
  }));
}

/**
 * Tanda topik "meletup" (baru muncul & cepat naik) dengan membandingkan data larian sebelumnya.
 * Menambah: first_seen, prev_score, rising, meletup
 */
export function markVelocity(items, prevItems = [], now = Date.now(), { max = 8 } = {}) {
  const hasPrev = prevItems.length > 0;
  const scores = items.map((i) => i.score).sort((a, b) => a - b);
  const pct = (p) => scores[Math.floor((scores.length - 1) * p)] ?? 0;
  const p85 = pct(0.85), p70 = pct(0.7);
  for (const it of items) {
    const prev = hasPrev ? prevItems.find((p) => similarity(p.title, it.title) >= 0.6) : null;
    it.first_seen = prev?.first_seen || new Date(now).toISOString();
    it.prev_score = prev ? prev.score : null;
    const ageH = (now - Date.parse(it.first_seen)) / 3600000;
    const pubH = it.published ? (now - Date.parse(it.published)) / 3600000 : 99;
    it.rising = prev ? it.score - prev.score >= 15 || (prev.score > 0 && it.score / prev.score >= 1.3) : false;
    // Tanpa data larian lepas, hanya isyarat kuat (banyak sumber / trafik tinggi & sangat baharu) dikira
    const strong = (it.sources?.length || 0) >= 3 || (it.traffic || 0) >= 20000;
    it.meletup = hasPrev
      ? (ageH <= 3 && pubH <= 6 && (strong || it.score >= p85)) || (it.rising && it.score >= p70)
      : pubH <= 4 && strong && it.score >= p70;
  }
  // Hadkan kepada topik terkuat sahaja
  items.filter((i) => i.meletup).sort((a, b) => b.score - a.score).slice(max).forEach((i) => { i.meletup = false; });
  return items;
}

/**
 * Dapatkan topik trending.
 * @param {string[]} categories - senarai kategori (default semua)
 * @param {number} limit - bilangan per kategori
 */
export async function getTrending(categories = Object.keys(CATEGORIES), limit = 10, { extras = false } = {}) {
  const errors = [];
  const [trends, ...newsLists] = await Promise.all([
    googleTrends().catch((e) => { errors.push(`Google Trends: ${e.message}`); return []; }),
    ...categories.map((c) => googleNews(c).catch((e) => { errors.push(`Google News (${c}): ${e.message}`); return []; })),
  ]);

  const result = {};
  categories.forEach((c, i) => {
    const pool = [...newsLists[i], ...trends.filter((t) => t.category === c)]
      .filter((it) => !isForeign(`${it.title} ${it.snippet || ''}`))
      .map((it) => ({ ...it, group: CATEGORIES[c].group }));
    result[c] = clusterAndScore(pool).slice(0, limit);
  });
  const out = { categories: result, errors, fetched_at: new Date().toISOString() };
  if (!extras) return out;

  // Sumber tambahan
  const sources = { 'Google News (umum)': googleNewsGeneral, Reddit: reddit, Lowyat: lowyat, YouTube: youtube };
  const extraLists = await Promise.all(Object.entries(sources).map(([name, fn]) =>
    fn().catch((e) => { errors.push(`${name}: ${e.message}`); return []; })));
  const extraItems = extraLists.flat().filter((it) => CATEGORIES[it.category] && !isForeign(`${it.title} ${it.snippet || ''}`));
  out.source_counts = Object.fromEntries(Object.keys(sources).map((n, i) => [n, extraLists[i].length]));

  // Senarai rata semua topik (dedupe merentas kategori)
  const flat = [];
  const add = (it) => {
    const dup = flat.find((f) => similarity(f.title, it.title) >= 0.6);
    if (dup) {
      dup.origins = [...new Set([...(dup.origins || []), ...(it.origins || [])])];
      dup.sources = [...new Set([...dup.sources, ...it.sources])].slice(0, 6);
      dup.score = Math.max(dup.score, it.score);
      return;
    }
    flat.push({ ...it });
  };
  Object.values(result).flat().forEach(add);
  clusterAndScore(extraItems.map((it) => ({ ...it, group: CATEGORIES[it.category].group }))).slice(0, 150).forEach(add);
  out.items = flat.sort((a, b) => b.score - a.score).slice(0, 300);
  return out;
}
