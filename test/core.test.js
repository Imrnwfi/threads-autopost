import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tap-'));

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

let trends, dbm;
before(async () => {
  trends = await import('../src/trends.js');
  dbm = await import('../src/db.js');
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

test('topik yang sudah digunakan ditanda & dilangkau', async () => {
  dbm.markTopicUsed('Cara semak status SARA');
  const t = await trends.pickTopic('bantuan');
  assert.notEqual(t.title, 'Cara semak status SARA');
  const { categories } = await trends.getTrending(['bantuan'], 10);
  assert.ok(categories.bantuan.find((x) => x.title === 'Cara semak status SARA').used);
});
