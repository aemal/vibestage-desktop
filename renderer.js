try {
    console.log('=== RENDERER.JS STARTING ===');
    if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write('renderer.js loaded\n');
    }
    console.log('renderer.js loaded');

    const { auth, db, rtdb, storage } = require('./firebase-config');
    console.log('Firebase config loaded');
    
    const { ref, onChildAdded, onChildChanged, set, update, get, onValue, remove } = require('firebase/database');
    console.log('Firebase database functions loaded');
    
    const { collection, addDoc } = require('firebase/firestore');
    console.log('Firestore functions loaded');
    
    const confetti = require('canvas-confetti');
    console.log('Canvas confetti loaded');

    // On app start, delete all emojiEvents
    remove(ref(rtdb, 'emojiEvents')).then(() => {
        const msg = 'All emojiEvents deleted on app start\n';
        console.log(msg);
        if (typeof process !== 'undefined' && process.stdout) process.stdout.write(msg);
    });

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

    let fadeTimeout = null;

    // Add floating animation style to the document head if not already present
    if (!document.getElementById('emoji-float-style')) {
        const style = document.createElement('style');
        style.id = 'emoji-float-style';
        style.textContent = `
        @keyframes emoji-float {
            0% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-40px) scale(1.08); }
            100% { transform: translateY(0px) scale(1); }
        }
        .emoji-float {
            animation: emoji-float 3s ease-in-out infinite;
        }
        `;
        document.head.appendChild(style);
    }

    function handleEmojiEvent(val, key) {
        console.log('=== handleEmojiEvent called ===');
        console.log('val:', val);
        console.log('key:', key);
        
        const emojiContainer = document.body;
        if (!emojiContainer) {
            console.log('No emoji container found');
            return;
        }
        function getRandomPosition() {
            const maxX = window.innerWidth - 120;
            const maxY = window.innerHeight - 120;
            return {
                x: Math.floor(Math.random() * maxX),
                y: Math.floor(Math.random() * maxY)
            };
        }
        const position = val.position || getRandomPosition();
        // Create a new emoji element
        // Try multiple ways to detect party emoji
        const isPartyEmoji = val.emoji === '🎉' || 
                            val.emoji.includes('🎉') || 
                            val.emoji.charCodeAt(0) === 127881 ||
                            val.emoji === '\uD83C\uDF89';
        
        // Try multiple ways to detect star emoji
        const isStarEmoji = val.emoji === '🌟' || 
                           val.emoji.includes('🌟') || 
                           val.emoji.charCodeAt(0) === 127775 ||
                           val.emoji === '\uD83C\uDF1F';
        
        console.log('Is party emoji?', isPartyEmoji);
        console.log('Is star emoji?', isStarEmoji);
        
        // If it's a party emoji, don't render the emoji - just show confetti
        if (isPartyEmoji) {
            console.log('🎉 emoji detected! Firing canvas-confetti...');
            
            // Helper function for random ranges
            function randomInRange(min, max) {
                return Math.random() * (max - min) + min;
            }
            
            console.log('About to call first confetti burst');
            confetti({
                angle: randomInRange(55, 125),
                spread: randomInRange(50, 70),
                particleCount: randomInRange(50, 100),
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
            });
            console.log('First confetti burst called');
            
            // Second burst after a short delay with different random parameters
            setTimeout(() => {
                console.log('About to call second confetti burst');
                confetti({
                    angle: randomInRange(55, 125),
                    spread: randomInRange(50, 70),
                    particleCount: randomInRange(50, 100),
                    origin: { y: 0.6 },
                    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
                });
                console.log('Second confetti burst called');
            }, 150);
            console.log('Canvas-confetti setup complete');
            
            // Don't render the emoji element - just return after confetti
            return;
        }
        
        // If it's a star emoji, show star confetti effect
        if (isStarEmoji) {
            console.log('🌟 emoji detected! Firing star confetti...');
            
            var defaults = {
                spread: 360,
                ticks: 50,
                gravity: 0,
                decay: 0.94,
                startVelocity: 30,
                colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8']
            };

            function shoot() {
                confetti({
                    ...defaults,
                    particleCount: 40,
                    scalar: 1.2,
                    shapes: ['star']
                });

                confetti({
                    ...defaults,
                    particleCount: 10,
                    scalar: 0.75,
                    shapes: ['circle']
                });
            }

            setTimeout(shoot, 0);
            setTimeout(shoot, 100);
            setTimeout(shoot, 200);
            
            console.log('Star confetti setup complete');
            
            // Don't render the emoji element - just return after confetti
            return;
        }
        
        // Only render emoji element for non-party emojis
        const emojiElem = document.createElement('span');
        emojiElem.style.position = 'absolute';
        emojiElem.style.left = `${position.x}px`;
        emojiElem.style.top = `${position.y}px`;
        emojiElem.style.fontSize = '120px';
        emojiElem.style.fontFamily = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
        emojiElem.style.userSelect = 'none';
        emojiElem.style.pointerEvents = 'none';
        emojiElem.style.opacity = '1';
        emojiElem.style.transition = 'opacity 1s';
        emojiElem.style.zIndex = '9999';
        emojiElem.classList.add('emoji-float');
        emojiElem.textContent = val.emoji;
        emojiContainer.appendChild(emojiElem);
        
        console.log('Emoji element created and added:', val.emoji);
        
        console.log('Not a 🎉 emoji, no confetti triggered');
        
        // Confetti animation for 🎉
        console.log('Received emoji:', val.emoji, 'Type:', typeof val.emoji);
        console.log('Emoji length:', val.emoji.length);
        console.log('Emoji char codes:', Array.from(val.emoji).map(char => char.charCodeAt(0)));
        
        // Fade out after 5 seconds
        setTimeout(() => {
            emojiElem.style.opacity = '0';
            // Remove from DOM after fade out
            setTimeout(() => {
                if (emojiElem.parentNode) {
                    emojiElem.parentNode.removeChild(emojiElem);
                }
                // Remove from database
                if (key) {
                    remove(ref(rtdb, 'emojiEvents/' + key));
                }
            }, 1000); // match transition duration
        }, 5000);
    }

    function listenForEmojiEvents() {
        console.log('Setting up Firebase listeners...');
        const emojiRef = ref(rtdb, 'emojiEvents');
        
        // First, check if there are existing emojis and mark as initialized
        get(emojiRef).then(snapshot => {
            if (snapshot.exists()) {
                initialized = true;
                console.log('Found existing emojis, marked as initialized');
            } else {
                console.log('No existing emojis, ready to show new ones');
            }
        });
        
        onChildAdded(emojiRef, (snapshot) => {
            console.log('onChildAdded triggered');
            const val = snapshot.val();
            const key = snapshot.key;
            console.log('Child added - val:', val, 'key:', key, 'initialized:', initialized);
            
            // Only skip if we found existing emojis during initialization
            if (!initialized) {
                initialized = true;
                console.log('First emoji received, setting initialized to true');
            }
            
            // Always handle the emoji event
            handleEmojiEvent(val, key);
        });
        
        onChildChanged(emojiRef, (snapshot) => {
            console.log('onChildChanged triggered');
            const val = snapshot.val();
            const key = snapshot.key;
            console.log('Child changed - val:', val, 'key:', key);
            handleEmojiEvent(val, key);
        });
    }

    console.log('About to call listenForEmojiEvents...');
    try {
        listenForEmojiEvents();
        console.log('listenForEmojiEvents called successfully');
    } catch (error) {
        console.error('Error calling listenForEmojiEvents:', error);
    }

    // Remove the old random emoji logic
    // function getRandomPosition() { ... }
    // function getRandomEmoji() { ... }
    // async function updateEmoji() { ... }
    // updateEmoji();
    // setInterval(updateEmoji, 2000); 
} catch (error) {
    console.error('ERROR IN RENDERER.JS:', error);
    alert('ERROR IN RENDERER.JS: ' + error.message);
} 