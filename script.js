
// ===================================
// KONFIGURACJA
// ===================================

// PRZEPISZ TU SWOJE DOTYCHCZASOWE WARTOŚCI!
const SUPABASE_URL = "https://cyrrxgyqyahnxjbvgqmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_6eq2OFDAgjM880ulznbA6w_aHQLejom";
const VAPID_PUBLIC_KEY = "BE9LN658qu3-4qMbATBP6TYBKYVHx8zL9Aus08t90m8N_ybg6B_skW0GhvQ72svGF5O3xH921igvcGcuWL-_1do";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ===================================
// ELEMENTY STRONY
// ===================================

const content = document.querySelector(".content");
const touchButton = document.querySelector("#touchButton");
const message = document.querySelector("#message");

let currentUser = null;
let currentPair = null;
let partnerId = null;
let partnerName = null;
let channel = null;
let swRegistration = null;
let refreshInProgress = false;
let lastAcceptedIds = new Set();
let lastDeclinedIds = new Set();
let pairCheckTimer = null;

// ===================================
// PANEL APLIKACJI
// ===================================

const setup = document.createElement("div");
setup.className = "setup";
content.prepend(setup);

function showSetup(html) {
    setup.innerHTML = html;
}

function showMessage(text) {
    message.textContent = text;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ===================================
// DODATKOWE STYLE
// ===================================

const extraStyles = document.createElement("style");

extraStyles.textContent = `
.setup {
    width: 100%;
    margin-top: 20px;
    text-align: center;
}

.setup button,
.action-button {
    border: none;
    border-radius: 18px;
    padding: 12px 17px;
    margin: 5px;
    background: #641f35;
    color: white;
    font-size: 14px;
    cursor: pointer;
}

.setup input {
    padding: 13px;
    border: 1px solid #d9a6ae;
    border-radius: 12px;
    margin: 8px;
    max-width: 220px;
    background: white;
    color: #603c46;
}

.setup p {
    color: #a58b8e;
    margin: 9px 0;
    line-height: 1.5;
}

.setup h3 {
    color: #641f35;
    margin-bottom: 10px;
}

#incomingRequest {
    width: 100%;
    margin-top: 18px;
    padding: 15px;
    border-radius: 18px;
    background: #f5e5e3;
    color: #641f35;
}

.request-card {
    background: #fff9f0;
    border-radius: 14px;
    padding: 13px;
    margin-top: 10px;
}

.request-card p {
    color: #603c46;
}

.request-count {
    display: inline-block;
    min-width: 26px;
    padding: 5px 9px;
    margin-left: 5px;
    border-radius: 20px;
    background: #641f35;
    color: white;
    font-weight: bold;
}

.request-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 5px;
}

.secondary-button {
    background: #d9a6ae !important;
    color: #481526 !important;
}

.pending-box {
    background: #f5e5e3;
    border-radius: 16px;
    padding: 14px;
    margin-top: 15px;
    color: #641f35;
}

.pending-box p {
    color: #603c46;
}

.small-text {
    font-size: 12px;
    color: #a58b8e;
}

.touching {
    animation: touchAnimation 0.8s ease-in-out;
}

@keyframes touchAnimation {
    0% { transform: scale(1); }
    40% { transform: scale(1.12); }
    100% { transform: scale(1); }
}
`;

document.head.appendChild(extraStyles);

// ===================================
// LOGOWANIE ANONIMOWE
// ===================================

async function login() {
    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError) {
        showMessage("Problem z sesją: " + sessionError.message);
        return false;
    }

    if (sessionData.session) {
        currentUser = sessionData.session.user;
        return true;
    }

    const { data, error } =
        await db.auth.signInAnonymously();

    if (error) {
        showMessage("Nie udało się połączyć: " + error.message);
        return false;
    }

    currentUser = data.user;
    return true;
}

// ===================================
// WYBÓR PROFILU
// ===================================

