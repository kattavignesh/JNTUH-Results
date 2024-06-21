const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/fetchResults', async (req, res) => {
    const rollNo = req.body.rollNo;
    const url = `https://jntuhresults.up.railway.app/api/academicallresult?htno=${rollNo}`;

    try {
        const response = await axios.get(url);
        const resultsData = response.data.data.Results;
        res.json(resultsData);
    } catch (error) {
        res.status(500).send('Error fetching the academic result data');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
