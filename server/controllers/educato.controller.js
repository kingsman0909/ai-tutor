
const EducatoModel = require('../models/educato.model');
const SpeechModel = require('../models/speech.model');
const CartesiaModel = require('../models/cartesia.model');

class EducatoController {

    static async chat(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Voice recording is required.'
                });
            }

            let history = [];

            if (req.body.history) {
                try {
                    history = JSON.parse(req.body.history);
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid conversation history.'
                    });
                }
            }

            // STEP 1: TRANSCRIBE AUDIO
            const transcription = await SpeechModel.transcribe(
                req.file.buffer,
                req.file.mimetype
            );

            const recognizedText = transcription.transcript.trim();

            if (!recognizedText) {
                return res.status(400).json({
                    success: false,
                    message: 'No speech detected.'
                });
            }

            console.log('Recognized Voice:', recognizedText);

            // STEP 2: GENERATE EDUCATO RESPONSE
            const reply = await EducatoModel.chat(
                recognizedText,
                history
            );

            console.log('Educato Reply:', reply);

            // STEP 3: GENERATE CARTESIA VOICE
            const audioBuffer = await CartesiaModel.generateSpeech(reply);

            console.log('Cartesia TTS generated successfully.');

            // STEP 4: RETURN TEXT + AUDIO
            return res.status(200).json({
                success: true,
                message: 'Educato responded successfully.',

                data: {
                    transcript: recognizedText,
                    transcriptionProvider: transcription.provider,

                    reply,

                    audio: audioBuffer.toString('base64'),
                    audioMimeType: 'audio/mpeg',

                    provider: 'Groq',
                    ttsProvider: 'Cartesia'
                }
            });

        } catch (error) {
            console.error('Educato Error:', error);

            return res.status(500).json({
                success: false,
                message: 'Educato is temporarily unavailable.',
                error: error.message
            });
        }
    }
}

module.exports = EducatoController;