async function chooseProfile(name) {
    localStorage.setItem("styknij_profile", name);

    showSetup("<p>Łączę z aplikacją...</p>");

    const loggedIn = await login();

    if (!loggedIn) return;

    await findPair();
}

function profileScreen() {
    showSetup(`
        <h3>Kto tu jest? ♡</h3>
        <p>Wybierz swój profil.</p>

        <button id="lenaProfile">Lena</button>
        <button id="majaProfile">Maja</button>
    `);

    document.querySelector("#lenaProfile")
        .addEventListener("click", () => chooseProfile("Lena"));

    document.querySelector("#majaProfile")
        .addEventListener("click", () => chooseProfile("Maja"));
}

// ===================================
// WYSZUKIWANIE PARY
// ===================================

async function findPair() {
    const { data, error } = await db
        .from("pairs")
        .select("*")
        .or(
            `user_one.eq.${currentUser.id},user_two.eq.${currentUser.id}`
        )
        .limit(1)
        .maybeSingle();

    if (error) {
        showMessage("Błąd połączenia: " + error.message);
        return;
    }

    if (!data) {
        pairingScreen();
        return;
    }

    currentPair = data;

    if (!data.user_two) {
        waitingScreen();
        return;
    }

    partnerId = data.user_one === currentUser.id
        ? data.user_two
        : data.user_one;

    partnerName =
        localStorage.getItem("styknij_profile") === "Lena"
            ? "Maja"
            : "Lena";

    await startApp();
}

// ===================================
// PAROWANIE
// ===================================

function pairingScreen() {
    showSetup(`
        <h3>Połączmy telefony ♡</h3>
        <p>Utwórz kod zaproszenia albo wpisz kod drugiej osoby.</p>

        <button id="createPair">Utwórz kod</button>

        <div>
            <input id="inviteCode" placeholder="Kod zaproszenia">
            <button id="joinPair">Dołącz</button>
        </div>

        <p id="pairMessage"></p>
    `);

    document.querySelector("#createPair")
        .addEventListener("click", createPair);

    document.querySelector("#joinPair")
        .addEventListener("click", joinPair);
}

async function createPair() {
    const result = await db.rpc("create_pair");

    if (result.error) {
        document.querySelector("#pairMessage").textContent =
            result.error.message;
        return;
    }

    const code = result.data;

    showSetup(`
        <h3>Twój kod zaproszenia ♡</h3>
        <p>Przekaż go drugiej osobie:</p>
        <h2>${escapeHTML(code)}</h2>
        <button id="copyCode">Kopiuj kod</button>
        <p>Czekam, aż druga osoba dołączy...</p>
    `);

    document.querySelector("#copyCode")
        .addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(code);
                document.querySelector("#copyCode").textContent =
                    "Skopiowano!";
            } catch {
                showMessage("Nie udało się skopiować kodu.");
            }
        });

    if (pairCheckTimer) clearInterval(pairCheckTimer);

    pairCheckTimer = setInterval(async () => {
        const { data } = await db
            .from("pairs")
            .select("*")
            .eq("invite_code", code)
            .maybeSingle();

        if (data && data.user_two) {
            clearInterval(pairCheckTimer);
            pairCheckTimer = null;
            await findPair();
        }
    }, 3000);
}

async function joinPair() {
    const code = document.querySelector("#inviteCode")
        .value.trim();

    if (!code) {
        document.querySelector("#pairMessage").textContent =
            "Wpisz kod zaproszenia.";
        return;
    }

    const { error } = await db.rpc("join_pair", {
        p_code: code
    });

    if (error) {
        document.querySelector("#pairMessage").textContent =
            error.message;
        return;
    }

    await findPair();
}

function waitingScreen() {
    showSetup(`
        <h3>Czekamy na drugą osobę ♡</h3>
        <p>Przekaż jej swój kod zaproszenia.</p>
        <p>Sprawdzam automatycznie, czy dołączyła.</p>
    `);

    if (pairCheckTimer) clearInterval(pairCheckTimer);

    pairCheckTimer = setInterval(async () => {
        const { data } = await db
            .from("pairs")
            .select("*")
            .eq("id", currentPair.id)
            .maybeSingle();

        if (data && data.user_two) {
            clearInterval(pairCheckTimer);
            pairCheckTimer = null;
            await findPair();
        }
    }, 3000);
}

