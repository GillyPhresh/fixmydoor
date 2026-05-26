self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
