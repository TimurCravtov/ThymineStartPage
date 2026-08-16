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

// --- Hotlinks (supports nested folders) ---
const defaultLinks = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'Gmail', url: 'https://gmail.com' },
    { name: 'ChatGPT', url: 'https://chat.openai.com' }
];

function genId() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shared 14x14 stroke icons used across the quick-add and item menus, so every
// menu row lines up the same way regardless of which action it represents.
const ICONS = {
    link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`,
    folderPlus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M12 11v4M10 13h4"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
    home: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>`,
    back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`
};

// Normalizes legacy flat {name,url} entries into the {id,type,...} tree format.
function normalizeItem(item) {
    if (item && item.type === 'folder') {
        return {
            id: item.id || genId(),
            type: 'folder',
            name: item.name || 'Folder',
            children: Array.isArray(item.children) ? item.children.map(normalizeItem) : []
        };
    }
    return {
        id: item && item.id || genId(),
        type: 'link',
        name: (item && item.name) || '',
        url: (item && item.url) || ''
    };
}

function loadUserLinks() {
    const saved = JSON.parse(localStorage.getItem('user_hotlinks'));
    const raw = Array.isArray(saved) ? saved : defaultLinks;
    return raw.map(normalizeItem);
}

let userLinks = loadUserLinks();

// Ids of the folder chain currently being viewed in the main quick-links widget.
let folderPath = [];
// Ids of folders collapsed in the settings tree editor.
let collapsedFolders = new Set();

// Finds { list, index, item } for an id anywhere in the tree, where `list` is
// the actual array containing the item (so callers can mutate it in place).
function findItemLocation(id, list = userLinks) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, index: i, item: list[i] };
        if (list[i].type === 'folder') {
            const found = findItemLocation(id, list[i].children);
            if (found) return found;
        }
    }
    return null;
}

function getListForParent(parentId) {
    if (!parentId) return userLinks;
    const loc = findItemLocation(parentId);
    return loc && loc.item.type === 'folder' ? loc.item.children : userLinks;
}

function getCurrentList() {
    let list = userLinks;
    for (const id of folderPath) {
        const folder = list.find(i => i.id === id && i.type === 'folder');
        if (!folder) {
            folderPath = [];
            return userLinks;
        }
        list = folder.children;
    }
    return list;
}

function getFaviconUrl(siteUrl) {
    try {
        const u = new URL(siteUrl);
        return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(u.hostname)}`;
    } catch (e) { return ''; }
}

function renderBreadcrumb() {
    if (folderPath.length === 0) return '';
    const crumbs = folderPath.map((id, idx) => {
        const loc = findItemLocation(id);
        const name = loc ? loc.item.name : '';
        const isLast = idx === folderPath.length - 1;
        return `<span class="crumb${isLast ? ' crumb-current' : ''}" onclick="navigateToFolder(${idx})">${escapeHtml(name)}</span>`;
    }).join('<span class="crumb-sep">/</span>');
    return `<div class="quick-links-breadcrumb">
        <span class="crumb crumb-home" onclick="navigateToFolder(-1)">⌂ Home</span>
        <span class="crumb-sep">/</span>${crumbs}
    </div>`;
}

window.navigateToFolder = (idx) => {
    folderPath = idx < 0 ? [] : folderPath.slice(0, idx + 1);
    renderQuickLinks();
};

window.openFolder = (id) => {
    folderPath.push(id);
    renderQuickLinks();
};

