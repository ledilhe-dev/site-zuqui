const CACHE_NAME = 'check-diario-pwa-v167-comparativo-anual-v3';
const ASSET_MANIFEST = './assets/manifest.json';
const CORE_ASSETS = [
  './',
  './index.html',
  './config.js',
  ASSET_MANIFEST,
  './manifest.webmanifest',
  './assets/brand/logo-checkdiario-horizontal.svg',
  './assets/brand/logo-checkdiario-horizontal-dark.svg',
  './assets/brand/logo-checkdiario-icon.svg',
  './assets/brand/favicon.svg',
  './assets/vendor/cropperjs/cropper.min.css',
  './assets/vendor/cropperjs/cropper.min.js',
  './icon-192.png',
  './icon-512.png',
  './favicon-check-diario.svg',
  './logo-check-diario.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const response = await fetch(ASSET_MANIFEST, { cache: 'no-store' });
      if (!response.ok) throw new Error('Manifesto de módulos indisponível.');
      const moduleAssets = await response.json();
      await cache.addAll([...CORE_ASSETS, ...moduleAssets]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', cloned));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Módulos mudam independentemente do index.html. Busca a versão de rede
  // primeiro e usa o cache apenas quando estiver offline, evitando misturas
  // entre arquivos antigos e novos depois de uma publicação.
  if (requestUrl.pathname.includes('/assets/') || requestUrl.pathname.endsWith('/config.js')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
