/* Farestorm production cache. Bump this version when the cache format changes. */
const CACHE = 'farestorm-shell-v2';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
const assetURL = (path, base) => {
  try {
    const url = new URL(path, base);
    return url.origin === self.location.origin && !url.pathname.endsWith('/sw.js') ? url.href : null;
  } catch { return null; }
};
async function precache() {
  const cache = await caches.open(CACHE);
  const queue = CORE.map((path) => new URL(path, self.location.origin).href);
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    if (visited.size > 240) throw new Error('Farestorm cache asset limit exceeded.');
    const response = await fetch(new Request(url, { cache: 'reload' }));
    if (!response.ok) throw new Error(`Farestorm cache could not fetch ${url}: ${response.status}`);
    const type = response.headers.get('content-type') ?? '';
    if (new URL(url).pathname.startsWith('/assets/') && /html/.test(type)) throw new Error(`The host returned HTML instead of an asset: ${url}`);
    await cache.put(url, response.clone());
    if (/html|javascript|css/.test(type)) {
      const source = await response.text();
      // Vite emits same-origin hashed assets, CSS font URLs and relative module chunks.
      const matches = source.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^\s'"\)]+)["']?\)|["']((?:\.\.?\/|\/assets\/)[^"'\s]+\.(?:js|css|png|webp|avif|jpe?g|woff2?|svg|wasm))["']/g);
      for (const match of matches) {
        const path = match[1] || match[2] || match[3];
        if (!path || /[${}<>]/.test(path) || /^(?:data:|https?:\/\/)/.test(path)) continue;
        const asset = assetURL(path, url);
        if (asset && !visited.has(asset)) queue.push(asset);
      }
    }
  }
}
self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('farestorm-') && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('The host did not return the game shell.');
        await cache.put('/index.html', response.clone());
        return response;
      } catch {
        return await cache.match('/index.html') || new Response('Farestorm has not finished downloading. Reconnect and load the game once to prepare offline play.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || CORE.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE), cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