function renderQuickLinks() {
    const container = document.querySelector('.quick-links');
    if (!container) return;
    const showFavicons = getFaviconsEnabled();
    const items = getCurrentList();

    const cardsHtml = items.map(item => {
        const safeName = escapeHtml(item.name);
        const isFolder = item.type === 'folder';
        const dragAttrs = `draggable="true"
            ondragstart="onTileDragStart(event, '${item.id}')"
            ondragend="onTileDragEnd(event)"
            ondragover="onTileDragOver(event, '${item.id}', ${isFolder})"
            ondragleave="onTileDragLeave(event)"
            ondrop="onTileDrop(event, '${item.id}', ${isFolder})"`;

        const kebabHtml = `
            <button class="link-kebab" onclick="toggleItemMenu(event, '${item.id}')" title="More options">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
            </button>
            <div class="item-menu" id="item-menu-${item.id}"></div>`;

        if (isFolder) {
            const count = item.children.length;
            return `
        <div class="link-tile" style="position: relative;" ${dragAttrs}>
            <div class="link-card folder-card" onclick="openFolder('${item.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="folder-icon"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                <span>${safeName}</span>
                ${count ? `<span class="folder-count">${count}</span>` : ''}
            </div>
            ${kebabHtml}
        </div>`;
        }

        const favicon = getFaviconUrl(item.url);
        return `
        <div class="link-tile" style="position: relative;" ${dragAttrs}>
            <a href="${item.url}" class="link-card" target="_blank" draggable="false">
                ${showFavicons ? `<img class="link-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" draggable="false">` : ''}
                <span>${safeName}</span>
            </a>
            ${kebabHtml}
        </div>`;
    }).join('');

    const addTileHtml = `
        <div style="position: relative;">
            <div class="link-card add-tile" onclick="toggleAddMenu(event)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>Add</span>
            </div>
            <div class="quick-add-menu" id="quick-add-menu">
                <button onclick="quickAddLink(event)">${ICONS.link}<span>Add Link</span></button>
                <button onclick="quickAddFolder(event)">${ICONS.folder}<span>Add Folder</span></button>
            </div>
        </div>`;

    container.innerHTML = renderBreadcrumb() + `<div class="quick-links-grid">${cardsHtml}${addTileHtml}</div>`;
}

window.toggleAddMenu = (e) => {
    e.stopPropagation();
    closeAllItemMenus();
    const menu = document.getElementById('quick-add-menu');
    if (menu) menu.classList.toggle('open');
};

document.addEventListener('click', () => {
    const menu = document.getElementById('quick-add-menu');
    if (menu) menu.classList.remove('open');
    closeAllItemMenus();
});

// --- Drag & drop: reorder tiles, or drop onto a folder to file into it ---
let draggedId = null;

function reorderItem(sourceId, targetId, insertAfter) {
    const list = getCurrentList();
    const sourceIndex = list.findIndex(i => i.id === sourceId);
    if (sourceIndex === -1) return;
    const [item] = list.splice(sourceIndex, 1);
    let targetIndex = list.findIndex(i => i.id === targetId);
    if (targetIndex === -1) {
        list.push(item);
    } else {
        list.splice(targetIndex + (insertAfter ? 1 : 0), 0, item);
    }
    saveLinks();
}

window.onTileDragStart = (e, id) => {
    draggedId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    closeAllItemMenus();
    e.currentTarget.classList.add('dragging');
};

window.onTileDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over, .drag-over-folder').forEach(el => el.classList.remove('drag-over', 'drag-over-folder'));
    draggedId = null;
};

window.onTileDragOver = (e, id, isFolder) => {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add(isFolder ? 'drag-over-folder' : 'drag-over');
};

window.onTileDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over', 'drag-over-folder');
};

window.onTileDrop = (e, targetId, isFolder) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over', 'drag-over-folder');
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    draggedId = null;
    if (!sourceId || sourceId === targetId) return;

    if (isFolder) {
        const srcLoc = findItemLocation(sourceId);
        if (srcLoc && srcLoc.item.type === 'folder' && collectFolderIds(srcLoc.item, new Set()).has(targetId)) return;
        moveItem(sourceId, targetId);
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const insertAfter = (e.clientX - rect.left) > rect.width / 2;
    reorderItem(sourceId, targetId, insertAfter);
};

// --- Item (⋮) menu: move to folder / delete ---
function closeAllItemMenus() {
    document.querySelectorAll('.item-menu.open').forEach(m => {
        m.classList.remove('open');
        const wrapper = m.closest('.link-tile');
        if (wrapper) wrapper.classList.remove('menu-open');
    });
}

function collectFolderIds(item, set) {
    if (item.type !== 'folder') return set;
    set.add(item.id);
    item.children.forEach(c => collectFolderIds(c, set));
    return set;
}

function buildFolderOptions(itemId) {
    const loc = findItemLocation(itemId);
    const excluded = loc && loc.item.type === 'folder' ? collectFolderIds(loc.item, new Set()) : new Set();
    const options = [];
    function walk(list, depth) {
        list.forEach(it => {
            if (it.type !== 'folder' || excluded.has(it.id)) return;
            options.push({ id: it.id, name: it.name, depth });
            walk(it.children, depth + 1);
        });
    }
    walk(userLinks, 0);
    return options;
}

