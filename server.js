const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Updated Proxy Route
app.get('/api/results', async (req, res) => {
    const { rollNo } = req.query;

    try {
        const response = await axios.get(
            `https://jntuhresults.dhethi.com/api/getAllResult?rollNumber=${encodeURIComponent(rollNo)}`,
            {
                headers: { accept: 'application/json' }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch data from API' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
