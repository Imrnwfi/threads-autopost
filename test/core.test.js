import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tap-'));
process.env.THREADS_ACCESS_TOKEN = 'TEST_TOKEN';
process.env.THREADS_USER_ID = '123';

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

const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  calls.push({ url, opts });
  const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('trends.google.com')) return new Response(TRENDS_XML);
  if (url.includes('news.google.com')) return new Response(NEWS_XML);
  if (url.endsWith('/123/threads')) return json({ id: 'C1' });
  if (url.includes('/C1?')) return json({ status: 'FINISHED' });
  if (url.endsWith('/123/threads_publish')) return json({ id: 'P1' });
  if (url.includes('/P1?')) return json({ permalink: 'https://www.threads.net/@x/post/abc' });
  return new Response('not found', { status: 404 });
};

let trends, threads, scheduler, dbm;
before(async () => {
  trends = await import('../src/trends.js');
  threads = await import('../src/threads.js');
  scheduler = await import('../src/scheduler.js');
  dbm = await import('../src/db.js');
});

test('guessCategory', () => {
  assert.equal(trends.guessCategory('Bayaran STR dan bantuan Madani'), 'bantuan');
  assert.equal(trends.guessCategory('Resepi nasi lemak viral'), 'food');
  assert.equal(trends.guessCategory('OpenAI lancar model ChatGPT baru'), 'ai');
  assert.equal(trends.guessCategory('Kod promo Shopee cashback'), 'voucher');
});

test('getTrending gabung tajuk serupa & beri skor', async () => {
  const { categories, errors } = await trends.getTrending(['bantuan'], 10);
  assert.deepEqual(errors, []);
  const list = categories.bantuan;
  assert.ok(list.length >= 2);
  const top = list[0];
  assert.match(top.title, /STR/i);
  assert.ok(top.sources.length >= 2, 'sumber digabung: ' + top.sources);
  assert.ok(!/ - Sinar Harian$/.test(top.title), 'nama akhbar dibuang');
});

test('publishText: container -> publish', async () => {
  calls.length = 0;
  const r = await threads.publishText('Hello Threads 👋');
  assert.equal(r.id, 'P1');
  assert.equal(r.permalink, 'https://www.threads.net/@x/post/abc');
  const create = calls.find((c) => c.url.endsWith('/123/threads'));
  assert.equal(create.opts.body.get('media_type'), 'TEXT');
  assert.equal(create.opts.body.get('text'), 'Hello Threads 👋');
});

test('publishText tolak teks > 500 aksara', async () => {
  await assert.rejects(threads.publishText('a'.repeat(501)), /500/);
});

test('publishPost kemas kini status & elak double post', async () => {
  const { db } = dbm;
  const id = db.prepare("INSERT INTO posts (text, status, topic) VALUES ('Ujian', 'scheduled', 'Topik ujian')").run().lastInsertRowid;
  const p = await scheduler.publishPost(id);
  assert.equal(p.status, 'posted');
  assert.equal(p.threads_id, 'P1');
  assert.ok(dbm.isTopicUsed('Topik ujian'));
  await assert.rejects(scheduler.publishPost(id), /sudah/);
});

test('guessCategory guna sempadan perkataan', () => {
  assert.equal(trends.guessCategory('Strategi industri automotif'), 'viral');
  assert.equal(trends.guessCategory('Tool AI terbaru untuk pelajar'), 'ai');
});