function moveItem(id, targetFolderId) {
    const loc = findItemLocation(id);
    if (!loc) return;
    let targetList = userLinks;
    if (targetFolderId) {
        const targetLoc = findItemLocation(targetFolderId);
        if (!targetLoc || targetLoc.item.type !== 'folder') return;
        targetList = targetLoc.item.children;
    }
    loc.list.splice(loc.index, 1);
    targetList.push(loc.item);
    saveLinks();
}

function renderItemMenuMain(id) {
    return `
        <button onclick="showMoveSubmenu(event, '${id}')">${ICONS.folder}<span>Move to Folder</span></button>
        <div class="menu-divider"></div>
        <button class="menu-danger" onclick="handleDeleteFromMenu(event, '${id}')">${ICONS.trash}<span>Delete</span></button>
    `;
}

function renderItemMenuFolders(id) {
    const options = buildFolderOptions(id);
    const folderButtons = options.map(o =>
        `<button style="padding-left:${0.85 + o.depth * 0.9}rem" onclick="handleMove(event, '${id}', '${o.id}')">${ICONS.folder}<span>${escapeHtml(o.name)}</span></button>`
    ).join('');
    return `
        <button class="menu-back" onclick="showMainSubmenu(event, '${id}')">${ICONS.back}<span>Back</span></button>
        <div class="menu-divider"></div>
        <button class="menu-accent" onclick="handleMoveToNewFolder(event, '${id}')">${ICONS.folderPlus}<span>Add New Folder</span></button>
        <div class="menu-divider"></div>
        <button onclick="handleMove(event, '${id}', null)">${ICONS.home}<span>Home</span></button>
        ${folderButtons || '<div class="menu-hint">No other folders yet</div>'}
    `;
}

window.toggleItemMenu = (e, id) => {
    e.stopPropagation();
    const addMenu = document.getElementById('quick-add-menu');
    if (addMenu) addMenu.classList.remove('open');
    const menu = document.getElementById(`item-menu-${id}`);
    if (!menu) return;
    const alreadyOpen = menu.classList.contains('open');
    closeAllItemMenus();
    if (!alreadyOpen) {
        menu.innerHTML = renderItemMenuMain(id);
        menu.classList.add('open');
        const wrapper = menu.closest('.link-tile');
        if (wrapper) wrapper.classList.add('menu-open');
    }
};

window.showMoveSubmenu = (e, id) => {
    e.stopPropagation();
    const menu = document.getElementById(`item-menu-${id}`);
    if (menu) menu.innerHTML = renderItemMenuFolders(id);
};

window.showMainSubmenu = (e, id) => {
    e.stopPropagation();
    const menu = document.getElementById(`item-menu-${id}`);
    if (menu) menu.innerHTML = renderItemMenuMain(id);
};

window.handleMove = (e, id, targetFolderId) => {
    e.stopPropagation();
    moveItem(id, targetFolderId || null);
};

window.handleMoveToNewFolder = (e, id) => {
    e.stopPropagation();
    const name = prompt("New folder name:");
    if (!name) return;
    const folder = { id: genId(), type: 'folder', name, children: [] };
    userLinks.push(folder);
    moveItem(id, folder.id);
};

window.handleDeleteFromMenu = (e, id) => {
    e.stopPropagation();
    const loc = findItemLocation(id);
    if (!loc) return;
    if (loc.item.type === 'folder') deleteFolderInline(id);
    else deleteLinkInline(id);
};

window.quickAddLink = (e) => {
    e.preventDefault();
    const url = prompt("Enter website URL (e.g., https://example.com):");
    if (!url) return;

    let name = prompt("Enter website name (optional):");
    let finalUrl = url.startsWith('http') ? url : `https://${url}`;

    if (!name) {
        try {
            const u = new URL(finalUrl);
            name = u.hostname.replace('www.', '').split('.')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
        } catch (err) {
            name = "New Link";
        }
    }

    getCurrentList().push({ id: genId(), type: 'link', name, url: finalUrl });
    saveLinks();
};

