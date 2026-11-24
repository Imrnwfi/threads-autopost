import { test, before } from 'node:test';
import assert from 'node:assert/strict';


const now = new Date().toUTCString();
const TRENDS_XML = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel><title>Daily</title>
<item><title>str fasa 4</title><ht:approx_traffic>50K+</ht:approx_traffic><pubDate>${now}</pubDate>
<ht:news_item><ht:news_item_title>Bayaran STR Fasa 4 mula dikreditkan esok</ht:news_item_title><ht:news_item_url>https://example.com/str</ht:news_item_url><ht:news_item_source>Berita Harian</ht:news_item_source></ht:news_item></item>
</channel></rss>`;
const NEWS_XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>News</title>
<item><title>Bayaran STR Fasa 4 dikreditkan mulai esok - Sinar Harian</title><link>https://example.com/a</link><pubDate>${now}</pubDate><source url="https://sinarharian.com.my">Sinar Harian</source></item>
<item><title>STR Fasa 4: bayaran dikreditkan mulai esok kepada penerima - Harian Metro</title><link>https://example.com/b</link><pubDate>${now}</pubDate><source url="https://hmetro.com.my">Harian Metro</source></item>
<item><title>Cara semak status SARA - Kosmo</title><link>https://example.com/c</link><pubDate>${now}</pubDate><source url="https://kosmo.com.my">Kosmo</source></item>
</channel></rss>`;

globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes('trends.google.com')) return new Response(TRENDS_XML);
  if (url.includes('news.google.com')) return new Response(NEWS_XML);
  return new Response('not found', { status: 404 });
};

let trends;
before(async () => {
  trends = await import('../lib/trends.js');
});

test('guessCategory: kewangan / bantuan / e-wallet sahaja', () => {
  assert.equal(trends.guessCategory('Bayaran STR fasa 4 dan bantuan Madani'), 'tunai');
  assert.equal(trends.guessCategory('Dividen ASB 2026 diumumkan'), 'pelaburan');
  assert.equal(trends.guessCategory('Review app StashAway vs Versa'), 'applabur');
  assert.equal(trends.guessCategory('10 tips jimat duit gaji bulanan'), 'simpan');
  assert.equal(trends.guessCategory('Kod promo TNG eWallet cashback RM5'), 'promo');
  assert.equal(trends.guessCategory('Cara tuntut kredit percuma eMadani'), 'percuma');
  assert.equal(trends.guessCategory('Amaran: scam pautan palsu curi akaun bank'), 'scam');
  assert.equal(trends.guessCategory('BUDI95 harga RON95 baharu'), 'subsidi');
});

test('guessCategory: singkatan ikut huruf besar & sumber umum perlu 2 isyarat', () => {
  assert.equal(trends.guessCategory('Sara Tendulkar to marry Rajveer Deol?'), null);
  assert.equal(trends.guessCategory('Molly-Mae Hague raising her children'), null);
  assert.equal(trends.guessCategory('Kedai runcit di pedalaman layak sertai SARA'), 'tunai');
  assert.equal(trends.guessCategory('Duit MAE boleh guna untuk bayar tol'), 'tipsewallet');
  assert.equal(trends.guessCategory('MARA arah tindakan segera isu makanan di MRSM'), null);
  assert.equal(trends.guessCategory('Kerja keras membuahkan hasil', null, 2), null);
  assert.equal(trends.guessCategory('Bayaran STR fasa 4 bermula, semak status', null, 2), 'tunai');
});

test('isMalaysianSource: hanya penerbit Malaysia', () => {
  assert.equal(trends.isMalaysianSource('https://www.hmetro.com.my/x'), true);
  assert.equal(trends.isMalaysianSource('https://www.malaymail.com/news/x'), true);
  assert.equal(trends.isMalaysianSource('https://kwsp.gov.my/x'), true);
  assert.equal(trends.isMalaysianSource('https://inshorts.com/x'), false);
  assert.equal(trends.isMalaysianSource('https://vnexpress.net/x'), false);
});

