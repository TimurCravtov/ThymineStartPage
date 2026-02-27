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
    const digitalTimeElement = document.getElementById('digital-time');
    const greetingElement = document.getElementById('greeting');
    const hourHand = document.getElementById('hour-hand');
    const minuteHand = document.getElementById('minute-hand');
    const secondHand = document.getElementById('second-hand');
    const now = new Date();

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Update Digital
    if (digitalTimeElement) {
        digitalTimeElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Update Analog hands
    if (hourHand && minuteHand && secondHand) {
        const hRotation = (hours % 12) * 30 + minutes * 0.5;
        const mRotation = minutes * 6;
        const sRotation = seconds * 6;

        hourHand.style.transform = `rotate(${hRotation}deg)`;
        minuteHand.style.transform = `rotate(${mRotation}deg)`;
        secondHand.style.transform = `rotate(${sRotation}deg)`;
    }

    let greeting = 'Good evening.';
    if (hours < 12) greeting = 'Good morning.';
    else if (hours < 18) greeting = 'Good afternoon.';

    greetingElement.textContent = greeting;
}

// --- Settings Logic ---

function applyClockStyle(style) {
    const clockElement = document.getElementById('clock');
    // Remove all style classes
    clockElement.classList.remove('minimal', 'bold', 'glass', 'circular');

    // Apply selected style
    if (style !== 'default') {
        clockElement.classList.add(style);
    }

    // Save to localStorage
    localStorage.setItem('settings_clock_style', style);
}

const clockStyleSelect = document.getElementById('clock-style');
if (clockStyleSelect) {
    clockStyleSelect.onchange = (e) => applyClockStyle(e.target.value);
}

// --- Hotlinks Logic ---

const defaultLinks = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'Gmail', url: 'https://gmail.com' },
    { name: 'ChatGPT', url: 'https://chat.openai.com' }
];

let userLinks = JSON.parse(localStorage.getItem('user_hotlinks')) || defaultLinks;

function renderQuickLinks() {
    const container = document.querySelector('.quick-links');
    if (!container) return;

    container.innerHTML = userLinks.map(link => `
        <a href="${link.url}" class="link-card" target="_blank">
            <span>${link.name}</span>
        </a>
    `).join('');
}

function renderLinkSettings() {
    const list = document.getElementById('hotlinks-list');
    if (!list) return;

    list.innerHTML = userLinks.map((link, index) => `
        <div class="link-edit-item">
            <input type="text" value="${link.name}" onchange="updateLink(${index}, 'name', this.value)" placeholder="Name">
            <input type="text" value="${link.url}" onchange="updateLink(${index}, 'url', this.value)" placeholder="URL">
            <button class="btn-text delete-link" onclick="deleteLink(${index})">✕</button>
        </div>
    `).join('');
}

window.updateLink = (index, field, value) => {
    userLinks[index][field] = value;
    saveLinks();
};

window.deleteLink = (index) => {
    userLinks.splice(index, 1);
    saveLinks();
};

window.addNewLink = () => {
    userLinks.push({ name: 'New Link', url: 'https://' });
    saveLinks();
};

function saveLinks() {
    localStorage.setItem('user_hotlinks', JSON.stringify(userLinks));
    renderQuickLinks();
    renderLinkSettings();
}

// Attach listeners
authButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;

window.onload = () => {
    updateClock();
    setInterval(updateClock, 1000);
    renderQuickLinks();
    renderLinkSettings();

    // Apply saved clock style
    const savedStyle = localStorage.getItem('settings_clock_style');
    if (savedStyle && clockStyleSelect) {
        clockStyleSelect.value = savedStyle;
        applyClockStyle(savedStyle);
    }

    // Immediately show cached data while loading
    const cached = loadEventsFromCache();
    if (cached) {
        authOverlay.style.display = 'none';
        calendarContent.style.display = 'block';
        renderEvents(cached);
    }

    // Custom CSS Initialization
    cssEditor = document.getElementById('custom-css-editor');
    const savedCSS = localStorage.getItem('user_custom_css');
    if (savedCSS) {
        if (cssEditor) cssEditor.value = savedCSS;
        applyCustomCSS(savedCSS);
    }
    if (cssEditor) {
        cssEditor.oninput = (e) => applyCustomCSS(e.target.value);
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

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
    }
}

// --- Custom CSS Logic ---

const styleTag = document.createElement('style');
styleTag.id = 'custom-runtime-styles';
document.head.appendChild(styleTag);

function applyCustomCSS(css) {
    styleTag.textContent = css;
    localStorage.setItem('user_custom_css', css);
}

// Initialized after DOM load in window.onload
let cssEditor;

