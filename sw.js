
self.addEventListener("push", function(event) {
    let data = {};

    try {
        data = event.data.json();
    } catch (error) {
        data = {
            title: "styknij. ♡",
            body: "Ktoś chce się z Tobą styknąć ♡"
        };
    }

    const title = data.title || "styknij. ♡";

    const options = {
        body: data.body || "Ktoś chce się z Tobą styknąć ♡",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: "styknij-pending",
        renotify: false,
        data: {
            url: "./"
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    // Otwiera stronę aplikacji, a nie główną stronę GitHuba.
    const targetUrl = new URL("./", self.registration.scope).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {
            for (const client of clientList) {
                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
