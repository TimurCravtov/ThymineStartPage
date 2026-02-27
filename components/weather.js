// --- Weather Widget Logic ---

const WEATHER_CACHE_KEY = 'weather_data_cache';
const WEATHER_SETTINGS_KEY = 'weather_settings';

// Default settings
let weatherSettings = JSON.parse(localStorage.getItem(WEATHER_SETTINGS_KEY)) || {
    useGeolocation: true,
    latitude: null,
    longitude: null,
    city: ''
};

function saveWeatherSettings() {
    localStorage.setItem(WEATHER_SETTINGS_KEY, JSON.stringify(weatherSettings));
}

// WMO Weather interpretation codes (Open-Meteo)
const weatherCodes = {
    0: { desc: 'Clear sky', icon: '☀️' },
    1: { desc: 'Mainly clear', icon: '🌤️' },
    2: { desc: 'Partly cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Fog', icon: '🌫️' },
    48: { desc: 'Depositing rime fog', icon: '🌫️' },
    51: { desc: 'Light drizzle', icon: '🌧️' },
    53: { desc: 'Moderate drizzle', icon: '🌧️' },
    55: { desc: 'Dense drizzle', icon: '🌧️' },
    56: { desc: 'Light freezing drizzle', icon: '🌧️❄️' },
    57: { desc: 'Dense freezing drizzle', icon: '🌧️❄️' },
    61: { desc: 'Slight rain', icon: '🌦️' },
    63: { desc: 'Moderate rain', icon: '🌧️' },
    65: { desc: 'Heavy rain', icon: '🌧️' },
    66: { desc: 'Light freezing rain', icon: '🌧️❄️' },
    67: { desc: 'Heavy freezing rain', icon: '🌧️❄️' },
    71: { desc: 'Slight snow fall', icon: '🌨️' },
    73: { desc: 'Moderate snow fall', icon: '❄️' },
    75: { desc: 'Heavy snow fall', icon: '❄️' },
    77: { desc: 'Snow grains', icon: '❄️' },
    80: { desc: 'Slight rain showers', icon: '🌦️' },
    81: { desc: 'Moderate rain showers', icon: '🌧️' },
    82: { desc: 'Violent rain showers', icon: '🌧️' },
    85: { desc: 'Slight snow showers', icon: '🌨️' },
    86: { desc: 'Heavy snow showers', icon: '❄️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

function renderWeather(data) {
    const container = document.getElementById('weather-container');
    if (!container) return;

    // Check widget visibility
    const visibilitySaved = JSON.parse(localStorage.getItem('widget_visibility') || '{}');
    if (visibilitySaved.weather === false) {
        container.style.display = 'none';
    } else {
        container.style.display = 'flex';
    }

    if (!data) {
        container.innerHTML = '<div class="weather-loading">Loading weather...</div>';
        return;
    }

    if (data.error) {
        container.innerHTML = `<div class="weather-error">${data.error}</div>`;
        return;
    }

    const weather = weatherCodes[data.weathercode] || { desc: 'Unknown', icon: '❓' };

    container.innerHTML = `
        <div class="weather-icon">${weather.icon}</div>
        <div class="weather-info">
            <div class="weather-temp">${Math.round(data.temperature)}°C</div>
            <div class="weather-desc">${weather.desc}</div>
        </div>
    `;
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        const weatherData = data.current_weather;

        // Cache for 30 mins
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
            timestamp: new Date().getTime(),
            data: weatherData
        }));

        renderWeather(weatherData);
    } catch (e) {
        renderWeather({ error: 'Failed to find weather' });
    }
}

async function fetchWeatherByCity(city) {
    try {
        // Geocoding API to get lat/lon for city
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        if (!geoRes.ok) throw new Error('Geocoding API Error');
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            renderWeather({ error: 'City not found' });
            return;
        }

        const lat = geoData.results[0].latitude;
        const lon = geoData.results[0].longitude;

        await fetchWeatherByCoords(lat, lon);
    } catch (e) {
        renderWeather({ error: 'Failed to resolve city' });
    }
}

function initWeather() {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (cached) {
        const parsed = JSON.parse(cached);
        const age = (new Date().getTime() - parsed.timestamp) / 1000 / 60;
        if (age < 30) {
            renderWeather(parsed.data);
            return;
        }
    }

    renderWeather(null); // loading state

    if (weatherSettings.useGeolocation) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    weatherSettings.latitude = pos.coords.latitude;
                    weatherSettings.longitude = pos.coords.longitude;
                    saveWeatherSettings();
                    fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    renderWeather({ error: 'Location access denied' });
                }
            );
        } else {
            renderWeather({ error: 'Geolocation not supported' });
        }
    } else if (weatherSettings.city) {
        fetchWeatherByCity(weatherSettings.city);
    } else {
        renderWeather({ error: 'Configure weather in settings' });
    }
}

// Settings Integration
function initWeatherSettings() {
    const geoToggle = document.getElementById('weather-geo-toggle');
    const cityInput = document.getElementById('weather-city-input');

    if (!geoToggle || !cityInput) return;

    geoToggle.checked = weatherSettings.useGeolocation;
    cityInput.value = weatherSettings.city;
    cityInput.disabled = weatherSettings.useGeolocation;

    geoToggle.addEventListener('change', (e) => {
        weatherSettings.useGeolocation = e.target.checked;
        cityInput.disabled = weatherSettings.useGeolocation;
        saveWeatherSettings();

        // Clear cache and re-fetch using new setting
        localStorage.removeItem(WEATHER_CACHE_KEY);
        initWeather();
    });

    cityInput.addEventListener('change', (e) => {
        weatherSettings.city = e.target.value.trim();
        saveWeatherSettings();

        if (!weatherSettings.useGeolocation && weatherSettings.city) {
            localStorage.removeItem(WEATHER_CACHE_KEY);
            initWeather();
        }
    });

    // Add to visibility widgets array
    const visibilitySaved = JSON.parse(localStorage.getItem('widget_visibility') || '{}');
    const weatherVisible = visibilitySaved.weather !== false; // default true

    // We update window UI visibility logic dynamically in components/settings.js when its toggle triggers
}

// Hook into the main visibility logic globally
if (typeof window !== 'undefined') {
    // Override window toggleWidgetVisibility to also include weather manually since settings.js map runs early
    const originalToggle = window.toggleWidgetVisibility;
    window.toggleWidgetVisibility = function (widget, visible) {
        if (originalToggle) originalToggle(widget, visible);
        if (widget === 'weather') {
            const container = document.getElementById('weather-container');
            if (container) container.style.display = visible ? 'flex' : 'none';
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initWeather();
    initWeatherSettings();
});
