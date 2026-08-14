/* RouteRig service worker: NETWORK-FIRST so fixes always reach the cab,
   cache only as offline fallback. Bump CACHE version when assets change. */
const CACHE = 'routerig-v8';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/fonts.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png',
  'vendor/markercluster/leaflet.markercluster.js',
  'vendor/markercluster/MarkerCluster.css',
  'vendor/fonts/barlow-latin-400-normal.woff2',
  'vendor/fonts/barlow-latin-400-italic.woff2',
  'vendor/fonts/barlow-latin-500-normal.woff2',
  'vendor/fonts/barlow-latin-600-normal.woff2',
  'vendor/fonts/barlow-latin-700-normal.woff2',
  'vendor/fonts/barlow-condensed-latin-500-normal.woff2',
  'vendor/fonts/barlow-condensed-latin-600-normal.woff2',
  'vendor/fonts/barlow-condensed-latin-700-normal.woff2',
  'js/config.js',
  'js/util.js',
  'js/geo.js',
  'js/nav.js',
  'js/icons.js',
  'js/data.js',
  'js/overpass.js',
  'js/fuel.js',
  'js/services.js',
  'js/routing.js',
  'js/drive.js',
  'js/ui.js',
  'js/voice.js',
  'js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) {
    return; // live data (tiles/APIs): straight to the network
  }
  /* network-first: always fresh code when online; cached shell when offline */
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match('./'))
      )
  );
});
