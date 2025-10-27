// server.js
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Proxy Route
app.get('/api/results', async (req, res) => {
    const { rollNo } = req.query;
    if (!rollNo) return res.status(400).json({ error: 'rollNo query parameter is required' });

    try {
        const response = await axios.get(
            `https://jntuhresults.dhethi.com/api/getAllResult?rollNumber=${encodeURIComponent(rollNo)}`,
            {
                headers: { accept: 'application/json' },
                timeout: 15000
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('API fetch error:', (error.response && error.response.status) ? `${error.response.status} ${error.response.statusText}` : error.message || error);
        if (error.response && error.response.data) {
            return res.status(502).json({ error: 'Upstream API error', details: error.response.data });
        }
        res.status(500).json({ error: 'Failed to fetch data from API' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
