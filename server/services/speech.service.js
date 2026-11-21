const SpeechModel = require('../models/speech.model');

class SpeechService {
    static async transcribeAudio(file) {
        if (!file) {
            throw new Error('Audio file is required.');
        }

        const mimeType = file.mimetype.split(';')[0];

        const allowedTypes = [
            'audio/webm',
            'audio/wav',
            'audio/mpeg',
            'audio/mp4',
            'audio/ogg'
        ];

        if (!allowedTypes.includes(mimeType)) {
            throw new Error('Unsupported audio format.');
        }

        const result = await SpeechModel.transcribe(
            file.buffer,
            mimeType
        );

        return {
            transcript: result.transcript,
            provider: result.provider
        };
    }
}

module.exports = SpeechService;