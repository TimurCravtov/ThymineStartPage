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
        callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authButton.style.display = 'block';
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
        if (resp.error !== undefined) throw (resp);
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
        const cached = loadEventsFromCache();
        if (cached) { renderEvents(cached); return; }
        eventList.innerHTML = `<p class="error">Error fetching events: ${err.message}</p>`;
        return;
    }
    const events = response.result.items;
    saveEventsToCache(events);
    renderEvents(events);
}

// --- Clock ---

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

    if (digitalTimeElement) {
        digitalTimeElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (hourHand && minuteHand && secondHand) {
        hourHand.style.transform = `rotate(${(hours % 12) * 30 + minutes * 0.5}deg)`;
        minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
        secondHand.style.transform = `rotate(${seconds * 6}deg)`;
    }

    let greeting = 'Good evening.';
    if (hours < 12) greeting = 'Good morning.';
    else if (hours < 18) greeting = 'Good afternoon.';
    if (greetingElement) greetingElement.textContent = greeting;
}

// --- Clock Style ---

function applyClockStyle(style) {
    const clockElement = document.getElementById('clock');
    clockElement.classList.remove('minimal', 'bold', 'glass', 'circular');
    if (style !== 'default') clockElement.classList.add(style);
    localStorage.setItem('settings_clock_style', style);
}

const clockStyleSelect = document.getElementById('clock-style');
if (clockStyleSelect) {
    clockStyleSelect.onchange = (e) => applyClockStyle(e.target.value);
}

// --- Widget Visibility ---

function toggleWidgetVisibility(widget, visible) {
    const map = {
        clock: ['#clock', '#greeting'],
        search: ['.search-box'],
        hotlinks: ['.quick-links'],
        calendar: ['.calendar-container'],
    };
    const selectors = map[widget] || [];
    selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = visible ? '' : 'none';
    });
    // persist
    const saved = JSON.parse(localStorage.getItem('widget_visibility') || '{}');
    saved[widget] = visible;
    localStorage.setItem('widget_visibility', JSON.stringify(saved));
}

function loadWidgetVisibility() {
    const saved = JSON.parse(localStorage.getItem('widget_visibility') || '{}');
    Object.entries(saved).forEach(([widget, visible]) => {
        toggleWidgetVisibility(widget, visible);
        const checkbox = document.getElementById(`${widget}-visible`);
        if (checkbox) checkbox.checked = visible;
    });
}

// --- Favicon toggle ---

function toggleFavicons(show) {
    localStorage.setItem('show_favicons', JSON.stringify(show));
    renderQuickLinks();
}

function getFaviconsEnabled() {
    const saved = localStorage.getItem('show_favicons');
    return saved === null ? true : JSON.parse(saved);
}

// --- Background Settings ---

const PRESET_BG_COLORS = ['#0c0c0c', '#071229', '#0b3a2e', '#2b0b3a', '#1a1a1a', '#7c3aed', '#4f46e5', '#ff6b6b', '#ffd166', '#06d6a0'];

function renderColorSwatches() {
    const container = document.getElementById('bg-color-swatches');
    if (!container) return;
    container.innerHTML = PRESET_BG_COLORS.map(c => {
        const lc = String(c).toLowerCase();
        return `<div class="bg-swatch" data-color="${lc}" style="background:${lc}"></div>`;
    }).join('');
    container.querySelectorAll('.bg-swatch').forEach(el => {
        el.onclick = () => {
            const color = String(el.getAttribute('data-color') || '').toLowerCase();
            applyBackground({ type: 'color', value: color });
            markSelectedSwatch(color);
        };
    });
}

function markSelectedSwatch(color) {
    const target = String(color || '').toLowerCase();
    document.querySelectorAll('.bg-swatch').forEach(s => {
        const c = String(s.getAttribute('data-color') || '').toLowerCase();
        s.classList.toggle('selected', c === target && target !== '');
    });
}

function applyBackground(setting) {
    const body = document.body;
    if (!setting) return;
    if (setting.type === 'color') {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = String(setting.value || '').trim();
        body.style.backgroundRepeat = '';
        body.style.backgroundSize = '';
    } else if (setting.type === 'image') {
        body.style.backgroundImage = `url(${setting.value})`;
        body.style.backgroundPosition = 'center';
        body.style.backgroundSize = 'cover';
        body.style.backgroundRepeat = 'no-repeat';
    }
    localStorage.setItem('settings_background', JSON.stringify(setting));
}

function clearBackground() {
    document.body.style.background = '';
    document.body.style.backgroundImage = '';
    localStorage.removeItem('settings_background');
    const preview = document.getElementById('bg-image-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    markSelectedSwatch(null);
}

function loadSavedBackground() {
    const saved = localStorage.getItem('settings_background');
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        if (parsed.type === 'color') {
            applyBackground(parsed);
            const colorInput = document.getElementById('bg-color-custom');
            if (colorInput) colorInput.value = parsed.value;
            markSelectedSwatch(parsed.value);
            document.getElementById('background-type').value = 'color';
            toggleBgControls('color');
        } else if (parsed.type === 'image') {
            applyBackground(parsed);
            const preview = document.getElementById('bg-image-preview');
            if (preview) { preview.src = parsed.value; preview.style.display = 'block'; }
            document.getElementById('background-type').value = 'image';
            toggleBgControls('image');
        }
    } catch (e) {
        console.warn('Invalid saved background', e);
    }
}

