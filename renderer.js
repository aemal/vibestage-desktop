const emojis = ['😊', '🌟', '🎉', '🌈', '🎨', '🎭', '🎪', '🎯', '🎲', '🎮', '🎸', '🎹', '🎺', '🎻', '🎬'];
const emojiElement = document.getElementById('emoji');

function getRandomPosition() {
    const maxX = window.innerWidth - 100; // Account for emoji size
    const maxY = window.innerHeight - 100;
    return {
        x: Math.floor(Math.random() * maxX),
        y: Math.floor(Math.random() * maxY)
    };
}

function getRandomEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function updateEmoji() {
    const position = getRandomPosition();
    emojiElement.textContent = getRandomEmoji();
    emojiElement.style.left = `${position.x}px`;
    emojiElement.style.top = `${position.y}px`;
    emojiElement.style.opacity = '1'; // Always visible
}

// Initial emoji display
updateEmoji();

// Update emoji every 2 seconds
setInterval(updateEmoji, 2000); 