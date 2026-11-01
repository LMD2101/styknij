self.addEventListener("push", function(event) {
    let data = {};

    try {
        data = event.data.json();
    } catch (error) {
        data = {
            title: "styknij. ♡",
            body: "Ktoś chce się z Tobą styknąć 🤍"
        };
    }

    const title = data.title || "styknij. ♡";

    const options = {
        body: data.body || "Ktoś chce się z Tobą styknąć 🤍",
        data: { url: data.url || "./" }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {
            for (const client of clientList) {
                if ("focus" in client) return client.focus();
            }

            if (clients.openWindow) return clients.openWindow("./");
        })
    );
});
