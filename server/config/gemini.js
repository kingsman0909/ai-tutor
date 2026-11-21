const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing from .env');
}

const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

module.exports = gemini;