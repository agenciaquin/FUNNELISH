/* QuinChat — Service Worker
 * Hace la app instalable (PWA) y recibe las notificaciones push.
 * No cachea el panel: siempre pide datos frescos al servidor.
 */

const VERSION = 'quinchat-v1';

self.addEventListener('install', (event) => {
  // Activar la versión nueva de inmediato, sin esperar a cerrar pestañas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar cachés viejos de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ── Notificaciones push ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'QuinChat', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'QuinChat';
  const options = {
    body: data.body || 'Tienes un mensaje nuevo.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'quinchat-mensaje',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: enfocar la app si ya está abierta, si no, abrirla
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clientes) {
        if ('focus' in c) {
          if ('navigate' in c) {
            try { await c.navigate(destino); } catch (e) { /* ignorar */ }
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })()
  );
});
