// --- Search Engine ---

function applySearchEngine(url) {
    const form = document.querySelector('.search-box form');
    if (form) form.action = url;
    localStorage.setItem('search_engine', url);
}

document.addEventListener('DOMContentLoaded', () => {
    const savedEngine = localStorage.getItem('search_engine');
    const searchEngineSelect = document.getElementById('search-engine');
    if (savedEngine) {
        applySearchEngine(savedEngine);
        if (searchEngineSelect) searchEngineSelect.value = savedEngine;
    }
    // Note: The HTML uses inline onchange="applySearchEngine(e.target.value)" directly or similar?
    // In script.js it was assigned via searchEngineSelect.onchange.
    // We already have generic applySearchEngine that is used inline? Actually the original code did:
    // if (searchEngineSelect) { searchEngineSelect.onchange = (e) => applySearchEngine(e.target.value); }
    if (searchEngineSelect) {
        searchEngineSelect.addEventListener('change', (e) => applySearchEngine(e.target.value));
    }
});
