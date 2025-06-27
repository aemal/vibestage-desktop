const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require('electron');
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

let mainWindow; // Store reference to the main window

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
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

  const win = mainWindow; // Keep existing variable for compatibility

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

  // Register global shortcuts and IPC handlers
  win.webContents.once('did-finish-load', () => {
    console.log('Registering global shortcuts...');
    
    // Register the questions modal shortcut
    const questionsShortcut = globalShortcut.register('CommandOrControl+Shift+E', () => {
      console.log('🔥 Global shortcut triggered: Cmd+Shift+E');
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Enable mouse events when showing modal
        console.log('🖱️ Enabling mouse events for modal');
        mainWindow.setIgnoreMouseEvents(false);
        console.log('✅ Mouse events enabled via global shortcut');
        mainWindow.webContents.send('show-questions-modal');
      }
    });

    // Don't register global escape - handle it in the modal instead
    // const escapeShortcut = globalShortcut.register('Escape', () => {
    //   console.log('🔥 Escape key triggered');
    //   if (mainWindow && !mainWindow.isDestroyed()) {
    //     // Disable mouse events when closing modal
    //     console.log('🖱️ Disabling mouse events for escape');
    //     mainWindow.setIgnoreMouseEvents(true, { forward: true });
    //     console.log('✅ Mouse events disabled via escape key');
    //     mainWindow.webContents.send('close-modal');
    //   }
    // });
    const escapeShortcut = null; // Disabled to prevent conflicts

    // Register dev tools shortcut
    const devToolsShortcut = globalShortcut.register('CommandOrControl+Option+I', () => {
      console.log('Dev tools shortcut triggered');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.toggleDevTools();
      }
    });

    if (!questionsShortcut) {
      console.log('Questions shortcut registration failed');
    } else {
      console.log('Questions shortcut registered successfully');
    }

    if (!escapeShortcut) {
      console.log('Escape shortcut registration failed');
    } else {
      console.log('Escape shortcut registered successfully');
    }

    if (!devToolsShortcut) {
      console.log('DevTools shortcut registration failed');
    } else {
      console.log('DevTools shortcut registered successfully');
    }
  });

  // Handle IPC messages from renderer for mouse event control
  ipcMain.on('enable-mouse-events', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🖱️ IPC: Enabling mouse events');
      mainWindow.setIgnoreMouseEvents(false);
      console.log('✅ Mouse events enabled via IPC');
    }
  });

  ipcMain.on('disable-mouse-events', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🖱️ IPC: Disabling mouse events');
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      console.log('✅ Mouse events disabled via IPC');
    }
  });

  // Add a debug IPC handler to check mouse event status
  ipcMain.on('debug-mouse-events', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🔍 Debug: Current mouse events state');
      // Note: There's no direct way to check if mouse events are ignored, 
      // but we can try to enable them again
      mainWindow.setIgnoreMouseEvents(false);
      console.log('🔧 Debug: Force enabled mouse events');
    }
  });

  // Clean up shortcuts when window closes
  win.on('closed', () => {
    globalShortcut.unregisterAll();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Clean up global shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 