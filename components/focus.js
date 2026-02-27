// --- Focus Mode Logic ---

let focusTimer = null;
let focusTimeLeft = 25 * 60; // in seconds
let isFocusRunning = false;
let currentFocusMode = 'Work'; // 'Work' or 'Break'

function getFocusDurations() {
    return {
        work: parseInt(localStorage.getItem('settings_focus_work')) || 25,
        break: parseInt(localStorage.getItem('settings_focus_break')) || 5
    };
}

function updateFocusDisplay() {
    const min = Math.floor(focusTimeLeft / 60);
    const sec = focusTimeLeft % 60;
    const timeString = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    document.getElementById('focus-timer-display').textContent = timeString;
    if (isFocusRunning) {
        document.title = `${timeString} - ${currentFocusMode}`;
    } else {
        document.title = 'Start Page';
    }
}

function updateFocusModeLabel() {
    document.getElementById('focus-mode-label').textContent = currentFocusMode;
}

function resetFocusTimer() {
    clearInterval(focusTimer);
    isFocusRunning = false;
    document.getElementById('focus-btn-start').textContent = 'Start';
    const durations = getFocusDurations();
    focusTimeLeft = (currentFocusMode === 'Work' ? durations.work : durations.break) * 60;
    updateFocusDisplay();
    updateFocusModeLabel();
}

function switchFocusMode() {
    currentFocusMode = currentFocusMode === 'Work' ? 'Break' : 'Work';
    resetFocusTimer();
}

function toggleFocusTimer() {
    if (isFocusRunning) {
        clearInterval(focusTimer);
        isFocusRunning = false;
        document.getElementById('focus-btn-start').textContent = 'Resume';
        document.title = 'Start Page';
    } else {
        isFocusRunning = true;
        document.getElementById('focus-btn-start').textContent = 'Pause';
        focusTimer = setInterval(() => {
            focusTimeLeft--;
            if (focusTimeLeft < 0) {
                // Timer finished!
                // Play a simple beep
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    osc.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.5);
                } catch (e) { }

                switchFocusMode();
                toggleFocusTimer(); // auto-start next mode
            } else {
                updateFocusDisplay();
            }
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    resetFocusTimer();

    // Settings logic for focus mode
    const workInput = document.getElementById('focus-work-input');
    const breakInput = document.getElementById('focus-break-input');

    if (workInput) {
        workInput.value = getFocusDurations().work;
        workInput.addEventListener('change', (e) => {
            let val = Math.max(1, parseInt(e.target.value) || 25);
            e.target.value = val;
            localStorage.setItem('settings_focus_work', val);
            if (!isFocusRunning && currentFocusMode === 'Work') resetFocusTimer();
        });
    }

    if (breakInput) {
        breakInput.value = getFocusDurations().break;
        breakInput.addEventListener('change', (e) => {
            let val = Math.max(1, parseInt(e.target.value) || 5);
            e.target.value = val;
            localStorage.setItem('settings_focus_break', val);
            if (!isFocusRunning && currentFocusMode === 'Break') resetFocusTimer();
        });
    }
});
