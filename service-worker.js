self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'AMR_PUSH_NOTIFICATION') return;

  const title = data.title || 'New session uploaded';
  const body = data.body || 'A new live session is now available.';
  const url = data.url || self.location.origin + '/index.html';
  const options = {
    body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    tag: data.tag || 'amr-session-upload',
    renotify: true,
    data: { url }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/index.html';
  const urlToOpen = new URL(targetUrl, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === urlToOpen.href && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.length) {
        return clients[0].focus();
      }
      return self.clients.openWindow(urlToOpen.href);
    })
  );
});
