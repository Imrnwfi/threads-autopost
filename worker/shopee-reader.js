// Pembaca link Shopee — Cloudflare Worker (percuma).
// Baca nama, harga, penerangan & gambar produk daripada link Shopee Malaysia (termasuk link pendek s.shopee.com.my)
// dengan cara yang sama seperti pratonton link WhatsApp/Facebook (tag og: & JSON-LD).
//
// Pasang: dash.cloudflare.com → Workers & Pages → Create → Worker → tampal kod ini → Deploy.
// Guna:   https://<nama-worker>.<akaun>.workers.dev/?url=https://s.shopee.com.my/xxxx

const ALLOWED_HOSTS = /(^|\.)(shopee\.com\.my|shp\.ee|shope\.ee)$/i;
const ALLOWED_ORIGINS = ['https://imrnwfi.github.io', 'http://localhost:3000', 'http://localhost:4010'];
const UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.1 A',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
];
const CACHE_SECONDS = 6 * 3600;

function cors(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.github.io') ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(req, body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}`, ...cors(req) },
  });
}
const decode = (s = '') => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function meta(html, prop) {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return decode((a || b || [])[1] || '').trim();
}
function nameFromUrl(url) {
  try {
    const seg = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean)[0] || '');
    const m = seg.match(/^(.*)-i\.\d+\.\d+$/);
    return m ? m[1].replace(/[-_]+/g, ' ').trim() : '';
  } catch { return ''; }
}
function parse(html, finalUrl) {
  let name = meta(html, 'og:title') || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '');
  let description = meta(html, 'og:description') || meta(html, 'description');
  let image = meta(html, 'og:image');
  let price = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]);
      const list = Array.isArray(d) ? d : d['@graph'] || [d];
      const p = list.find((x) => x && x['@type'] === 'Product');
      if (!p) continue;
      name = name || p.name;
      description = description || p.description;
      image = image || (Array.isArray(p.image) ? p.image[0] : p.image);
      const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      if (o) price = price || o.price || o.lowPrice;
    } catch { /* abaikan */ }
  }
  name = String(name || '').replace(/\s*[|\-–]\s*Shopee\s*Malaysia\s*$/i, '').replace(/^Shopee\s*Malaysia\s*[|\-–]?\s*/i, '').trim();
  // Halaman generik / disekat
  if (!name || /^(shopee|shopee malaysia|log ?in|login|captcha)$/i.test(name) || /beli.*jual.*online/i.test(name)) name = '';
  if (!name) name = nameFromUrl(finalUrl);
  const ids = finalUrl.match(/-i\.(\d+)\.(\d+)/) || finalUrl.match(/\/product\/(\d+)\/(\d+)/);
  return {
    name: name.slice(0, 200),
    description: String(description || '').replace(/\s+/g, ' ').trim().slice(0, 1500),
    price: price ? `RM${String(price).replace(/^RM\s*/i, '')}` : '',
    image: image || '',
    shopid: ids?.[1] || '',
    itemid: ids?.[2] || '',
  };
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    const raw = new URL(req.url).searchParams.get('url');
    if (!raw) return json(req, { ok: true, service: 'shopee-reader', usage: '/?url=https://s.shopee.com.my/xxxx' });
    let target;
    try { target = new URL(raw); } catch { return json(req, { ok: false, error: 'URL tidak sah' }, 400); }
    if (!ALLOWED_HOSTS.test(target.hostname)) return json(req, { ok: false, error: 'Hanya link Shopee Malaysia dibenarkan' }, 400);

    const cache = caches.default;
    const key = new Request(`https://shopee-reader.cache/${encodeURIComponent(target.href)}`);
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { status: hit.status, headers: { ...Object.fromEntries(hit.headers), ...cors(req) } });

    const debug = new URL(req.url).searchParams.has('debug');
    const trace = [];
    // 1) Ikut redirect secara manual (link pendek → link produk)
    let finalUrl = target.href;
    for (let i = 0; i < 6; i++) {
      let res;
      try {
        res = await fetch(finalUrl, { redirect: 'manual', headers: { 'User-Agent': UAS[2], 'Accept': 'text/html' } });
      } catch (e) { trace.push({ step: 'redirect', url: finalUrl, error: String(e) }); break; }
      const loc = res.headers.get('location');
      trace.push({ step: 'redirect', url: finalUrl, status: res.status, location: loc });
      if (res.status >= 300 && res.status < 400 && loc) { finalUrl = new URL(loc, finalUrl).href; continue; }
      if (res.status === 200) {
        const html = await res.text();
        const m = html.match(/(?:http-equiv=["']refresh["'][^>]*url=|window\.location(?:\.href)?\s*=\s*["']|og:url["'][^>]*content=["'])([^"'>\s]+)/i);
        const next = m && decode(m[1]);
        if (next && next !== finalUrl && /shopee\.com\.my/.test(next) && i < 5) { trace.push({ step: 'html-redirect', to: next }); finalUrl = new URL(next, finalUrl).href; continue; }
      }
      break;
    }
    // Buka pautan "universal-link" → link produk sebenar
    try {
      const u = new URL(finalUrl);
      const redir = u.searchParams.get('redir') || u.searchParams.get('url');
      if (redir && /shopee\.com\.my/.test(redir)) finalUrl = decodeURIComponent(redir);
    } catch { /* abaikan */ }

    // 2) Baca halaman produk
    let best = null;
    for (const ua of UAS) {
      try {
        const res = await fetch(finalUrl, {
          redirect: 'follow',
          headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ms-MY,ms;q=0.9,en;q=0.8' },
        });
        const html = await res.text();
        const info = parse(html, res.url || finalUrl);
        trace.push({ step: 'page', ua: ua.slice(0, 20), status: res.status, url: res.url, len: html.length, title: (html.match(/<title[^>]*>([^<]*)/i) || [])[1]?.slice(0, 80), name: info.name });
        if (res.url) finalUrl = res.url;
        if (info.name && (!best || (info.description && !best.description))) best = info;
        if (best?.name && best.description) break;
      } catch (e) { trace.push({ step: 'page', ua: ua.slice(0, 20), error: String(e) }); }
    }
    // 3) Sandaran: nama daripada slug URL
    if (!best?.name) {
      const n = nameFromUrl(finalUrl);
      if (n) best = { ...(best || {}), name: n, description: best?.description || '', price: best?.price || '', image: best?.image || '', fromUrl: true };
    }
    const body = best?.name
      ? { ok: true, url: finalUrl, ...best }
      : { ok: false, url: finalUrl, name: nameFromUrl(finalUrl), error: 'Shopee tidak memulangkan maklumat produk' };
    if (debug) body.trace = trace;
    const out = json(req, body, 200, body.ok && !debug ? CACHE_SECONDS : 0);
    if (body.ok && !debug) ctx.waitUntil(cache.put(key, out.clone()));
    return out;
  },
};