// ===================================
// POWIADOMIENIA
// ===================================

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat(
        (4 - base64String.length % 4) % 4
    );

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from(
        rawData,
        char => char.charCodeAt(0)
    );
}

async function registerServiceWorker() {
    try {
        swRegistration =
            await navigator.serviceWorker.register("./sw.js");

        return swRegistration;
    } catch (error) {
        console.error("Błąd service workera:", error);
        showMessage("Nie udało się uruchomić powiadomień.");
        return null;
    }
}

async function checkNotifications() {
    const button = document.querySelector("#enableNotifications");

    if (!button) return;

    if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
    ) {
        button.style.display = "none";
        return;
    }

    if (Notification.permission !== "granted") {
        return;
    }

    try {
        const registration = await registerServiceWorker();
        if (!registration) return;

        const subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) return;

        const { error } = await db
            .from("push_subscriptions")
            .upsert({
                user_id: currentUser.id,
                subscription: subscription.toJSON(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: "user_id"
            });

        if (error) throw error;

        button.textContent = "♡ Powiadomienia włączone";
        button.disabled = true;
        button.style.display = "none";

    } catch (error) {
        console.error("Sprawdzanie powiadomień:", error);
    }
}

async function enablePushNotifications() {
    const isInstalled =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    if (!isInstalled) {
        showMessage("Otwórz styknij z ikony na ekranie iPhone'a.");
        return;
    }

    if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
    ) {
        showMessage("Ta przeglądarka nie obsługuje powiadomień.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            showMessage("Nie przyznano zgody na powiadomienia.");
            return;
        }

        const registration = await registerServiceWorker();
        if (!registration) return;

        let subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey:
                    urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        const { error } = await db
            .from("push_subscriptions")
            .upsert({
                user_id: currentUser.id,
                subscription: subscription.toJSON(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: "user_id"
            });

        if (error) throw error;

        const button =
            document.querySelector("#enableNotifications");

        if (button) {
            button.textContent = "♡ Powiadomienia włączone";
            button.disabled = true;
            button.style.display = "none";
        }

        showMessage("Powiadomienia są włączone ♡");

    } catch (error) {
        console.error("Błąd powiadomień:", error);
        showMessage("Nie udało się włączyć powiadomień: " + error.message);
    }
}

// ===================================
// GŁÓWNA APLIKACJA
// ===================================

async function startApp() {
    if (pairCheckTimer) {
        clearInterval(pairCheckTimer);
        pairCheckTimer = null;
    }

    if (channel) {
        await db.removeChannel(channel);
        channel = null;
    }

    showSetup(`
        <p>Połączono z ${escapeHTML(partnerName)} ♡</p>

        <button id="enableNotifications">
            ♡ Włącz powiadomienia
        </button>

        <div id="incomingRequest"></div>
        <div id="outgoingRequest"></div>
    `);

    document.querySelector("#enableNotifications")
        .addEventListener("click", enablePushNotifications);

    touchButton.disabled = false;
    touchButton.textContent = "♡ Chcę się styknąć";

    showMessage("Możecie już wysyłać sobie stykniecia ♡");

    await checkNotifications();
    await refreshRequests(true);

    channel = db
        .channel("touch-" + currentPair.id)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "touch_requests",
                filter: "pair_id=eq." + currentPair.id
            },
            async () => {
                await refreshRequests(false);
            }
        )
        .subscribe();
}

// ===================================
// WYSYŁANIE STYKNIECIA
// ===================================

