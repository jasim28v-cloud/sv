const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(compression()); 
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/status', (req, res) => {
    res.json({ 
        message: "System Online",
        speed: "Optimized" 
    });
});

app.listen(PORT, () => {
    console.log(`System active on port ${PORT}`);
});
