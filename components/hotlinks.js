// --- Favicon toggle ---
function toggleFavicons(show) {
    localStorage.setItem('show_favicons', JSON.stringify(show));
    renderQuickLinks();
}
window.toggleFavicons = toggleFavicons;

function getFaviconsEnabled() {
    const saved = localStorage.getItem('show_favicons');
    return saved === null ? true : JSON.parse(saved);
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

document.addEventListener('DOMContentLoaded', () => {
    renderQuickLinks();
    renderLinkSettings();

    const faviconCheckbox = document.getElementById('favicons-visible');
    if (faviconCheckbox) {
        faviconCheckbox.checked = getFaviconsEnabled();
    }
});
