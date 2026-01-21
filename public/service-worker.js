const CACHE_NAME = 'sales-tracker-cache-v3'
const OFFLINE_URLS = ['/', '/index.html', '/admin-mobile.js', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
      self.clients.claim()
    ])
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET') return
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)))
  }
})
