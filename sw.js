
const CACHE_NAME = 'megaclean-v4';
const CACHE_STATIC = [
  '/horas/',
  '/horas/index.html',
  '/horas/manifest.json',
  '/horas/icon-192.png',
  '/horas/icon-512.png',
  // Fuentes Google (se cachean dinámicamente en runtime)
];

// Recursos externos que también se cachean al usarse
const CACHE_EXTERNAL_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com', // Firebase SDK
];

// ── INSTALL: cachear recursos estáticos propios ──
self.addEventListener('install', e => {
  console.log('[SW] Instalando v4...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_STATIC))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en install:', err))
  );
});

// ── ACTIVATE: limpiar cachés viejos ──
self.addEventListener('activate', e => {
  console.log('[SW] Activando v4...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia por tipo de recurso ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firestore API → siempre network (nunca cachear datos de Firestore)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com')) {
    return; // dejar pasar al browser normal
  }

  // Recursos propios (HTML, íconos, manifest) → Cache First, fallback network
  if (url.hostname === 'megaclean-art.github.io' || url.hostname === 'localhost') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // Fallback: si es navegación, devolver el index cacheado
          if (e.request.mode === 'navigate') {
            return caches.match('/horas/') || caches.match('/horas/index.html');
          }
        });
      })
    );
    return;
  }

  // Fuentes y SDKs externos → Cache First (se cachean al primer uso)
  const esExterno = CACHE_EXTERNAL_ORIGINS.some(o => url.hostname.includes(o));
  if (esExterno) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => null);
      })
    );
    return;
  }
});
