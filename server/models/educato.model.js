
const groq = require('../config/groq');
const EDUCATO_PROMPT = require('../config/educato.prompt');

class EducatoModel {

    static async chat(message, history = []) {

        const recentHistory = history.slice(-10);

        const messages = [
            {
                role: 'system',
                content: EDUCATO_PROMPT
            },
            ...recentHistory,
            {
                role: 'user',
                content: message
            }
        ];

        const response = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages,
            temperature: 0.8,
            max_tokens: 100
        });

        return response.choices[0].message.content;
    }
}

module.exports = EducatoModel;
