
const gemini = require('../config/gemini');
const groq = require('../config/groq');

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

class SpeechModel {

    static async transcribeWithGroq(audioBuffer, mimeType) {
        const extensions = {
            'audio/webm': 'webm',
            'audio/wav': 'wav',
            'audio/mpeg': 'mp3',
            'audio/mp4': 'mp4',
            'audio/ogg': 'ogg'
        };

        const extension = extensions[mimeType] || 'webm';

        const file = new File(
            [audioBuffer],
            `recording.${extension}`,
            { type: mimeType }
        );

        const response = await groq.audio.transcriptions.create({
            file,
            model: 'whisper-large-v3',
            prompt: 'Transcribe Filipino, English, and Taglish accurately. Preserve the original spoken language and technical terms.',
            response_format: 'json',
            temperature: 0
        });

        return response.text || '';
    }

    static async transcribeWithGemini(audioBuffer, mimeType) {
        const audioBase64 = audioBuffer.toString('base64');

        const response = await gemini.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
            contents: [{
                role: 'user',
                parts: [
                    {
                        text: `Transcribe the provided audio accurately.
Recognize Filipino, English, and Taglish.
Preserve the original spoken language.
Do not translate Filipino words into English.
Preserve English technical terms.
Do not summarize or explain.
Return only the transcribed speech.`
                    },
                    {
                        inlineData: {
                            mimeType,
                            data: audioBase64
                        }
                    }
                ]
            }]
        });

        return response.text || '';
    }

    static async transcribe(audioBuffer, mimeType) {

        // PRIMARY: GROQ
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Groq attempt ${attempt}`);

                const transcript = await this.transcribeWithGroq(
                    audioBuffer,
                    mimeType
                );

                return {
                    transcript,
                    provider: 'Groq Whisper'
                };

            } catch (error) {
                const status = Number(error.status || error.code);

                console.error('Groq Error:', status, error.message);

                const retryable = [
                    408, 429, 500, 502, 503, 504
                ].includes(status);

                if (!retryable || attempt === 3) {
                    break;
                }

                await sleep(attempt * 2000);
            }
        }

        // FALLBACK: GEMINI
        console.log('Groq unavailable. Switching to Gemini...');

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`Gemini fallback attempt ${attempt}`);

                const transcript = await this.transcribeWithGemini(
                    audioBuffer,
                    mimeType
                );

                return {
                    transcript,
                    provider: 'Gemini'
                };

            } catch (error) {
                const status = Number(error.status || error.code);

                console.error('Gemini Error:', status, error.message);

                const retryable = [
                    408, 429, 500, 502, 503, 504
                ].includes(status);

                if (!retryable || attempt === 2) {
                    throw error;
                }

                await sleep(2000);
            }
        }
    }
}

module.exports = SpeechModel;
