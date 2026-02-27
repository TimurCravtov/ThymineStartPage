// --- Widget Visibility ---
function toggleWidgetVisibility(widget, visible) {
    const map = {
        clock: ['#clock', '#greeting'],
        search: ['.search-box'],
        hotlinks: ['.quick-links'],
        calendar: ['.calendar-container'],
        focus: ['.focus-container']
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
window.toggleWidgetVisibility = toggleWidgetVisibility;

function loadWidgetVisibility() {
    const saved = JSON.parse(localStorage.getItem('widget_visibility') || '{}');
    Object.entries(saved).forEach(([widget, visible]) => {
        toggleWidgetVisibility(widget, visible);
        const checkbox = document.getElementById(`${widget}-visible`);
        if (checkbox) checkbox.checked = visible;
    });
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

// --- Settings Panel ---
function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
}
window.openSettings = openSettings;

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}
window.closeSettings = closeSettings;

function toggleSettingsSection(id) {
    const section = document.getElementById(id);
    if (section) section.classList.toggle('collapsed');
}
window.toggleSettingsSection = toggleSettingsSection;

// --- Custom CSS ---
const styleTag = document.createElement('style');
styleTag.id = 'custom-runtime-styles';
document.head.appendChild(styleTag);

function applyCustomCSS(css) {
    styleTag.textContent = css;
    localStorage.setItem('user_custom_css', css);
}

document.addEventListener('DOMContentLoaded', () => {
    // Widget visibility
    loadWidgetVisibility();

    // Custom CSS
    const cssEditor = document.getElementById('custom-css-editor');
    const savedCSS = localStorage.getItem('user_custom_css');
    if (savedCSS) {
        if (cssEditor) cssEditor.value = savedCSS;
        applyCustomCSS(savedCSS);
    }
    if (cssEditor) {
        cssEditor.addEventListener('input', (e) => applyCustomCSS(e.target.value));
    }

    // Background controls
    renderColorSwatches();
    const bgTypeSelect = document.getElementById('background-type');
    const bgColorCustom = document.getElementById('bg-color-custom');
    const bgImageInput = document.getElementById('bg-image-input');
    const clearBtn = document.getElementById('clear-bg-btn');

    if (bgTypeSelect) bgTypeSelect.addEventListener('change', (e) => toggleBgControls(e.target.value));
    if (bgColorCustom) {
        bgColorCustom.addEventListener('input', (e) => {
            applyBackground({ type: 'color', value: e.target.value });
            markSelectedSwatch(e.target.value);
        });
    }
    if (bgImageInput) bgImageInput.addEventListener('change', (e) => handleImageUpload(e.target.files && e.target.files[0]));
    if (clearBtn) clearBtn.addEventListener('click', (e) => { e.preventDefault(); clearBackground(); });

    loadSavedBackground();
});
