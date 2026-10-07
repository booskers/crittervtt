// Critter VTT kept on the device, so it opens at once (the home-screen app, the Android app, a browser) even on a poor
// connection: what was kept is shown straight away and a fresh copy is fetched alongside it, for next time. The live
// table (the WebSocket, /stats, /ddb, /health) always goes to the Homebase and is never kept. build.mjs puts the
// version in VERSION, so each release starts over with its own copy.
const VERSION = '__VERSION__', KEEP = 'critter-' + VERSION;
const SHELL = ['./', 'homebase.js', 'manifest.webmanifest', 'manifest-player.webmanifest', 'favicon.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
// three.js and cannon.js (the dice) and the fonts come from elsewhere; they're kept too, as they never change at an address
const ELSEWHERE = /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const LIVE = /^\/(ws|stats|ddb|health|api)(\/|$)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(KEEP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('critter-') && k !== KEEP && k !== 'critter-elsewhere').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (ELSEWHERE.test(r.url)) {
    e.respondWith(caches.open('critter-elsewhere').then(async c => (await c.match(r)) || fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; })));
    return;
  }
  if (u.origin !== location.origin || LIVE.test(u.pathname)) return;
  // the page itself, whatever its ?app=player or #code: one kept copy
  const key = r.mode === 'navigate' ? new URL('./', location).href : u.origin + u.pathname;
  e.respondWith(caches.open(KEEP).then(async c => {
    const kept = await c.match(key);
    const fresh = fetch(r).then(res => { if (res.ok && res.type === 'basic') c.put(key, res.clone()); return res; });
    if (kept) { e.waitUntil(fresh.catch(() => {})); return kept; }
    return fresh;
  }));
});
// a tap on "Your turn" brings Critter VTT to the front (or opens it)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});
