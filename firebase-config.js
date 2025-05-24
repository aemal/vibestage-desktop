const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const { getDatabase } = require('firebase/database');
const { getStorage } = require('firebase/storage');

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

module.exports = { app, auth, db, rtdb, storage }; 