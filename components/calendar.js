// Google API Config (Placeholders - to be filled by user)
const CLIENT_ID = '352272253888-fpa47fv6g88l860ou2254ak9e89vgmgj.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCcHvDCiMrxdmMNdfwetMylnZGGdfZTaew';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

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
    const age = (new Date().getTime() - parsed.timestamp) / 1000 / 60;
    if (age > 30) return null;
    return parsed.data;
}

function renderEvents(events) {
    const eventList = document.getElementById('event-list');
    if (!eventList) return;
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
    if (window.gapi) {
        gapi.load('client', intializeGapiClient);
    } else {
        setTimeout(gapiLoaded, 500); // Retry if not loaded yet
    }
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
    if (window.google && window.google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '',
        });
        gisInited = true;
        maybeEnableButtons();
    } else {
        setTimeout(gisLoaded, 500);
    }
}

function maybeEnableButtons() {
    const authButton = document.getElementById('auth-button');
    const authOverlay = document.getElementById('auth-overlay');
    const calendarContent = document.getElementById('calendar-content');
    if (gapiInited && gisInited && authButton) {
        authButton.style.display = 'block';
        const token = localStorage.getItem('gapi_token_present');
        if (token) {
            tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) {
                    localStorage.removeItem('gapi_token_present');
                    throw (resp);
                }
                if (authOverlay) authOverlay.style.display = 'none';
                if (calendarContent) calendarContent.style.display = 'block';
                await listUpcomingEvents();
            };
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

async function handleAuthClick() {
    const authOverlay = document.getElementById('auth-overlay');
    const calendarContent = document.getElementById('calendar-content');
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        localStorage.setItem('gapi_token_present', 'true');
        if (authOverlay) authOverlay.style.display = 'none';
        if (calendarContent) calendarContent.style.display = 'block';
        await listUpcomingEvents();
    };
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSignoutClick() {
    const authOverlay = document.getElementById('auth-overlay');
    const calendarContent = document.getElementById('calendar-content');
    const eventList = document.getElementById('event-list');
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('gapi_token_present');
        localStorage.removeItem('cached_calendar_events');
        if (authOverlay) authOverlay.style.display = 'flex';
        if (calendarContent) calendarContent.style.display = 'none';
        if (eventList) eventList.innerHTML = '';
        maybeEnableButtons();
    }
}

async function listUpcomingEvents() {
    const eventList = document.getElementById('event-list');
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
        const cached = loadEventsFromCache();
        if (cached) { renderEvents(cached); return; }
        if (eventList) eventList.innerHTML = `<p class="error">Error fetching events: ${err.message}</p>`;
        return;
    }
    const events = response.result.items;
    saveEventsToCache(events);
    renderEvents(events);
}

document.addEventListener('DOMContentLoaded', () => {
    const authButton = document.getElementById('auth-button');
    const signoutButton = document.getElementById('signout-button');
    const authOverlay = document.getElementById('auth-overlay');
    const calendarContent = document.getElementById('calendar-content');

    if (authButton) authButton.onclick = handleAuthClick;
    if (signoutButton) signoutButton.onclick = handleSignoutClick;

    // Show cached calendar data
    const cached = loadEventsFromCache();
    if (cached) {
        if (authOverlay) authOverlay.style.display = 'none';
        if (calendarContent) calendarContent.style.display = 'block';
        renderEvents(cached);
    }

    gapiLoaded();
    gisLoaded();
});
