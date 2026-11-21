const SpeechService = require('../services/speech.service');

class SpeechController {
    static async transcribe(req, res) {
        try {
            const result = await SpeechService.transcribeAudio(req.file);

            return res.status(200).json({
                success: true,
                message: 'Audio transcribed successfully.',
                data: result
            });

        } catch (error) {
            console.error('Speech Controller Error:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Transcription failed.'
            });
        }
    }
}

module.exports = SpeechController;