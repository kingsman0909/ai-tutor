const express = require('express');
const multer = require('multer');

const EducatoController = require('../controllers/educato.controller');

const SpeechController = require('../controllers/speech.controller');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

router.post(
    '/chat',
    upload.single('audio'),
    EducatoController.chat
);
router.post(
    '/transcribe',
    upload.single('audio'),
    SpeechController.transcribe
);

module.exports = router;