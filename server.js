const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve the remote controller interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'remote-controller.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Remote controller server running at http://localhost:${PORT}`);
});