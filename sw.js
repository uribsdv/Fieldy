// Fieldy service worker — v2
// Two jobs: (1) receive Web Push messages from the Cloudflare Worker and show
// them as notifications, even when the app is closed; (2) open the right
// screen when a notification is tapped. It deliberately has no fetch handler:
// the old one only re-issued every request unchanged, which adds latency
// (Chrome flags such "no-op" handlers) and buys nothing without caching.
const SW_VERSION = '2026.09.10-3'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (err) { d = { body: e.data ? e.data.text() : '' } }
  const title = d.title || 'Fieldy'
  const opts = {
    body: d.body || '',
    icon: '/Fieldy/icon-192-1.png',
    badge: '/Fieldy/icon-192-1.png',
    dir: 'rtl',
    lang: 'he',
    data: { url: d.url || '/Fieldy/' },
  }
  if (d.tag) { opts.tag = d.tag; opts.renotify = true }
  e.waitUntil(self.registration.showNotification(title, opts))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/Fieldy/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.indexOf('/Fieldy') !== -1 && 'focus' in c) {
        if ('navigate' in c) c.navigate(url)
        return c.focus()
      }
    }
    return self.clients.openWindow(url)
  }))
})
