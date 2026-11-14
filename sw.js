
// Nowa wersja service workera przejmuje aplikację od razu,
// zamiast czekać, aż zamkniesz wszystkie okna.
self.addEventListener("install", function() {
    self.skipWaiting();
});

self.addEventListener("activate", function(event) {
    event.waitUntil(clients.claim());
});

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

    const isAlert = data.type === "alert";

    const title = data.title || "styknij. ♡";

    const options = {
        body: data.body || "Ktoś chce się z Tobą styknąć ♡",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: isAlert ? "styknij-alert" : "styknij-pending",
        renotify: isAlert,
        requireInteraction: isAlert,
        data: {
            url: "./"
        }
    };

    // Wibracja działa na Androidzie. iPhone ignoruje ten wzór
    // i używa własnego dźwięku/wibracji powiadomienia.
    if (isAlert) {
        options.vibrate = [300, 150, 300, 150, 300];
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    // Adres liczymy z miejsca, w którym stoi aplikacja (np. .../styknij/).
    // Pole "url" z powiadomienia celowo pomijamy: "/" prowadziłoby
    // na główną stronę github.io, a nie do aplikacji.
    const scope = self.registration.scope;
    const targetUrl = new URL("./", scope).href;

    event.waitUntil((async function() {
        const windowClients = await clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        // Jeśli aplikacja jest już otwarta, wystarczy ją wyciągnąć na wierzch.
        for (const client of windowClients) {
            if (client.url.startsWith(scope) && "focus" in client) {
                try {
                    await client.focus();
                    return;
                } catch (error) {
                    // przechodzimy do otwarcia nowego okna
                }
            }
        }

        if (clients.openWindow) {
            return clients.openWindow(targetUrl);
        }
    })());
});