async function sendTouch() {
    if (!partnerId || !currentPair || touchButton.disabled) return;

    touchButton.disabled = true;

    const { data, error } = await db
        .from("touch_requests")
        .insert({
            pair_id: currentPair.id,
            sender_id: currentUser.id,
            receiver_id: partnerId
        })
        .select("id")
        .single();

    if (error) {
        showMessage("Nie udało się wysłać: " + error.message);
        touchButton.disabled = false;
        return;
    }

    showMessage("Wysłano stykniecie ♡");
    touchButton.textContent = "♡ Stykniecie wysłane!";

    // Powiadomienie dla drugiej osoby.
    const { error: pushError } = await db.functions.invoke(
        "send-touch-notification",
        {
            body: {
                requestId: data.id,
                senderName: localStorage.getItem("styknij_profile")
            }
        }
    );

    if (pushError) {
        console.error("Błąd powiadomienia:", pushError);
        showMessage("Stykniecie wysłane, ale powiadomienie nie dotarło.");
    }

    await refreshRequests(false);

    setTimeout(() => {
        touchButton.disabled = false;
        touchButton.textContent = "♡ Chcę się styknąć";
    }, 1500);
}

// ===================================
// ODSWIEŻANIE STYKNIEC
// ===================================

async function refreshRequests(initial = false) {
    if (!currentPair || refreshInProgress) return;

    refreshInProgress = true;

    try {
        const { data, error } = await db
            .from("touch_requests")
            .select("*")
            .eq("pair_id", currentPair.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Błąd pobierania stykniec:", error);
            showMessage("Nie udało się odświeżyć stykniec.");
            return;
        }

        const requests = data || [];

        const incoming = requests.filter(request =>
            request.receiver_id === currentUser.id &&
            request.status === "pending"
        );

        const outgoingPending = requests.filter(request =>
            request.sender_id === currentUser.id &&
            request.status === "pending"
        );

        const outgoingAccepted = requests.filter(request =>
            request.sender_id === currentUser.id &&
            request.status === "accepted"
        );

        const outgoingDeclined = requests.filter(request =>
            request.sender_id === currentUser.id &&
            request.status === "declined"
        );

        const incomingBox =
            document.querySelector("#incomingRequest");

        if (incomingBox) {
            if (incoming.length > 0) {
                incomingBox.innerHTML = `
                    <h3>
                        ${escapeHTML(partnerName)} chce się z Tobą styknąć
                        <span class="request-count">${incoming.length}</span>
                    </h3>

                    <p>Masz ${incoming.length} oczekujących stykniec ♡</p>

                    <div class="request-actions">
                        <button id="acceptAll">♡ Akceptuj wszystkie</button>
                        <button id="declineAll" class="secondary-button">
                            Odrzuć wszystkie
                        </button>
                    </div>

                    <div>
                        ${incoming.map((request, index) => `
                            <div class="request-card">
                                <p>Stykniecie ${incoming.length - index}</p>
                                <div class="request-actions">
                                    <button class="action-button"
                                        data-accept="${request.id}">
                                        ♡ Akceptuję
                                    </button>
                                    <button class="action-button secondary-button"
                                        data-decline="${request.id}">
                                        Odrzuć
                                    </button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                `;

                document.querySelector("#acceptAll")
                    .addEventListener("click", () =>
                        respondToAllTouches(true)
                    );

                document.querySelector("#declineAll")
                    .addEventListener("click", () =>
                        respondToAllTouches(false)
                    );

                incomingBox.querySelectorAll("[data-accept]")
                    .forEach(button => {
                        button.addEventListener("click", () =>
                            respondToTouch(button.dataset.accept, true)
                        );
                    });

                incomingBox.querySelectorAll("[data-decline]")
                    .forEach(button => {
                        button.addEventListener("click", () =>
                            respondToTouch(button.dataset.decline, false)
                        );
                    });

            } else {
                incomingBox.innerHTML = "";
            }
        }

        const outgoingBox =
            document.querySelector("#outgoingRequest");

        if (outgoingBox) {
            let outgoingHTML = "";

            if (outgoingPending.length > 0) {
                outgoingHTML += `
                    <div class="pending-box">
                        <h3>Czekam na Ciebie ♡</h3>
                        <p>
                            Wysłane stykniecia:
                            <strong>${outgoingPending.length}</strong>
                        </p>
                        <p class="small-text">
                            Gdy ${escapeHTML(partnerName)} odpowie,
                            zobaczysz tutaj aktualizację.
                        </p>
                    </div>
                `;
            }

            if (outgoingAccepted.length > 0) {
                const newestAccepted = outgoingAccepted[0];

                outgoingHTML += `
                    <div class="pending-box">
                        <p>♡ ${escapeHTML(partnerName)} zaakceptowała stykniecie!</p>
                    </div>
                `;

                if (!initial && !lastAcceptedIds.has(newestAccepted.id)) {
                    animateTouch();
                    showMessage(partnerName + " zaakceptowała stykniecie ♡");
                }
            }

            if (outgoingDeclined.length > 0) {
                const newestDeclined = outgoingDeclined[0];

                outgoingHTML += `
                    <div class="pending-box">
                        <p>${escapeHTML(partnerName)} tym razem odrzuciła stykniecie.</p>
                    </div>
                `;

                if (!initial && !lastDeclinedIds.has(newestDeclined.id)) {
                    showMessage(partnerName + " odpowiedziała na stykniecie.");
                }
            }

            outgoingBox.innerHTML = outgoingHTML;
        }

        outgoingAccepted.forEach(request =>
            lastAcceptedIds.add(request.id)
        );

        outgoingDeclined.forEach(request =>
            lastDeclinedIds.add(request.id)
        );

        if (incoming.length > 0) {
            showMessage("Masz " + incoming.length + " oczekujących stykniec ♡");
        }

    } finally {
        refreshInProgress = false;
    }
}

// ===================================
// ODPOWIEDŹ NA JEDNO STYKNIECIE
// ===================================

async function respondToTouch(id, accepted) {
    const buttons = document.querySelectorAll(
        `[data-accept="${id}"], [data-decline="${id}"]`
    );

    buttons.forEach(button => button.disabled = true);

    const { error } = await db.rpc("respond_to_touch", {
        p_request_id: id,
        p_accept: accepted
    });

    if (error) {
        showMessage("Coś poszło nie tak: " + error.message);
        await refreshRequests(false);
        return;
    }

    if (accepted) {
        showMessage("Stykniecie zaakceptowane ♡");
        animateTouch();
    } else {
        showMessage("Stykniecie odrzucone.");
    }

    await refreshRequests(false);
}

// ===================================
// ODPOWIEDŹ NA WSZYSTKIE STYKNIECIA
// ===================================

async function respondToAllTouches(accepted) {
    const buttons = document.querySelectorAll(
        "#acceptAll, #declineAll"
    );

    buttons.forEach(button => button.disabled = true);

    const { data, error } = await db.rpc(
        "respond_to_all_touches",
        {
            p_pair_id: currentPair.id,
            p_accept: accepted
        }
    );

    if (error) {
        showMessage("Nie udało się wykonać operacji: " + error.message);
        await refreshRequests(false);
        return;
    }

    if (accepted) {
        showMessage("Zaakceptowano " + data + " stykniec ♡");
        animateTouch();
    } else {
        showMessage("Odrzucono " + data + " stykniec.");
    }

    await refreshRequests(false);
}

// ===================================
// ANIMACJA
// ===================================

function animateTouch() {
    const hands = document.querySelector(".hands");

    if (!hands) return;

    hands.classList.remove("touching");

    void hands.offsetWidth;

    hands.classList.add("touching");

    if (navigator.vibrate) {
        navigator.vibrate(150);
    }
}

// ===================================
// START
// ===================================

touchButton.addEventListener("click", sendTouch);

async function init() {
    touchButton.disabled = true;

    const savedProfile =
        localStorage.getItem("styknij_profile");

    if (!savedProfile) {
        profileScreen();
        return;
    }

    showSetup("<p>Uruchamiam styknij... ♡</p>");

    const loggedIn = await login();

    if (!loggedIn) return;

    await findPair();
}

init();
