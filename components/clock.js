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
    if (!clockElement) return;
    clockElement.classList.remove('minimal', 'bold', 'glass', 'circular');
    if (style !== 'default') clockElement.classList.add(style);
    localStorage.setItem('settings_clock_style', style);
}

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);

    const clockStyleSelect = document.getElementById('clock-style');
    if (clockStyleSelect) {
        clockStyleSelect.onchange = (e) => applyClockStyle(e.target.value);
    }

    const savedStyle = localStorage.getItem('settings_clock_style');
    if (savedStyle && clockStyleSelect) {
        clockStyleSelect.value = savedStyle;
        applyClockStyle(savedStyle);
    }
});
