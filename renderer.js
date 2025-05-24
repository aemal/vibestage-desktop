if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('renderer.js loaded\n');
}
console.log('renderer.js loaded');

const { auth, db, rtdb, storage } = require('./firebase-config');
const { ref, onChildAdded, onChildChanged, set, update, get, onValue } = require('firebase/database');
const { collection, addDoc } = require('firebase/firestore');

// Minimal test read from emojiEvents
const testRef = ref(rtdb, 'emojiEvents');
get(testRef).then(snapshot => {
    if (snapshot.exists()) {
        if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write('Test read from emojiEvents: ' + JSON.stringify(snapshot.val()) + '\n');
        }
        console.log('Test read from emojiEvents:', snapshot.val());
    } else {
        if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write('Test read from emojiEvents: No data\n');
        }
        console.log('Test read from emojiEvents: No data');
    }
}).catch(error => {
    if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write('Test read error: ' + error.message + '\n');
    }
    console.error('Test read error:', error);
});

const emojis = ['😊', '🌟', '🎉', '🌈', '🎨', '🎭', '🎪', '🎯', '🎲', '🎮', '🎸', '🎹', '🎺', '🎻', '🎬'];
const emojiElement = document.getElementById('emoji');

// Rate limiting for emoji updates
const RATE_LIMIT_MS = 1000; // 1 second between updates
const lastUpdateTimes = new Map();

// Firebase Realtime Database functions
function initializeEmojiListener(emojiId, callback) {
  const emojiRef = ref(rtdb, `emojis/${emojiId}`);
  onValue(emojiRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
}

async function updateEmojiCount(emojiId, userId, increment = 1) {
  // Rate limiting check
  const now = Date.now();
  const lastUpdate = lastUpdateTimes.get(emojiId) || 0;
  if (now - lastUpdate < RATE_LIMIT_MS) {
    throw new Error('Rate limit exceeded. Please wait before updating again.');
  }

  // Input validation
  if (typeof increment !== 'number' || increment <= 0) {
    throw new Error('Invalid increment value');
  }

  const emojiRef = ref(rtdb, `emojis/${emojiId}`);
  try {
    await update(emojiRef, {
      count: increment,
      lastUpdated: now,
      [`users/${userId}`]: true
    });
    lastUpdateTimes.set(emojiId, now);
  } catch (error) {
    console.error('Error updating emoji count:', error);
    throw error;
  }
}

// Firestore functions for storing click data
async function saveClickData(emojiId, userData) {
  try {
    await addDoc(collection(db, 'clicks'), {
      emojiId,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      ...userData
    });
  } catch (error) {
    console.error('Error saving click data:', error);
    throw error;
  }
}

// Error handling
const handleFirebaseError = (error) => {
  switch (error.code) {
    case 'database/operation-failed':
      return 'Failed to update emoji count. Please try again.';
    case 'database/network-error':
      return 'Network error. Please check your internet connection.';
    case 'database/connection-lost':
      return 'Connection lost. Please check your internet connection.';
    case 'database/rate-limit-exceeded':
      return 'Too many updates. Please wait a moment before trying again.';
    default:
      return 'An error occurred. Please try again later.';
  }
};

// Connection monitoring
const monitorConnection = () => {
  const connectedRef = ref(rtdb, '.info/connected');
  onValue(connectedRef, (snap) => {
    if (snap.val() === false) {
      console.error('Lost connection to Firebase');
      // Handle connection loss - maybe show a message to the user
    }
  });
};

// Initialize connection monitoring
monitorConnection();

// Listen for emoji updates from Firebase
// Replace 'currentEmoji' with the actual key/path used in your Realtime Database for the latest emoji
const EMOJI_DB_PATH = 'emojiEvents';

let initialized = false;

// Global error handler
if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', function (err) {
        process.stdout.write('Uncaught Exception: ' + err + '\n');
        console.error('Uncaught Exception:', err);
    });
}

function handleEmojiEvent(val) {
    const log = (...args) => {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n';
        console.log(...args);
        if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(msg);
        }
    };
    if (!emojiElement) {
        const msg = 'emojiElement not found in DOM\n';
        console.log(msg);
        if (typeof process !== 'undefined' && process.stdout) process.stdout.write(msg);
        return;
    }
    log('Emoji event:', val);
    function getRandomPosition() {
        const maxX = window.innerWidth - 120;
        const maxY = window.innerHeight - 120;
        return {
            x: Math.floor(Math.random() * maxX),
            y: Math.floor(Math.random() * maxY)
        };
    }
    const position = val.position || getRandomPosition();
    emojiElement.textContent = val.emoji;
    emojiElement.style.left = `${position.x}px`;
    emojiElement.style.top = `${position.y}px`;
    emojiElement.style.opacity = '1';
    log('Emoji rendered:', val.emoji, 'at', position);
}

function listenForEmojiEvents() {
    const emojiRef = ref(rtdb, 'emojiEvents');
    onChildAdded(emojiRef, (snapshot) => {
        const val = snapshot.val();
        if (!initialized) {
            initialized = true;
            // Skip initial batch
            return;
        }
        handleEmojiEvent(val);
    });
    onChildChanged(emojiRef, (snapshot) => {
        const val = snapshot.val();
        handleEmojiEvent(val);
    });
    // Add onValue debug listener
    onValue(emojiRef, (snapshot) => {
        const data = snapshot.val();
        const msg = 'onValue data: ' + JSON.stringify(data) + '\n';
        console.log(msg);
        if (typeof process !== 'undefined' && process.stdout) process.stdout.write(msg);
    });
}

listenForEmojiEvents();

// Remove the old random emoji logic
// function getRandomPosition() { ... }
// function getRandomEmoji() { ... }
// async function updateEmoji() { ... }
// updateEmoji();
// setInterval(updateEmoji, 2000); 