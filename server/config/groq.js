
const Groq = require('groq-sdk');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing.');
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

module.exports = groq;
