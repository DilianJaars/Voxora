// Minimal service worker so Voxora can be installed as an app. Offline audio is stored by the page itself (Cache API).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