test('isMalay: hanya tajuk Bahasa Melayu', () => {
  assert.equal(trends.isMalay('Bayaran STR Fasa 4 dikreditkan mulai esok'), true);
  assert.equal(trends.isMalay('Bursa Malaysia Kekal Tinggi Pada Tengah Hari'), true);
  assert.equal(trends.isMalay("MAE Tabung Daily Bonus Sudah Kembali"), true);
  assert.equal(trends.isMalay('Bursa Malaysia rebounds to snap five-day losing streak'), false);
  assert.equal(trends.isMalay('LHDN targets net direct tax collection of RM199bil for 2027'), false);
  assert.equal(trends.isMalay('PayerMax, ShopeePay to expand partnership in digital payments'), false);
});

test('isForeign buang berita luar negara', () => {
  assert.equal(trends.isForeign('EPF UPI withdrawals may begin by December | Inshorts'), true);
  assert.equal(trends.isForeign('EPF: Monthly income from Rs 50 lakh at retirement'), true);
  assert.equal(trends.isForeign('REG - Living REIT PLC - Appointment of Director'), true);
  assert.equal(trends.isForeign('Bursa Malaysia rebounds to snap losing streak'), false);
  assert.equal(trends.isForeign('Singapore REIT listed on Bursa Malaysia'), false);
});

test('guessCategory buang topik luar skop & guna sempadan perkataan', () => {
  assert.equal(trends.guessCategory('Resepi nasi lemak viral di Kuantan'), null);
  assert.equal(trends.guessCategory('Pasukan bola sepak menang perlawanan'), null);
  assert.equal(trends.guessCategory('Strategi industri automotif'), null);
  assert.equal(trends.guessCategory('Amaran hujan berterusan di Kelantan, Terengganu hingga Jumaat'), null);
  assert.equal(trends.guessCategory('Cara semak status STR'), 'tunai');
});

test('getTrending gabung tajuk serupa & beri skor', async () => {
  const { categories, errors } = await trends.getTrending(['tunai'], 10);
  assert.deepEqual(errors, []);
  const top = categories.tunai[0];
  assert.equal(top.group, 'bantuan');
  assert.match(top.title, /STR/i);
  assert.ok(top.sources.length >= 2, 'sumber digabung: ' + top.sources);
  assert.ok(!/ - Sinar Harian$/.test(top.title), 'nama akhbar dibuang');
});

test('fetch-trends menulis fail JSON untuk laman', async () => {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tpg-')), 'trends.json');
  const mock = path.join(path.dirname(out), 'mock.mjs');
  fs.writeFileSync(mock, `const N=${JSON.stringify(NEWS_XML)};const T=${JSON.stringify(TRENDS_XML)};globalThis.fetch=async(u)=>new Response(String(u).includes('trends.google')?T:N);`);
  execFileSync(process.execPath, ['--import', mock, 'scripts/fetch-trends.mjs', out]);
  const data = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.ok(data.fetched_at);
  assert.equal(Object.keys(data.categories).length, Object.keys(trends.CATEGORIES).length);
  assert.equal(data.labels.tunai.group, 'bantuan');
  assert.equal(data.groups.ewallet.label, 'E-Wallet');
});

test('matchesCategory buang tajuk tersasar', () => {
  assert.equal(trends.matchesCategory('Dua maut dalam insiden letupan di Hanoi', 'promo'), false);
  assert.equal(trends.matchesCategory('Kod promo GrabPay cashback hujung minggu', 'promo'), true);
});

