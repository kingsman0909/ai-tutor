
class CartesiaModel {

    static async generateSpeech(text) {
        if (!process.env.CARTESIA_API_KEY) {
            throw new Error('CARTESIA_API_KEY is missing.');
        }

        if (!process.env.CARTESIA_VOICE_ID) {
            throw new Error('CARTESIA_VOICE_ID is missing.');
        }

        if (!text || !text.trim()) {
            throw new Error('Text is required for TTS.');
        }

        const response = await fetch(
            'https://api.cartesia.ai/tts/bytes',
            {
                method: 'POST',

                headers: {
                    'Authorization': `Bearer ${process.env.CARTESIA_API_KEY}`,
                    'Cartesia-Version': '2026-08-14',
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    model_id: 'sonic-3.6',

                    transcript: text,

                    voice: {
                        id: process.env.CARTESIA_VOICE_ID
                    },

                    language: 'tl-PH',

                    output_format: {
                        container: 'mp3',
                        sample_rate: 44100,
                        bit_rate: 128000
                    },

                    generation_config: {
                        speed: 1.05,
                        volume: 1.0,
                        emotion: 'sarcastic'
                    }
                })
            }
        );

        if (!response.ok) {
            const errorMessage = await response.text();

            throw new Error(
                `Cartesia API Error (${response.status}): ${errorMessage}`
            );
        }

        const audioBuffer = Buffer.from(
            await response.arrayBuffer()
        );

        if (!audioBuffer.length) {
            throw new Error('Cartesia returned empty audio.');
        }

        return audioBuffer;
    }
}

module.exports = CartesiaModel;
