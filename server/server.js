const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const speechRoutes = require('./routes/speech.route.js');

dotenv.config();

const app = express();

app.use(cors({
    origin: '*'
}));

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Educato AI API is running.'
    });
});

app.use('/api/speech', speechRoutes);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});