function toggleBgControls(type) {
    const colorControls = document.getElementById('bg-color-controls');
    const imageControls = document.getElementById('bg-image-controls');
    if (!colorControls || !imageControls) return;
    colorControls.style.display = type === 'color' ? 'flex' : 'none';
    imageControls.style.display = type === 'image' ? 'flex' : 'none';
}

function handleImageUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        const preview = document.getElementById('bg-image-preview');
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
        applyBackground({ type: 'image', value: dataUrl });
    };
    reader.readAsDataURL(file);
}

// --- Search Engine ---

function applySearchEngine(url) {
    const form = document.querySelector('.search-box form');
    if (form) form.action = url;
    localStorage.setItem('search_engine', url);
}

// --- Hotlinks ---

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
    const showFavicons = getFaviconsEnabled();

    function getFaviconUrl(siteUrl) {
        try {
            const u = new URL(siteUrl);
            return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(u.hostname)}`;
        } catch (e) { return ''; }
    }

    container.innerHTML = userLinks.map(link => {
        const favicon = getFaviconUrl(link.url);
        const safeName = String(link.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
        <a href="${link.url}" class="link-card" target="_blank">
            ${showFavicons ? `<img class="link-favicon" src="${favicon}" alt="" onerror="this.style.display='none'">` : ''}
            <span>${safeName}</span>
        </a>
    `;
    }).join('');
}

function renderLinkSettings() {
    const list = document.getElementById('hotlinks-list');
    if (!list) return;
    list.innerHTML = userLinks.map((link, index) => `
        <div class="link-edit-item">
            <input type="text" value="${link.name}" onchange="updateLink(${index}, 'name', this.value)" placeholder="Name">
            <input type="text" value="${link.url}" onchange="updateLink(${index}, 'url', this.value)" placeholder="URL">
            <button class="btn-delete" onclick="deleteLink(${index})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
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

// --- Settings Panel ---

function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

function toggleSettingsSection(id) {
    const section = document.getElementById(id);
    if (section) section.classList.toggle('collapsed');
}

// --- Custom CSS ---

const styleTag = document.createElement('style');
styleTag.id = 'custom-runtime-styles';
document.head.appendChild(styleTag);

function applyCustomCSS(css) {
    styleTag.textContent = css;
    localStorage.setItem('user_custom_css', css);
}

let cssEditor;

// --- Init ---

authButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;

window.onload = () => {
    updateClock();
    setInterval(updateClock, 1000);

    renderQuickLinks();
    renderLinkSettings();

    // Favicon toggle state
    const faviconCheckbox = document.getElementById('favicons-visible');
    if (faviconCheckbox) faviconCheckbox.checked = getFaviconsEnabled();

    // Clock style
    const savedStyle = localStorage.getItem('settings_clock_style');
    if (savedStyle && clockStyleSelect) {
        clockStyleSelect.value = savedStyle;
        applyClockStyle(savedStyle);
    }

    // Widget visibility
    loadWidgetVisibility();

    // Search engine
    const savedEngine = localStorage.getItem('search_engine');
    const searchEngineSelect = document.getElementById('search-engine');
    if (savedEngine) {
        applySearchEngine(savedEngine);
        if (searchEngineSelect) searchEngineSelect.value = savedEngine;
    }
    if (searchEngineSelect) {
        searchEngineSelect.onchange = (e) => applySearchEngine(e.target.value);
    }

    // Show cached calendar data
    const cached = loadEventsFromCache();
    if (cached) {
        authOverlay.style.display = 'none';
        calendarContent.style.display = 'block';
        renderEvents(cached);
    }

    // Custom CSS
    cssEditor = document.getElementById('custom-css-editor');
    const savedCSS = localStorage.getItem('user_custom_css');
    if (savedCSS) {
        if (cssEditor) cssEditor.value = savedCSS;
        applyCustomCSS(savedCSS);
    }
    if (cssEditor) {
        cssEditor.oninput = (e) => applyCustomCSS(e.target.value);
    }

    // Background controls
    renderColorSwatches();
    const bgTypeSelect = document.getElementById('background-type');
    const bgColorCustom = document.getElementById('bg-color-custom');
    const bgImageInput = document.getElementById('bg-image-input');
    const clearBtn = document.getElementById('clear-bg-btn');

    if (bgTypeSelect) bgTypeSelect.onchange = (e) => toggleBgControls(e.target.value);
    if (bgColorCustom) {
        bgColorCustom.oninput = (e) => {
            applyBackground({ type: 'color', value: e.target.value });
            markSelectedSwatch(e.target.value);
        };
    }
    if (bgImageInput) bgImageInput.onchange = (e) => handleImageUpload(e.target.files && e.target.files[0]);
    if (clearBtn) clearBtn.onclick = (e) => { e.preventDefault(); clearBackground(); };

    loadSavedBackground();

    gapiLoaded();
    gisLoaded();
};