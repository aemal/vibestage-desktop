try {
    console.log('🚀 RENDERER.JS STARTING - TIMESTAMP:', Date.now());
    const fs = require('fs');
    const path = require('path');
    let config = { showEmojis: true };
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (error) {
        console.error('Error reading config.json:', error);
    }
    console.log('=== RENDERER.JS STARTING ===');
    if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write('renderer.js loaded\n');
    }
    console.log('renderer.js loaded');

    const { ipcRenderer } = require('electron');
    
    const { auth, db, rtdb, storage } = require('./firebase-config');

    console.log('Firebase config loaded');
    
    const { ref, onChildAdded, onChildChanged, set, update, get, onValue, remove } = require('firebase/database');
    console.log('Firebase database functions loaded');
    
    const { collection, addDoc, onSnapshot, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } = require('firebase/firestore');
    console.log('Firestore functions loaded');
    
    const confetti = require('canvas-confetti');
    console.log('Canvas confetti loaded');

    // On app start, delete all emojiEvents
    remove(ref(rtdb, 'emojiEvents')).then(() => {
        const msg = 'All emojiEvents deleted on app start\n';
        console.log(msg);
        if (typeof process !== 'undefined' && process.stdout) process.stdout.write(msg);
    });

    // On app start, reset workshop pace to zero
    set(ref(rtdb, 'workshopSpeed'), {
        'too-slow': 0,
        'just-right': 0,
        'too-fast': 0,
        lastUpdated: Date.now()
    }).then(() => {
        const msg = 'Workshop pace reset to zero on app start\n';
        console.log(msg);
        if (typeof process !== 'undefined' && process.stdout) process.stdout.write(msg);
    }).catch(error => {
        console.error('Error resetting workshop pace:', error);
        if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write('Error resetting workshop pace: ' + error.message + '\n');
        }
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

    // DISABLE the old emoji element to prevent duplicate displays
    const emojiElement = document.getElementById('emoji');
    if (emojiElement) {
        emojiElement.style.display = 'none'; // Hide the old emoji system
        console.log('🚫 Disabled old emoji element to prevent duplicates');
    }

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

    // Workshop speed feedback functionality
    let workshopSpeedData = {
        'too-slow': 0,
        'just-right': 0,
        'too-fast': 0
    };

    function initializeWorkshopSpeedListener() {
        console.log('Setting up workshop speed listener...');
        const speedRef = ref(rtdb, 'workshopSpeed');

        onValue(speedRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                workshopSpeedData = {
                    'too-slow': data['too-slow'] || 0,
                    'just-right': data['just-right'] || 0,
                    'too-fast': data['too-fast'] || 0
                };

                // Update the modal if it's open
                updateWorkshopSpeedDisplay();

                console.log('Workshop speed updated:', workshopSpeedData);
            }
        });
    }

    function updateWorkshopSpeedDisplay() {
        const tooSlowElement = document.getElementById('too-slow-count');
        const justRightElement = document.getElementById('just-right-count');
        const tooFastElement = document.getElementById('too-fast-count');

        if (tooSlowElement) tooSlowElement.textContent = workshopSpeedData['too-slow'];
        if (justRightElement) justRightElement.textContent = workshopSpeedData['just-right'];
        if (tooFastElement) tooFastElement.textContent = workshopSpeedData['too-fast'];
    }

    // Initialize workshop speed listener
    initializeWorkshopSpeedListener();

    // Listen for emoji updates from Firebase
    // Replace 'currentEmoji' with the actual key/path used in your Realtime Database for the latest emoji
    const EMOJI_DB_PATH = 'emojiEvents';

    let initialized = false;
    let processedEmojiKeys = new Set(); // Track processed emoji keys to prevent duplicates
    let activeEmojiInstances = new Map(); // Track active emoji DOM elements to prevent duplicates

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
        @keyframes question-bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0px) scale(1); }
            40% { transform: translateY(-30px) scale(1.2); }
            60% { transform: translateY(-15px) scale(1.1); }
        }
        .question-bounce {
            animation: question-bounce 2s ease-in-out infinite;
        }
        `;
        document.head.appendChild(style);
    }

    function handleEmojiEvent(val, key) {
        console.log('🎨 === handleEmojiEvent called ===');
        console.log('🎨 val:', val);
        console.log('🎨 key:', key);
        console.log('🎨 Emoji received:', val.emoji);
        console.log('🎨 config.showEmojis:', config.showEmojis);

        // CRITICAL: Check if this emoji is already being displayed
        if (activeEmojiInstances.has(key)) {
            console.log('🚫 DUPLICATE PREVENTION: Emoji already exists for key:', key);
            return;
        }

        if (!config.showEmojis && val.source !== 'question') {
            console.log('🚫 Emojis disabled for non-questions, removing:', key);
            if (key) {
                remove(ref(rtdb, 'emojiEvents/' + key));
                processedEmojiKeys.delete(key); // Clean up tracking
            }
            return;
        }
        console.log('Emoji char codes:', val.emoji ? Array.from(val.emoji).map(char => char.charCodeAt(0)) : 'no emoji');
        
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
        // Try multiple ways to detect party emoji (Unicode emojis)
        const isPartyEmoji = val.emoji === '🎉' || 
                            val.emoji.includes('🎉') || 
                            val.emoji.charCodeAt(0) === 127881 ||
                            val.emoji === '\uD83C\uDF89';
        
        // Try multiple ways to detect star emoji (Unicode emojis)
        const isStarEmoji = val.emoji === '🌟' || 
                           val.emoji.includes('🌟') || 
                           val.emoji.charCodeAt(0) === 127775 ||
                           val.emoji === '\uD83C\uDF1F';
        
        console.log('Is party emoji?', isPartyEmoji);
        console.log('Is star emoji?', isStarEmoji);
        
        // If it's a party emoji, don't render the emoji - just show confetti
        if (isPartyEmoji) {
            console.log('🎉 PARTY EMOJI DETECTED! Firing canvas-confetti...');
            
            // Check if confetti is available
            if (typeof confetti === 'undefined') {
                console.error('❌ Confetti library not available!');
                return;
            }
            
            console.log('✅ Confetti library is available, proceeding...');
            
            // Helper function for random ranges
            function randomInRange(min, max) {
                return Math.random() * (max - min) + min;
            }
            
            try {
                console.log('About to call first confetti burst');
                confetti({
                    angle: randomInRange(55, 125),
                    spread: randomInRange(50, 70),
                    particleCount: randomInRange(50, 100),
                    origin: { y: 0.6 },
                    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
                });
                console.log('✅ First confetti burst completed');
                
                // Second burst after a short delay with different random parameters
                setTimeout(() => {
                    try {
                        console.log('About to call second confetti burst');
                        confetti({
                            angle: randomInRange(55, 125),
                            spread: randomInRange(50, 70),
                            particleCount: randomInRange(50, 100),
                            origin: { y: 0.6 },
                            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
                        });
                        console.log('✅ Second confetti burst completed');
                    } catch (error) {
                        console.error('❌ Error in second confetti burst:', error);
                    }
                }, 150);
                console.log('✅ Canvas-confetti setup complete - NOT rendering emoji');
            } catch (error) {
                console.error('❌ Error in confetti animation:', error);
            }
            
            // Don't render the emoji element - just return after confetti
            return;
        }
        
        // If it's a star emoji, show star confetti effect
        if (isStarEmoji) {
            console.log('🌟 STAR EMOJI DETECTED! Firing star confetti...');
            
            // Check if confetti is available
            if (typeof confetti === 'undefined') {
                console.error('❌ Confetti library not available for star!');
                return;
            }
            
            console.log('✅ Confetti library is available for star, proceeding...');
            
            try {
                var defaults = {
                    spread: 360,
                    ticks: 50,
                    gravity: 0,
                    decay: 0.94,
                    startVelocity: 30,
                    colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8']
                };

                function shoot() {
                    try {
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
                        console.log('✅ Star confetti burst completed');
                    } catch (error) {
                        console.error('❌ Error in star confetti burst:', error);
                    }
                }

                setTimeout(shoot, 0);
                setTimeout(shoot, 100);
                setTimeout(shoot, 200);
                
                console.log('✅ Star confetti setup complete - NOT rendering emoji');
            } catch (error) {
                console.error('❌ Error in star confetti animation:', error);
            }
            
            // Don't render the emoji element - just return after confetti
            return;
        }

        // Check if it's a question emoji (waving hand)
        const emojiStr = String(val.emoji);
        const isQuestionEmoji = emojiStr.includes('👋') || emojiStr.includes('🙋');
        
        if (isQuestionEmoji) {
            console.log('❓ Question emoji detected! Adding question bounce effect...');
            // Question emojis will be rendered with special bounce animation
        }
        
        // Only render emoji element for non-party/star emojis
        console.log('🎭 CREATING EMOJI ELEMENT FOR:', val.emoji, 'KEY:', key);


        const emojiElem = document.createElement('div');
        emojiElem.style.position = 'absolute';
        emojiElem.style.left = `${position.x}px`;
        emojiElem.style.top = `${position.y}px`;
        emojiElem.style.fontSize = '120px';
        emojiElem.style.fontFamily = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        emojiElem.style.lineHeight = '1';
        emojiElem.style.display = 'block';
        emojiElem.style.width = 'auto';
        emojiElem.style.height = 'auto';
        emojiElem.style.color = 'initial'; // Reset any color inheritance
        emojiElem.style.webkitFontFeatureSettings = '"liga", "kern"';
        emojiElem.style.fontFeatureSettings = '"liga", "kern"';
        emojiElem.style.textRendering = 'optimizeQuality';
        emojiElem.style.userSelect = 'none';
        emojiElem.style.pointerEvents = 'none'; // Allow clicks to pass through
        emojiElem.style.opacity = '1';
        emojiElem.style.transition = 'opacity 1s';
        emojiElem.style.zIndex = '1000'; // Lower z-index to ensure click-through

        // CRITICAL: Track this emoji instance to prevent duplicates
        activeEmojiInstances.set(key, emojiElem);
        
        // Apply appropriate animation based on emoji type
        if (isQuestionEmoji) {
            emojiElem.classList.add('question-bounce');
        } else {
            emojiElem.classList.add('emoji-float');
        }
        
        // Try using innerHTML with HTML entity to force color rendering
        if (val.emoji === '👋') {
            emojiElem.innerHTML = '&#x1F44B;'; // HTML entity for waving hand emoji
        } else if (val.emoji === '🙋') {
            emojiElem.innerHTML = '&#x1F64B;'; // HTML entity for raising hand emoji
        } else {
            emojiElem.textContent = val.emoji;
        }
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
                // CRITICAL: Clean up all tracking when emoji is removed
                if (key) {
                    remove(ref(rtdb, 'emojiEvents/' + key));
                    processedEmojiKeys.delete(key); // Clean up tracking
                    activeEmojiInstances.delete(key); // Clean up instance tracking
                    console.log('🧹 Cleaned up emoji:', key);
                }
            }, 1000); // match transition duration
        }, 5000);
    }

    let emojiListenerActive = false; // Guard to prevent multiple listeners
    let emojiListenerUnsubscribes = []; // Store unsubscribe functions

    function listenForEmojiEvents() {
        if (emojiListenerActive) {
            console.log('⚠️ Emoji listener already active, skipping setup');
            return;
        }

        console.log('🔥 Setting up Firebase listeners...');

        emojiListenerActive = true;
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
        
        // Use off() to clear any existing listeners first
        const { off } = require('firebase/database');
        off(emojiRef);
        console.log('🧹 Cleared any existing listeners');

        const unsubscribeAdded = onChildAdded(emojiRef, (snapshot) => {
            console.log('🔥 onChildAdded triggered');
            const val = snapshot.val();
            const key = snapshot.key;

            console.log('🔥 Child added - val:', val, 'key:', key, 'initialized:', initialized);
            console.log('🔥 Processed keys so far:', Array.from(processedEmojiKeys));

            // Check if we've already processed this emoji
            if (processedEmojiKeys.has(key)) {
                console.log('⚠️ Emoji already processed, skipping:', key);
                return;
            }

            // Only skip if we found existing emojis during initialization
            if (!initialized) {
                initialized = true;
                console.log('🔥 First emoji received, setting initialized to true');
            }

            // Mark as processed and handle the emoji event
            processedEmojiKeys.add(key);
            console.log('✅ Processing emoji:', val.emoji, 'key:', key);
            handleEmojiEvent(val, key);
        });

        // Store unsubscribe functions
        emojiListenerUnsubscribes.push(unsubscribeAdded);

        // Remove onChildChanged completely since it's causing duplicates
        console.log('🚫 Skipping onChildChanged to prevent duplicates');
    }

    // Questions functionality
    let questionsData = [];
    let draggedElement = null;

    // Drag and drop functionality
    function handleDragStart(e) {
        draggedElement = e.target;
        e.target.style.opacity = '0.5';
        e.target.style.transform = 'rotate(2deg)';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        console.log('🔄 Started dragging question:', e.target.dataset.questionId);
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        if (e.target !== draggedElement) {
            e.target.style.borderTop = '3px solid #007bff';
        }
    }

    function handleDragLeave(e) {
        e.target.style.borderTop = '';
    }

    function handleDrop(e) {
        e.preventDefault();
        e.target.style.borderTop = '';
        
        if (e.target !== draggedElement && e.target.draggable) {
            const questionsList = e.target.parentNode;
            const allQuestions = [...questionsList.children];
            const draggedIndex = allQuestions.indexOf(draggedElement);
            const targetIndex = allQuestions.indexOf(e.target);
            
            if (draggedIndex < targetIndex) {
                questionsList.insertBefore(draggedElement, e.target.nextSibling);
            } else {
                questionsList.insertBefore(draggedElement, e.target);
            }
            
            // Save new order to localStorage
            saveQuestionOrder(questionsList);
            console.log('✅ Question order updated and saved');
        }
    }

    function handleDragEnd(e) {
        e.target.style.opacity = '';
        e.target.style.transform = '';
        // Clear any remaining border styles
        const questionsList = e.target.parentNode;
        [...questionsList.children].forEach(item => {
            item.style.borderTop = '';
        });
    }

    // localStorage functions for question order
    function saveQuestionOrder(questionsList) {
        const order = [...questionsList.children].map((item, index) => ({
            id: item.dataset.questionId,
            index: index
        }));
        localStorage.setItem('vibestage-question-order', JSON.stringify(order));
        console.log('💾 Saved question order:', order);
    }

    function getSavedQuestionOrder() {
        try {
            const saved = localStorage.getItem('vibestage-question-order');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading saved question order:', error);
            return [];
        }
    }

    function reorderQuestionsByIndex(questions, savedOrder) {
        if (!savedOrder || savedOrder.length === 0) {
            return questions;
        }
        
        // Create a map of question IDs to questions for quick lookup
        const questionMap = new Map(questions.map(q => [q.id, q]));
        
        // Create ordered array based on saved order
        const orderedQuestions = [];
        const usedIds = new Set();
        
        // First, add questions in saved order
        savedOrder.forEach(orderItem => {
            const question = questionMap.get(orderItem.id);
            if (question) {
                orderedQuestions.push(question);
                usedIds.add(orderItem.id);
            }
        });
        
        // Then add any new questions that weren't in the saved order
        questions.forEach(question => {
            if (!usedIds.has(question.id)) {
                orderedQuestions.push(question);
            }
        });
        
        return orderedQuestions;
    }

    function handleNewQuestion(questionData) {
        console.log('🔥 handleNewQuestion called with:', questionData);
        
        // Validate question data
        if (!questionData || (!questionData.text && !questionData.question)) {
            console.warn('⚠️  Invalid question data, skipping emoji');
            return;
        }
        
        console.log('✅ Valid question data, proceeding with emoji...');
        
        // Add hand-raising emoji for new questions
        // Try different emoji options to find one that renders in color
        const randomEmoji = '👋'; // Try waving hand which might render better
        
        const timestamp = Date.now();
        const emojiEventRef = ref(rtdb, 'emojiEvents/' + timestamp);
        const emojiData = {
            emoji: randomEmoji,
            position: null, // Will use random position
            timestamp: timestamp,
            source: 'question',
            questionId: questionData.id,
            questionText: questionData.text || questionData.question
        };
        
        console.log('🎯 Adding emoji event to Firebase:', emojiData);
        console.log('🎯 Question emoji selected:', randomEmoji);
        
        set(emojiEventRef, emojiData).then(() => {
            console.log('✅ Question emoji added to Firebase events successfully!');
        }).catch(error => {
            console.error('❌ Error adding question emoji to Firebase:', error);
            console.error('Error details:', error.code, error.message);
        });

        // Store question data locally for quick access (avoid duplicates)
        const existingIndex = questionsData.findIndex(q => q.id === questionData.id);
        if (existingIndex === -1) {
            questionsData.push(questionData);
            console.log('📝 Question added to local storage. Total questions:', questionsData.length);
        } else {
            console.log('📝 Question already exists in local storage, skipping duplicate');
        }
    }

    let appStartupComplete = false; // Track if app startup is complete
    let loadedQuestionIds = new Set(); // Track questions loaded during startup
    let deletingQuestionIds = new Set(); // Track questions being deleted to prevent emoji triggers

    function listenForQuestions() {
        console.log('Setting up Firestore questions listener...');
        const questionsRef = collection(db, 'questions');
        
        // First load existing questions without triggering emojis
        console.log('Loading existing questions...');
        getDocs(questionsRef).then((snapshot) => {
            console.log('✅ Firestore connection successful!');
            questionsData = [];
            loadedQuestionIds.clear();
            
            snapshot.forEach((doc) => {
                const questionData = { id: doc.id, ...doc.data() };
                console.log('Existing question found (no emoji):', questionData.text || questionData.question);
                questionsData.push(questionData);
                loadedQuestionIds.add(questionData.id); // Track this question ID
            });
            
            console.log(`📊 Loaded ${questionsData.length} existing questions (startup mode - no emojis)`);
            
            // Mark startup as complete after a delay
            setTimeout(() => {
                appStartupComplete = true;
                console.log('🚀 App startup complete - will now trigger emojis for new questions only');
            }, 2000); // 2 second delay to ensure all startup questions are loaded
            
        }).catch(error => {
            console.error('❌ Error connecting to Firestore:', error);
            console.error('Firestore error details:', error.code, error.message);
        });
        
        // Listen for real-time updates
        console.log('🔄 Setting up real-time listener...');
        const unsubscribe = onSnapshot(questionsRef, 
            (snapshot) => {
                console.log('📨 Firestore snapshot received!');
                
                snapshot.docChanges().forEach((change) => {
                    const questionData = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'added') {
                        // Only trigger emojis if:
                        // 1. App startup is complete AND
                        // 2. This is not a question we loaded during startup AND
                        // 3. This question is not being deleted (to prevent emoji on delete operations)
                        console.log('🔍 Checking question for emoji trigger:', {
                            id: questionData.id,
                            text: questionData.text || questionData.question,
                            appStartupComplete,
                            isLoadedQuestion: loadedQuestionIds.has(questionData.id),
                            isBeingDeleted: deletingQuestionIds.has(questionData.id),
                            deletingIds: Array.from(deletingQuestionIds)
                        });
                        
                        if (appStartupComplete && !loadedQuestionIds.has(questionData.id) && !deletingQuestionIds.has(questionData.id)) {
                            console.log('🆕 NEW question detected (triggering emoji):', questionData.text || questionData.question);
                            handleNewQuestion(questionData);
                        } else {
                            if (deletingQuestionIds.has(questionData.id)) {
                                console.log('🚫 Skipping emoji for question being deleted:', questionData.text || questionData.question);
                            } else {
                                console.log('📄 Startup question or already loaded (no emoji):', questionData.text || questionData.question);
                            }
                            // Just add to local data without emoji
                            const existingIndex = questionsData.findIndex(q => q.id === questionData.id);
                            if (existingIndex === -1) {
                                questionsData.push(questionData);
                            }
                        }
                    } else if (change.type === 'modified') {
                        console.log('✏️  Question modified:', questionData.text || questionData.question);
                        // Update local data
                        const index = questionsData.findIndex(q => q.id === questionData.id);
                        if (index !== -1) {
                            questionsData[index] = questionData;
                        }
                    } else if (change.type === 'removed') {
                        console.log('🗑️  Question removed:', questionData.text || questionData.question);
                        // Remove from local data and tracking
                        const index = questionsData.findIndex(q => q.id === questionData.id);
                        if (index !== -1) {
                            questionsData.splice(index, 1);
                        }
                        loadedQuestionIds.delete(questionData.id);
                    }
                });
            }, 
            (error) => {
                console.error('❌ Firestore listener error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                
                // Try to reconnect after a delay
                setTimeout(() => {
                    console.log('🔄 Attempting to reconnect to Firestore...');
                    listenForQuestions();
                }, 5000);
            }
        );
        
        console.log('🎧 Real-time listener set up successfully');
        
        // Store unsubscribe function for cleanup if needed
        window.questionsUnsubscribe = unsubscribe;
    }

    function showQuestionsModal() {
        console.log('Showing questions modal...');
        
        // Tell main process to enable mouse events
        ipcRenderer.send('enable-mouse-events');
        
        // Always recreate the modal to ensure fresh content and remove any caching
        let modal = document.getElementById('questions-modal');
        if (modal) {
            modal.remove(); // Remove existing modal
            console.log('Removed existing modal to recreate with fresh data');
        }

        // Create modal
        modal = document.createElement('div');
        modal.id = 'questions-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 80vw;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 16px;
        `;

        // Workshop speed feedback section
        const speedFeedback = document.createElement('div');
        speedFeedback.style.cssText = `
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        `;

        const speedTitle = document.createElement('h3');
        speedTitle.textContent = 'Workshop Speed Feedback';
        speedTitle.style.cssText = `
            margin: 0 0 15px 0;
            color: #333;
            font-size: 1.2em;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const speedStats = document.createElement('div');
        speedStats.id = 'speed-stats';
        speedStats.style.cssText = `
            display: flex;
            justify-content: space-around;
            text-align: center;
            gap: 15px;
        `;

        // Create speed stat elements
        const tooSlowStat = document.createElement('div');
        tooSlowStat.innerHTML = `
            <div style="font-size: 1.8em; font-weight: bold; color: #dc3545; margin-bottom: 5px;" id="too-slow-count">0</div>
            <div style="font-size: 0.9em; color: #666;">Too Slow</div>
        `;

        const justRightStat = document.createElement('div');
        justRightStat.innerHTML = `
            <div style="font-size: 1.8em; font-weight: bold; color: #28a745; margin-bottom: 5px;" id="just-right-count">0</div>
            <div style="font-size: 0.9em; color: #666;">Just Right</div>
        `;

        const tooFastStat = document.createElement('div');
        tooFastStat.innerHTML = `
            <div style="font-size: 1.8em; font-weight: bold; color: #ffc107; margin-bottom: 5px;" id="too-fast-count">0</div>
            <div style="font-size: 0.9em; color: #666;">Too Fast</div>
        `;

        speedStats.appendChild(tooSlowStat);
        speedStats.appendChild(justRightStat);
        speedStats.appendChild(tooFastStat);

        speedFeedback.appendChild(speedTitle);
        speedFeedback.appendChild(speedStats);

        const title = document.createElement('h2');
        title.textContent = 'Questions';
        title.style.cssText = `
            margin: 0;
            color: #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        header.appendChild(speedFeedback);
        header.appendChild(title);

        const questionsList = document.createElement('div');
        questionsList.style.cssText = `
            max-height: 500px;
            overflow-y: auto;
        `;

        if (questionsData.length === 0) {
            const noQuestions = document.createElement('p');
            noQuestions.textContent = 'No questions yet.';
            noQuestions.style.cssText = `
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 40px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            questionsList.appendChild(noQuestions);
        } else {
            // Load saved order from localStorage
            const savedOrder = getSavedQuestionOrder();
            const orderedQuestions = reorderQuestionsByIndex(questionsData, savedOrder);
            
            orderedQuestions.forEach((question, index) => {
                const questionItem = document.createElement('div');
                questionItem.draggable = true;
                questionItem.dataset.questionId = question.id;
                questionItem.dataset.originalIndex = index;
                questionItem.style.cssText = `
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    background: #fafafa;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    transition: all 0.2s ease;
                `;
                
                // Add drag handle visual indicator
                const dragHandle = document.createElement('div');
                dragHandle.innerHTML = ':::';
                dragHandle.style.cssText = `
                    color: #999;
                    font-size: 14px;
                    margin-right: 12px;
                    cursor: grab;
                    user-select: none;
                    line-height: 1;
                    font-weight: bold;
                    letter-spacing: 1px;
                `;
                
                // Drag event listeners
                questionItem.addEventListener('dragstart', handleDragStart);
                questionItem.addEventListener('dragover', handleDragOver);
                questionItem.addEventListener('drop', handleDrop);
                questionItem.addEventListener('dragenter', handleDragEnter);
                questionItem.addEventListener('dragleave', handleDragLeave);
                questionItem.addEventListener('dragend', handleDragEnd);

                const questionContent = document.createElement('div');
                questionContent.style.cssText = `
                    flex: 1;
                    display: flex;
                    align-items: center;
                `;

                const questionText = document.createElement('div');
                questionText.textContent = question.text || question.question || 'No question text';
                questionText.style.cssText = `
                    font-size: 16px;
                    line-height: 1.5;
                    color: #333;
                    flex: 1;
                `;

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = 'DELETE';
                deleteBtn.style.cssText = `
                    background: #dc3545;
                    color: white;
                    border: 2px solid #dc3545;
                    border-radius: 8px;
                    width: 90px;
                    height: 36px;
                    font-size: 12px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-left: 16px;
                    flex-shrink: 0;
                    transition: all 0.2s;
                    user-select: none;
                    outline: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: relative;
                    z-index: 9999;
                    pointer-events: auto;
                    display: block;
                    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
                `;
                
                // Ensure the button is definitely clickable
                deleteBtn.setAttribute('type', 'button');
                deleteBtn.setAttribute('role', 'button');
                deleteBtn.setAttribute('tabindex', '0');
                
                deleteBtn.addEventListener('mouseenter', () => {
                    console.log('🖱️ Delete button hover for:', question.text || question.question);
                    if (!deleteBtn.disabled) {
                        deleteBtn.style.background = '#bb2d3b';
                        deleteBtn.style.transform = 'scale(1.05)';
                        deleteBtn.style.boxShadow = '0 4px 8px rgba(220, 53, 69, 0.4)';
                    }
                });
                
                deleteBtn.addEventListener('mouseleave', () => {
                    if (!deleteBtn.disabled) {
                        deleteBtn.style.background = '#dc3545';
                        deleteBtn.style.transform = 'scale(1)';
                        deleteBtn.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.3)';
                    }
                });


                // Simplified and reliable click handler
                deleteBtn.addEventListener('click', async function(e) {
                    e.stopPropagation(); // Only stop propagation to prevent modal close
                    console.log('🟢 DELETE BUTTON CLICKED!', question.id, question.text || question.question);
                    
                    // Disable button during deletion to prevent double-clicks
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = 'DELETING...';
                    deleteBtn.style.background = '#6c757d';
                    deleteBtn.style.cursor = 'not-allowed';
                    deleteBtn.style.transform = 'scale(1)';
                    deleteBtn.style.boxShadow = 'none';
                    
                    try {
                        // Mark this question as being deleted to prevent emoji triggers
                        deletingQuestionIds.add(question.id);
                        loadedQuestionIds.add(question.id);
                        console.log('🚫 Marked question as being deleted:', question.id);
                        
                        // Delete from Firestore
                        console.log('🗑️ Starting Firestore deletion for:', question.id);
                        await deleteDoc(doc(db, 'questions', question.id));
                        console.log('✅ Question deleted from Firestore:', question.id);
                        
                        // Remove from local array
                        const index = questionsData.findIndex(q => q.id === question.id);
                        if (index !== -1) {
                            questionsData.splice(index, 1);
                            console.log('✅ Question removed from local data');
                        }
                        
                        // Remove from DOM with animation
                        questionItem.style.transition = 'opacity 0.3s ease-out';
                        questionItem.style.opacity = '0';
                        setTimeout(() => {
                            if (questionItem.parentNode) {
                                questionItem.remove();
                                console.log('✅ Question removed from DOM');
                            }
                        }, 300);
                        
                        // Clean up the deleting flag
                        setTimeout(() => {
                            deletingQuestionIds.delete(question.id);
                            console.log('🧹 Cleaned up deleting flag for:', question.id);
                        }, 1000);
                        
                        // Update the "no questions" message if needed
                        if (questionsData.length === 0) {
                            setTimeout(() => {
                                questionsList.innerHTML = `
                                    <p style="text-align: center; color: #666; font-style: italic; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                        No questions yet.
                                    </p>
                                `;
                                console.log('📝 Updated to show "no questions" message');
                            }, 350);
                        }
                    } catch (error) {
                        console.error('❌ Error deleting question:', error);
                        console.error('Error details:', error.code, error.message);
                        
                        // Re-enable button on error
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = 'DELETE';
                        deleteBtn.style.background = '#dc3545';
                        deleteBtn.style.cursor = 'pointer';
                        deleteBtn.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.3)';
                        
                        // Remove from deleting set on error
                        deletingQuestionIds.delete(question.id);
                        
                        // Show error message
                        alert('Failed to delete question. Please try again.');
                    }
                });

                questionContent.appendChild(dragHandle);
                questionContent.appendChild(questionText);
                questionItem.appendChild(questionContent);
                questionItem.appendChild(deleteBtn);
                questionsList.appendChild(questionItem);
            });
        }

        modalContent.appendChild(header);
        modalContent.appendChild(questionsList);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Update workshop speed display when modal is shown
        updateWorkshopSpeedDisplay();

        // Ensure mouse events stay enabled
        setTimeout(() => {
            console.log('🔍 Modal ready - ensuring mouse events stay enabled');
            ipcRenderer.send('enable-mouse-events');
        }, 100);

        // Close modal when clicking outside (but not on content)
        modal.addEventListener('click', (e) => {
            // Only close if clicking directly on the modal backdrop, not on any content
            if (e.target === modal) {
                console.log('Clicked outside modal - closing');
                closeQuestionsModal();
            }
        });

        // Add keyboard listener for escape key within modal
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                console.log('Escape key pressed in modal - closing');
                closeQuestionsModal();
            }
        });

        // Make modal focusable so it can receive keyboard events
        modal.setAttribute('tabindex', '-1');
        
        // Focus the modal after a brief delay to ensure it's rendered
        setTimeout(() => {
            modal.focus();
            console.log('Modal focused and ready for interaction');
        }, 100);
    }

    // IPC handler for global shortcuts
    function setupIPCListeners() {
        // Listen for messages from main process
        ipcRenderer.on('show-questions-modal', () => {
            console.log('🔥 Global shortcut received from main process!');
            showQuestionsModal();
        });

        ipcRenderer.on('close-modal', () => {
            console.log('🔥 Close modal received from main process!');
            closeQuestionsModal();
        });

        console.log('🎧 IPC listeners set up for global shortcuts (Cmd+Shift+E, Escape)');
    }

    function closeQuestionsModal() {
        const modal = document.getElementById('questions-modal');
        if (modal) {
            // Remove the modal from DOM instead of just hiding it
            modal.remove();
            console.log('Modal closed and removed');
            
            // RESTORE click-through behavior by disabling mouse events
            ipcRenderer.send('disable-mouse-events');
            console.log('✅ Click-through restored - mouse events disabled');
        }
    }

    console.log('About to call listenForEmojiEvents...');
    try {
        listenForEmojiEvents();
        console.log('listenForEmojiEvents called successfully');
    } catch (error) {
        console.error('Error calling listenForEmojiEvents:', error);
    }

    console.log('About to call listenForQuestions...');
    try {
        listenForQuestions();
        console.log('listenForQuestions called successfully');
    } catch (error) {
        console.error('Error calling listenForQuestions:', error);
    }

    console.log('Setting up IPC listeners...');
    try {
        setupIPCListeners();
        console.log('IPC listeners set up successfully');
        
        // Ensure click-through is working on startup
        setTimeout(() => {
            ipcRenderer.send('disable-mouse-events');
            console.log('✅ Click-through ensured on startup');
        }, 1000);
    } catch (error) {
        console.error('Error setting up IPC listeners:', error);
    }

    // Test function to add a sample question (for testing purposes)
    window.addTestQuestion = async function(questionText) {
        try {
            const questionsRef = collection(db, 'questions');
            await addDoc(questionsRef, {
                text: questionText || 'This is a test question?',
                timestamp: serverTimestamp(),
                source: 'test'
            });
            console.log('Test question added successfully!');
        } catch (error) {
            console.error('Error adding test question:', error);
        }
    };

    // Test function to manually trigger emoji for existing questions
    window.testExistingQuestions = function() {
        console.log('🧪 Testing existing questions...');
        if (questionsData.length === 0) {
            console.log('No questions found. Try running: addTestQuestion("Test question?")');
            return;
        }
        questionsData.forEach(question => {
            console.log('Triggering emoji for:', question.text || question.question);
            handleNewQuestion(question);
        });
    };

    // Debug function to check Firestore connection
    window.debugFirestore = async function() {
        try {
            console.log('🔍 Debugging Firestore connection...');
            const questionsRef = collection(db, 'questions');
            const snapshot = await getDocs(questionsRef);
            console.log('📊 Firestore debug results:');
            console.log('- Connection: ✅ Success');
            console.log('- Documents found:', snapshot.size);
            snapshot.forEach((doc) => {
                console.log('- Document:', doc.id, doc.data());
            });
        } catch (error) {
            console.error('❌ Firestore debug error:', error);
        }
    };

    // Test function to check if delete buttons are working
    window.testDeleteButtons = function() {
        const modal = document.getElementById('questions-modal');
        if (!modal) {
            console.log('❌ No modal found. Open the questions modal first with Cmd+Shift+E');
            return;
        }
        
        const deleteButtons = modal.querySelectorAll('button');
        console.log('🔍 Found', deleteButtons.length, 'delete buttons');
        
        deleteButtons.forEach((btn, index) => {
            console.log(`Button ${index}:`, btn.textContent, 'Style:', btn.style.background);            
            // Add a direct click test
            btn.addEventListener('click', () => {
                console.log(`🧪 TEST: Button ${index} was clicked!`);
            });
        });
        
        if (deleteButtons.length > 0) {
            console.log('🧪 Try clicking the DELETE buttons - they should work properly');
            console.log('🧪 Or call testDeleteFirst() to delete the first question directly');
        }
    };

    // Test function to delete the first question directly
    window.testDeleteFirst = async function() {
        if (questionsData.length === 0) {
            console.log('❌ No questions to delete');
            return;
        }
        
        const firstQuestion = questionsData[0];
        console.log('🧪 Testing delete for first question:', firstQuestion.text || firstQuestion.question);
        
        try {
            await deleteDoc(doc(db, 'questions', firstQuestion.id));
            console.log('✅ First question deleted successfully!');
            
            // Remove from local array
            questionsData.shift();
            console.log('✅ Removed from local data');
            
            console.log('🔄 Refresh the modal to see changes');
        } catch (error) {
            console.error('❌ Error deleting first question:', error);
        }
    };

    // Test function to programmatically click the first delete button
    window.testClickFirst = function() {
        const modal = document.getElementById('questions-modal');
        if (!modal) {
            console.log('❌ No modal found. Open the questions modal first with Cmd+Shift+E');
            return;
        }
        
        const deleteButtons = modal.querySelectorAll('button[textContent*="DELETE"], button:not([textContent*="✕"])');
        console.log('🔍 Found delete buttons:', deleteButtons.length);
        
        if (deleteButtons.length === 0) {
            console.log('❌ No delete buttons found');
            return;
        }
        
        // Try clicking the first delete button programmatically
        const firstBtn = Array.from(deleteButtons).find(btn => btn.textContent.includes('DELETE'));
        if (firstBtn) {
            console.log('🧪 Programmatically clicking first delete button...');
            firstBtn.click();
        } else {
            console.log('❌ No DELETE button found');
        }
    };

    // Simple test to check if mouse events are working at all
    window.testMouseEvents = function() {
        console.log('🧪 Testing if mouse events work...');
        
        // Tell main process to enable mouse events explicitly
        ipcRenderer.send('enable-mouse-events');
        
        // Also send debug message to main process
        ipcRenderer.send('debug-mouse-events');
        
        setTimeout(() => {
            console.log('🖱️ Mouse events should be enabled now. Try clicking anywhere and check console.');
            console.log('📋 Check terminal output for main process mouse event logs');
        }, 100);
    };

    // Test function to force enable clickability
    window.forceClickable = function() {
        console.log('🔧 Forcing all buttons to be clickable...');
        const modal = document.getElementById('questions-modal');
        if (!modal) {
            console.log('❌ No modal found');
            return;
        }
        
        // Force enable pointer events on everything
        modal.style.pointerEvents = 'auto';
        
        const allButtons = modal.querySelectorAll('button');
        allButtons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            btn.style.zIndex = '99999';
            btn.style.position = 'relative';
            btn.style.border = '3px solid red'; // Make them super visible
            
            // Remove all existing event listeners and add new ones
            btn.onclick = function(e) {
                console.log(`🔴 FORCED CLICK on button ${i}:`, btn.textContent);
                e.stopPropagation();
                return false;
            };
        });
        
        console.log('✅ Forced', allButtons.length, 'buttons to be clickable with red borders');
    };

    // Test confetti functionality
    window.testConfetti = function() {
        console.log('🧪 Testing confetti functionality...');
        
        if (typeof confetti === 'undefined') {
            console.error('❌ Confetti library not loaded!');
            return;
        }
        
        console.log('✅ Confetti library is available');
        
        try {
            // Test basic confetti
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            console.log('✅ Basic confetti test completed');
            
            // Test party emoji detection
            const testPartyEmoji = {
                emoji: '🎉',
                position: { x: 200, y: 200 }
            };
            console.log('🧪 Testing party emoji detection...');
            handleEmojiEvent(testPartyEmoji, 'test-key');
            
        } catch (error) {
            console.error('❌ Error testing confetti:', error);
        }
    };

    // Test mouse click-through
    window.testClickThrough = function() {
        console.log('🧪 Testing click-through functionality...');
        console.log('Try clicking on the screen. You should be able to click through emojis.');
        
        // ENSURE click-through is enabled by disabling mouse events
        ipcRenderer.send('disable-mouse-events');
        console.log('✅ Disabled mouse events to enable click-through');
        
        // Add a test emoji to check click-through
        const testDiv = document.createElement('div');
        testDiv.style.position = 'absolute';
        testDiv.style.left = '50px';
        testDiv.style.top = '50px';
        testDiv.style.width = '100px';
        testDiv.style.height = '100px';
        testDiv.style.background = 'rgba(255, 0, 0, 0.5)';
        testDiv.style.pointerEvents = 'none';
        testDiv.style.zIndex = '1000';
        testDiv.textContent = 'CLICK THROUGH TEST';
        document.body.appendChild(testDiv);
        
        console.log('🔴 Red test element added. You should be able to click through it.');
        
        setTimeout(() => {
            testDiv.remove();
            console.log('🧹 Test element removed');
        }, 5000);
    };

    // Force enable click-through
    window.forceClickThrough = function() {
        console.log('🔧 Force enabling click-through...');
        ipcRenderer.send('disable-mouse-events'); // Disable to allow click-through
        console.log('✅ Mouse events disabled - clicks should pass through now');
    };

    // Emergency delete function that bypasses all UI
    window.emergencyDeleteAll = async function() {
        console.log('🚨 EMERGENCY: Deleting all questions directly from Firestore...');
        try {
            const questionsRef = collection(db, 'questions');
            const snapshot = await getDocs(questionsRef);
            
            console.log('📊 Found', snapshot.size, 'questions to delete');
            
            const deletePromises = [];
            snapshot.forEach((doc) => {
                console.log('🗑️ Deleting:', doc.id, doc.data().text || doc.data().question);
                deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            console.log('✅ All questions deleted successfully!');
            
            // Clear local data
            questionsData.length = 0;
            console.log('✅ Local data cleared');
            
        } catch (error) {
            console.error('❌ Emergency delete failed:', error);
        }
    };



    console.log('Questions feature setup complete! Use addTestQuestion("Your question here?") in console to test.');
    console.log('Press Cmd+Shift+E (global shortcut) to show all questions.');
    // Debug function to check current state
    window.debugState = function() {
        console.log('🔍 Current app state:');
        console.log('- Questions data:', questionsData.length, 'questions');
        console.log('- App startup complete:', appStartupComplete);
        console.log('- Loaded question IDs:', Array.from(loadedQuestionIds));
        console.log('- Currently deleting IDs:', Array.from(deletingQuestionIds));
        console.log('- Saved question order:', getSavedQuestionOrder());
        questionsData.forEach((q, i) => {
            console.log(`  Question ${i}:`, q.id, q.text || q.question);
        });
    };

    // Debug function to clear saved question order
    window.clearQuestionOrder = function() {
        localStorage.removeItem('vibestage-question-order');
        console.log('🧹 Cleared saved question order from localStorage');
        console.log('💡 Refresh the modal to see questions in default order');
    };

    // Debug function to show current saved order
    window.showSavedOrder = function() {
        const saved = getSavedQuestionOrder();
        console.log('💾 Current saved question order:', saved);
        return saved;
    };

    // Function to clean up any test borders that might be visible
    window.cleanupTestBorders = function() {
        const modal = document.getElementById('questions-modal');
        if (modal) {
            const allButtons = modal.querySelectorAll('button');
            allButtons.forEach(btn => {
                btn.style.border = '';
            });
            console.log('🧹 Cleaned up all test borders from modal buttons');
        }
        
        // Also clean up any other elements that might have test borders
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.style.border && el.style.border.includes('yellow')) {
                el.style.border = '';
            }
        });
        console.log('✅ All yellow test borders removed');
    };

    // Test function for question emojis
    window.testQuestionEmoji = function() {
        console.log('🧪 Testing question emoji...');
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const questionEmoji = '👋';
                console.log(`Test ${i + 1}: Selected emoji:`, questionEmoji);
                
                // Simulate adding to Firebase
                const timestamp = Date.now() + i;
                const emojiEventRef = ref(rtdb, 'emojiEvents/' + timestamp);
                const emojiData = {
                    emoji: questionEmoji,
                    position: null,
                    timestamp: timestamp,
                    source: 'test'
                };
                
                set(emojiEventRef, emojiData).then(() => {
                    console.log(`✅ Test emoji ${i + 1} added successfully:`, questionEmoji);
                }).catch(error => {
                    console.error(`❌ Test emoji ${i + 1} failed:`, error);
                });
            }, i * 1000); // 1 second delay between each test
        }
        console.log('🎲 Will show 3 question emojis over 3 seconds...');
    };

    console.log('Available debug commands:');
    console.log('- debugState() - Check current app state');
    console.log('- debugFirestore() - Check Firestore connection');
    console.log('- addTestQuestion("text") - Add a new test question');
    console.log('- testDeleteButtons() - Test if delete buttons are clickable');
    console.log('- testConfetti() - Test confetti animations');
    console.log('- testClickThrough() - Test if clicks pass through emojis');
    console.log('- forceClickThrough() - Force enable click-through if blocked');
    console.log('- emergencyDeleteAll() - Delete all questions bypassing UI');
    console.log('- showSavedOrder() - Show current saved question order');
    console.log('- clearQuestionOrder() - Clear saved question order');
    console.log('- cleanupTestBorders() - Remove any yellow test borders');
    console.log('- testQuestionEmoji() - Test question emojis');
    console.log('- location.reload() - Force refresh if you see cached content');
    console.log('');
    console.log('🔧 CLICK-THROUGH ISSUE FIXED:');
    console.log('- Mouse events are properly disabled when modal closes');
    console.log('- Run forceClickThrough() if clicks are still blocked');
    console.log('');
    console.log('To test functionality:');
    console.log('1. Press Cmd+Shift+E to open questions modal');
    console.log('2. Title should show just "Questions" (not "? Questions")');
    console.log('3. DELETE buttons should work properly');
    console.log('4. Questions are now DRAGGABLE - drag the ::: handle to reorder');
    console.log('5. Question order is automatically saved to localStorage');
    console.log('6. New questions show 👋 question emoji with bounce animation');
    console.log('7. Run testConfetti() to test 🎉 confetti');
    console.log('8. Run testClickThrough() to test mouse click-through');

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