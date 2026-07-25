const CACHE_NAME = 'run360x-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// Custom Offline HTML fallback page if no cache or network is available
const OFFLINE_FALLBACK_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RUN360X - Modo Offline Tático</title>
  <style>
    body {
      background-color: #020617;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .badge {
      background: #092e38;
      color: #22d3ee;
      border: 1px solid #06b6d4;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 20px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    h1 { font-size: 24px; font-weight: 900; margin: 0 0 10px 0; text-transform: uppercase; }
    p { color: #94a3b8; font-size: 14px; max-width: 400px; line-height: 1.5; margin: 0 0 24px 0; }
    button {
      background: linear-gradient(135deg, #06b6d4, #10b981);
      color: #020617;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 1px;
      cursor: pointer;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="badge">⚡ MODO OFFLINE TÁTICO</div>
  <h1>Sinal GPS / Rede Indisponível</h1>
  <p>O RUN360X está operando no modo de telemetria local. Seus dados e treinos salvos continuam seguros na memória do aparelho.</p>
  <button onclick="window.location.reload()">Reconectar Sistema</button>
</body>
</html>
`;

// Installation phase: Precaching core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[RUN360X SW] Pre-caching app shell e recursos estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation phase: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[RUN360X SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch phase: Offline-first with Stale-While-Revalidate strategy for assets and HTML Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests and browser extensions / dev websockets
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  if (request.url.includes('/vite') || request.url.includes('ws://') || request.url.includes('wss://')) return;

  // Navigation requests (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html').then((indexCached) => {
              if (indexCached) return indexCached;
              return new Response(OFFLINE_FALLBACK_HTML, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              });
            });
          });
        })
    );
    return;
  }

  // Static resources: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[RUN360X SW] Atendendo requisição do cache offline:', request.url, err);
        });

      // Serve from cache immediately if available, while updating cache in background
      return cachedResponse || fetchPromise || new Response('Offline', { status: 503 });
    })
  );
});

// Handle PWA Push Notifications & Tactical Alerts
self.addEventListener('push', (event) => {
  const data = event.data
    ? event.data.json()
    : { title: 'RUN360X Tático', body: 'Treino agendado ou novo desafio de bairro disponível!' };
  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'RUN360X Alerta', options)
  );
});

// Notification click behavior
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Message listener for manual SW controls from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


