
const EducatoModel = require('../models/educato.model');
const SpeechModel = require('../models/speech.model');

class EducatoController {

    static async chat(req, res) {
        try {
            // Get audio file from request
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Voice recording is required.'
                });
            }

            // Parse conversation history
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

            // STEP 2: SEND TRANSCRIPT TO EDUCATO
            const reply = await EducatoModel.chat(
                recognizedText,
                history
            );

            return res.status(200).json({
                success: true,
                message: 'Educato responded successfully.',
                data: {
                    transcript: recognizedText,
                    transcriptionProvider: transcription.provider,
                    reply,
                    provider: 'Groq'
                }
            });

        } catch (error) {
            console.error('Educato Error:', error);

            return res.status(500).json({
                success: false,
                message: 'Educato is temporarily unavailable.'
            });
        }
    }
}

module.exports = EducatoController;
