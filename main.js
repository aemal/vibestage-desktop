const { app, BrowserWindow, screen } = require('electron');
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const { getDatabase } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZvlz3uUec58kSZp9BajzkjzJBsh8b4Es",
  authDomain: "vibestage-d76c5.firebaseapp.com",
  databaseURL: "https://vibestage-d76c5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vibestage-d76c5",
  storageBucket: "vibestage-d76c5.firebasestorage.app",
  messagingSenderId: "749848512177",
  appId: "1:749848512177:web:1ea2df06bdeb1456a04490",
  measurementId: "G-K6S4E7036J"
};

// Initialize Firebase in the main process
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const rtdb = getDatabase(firebaseApp);

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    type: 'panel',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // macOS specific settings
  if (process.platform === 'darwin') {
    // Set window to be visible on all workspaces
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // Use a combination of window levels for maximum visibility
    win.setAlwaysOnTop(true, 'main-menu');
    win.setAlwaysOnTop(true, 'dock');
    
    // Disable window buttons and fullscreen capability
    win.setWindowButtonVisibility(false);
    win.setFullScreenable(false);
    
    // Set window to ignore mouse events but forward them
    win.setIgnoreMouseEvents(true, { forward: true });
    
    // Additional macOS specific settings
    win.setHasShadow(false);
    win.setFocusable(false);
    
    // Handle window state changes
    win.on('enter-full-screen', () => {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setAlwaysOnTop(true, 'main-menu');
    });
    
    win.on('leave-full-screen', () => {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setAlwaysOnTop(true, 'main-menu');
    });

    // Additional event handlers for better window management
    win.on('show', () => {
      win.setAlwaysOnTop(true, 'main-menu');
    });

    win.on('focus', () => {
      win.setAlwaysOnTop(true, 'main-menu');
    });
  }

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
}); 