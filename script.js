// ===================================
// KONFIGURACJA SUPABASE
// ===================================

const SUPABASE_URL = "https://cyrrxgyqyahnxjbvgqmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_6eq2OFDAgjM880ulznbA6w_aHQLejom";

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

// ===================================
// STYLE DODATKOWYCH ELEMENTÓW
// ===================================

const extraStyles = document.createElement("style");

extraStyles.textContent = `
.setup {
    margin-top: 25px;
}

.setup button, .action-button {
    border: none;
    border-radius: 18px;
    padding: 13px 20px;
    margin: 6px;
    background: #d9c8ef;
    color: #514267;
    font-size: 15px;
    cursor: pointer;
}

.setup input {
    padding: 13px;
    border: 1px solid #d9c8ef;
    border-radius: 12px;
    margin: 8px;
    max-width: 220px;
}

.setup p {
    color: #766785;
}

.setup h3 {
    color: #665078;
}

#incomingRequest {
    margin-top: 20px;
    padding: 15px;
    border-radius: 18px;
    background: #f2eafa;
    color: #665078;
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
// PANEL KONFIGURACJI
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

// ===================================
// LOGOWANIE ANONIMOWE
// ===================================

async function login() {
    const { data: sessionData } = await db.auth.getSession();

    if (sessionData.session) {
        currentUser = sessionData.session.user;
        return true;
    }

    const { data, error } = await db.auth.signInAnonymously();

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
// SZUKANIE PARY
// ===================================

async function findPair() {
    const { data, error } = await db
        .from("pairs")
        .select("*")
        .or(`user_one.eq.${currentUser.id},user_two.eq.${currentUser.id}`)
        .limit(1)
        .maybeSingle();

    if (error) {
        showMessage("Błąd: " + error.message);
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

    partnerName = localStorage.getItem("styknij_profile") === "Lena"
        ? "Maja"
        : "Lena";

    startApp();
}

// ===================================
// TWORZENIE LUB DOŁĄCZANIE DO PARY
// ===================================

function pairingScreen() {
    showSetup(`
        <h3>Połączmy telefony ♡</h3>
        <p>Możesz utworzyć kod zaproszenia albo wpisać kod drugiej osoby.</p>

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
        <h2>${code}</h2>
        <button id="copyCode">Kopiuj kod</button>
        <p>Czekam, aż druga osoba dołączy...</p>
    `);

    document.querySelector("#copyCode")
        .addEventListener("click", () => {
            navigator.clipboard.writeText(code);
            document.querySelector("#copyCode").textContent = "Skopiowano!";
        });

    const check = setInterval(async () => {
        const { data } = await db
            .from("pairs")
            .select("*")
            .eq("invite_code", code)
            .maybeSingle();

        if (data && data.user_two) {
            clearInterval(check);
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
        <p>Ta strona sprawdzi automatycznie, kiedy dołączy.</p>
    `);

    const check = setInterval(async () => {
        const { data } = await db
            .from("pairs")
            .select("*")
            .eq("id", currentPair.id)
            .maybeSingle();

        if (data && data.user_two) {
            clearInterval(check);
            await findPair();
        }
    }, 3000);
}

// ===================================
// GŁÓWNA APLIKACJA
// ===================================

async function startApp() {
    showSetup(`
        <p>Połączono z ${partnerName} ♡</p>
        <div id="incomingRequest"></div>
    `);

    touchButton.disabled = false;
    touchButton.textContent = "♡ Chcę się styknąć";

    showMessage("Możecie już wysyłać sobie dotyki ♡");

    await refreshRequests();

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
                await refreshRequests();
            }
        )
        .subscribe();
}

// ===================================
// WYSYŁANIE DOTYKU
// ===================================

async function sendTouch() {
    if (!partnerId) return;

    touchButton.disabled = true;

    const { error } = await db
        .from("touch_requests")
        .insert({
            pair_id: currentPair.id,
            sender_id: currentUser.id,
            receiver_id: partnerId
        });

    if (error) {
        showMessage("Nie udało się wysłać: " + error.message);
        touchButton.disabled = false;
        return;
    }

    showMessage("Wysyłam Ci mały dotyk ♡");

    touchButton.textContent = "♡ Dotyk wysłany!";

    setTimeout(() => {
        touchButton.disabled = false;
        touchButton.textContent = "♡ Chcę się styknąć";
    }, 3000);
}

// ===================================
// ODBIERANIE I AKCEPTOWANIE DOTYKU
// ===================================

async function refreshRequests() {
    const { data, error } = await db
        .from("touch_requests")
        .select("*")
        .eq("pair_id", currentPair.id)
        .order("created_at", { ascending: false })
        .limit(10);

    if (error || !data) return;

    const incoming = data.find(request =>
        request.receiver_id === currentUser.id &&
        request.status === "pending"
    );

    const accepted = data.find(request =>
        request.sender_id === currentUser.id &&
        request.status === "accepted"
    );

    const incomingBox = document.querySelector("#incomingRequest");

    if (incoming) {
        incomingBox.innerHTML = `
            <h3>${partnerName} chce się z Tobą styknąć ♡</h3>
            <button class="action-button" id="acceptTouch">
                ♡ Akceptuję
            </button>
            <button class="action-button" id="declineTouch">
                Odrzuć
            </button>
        `;

        document.querySelector("#acceptTouch")
            .addEventListener("click", () => respondToTouch(incoming.id, true));

        document.querySelector("#declineTouch")
            .addEventListener("click", () => respondToTouch(incoming.id, false));

    } else {
        incomingBox.innerHTML = "";
    }

    if (accepted) {
        showMessage(partnerName + " zaakceptowała dotyk ♡");
        animateTouch();
    }
}

async function respondToTouch(id, accepted) {
    const { error } = await db.rpc("respond_to_touch", {
        p_request_id: id,
        p_accept: accepted
    });

    if (error) {
        showMessage("Coś poszło nie tak: " + error.message);
        return;
    }

    if (accepted) {
        showMessage("Dotyk zaakceptowany ♡");
        animateTouch();
    } else {
        showMessage("Tym razem bez dotyku ♡");
    }

    await refreshRequests();
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

    const savedProfile = localStorage.getItem("styknij_profile");

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