test('ai.js: nameFromUrl & extractJson', async () => {
  const ai = await import('../site/js/ai.js');
  assert.equal(ai.nameFromUrl('https://shopee.com.my/Blender-Mudah-Alih-600ml-USB-i.123.456?sp_atk=x'), 'Blender Mudah Alih 600ml USB');
  assert.equal(ai.nameFromUrl('https://s.shopee.com.my/AbC123'), '');
  assert.deepEqual(ai.extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('ai.js: generate affiliate letak link dalam komen & #affiliate', async () => {
  const ai = await import('../site/js/ai.js');
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ variants: [{ parts: ['Hook', 'Isi', 'Link kat komen 👇'], comment: 'Beli sini: {LINK}' }, { parts: ['Satu'], comment: '' }] }) }] } }] }));
  try {
    const { variants: v } = await ai.generate({ provider: 'gemini', apiKey: 'k' }, {
      mode: 'affiliate', format: 'thread', parts: 3, count: 2, disclosure: true,
      product: { link: 'https://shopee.com.my/x-i.1.2', name: 'X' },
    });
    assert.equal(v[0].comment, 'Beli sini: https://shopee.com.my/x-i.1.2');
    assert.match(v[0].parts[2], /#affiliate/);
    assert.match(v[1].comment, /https:\/\/shopee\.com\.my\/x-i\.1\.2/);
    assert.ok(!v[0].parts.join(' ').includes('https://'), 'tiada link dalam post');
  } finally { globalThis.fetch = real; }
});

test('markVelocity tanda topik baru & naik', async () => {
  const now = Date.parse('2026-11-24T10:00:00Z');
  const items = [
    { title: 'Topik lama naik mendadak hari ini', score: 90, sources: ['a', 'b'], published: '2026-11-24T08:00:00Z' },
    { title: 'Topik baharu muncul dengan banyak sumber', score: 60, sources: ['a', 'b', 'c'], published: '2026-11-24T09:30:00Z' },
    { title: 'Topik biasa sahaja', score: 20, sources: ['a'], published: '2026-11-23T09:30:00Z' },
  ];
  const prev = [
    { title: 'Topik lama naik mendadak hari ini', score: 50, first_seen: '2026-11-24T02:00:00Z' },
    { title: 'Topik biasa sahaja', score: 20, first_seen: '2026-11-23T10:00:00Z' },
  ];
  trends.markVelocity(items, prev, now);
  assert.equal(items[0].rising, true);
  assert.equal(items[0].meletup, true);
  assert.equal(items[1].meletup, true);
  assert.equal(items[2].meletup, false);
  assert.equal(items[2].first_seen, '2026-11-23T10:00:00Z');
});

test('data.js: acara jualan & cuti', async () => {
  const d = await import('../site/js/data.js');
  const ev = d.upcomingEvents(new Date(2026, 10, 24), 40);
  const names = ev.map((e) => e.name);
  assert.ok(names.includes('Black Friday'));
  assert.equal(ev.find((e) => e.name === 'Black Friday').date, '2026-11-27');
  assert.ok(names.includes('12.12 Sale'));
  assert.ok(names.includes('Krismas'));
  assert.equal(d.daysUntil('2026-12-12', new Date(2026, 10, 24)), 18);
});

test('ai.js: firstUrl dari teks kongsi Shopee', async () => {
  const ai = await import('../site/js/ai.js');
  assert.equal(ai.firstUrl('Check out Blender Mini for RM29! https://s.shopee.com.my/AbC12.'), 'https://s.shopee.com.my/AbC12');
});

test('ai.js: parseShareText asingkan link, nama & harga', async () => {
  const ai = await import('../site/js/ai.js');
  assert.deepEqual(ai.parseShareText('Check out Blender Mini 600ml for RM29.90. Get it on Shopee now! https://s.shopee.com.my/AbC12'),
    { link: 'https://s.shopee.com.my/AbC12', name: 'Blender Mini 600ml', price: 'RM29.90' });
  const m = ai.parseShareText('Lihat Periuk Nasi Elektrik 1.8L dengan harga RM59.00 di Shopee! https://s.shopee.com.my/XyZ9');
  assert.equal(m.link, 'https://s.shopee.com.my/XyZ9');
  assert.equal(m.name, 'Periuk Nasi Elektrik 1.8L');
  assert.equal(m.price, 'RM59.00');
  assert.deepEqual(ai.parseShareText('https://s.shopee.com.my/AbC12'), { link: 'https://s.shopee.com.my/AbC12', name: '', price: '' });
});
