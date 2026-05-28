const CACHE_NAME = "fixmydoor-v3";
const URLS_TO_CACHE = [
  "/",
  "/admin",
  "/admin/notify",
  "/door-repair",
  "/entry-door-installation",
  "/furniture-repair",
  "/door-hardware",
  "/manifest.json",
  "/admin-manifest.json",
  "/icons/main-icon-72x72.png",
  "/icons/main-icon-96x96.png",
  "/icons/main-icon-128x128.png",
  "/icons/main-icon-192x192.png",
  "/icons/main-icon-512x512.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  const isStaticAsset = /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|json|xml|mp4|webm|ogg)$/i.test(requestUrl.pathname);

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
              cache.put("/", networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => (
          (await caches.match(event.request)) ||
          (await caches.match("/")) ||
          new Response("FixMyDoor Services is offline. Please reconnect and try again.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          })
        ))
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });

        return cachedResponse || networkFetch;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const origin = self.location.origin;
    const absoluteUrl = new URL(targetUrl, origin).toString();

    for (const client of clients) {
      if ("focus" in client && client.url.startsWith(origin)) {
        await client.focus();
        if ("navigate" in client) {
          await client.navigate(absoluteUrl);
        }
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(absoluteUrl);
    }
  })());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "FixMyDoor Services",
    message: "You have a new FixMyDoor Services update.",
    url: "/"
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.message = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "FixMyDoor Services", {
      body: payload.message || "You have a new FixMyDoor Services update.",
      icon: payload.icon || "/icons/main-icon-192x192.png",
      badge: payload.badge || "/icons/main-icon-96x96.png",
      tag: "fixmydoor-services-update",
      renotify: true,
      silent: false,
      timestamp: Date.now(),
      vibrate: [180, 80, 180],
      data: { url: payload.url || "/" }
    })
  );
});
