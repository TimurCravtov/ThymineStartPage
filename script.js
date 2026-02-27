function updateClock() {
    const clockElement = document.getElementById('clock');
    const greetingElement = document.getElementById('greeting');
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    clockElement.textContent = `${hours}:${minutes}`;
    
    let greeting = 'Good evening.';
    if (now.getHours() < 12) greeting = 'Good morning.';
    else if (now.getHours() < 18) greeting = 'Good afternoon.';
    
    greetingElement.textContent = greeting;
}

setInterval(updateClock, 1000);
updateClock();
