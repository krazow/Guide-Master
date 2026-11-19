// Service worker: offline-first app shell, runtime-cached Google Fonts and illustrations.
// tools/build.py keeps VERSION in step with GAME.version, so every release replaces the old cache.
const CACHE_PREFIX = 'guidemaster-';
const VERSION = CACHE_PREFIX + '1.18.0';
const FONTS = CACHE_PREFIX + 'fonts';
// Illustrations (art/, see art/README.md) are never precached: each image is cached the first time it is shown, in its own cache
// that outlives releases (the URLs carry ?v=<content hash>) and keeps only the ART_MAX most recently added images.
const ART = CACHE_PREFIX + 'art';
const ART_MAX = 60;
const isArt = url => /\/art\/[^?]+\.(png|webp|jpe?g)$/i.test(url.pathname);
async function trimArt(c) {
  const keys = await c.keys();
  for (let i = 0; i < keys.length - ART_MAX; i++) await c.delete(keys[i]);
}
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/fraunces-latin-600-normal.woff2',
  // the iPhone/iPad how-to page (src/js/41-install.js opens it) and its video, so they work offline too
  'install/ios.html', 'install/ios-add-to-home.mp4', 'install/ios-poster.jpg'];
// The app's own page is index.html; any other page (install/ios.html) is cached under its own URL.
const isAppPage = url => /\/(index\.html)?$/.test(url.pathname);
// Safari plays video only with byte-range (206) answers: cut the cached file to the range asked for.
async function ranged(req, res) {
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m || !res || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
  return new Response(buf.slice(start, end + 1), {status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes'}});
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== VERSION && k !== FONTS && k !== ART).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: cache after the first online load so the game looks right offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Illustrations: cache first, fetched and stored on first use (runtime cache, size-capped).
  if (isArt(url)) {
    e.respondWith(caches.open(ART).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) { await c.put(req, r.clone()); trimArt(c); }
      return r;
    }));
    return;
  }
  // Pages: network first (picks up updates), fall back to the cached copy offline (the game's shell for the app's own page).
  if (req.mode === 'navigate') {
    const app = isAppPage(url);
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(app ? 'index.html' : req, copy)); }
      return r;
    }).catch(async () => (!app && await caches.match(req, {ignoreSearch: true})) || caches.match('index.html', {ignoreSearch: true})));
    return;
  }
  // Video: from the cache, answering byte ranges (the network if it isn't cached yet).
  if (/\.mp4$/i.test(url.pathname)) {
    e.respondWith(caches.match(req.url, {ignoreSearch: true}).then(hit => hit ? ranged(req, hit) : fetch(req)));
    return;
  }
  // Everything else: cache first.
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  })));
});