window.quickAddFolder = (e) => {
    if (e) e.preventDefault();
    const name = prompt("Folder name:");
    if (!name) return;
    getCurrentList().push({ id: genId(), type: 'folder', name, children: [] });
    saveLinks();
};

window.deleteLinkInline = (id) => {
    if (confirm('Delete this shortcut?')) {
        const loc = findItemLocation(id);
        if (loc) {
            loc.list.splice(loc.index, 1);
            saveLinks();
        }
    }
};

window.deleteFolderInline = (id) => {
    const loc = findItemLocation(id);
    if (!loc) return;
    const msg = loc.item.children.length
        ? `Delete folder "${loc.item.name}" and its ${loc.item.children.length} item(s)?`
        : `Delete folder "${loc.item.name}"?`;
    if (confirm(msg)) {
        loc.list.splice(loc.index, 1);
        folderPath = folderPath.filter(fid => fid !== id);
        saveLinks();
    }
};

// --- Settings tree editor ---
function renderTreeLevel(list, depth) {
    return list.map(item => item.type === 'folder' ? renderFolderRow(item, depth) : renderLinkRow(item, depth)).join('');
}

function renderLinkRow(item, depth) {
    return `
        <div class="link-edit-item" style="margin-left:${depth * 1.1}rem">
            <input type="text" value="${escapeHtml(item.name)}" onchange="updateItem('${item.id}', 'name', this.value)" placeholder="Name">
            <input type="text" value="${escapeHtml(item.url)}" onchange="updateItem('${item.id}', 'url', this.value)" placeholder="URL">
            <button class="btn-delete" onclick="deleteItem('${item.id}')" title="Delete">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>`;
}

function renderFolderRow(item, depth) {
    const collapsed = collapsedFolders.has(item.id);
    const childrenHtml = item.children.length
        ? renderTreeLevel(item.children, depth + 1)
        : `<div class="s-hint folder-empty-hint" style="margin-left:${(depth + 1) * 1.1}rem">Empty folder</div>`;

    return `
        <div class="folder-edit-group">
            <div class="folder-edit-header" style="margin-left:${depth * 1.1}rem">
                <button class="folder-toggle" onclick="toggleFolderCollapse('${item.id}')" title="${collapsed ? 'Expand' : 'Collapse'}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transform: rotate(${collapsed ? -90 : 0}deg); transition: transform .2s;"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="folder-icon-sm"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                <input type="text" class="folder-name-input" value="${escapeHtml(item.name)}" onchange="updateItem('${item.id}', 'name', this.value)" placeholder="Folder name">
                <div class="folder-edit-actions">
                    <button class="btn-icon-xs" onclick="addNewLink('${item.id}')" title="Add link inside">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                    <button class="btn-delete" onclick="deleteItem('${item.id}')" title="Delete folder">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>
            ${!collapsed ? `<div class="folder-edit-children">${childrenHtml}</div>` : ''}
        </div>`;
}

window.toggleFolderCollapse = (id) => {
    if (collapsedFolders.has(id)) collapsedFolders.delete(id);
    else collapsedFolders.add(id);
    renderLinkSettings();
};

function renderLinkSettings() {
    const list = document.getElementById('hotlinks-list');
    if (!list) return;
    list.innerHTML = renderTreeLevel(userLinks, 0);
}

window.updateItem = (id, field, value) => {
    const loc = findItemLocation(id);
    if (loc) loc.item[field] = value;
    saveLinks();
};

window.deleteItem = (id) => {
    const loc = findItemLocation(id);
    if (!loc) return;
    if (loc.item.type === 'folder' && loc.item.children.length > 0) {
        if (!confirm(`Delete folder "${loc.item.name}" and its ${loc.item.children.length} item(s)?`)) return;
    }
    loc.list.splice(loc.index, 1);
    collapsedFolders.delete(id);
    folderPath = folderPath.filter(fid => fid !== id);
    saveLinks();
};

window.addNewLink = (parentId) => {
    getListForParent(parentId).push({ id: genId(), type: 'link', name: 'New Link', url: 'https://' });
    if (parentId) collapsedFolders.delete(parentId);
    saveLinks();
};

window.addNewFolder = (parentId) => {
    getListForParent(parentId).push({ id: genId(), type: 'folder', name: 'New Folder', children: [] });
    if (parentId) collapsedFolders.delete(parentId);
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
