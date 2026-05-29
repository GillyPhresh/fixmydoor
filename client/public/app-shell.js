(function () {
  var isAdminApp = window.location.pathname.indexOf("/admin") === 0;
  var manifest = document.getElementById("fixmydoor-manifest");
  var appName = document.querySelector('meta[name="application-name"]');
  var appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  var appleIcon = document.getElementById("fixmydoor-apple-touch-icon");
  var themeColor = document.querySelector('meta[name="theme-color"]');
  var robots = document.querySelector('meta[name="robots"]');

  if (manifest) {
    manifest.setAttribute("href", isAdminApp ? "/admin-manifest.json" : "/manifest.json");
  }
  if (appName) {
    appName.setAttribute("content", isAdminApp ? "FixMyDoor Admin Dashboard" : "FixMyDoor Services");
  }
  if (appleTitle) {
    appleTitle.setAttribute("content", isAdminApp ? "FixMyDoor Admin" : "FixMyDoor");
  }
  if (appleIcon) {
    appleIcon.setAttribute("href", isAdminApp ? "/icons/admin-icon-v2-192x192.png" : "/icons/main-icon-v2-192x192.png");
  }
  if (themeColor) {
    themeColor.setAttribute("content", isAdminApp ? "#2F241C" : "#6B4423");
  }
  if (robots && isAdminApp) {
    robots.setAttribute("content", "noindex, nofollow");
  }
})();

(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js")
      .then(function (reg) {
        console.log("FixMyDoor SW registered:", reg.scope);
        reg.update();
        window.setInterval(function () {
          reg.update();
        }, 60 * 60 * 1000);

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(function (err) {
        console.log("SW registration failed:", err);
      });
  });

  var refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
})();
