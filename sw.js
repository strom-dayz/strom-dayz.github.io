/* Service worker: офлайн-режим и обновления.
   Меняешь код (html/css/js)? Увеличь VERSION на 1 И номер ?v= в index.html (они должны совпадать),
   чтобы телефоны подхватили обновление.
   Страница (index.html) берётся из сети, если она есть (до 3 секунд), иначе из кэша — так онлайн всегда свежая версия.
   Данные из /data: сначала сохранённая копия, свежая скачивается в фоне. */
const VERSION = 'v37';
const V = VERSION.slice(1);
const CACHE = 'dayz-guide-' + VERSION;
const SHELL = [
  './', 'index.html', 'css/style.css?v=' + V, 'js/app.js?v=' + V, 'js/icons.js?v=' + V, 'js/migrate.js?v=' + V, 'js/map.js?v=' + V, 'js/nav.js?v=' + V, 'manifest.json',
  'data/map.json?v=' + V, 'data/map-vec.json?v=' + V, 'data/map-poi.json?v=' + V, 'data/map-grid.json?v=' + V, 'img/map/chernarus.jpg?v=27', 'data/symptoms.json?v=' + V, 'data/patches.json?v=' + V, 'data/quiz.json?v=' + V, 'data/servers.json?v=' + V, 'data/srv.json?v=' + V,
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'fonts/russo-cyr.woff2', 'fonts/russo-lat.woff2', 'fonts/onest-cyr.woff2', 'fonts/onest-lat.woff2',
  'data/meta.json?v=' + V, 'data/first15.json?v=' + V, 'data/food.json?v=' + V, 'data/diseases.json?v=' + V,
  'data/injuries.json?v=' + V, 'data/crafting.json?v=' + V, 'data/fire.json?v=' + V, 'data/infected.json?v=' + V,
  'data/weapons.json?v=' + V, 'data/slang.json?v=' + V,
  'data/controls.json?v=' + V, 'data/hud.json?v=' + V, 'data/loadout.json?v=' + V, 'data/week.json?v=' + V, 'data/loot.json?v=' + V, 'data/players.json?v=' + V
];

self.addEventListener('install', (e) => {
  // мимо HTTP-кэша браузера; один недоступный файл не ломает всё обновление
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => fetch(new Request(u, { cache: 'reload' }))
      .then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dayz-guide-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // страница: сначала сеть (с таймаутом), потом кэш
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res && res.ok) cache.put('index.html', res.clone()); return res; }).catch(() => null);
      const timeout = new Promise((r) => setTimeout(() => r(null), 3000));
      const res = await Promise.race([net, timeout]);
      if (res) return res;
      const cached = await cache.match('index.html') || await cache.match('./');
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) || Response.error();
    }));
    return;
  }

  // подробные плитки карты: свой кэш, переживает обновления
  if (/\/img\/map\/t\//.test(req.url)) {
    e.respondWith(caches.open('dayz-tiles-1').then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
    }).catch(() => Response.error()));
    return;
  }

  // остальное: кэш + обновление в фоне (js/css с ?v= — по точному адресу, данные — без учёта параметров)
  const versioned = /[?&]v=/.test(req.url);
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: !versioned });
      const network = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      // нет сети и нет точной версии — лучше прежняя копия, чем ошибка
      return (await network) || (await cache.match(req, { ignoreSearch: true })) || Response.error();
    })
  );
});
