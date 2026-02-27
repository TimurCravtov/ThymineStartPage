// Google API Config (Placeholders - to be filled by user)
const CLIENT_ID = '352272253888-fpa47fv6g88l860ou2254ak9e89vgmgj.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCcHvDCiMrxdmMNdfwetMylnZGGdfZTaew';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// UI Elements
const authOverlay = document.getElementById('auth-overlay');
const calendarContent = document.getElementById('calendar-content');
const eventList = document.getElementById('event-list');
const authButton = document.getElementById('auth-button');
const signoutButton = document.getElementById('signout-button');

// --- Caching Logic ---

function saveEventsToCache(events) {
    localStorage.setItem('cached_calendar_events', JSON.stringify({
        timestamp: new Date().getTime(),
        data: events
    }));
}

function loadEventsFromCache() {
    const cached = localStorage.getItem('cached_calendar_events');
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    // Optional: Only use cache if it's less than 30 minutes old
    const age = (new Date().getTime() - parsed.timestamp) / 1000 / 60;
    if (age > 30) return null;

    return parsed.data;
}

function renderEvents(events) {
    if (!events || events.length == 0) {
        eventList.innerHTML = '<p>No upcoming events found.</p>';
        return;
    }

    const output = events.map(event => {
        const start = event.start.dateTime || event.start.date;
        const date = new Date(start).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="event-item">
                <div class="event-time">${date}</div>
                <div class="event-summary">${event.summary}</div>
            </div>
        `;
    }).join('');
    eventList.innerHTML = output;
}

// --- Google API Logic ---

function gapiLoaded() {
    gapi.load('client', intializeGapiClient);
}

async function intializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (e) {
        console.error('GAPI Init Error:', e);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authButton.style.display = 'block';

        // Attempt silent login if we were previously authorized
        const token = localStorage.getItem('gapi_token_present');
        if (token) {
            tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) {
                    localStorage.removeItem('gapi_token_present');
                    throw (resp);
                }
                authOverlay.style.display = 'none';
                calendarContent.style.display = 'block';
                await listUpcomingEvents();
            };
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

async function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        localStorage.setItem('gapi_token_present', 'true');
        authOverlay.style.display = 'none';
        calendarContent.style.display = 'block';
        await listUpcomingEvents();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('gapi_token_present');
        localStorage.removeItem('cached_calendar_events');
        authOverlay.style.display = 'flex';
        calendarContent.style.display = 'none';
        eventList.innerHTML = '';
        maybeEnableButtons();
    }
}

async function listUpcomingEvents() {
    let response;
    try {
        response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 10,
            'orderBy': 'startTime',
        });
    } catch (err) {
        // If we have cached data, show that instead of an error
        const cached = loadEventsFromCache();
        if (cached) {
            renderEvents(cached);
            return;
        }
        eventList.innerHTML = `<p class="error">Error fetching events: ${err.message}</p>`;
        return;
    }

    const events = response.result.items;
    saveEventsToCache(events);
    renderEvents(events);
}

// --- App Initialization ---

function updateClock() {
    const clockElement = document.getElementById('clock');
    const greetingElement = document.getElementById('greeting');
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    clockElement.textContent = `${hours}:${minutes}`;

    let greeting = 'Good evening.';
    if (now.getHours() < 12) greeting = 'Good morning.';
    else if (now.getHours() < 18) greeting = 'Good afternoon.';

    greetingElement.textContent = greeting;
}

// Attach listeners
authButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;

window.onload = () => {
    updateClock();
    setInterval(updateClock, 1000);

    // Immediately show cached data while loading
    const cached = loadEventsFromCache();
    if (cached) {
        authOverlay.style.display = 'none';
        calendarContent.style.display = 'block';
        renderEvents(cached);
    }

    gapiLoaded();
    gisLoaded();
};

function openSettings() {
    const settingsModal = document.querySelector('.settings-modal');
    settingsModal.classList.add('active');
}

function closeSettings() {
    const settingsModal = document.querySelector('.settings-modal');
    settingsModal.classList.remove('active');
}

