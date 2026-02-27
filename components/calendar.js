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
        const calLabel = event._calendarSummary ? `<span class="event-cal-label">${event._calendarSummary}</span>` : '';
        return `
            <div class="event-item">
                <div class="event-time">${date} ${calLabel}</div>
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
                    console.warn('Silent auth failed:', resp.error);
                    if (authOverlay) authOverlay.style.display = 'flex';
                    if (calendarContent) calendarContent.style.display = 'none';
                    return;
                }
                if (authOverlay) authOverlay.style.display = 'none';
                if (calendarContent) calendarContent.style.display = 'block';
                await fetchCalendarList();
                await listUpcomingEvents();
            };
            try {
                tokenClient.requestAccessToken({ prompt: 'none' });
            } catch (e) {
                console.warn('Failed to request access token silently:', e);
            }
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
        await fetchCalendarList();
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
    let selectedCalendars = JSON.parse(localStorage.getItem('selected_calendars') || '["primary"]');
    let allEvents = [];

    try {
        const promises = selectedCalendars.map(calId =>
            gapi.client.calendar.events.list({
                'calendarId': calId,
                'timeMin': (new Date()).toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 10,
                'orderBy': 'startTime',
            })
        );
        const responses = await Promise.all(promises);
        responses.forEach((resp, index) => {
            if (resp.result && resp.result.items) {
                const items = resp.result.items.map(item => ({ ...item, _calendarSummary: resp.result.summary }));
                allEvents = allEvents.concat(items);
            }
        });
    } catch (err) {
        const cached = loadEventsFromCache();
        if (cached) { renderEvents(cached); return; }
        if (eventList) eventList.innerHTML = `<p class="error">Error fetching events: ${err.message}</p>`;
        return;
    }

    allEvents.sort((a, b) => {
        let startA = a.start.dateTime || a.start.date;
        let startB = b.start.dateTime || b.start.date;
        return new Date(startA) - new Date(startB);
    });

    const events = allEvents.slice(0, 10);
    saveEventsToCache(events);
    renderEvents(events);
}

async function fetchCalendarList() {
    try {
        const response = await gapi.client.calendar.calendarList.list();
        const calendars = response.result.items;
        localStorage.setItem('available_calendars', JSON.stringify(calendars));
        renderCalendarSettings();
    } catch (err) {
        console.error("Failed to fetch calendar list", err);
    }
}

function renderCalendarSettings() {
    const list = document.getElementById('calendar-selection-list');
    if (!list) return;

    const calendars = JSON.parse(localStorage.getItem('available_calendars') || '[]');
    let selectedCalendars = JSON.parse(localStorage.getItem('selected_calendars') || '["primary"]');

    if (!calendars || calendars.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = '<div class="s-divider" style="margin-top: 1rem;"></div><label style="margin: 0.75rem 0 0.5rem; display: block; font-size: 0.875rem; color: var(--text-secondary);">Visible Calendars</label>' +
        calendars.map(cal => {
            let isChecked = selectedCalendars.includes(cal.id) || (selectedCalendars.includes('primary') && cal.primary);
            return `
            <div style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="cal-${cal.id}" value="${cal.id}" ${isChecked ? 'checked' : ''} onchange="toggleCalendarSelection('${cal.id}', this.checked)">
                <label for="cal-${cal.id}" style="font-size: 0.85rem; cursor: pointer; color: var(--text-primary);">${cal.summary}</label>
            </div>
        `;
        }).join('');
}

window.toggleCalendarSelection = (calId, isChecked) => {
    let selectedCalendars = JSON.parse(localStorage.getItem('selected_calendars') || '["primary"]');

    if (selectedCalendars.includes('primary')) {
        const available = JSON.parse(localStorage.getItem('available_calendars') || '[]');
        const primaryCal = available.find(c => c.primary);
        if (primaryCal) {
            selectedCalendars = selectedCalendars.filter(id => id !== 'primary');
            if (!selectedCalendars.includes(primaryCal.id)) {
                selectedCalendars.push(primaryCal.id);
            }
        }
    }

    if (isChecked) {
        if (!selectedCalendars.includes(calId)) selectedCalendars.push(calId);
    } else {
        selectedCalendars = selectedCalendars.filter(id => id !== calId);
    }

    localStorage.setItem('selected_calendars', JSON.stringify(selectedCalendars));
    listUpcomingEvents();
};

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
    renderCalendarSettings();

    gapiLoaded();
    gisLoaded();
});
