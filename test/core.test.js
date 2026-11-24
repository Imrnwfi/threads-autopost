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

test('guessCategory', () => {
  assert.equal(trends.guessCategory('Bayaran STR dan bantuan Madani'), 'bantuan');
  assert.equal(trends.guessCategory('Resepi nasi lemak viral'), 'food');
  assert.equal(trends.guessCategory('OpenAI lancar model ChatGPT baru'), 'ai');
  assert.equal(trends.guessCategory('Kod promo Shopee cashback'), 'voucher');
});

test('guessCategory guna sempadan perkataan', () => {
  assert.equal(trends.guessCategory('Strategi industri automotif'), 'viral');
  assert.equal(trends.guessCategory('Tool AI terbaru untuk pelajar'), 'ai');
});

test('getTrending gabung tajuk serupa & beri skor', async () => {
  const { categories, errors } = await trends.getTrending(['bantuan'], 10);
  assert.deepEqual(errors, []);
  const top = categories.bantuan[0];
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
  assert.equal(Object.keys(data.categories).length, 6);
  assert.equal(data.labels.bantuan.label, 'Bantuan Kerajaan');
});

test('matchesCategory buang tajuk tersasar', () => {
  assert.equal(trends.matchesCategory('Dua maut dalam insiden letupan di Hanoi', 'food'), false);
  assert.equal(trends.matchesCategory('Kedai nasi lemak viral di Kuantan', 'food'), true);
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
