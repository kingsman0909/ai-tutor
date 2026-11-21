
import React, { useState, useRef, useEffect } from 'react';
import '../styles/main.css';

const API_URL = 'https://ai-tutor-2mff.onrender.com/api/speech/chat';

const Main = () => {
    const [transcript, setTranscript] = useState('');
    const [reply, setReply] = useState('');
    const [listening, setListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [error, setError] = useState('');
    const [audioBase64, setAudioBase64] = useState('');

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const mountedRef = useRef(true);

    // ==========================================
    // AUDIO UNLOCK - IMPORTANT FOR IPHONE SAFARI
    // ==========================================

    const unlockAudio = async () => {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('Web Audio API is not supported.');
        }

        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
        }

        const context = audioContextRef.current;

        if (context.state === 'suspended') {
            await context.resume();
        }

        // Silent audio to initialize playback on iOS
        const buffer = context.createBuffer(
            1,
            1,
            context.sampleRate
        );

        const silentSource = context.createBufferSource();

        silentSource.buffer = buffer;
        silentSource.connect(context.destination);
        silentSource.start(0);
    };

    // ==========================================
    // PLAY CARTESIA AUDIO
    // ==========================================

    const playEducatoVoice = async (base64 = audioBase64) => {
        try {
            if (!base64) return;

            const context = audioContextRef.current;

            if (!context) {
                throw new Error(
                    'Audio is not initialized. Tap Start Speaking first.'
                );
            }

            if (context.state === 'suspended') {
                await context.resume();
            }

            // Convert Base64 to Uint8Array
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            // Decode MP3 audio
            const audioBuffer = await context.decodeAudioData(
                bytes.buffer.slice(0)
            );

            // Stop previous playback
            if (sourceRef.current) {
                try {
                    sourceRef.current.stop();
                } catch (err) {
                    // Already stopped
                }

                sourceRef.current = null;
            }

            const source = context.createBufferSource();

            source.buffer = audioBuffer;
            source.connect(context.destination);

            source.onended = () => {
                if (sourceRef.current === source) {
                    sourceRef.current = null;

                    if (mountedRef.current) {
                        setSpeaking(false);
                    }
                }
            };

            sourceRef.current = source;

            await context.resume();

            source.start(0);

            setSpeaking(true);
            setError('');

        } catch (err) {
            console.error('Cartesia Playback Error:', err);

            setSpeaking(false);

            setError(
                'Unable to play Educato voice. Please tap Play Educato Voice.'
            );
        }
    };

    // ==========================================
    // STOP AUDIO
    // ==========================================

    const stopSpeaking = () => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch (err) {
                // Already stopped
            }

            sourceRef.current = null;
        }

        setSpeaking(false);
    };

    // ==========================================
    // RECORD MICROPHONE
    // ==========================================

    const handleSpeak = async () => {
        // Stop recording when button is clicked again
        if (listening) {
            recorderRef.current?.stop();
            return;
        }

        try {
            setError('');
            setTranscript('');
            setReply('');
            setAudioBase64('');

            stopSpeaking();

            // Unlock audio while the user is interacting
            await unlockAudio();

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    'Microphone is not supported by this browser.'
                );
            }

            if (!window.MediaRecorder) {
                throw new Error(
                    'Audio recording is not supported by this browser.'
                );
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            streamRef.current = stream;
            chunksRef.current = [];

            const supportedTypes = [
                'audio/mp4',
                'audio/webm;codecs=opus',
                'audio/webm'
            ];

            const mimeType = supportedTypes.find(type =>
                MediaRecorder.isTypeSupported(type)
            );

            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType } : {}
            );

            recorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || 'audio/mp4'
                });

                stream.getTracks().forEach(track => {
                    track.stop();
                });

                streamRef.current = null;

                if (!mountedRef.current) return;

                setListening(false);

                if (!audioBlob.size) {
                    setError('No audio recorded. Please try again.');
                    return;
                }

                await sendAudio(audioBlob);
            };

            recorder.onerror = (event) => {
                console.error('Recorder Error:', event);

                stream.getTracks().forEach(track => {
                    track.stop();
                });

                streamRef.current = null;

                setListening(false);
                setError('Audio recording failed.');
            };

            recorder.start();

            setListening(true);

        } catch (err) {
            console.error('Microphone Error:', err);

            streamRef.current?.getTracks().forEach(track => {
                track.stop();
            });

            streamRef.current = null;

            setListening(false);

            setError(
                err.message || 'Microphone access failed.'
            );
        }
    };

    // ==========================================
    // SEND AUDIO TO BACKEND
    // ==========================================

    const sendAudio = async (audioBlob) => {
        try {
            setLoading(true);
            setError('');

            const formData = new FormData();

            const extension = audioBlob.type.includes('mp4')
                ? 'mp4'
                : audioBlob.type.includes('ogg')
                    ? 'ogg'
                    : 'webm';

            formData.append(
                'audio',
                audioBlob,
                `recording.${extension}`
            );

            formData.append('history', JSON.stringify([]));

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || 'Educato failed to respond.'
                );
            }

            const data = result.data;

            if (!data?.reply) {
                throw new Error('Educato returned an empty response.');
            }

            if (!data.audio) {
                throw new Error(
                    'Cartesia did not return generated audio.'
                );
            }

            if (!mountedRef.current) return;

            // Display response
            setTranscript(data.transcript || '');
            setReply(data.reply);
            setAudioBase64(data.audio);

            console.log(
                'Transcription Provider:',
                data.transcriptionProvider
            );

            console.log(
                'TTS Provider:',
                data.ttsProvider
            );

            console.log('Cartesia audio received.');

            // Automatically play the generated response
            await playEducatoVoice(data.audio);

        } catch (err) {
            console.error('AI Error:', err);

            if (mountedRef.current) {
                setError(
                    err.message || 'Failed to connect to Educato.'
                );
            }

        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

    // ==========================================
    // CLEANUP
    // ==========================================

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            if (sourceRef.current) {
                try {
                    sourceRef.current.stop();
                } catch (err) {
                    // Already stopped
                }

                sourceRef.current = null;
            }

            if (recorderRef.current?.state === 'recording') {
                recorderRef.current.stop();
            }

            streamRef.current?.getTracks().forEach(track => {
                track.stop();
            });

            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // ==========================================
    // UI
    // ==========================================

    return (
        <main className="main">

            <section className="educato-container">

                <header className="educato-header">

                    <div className="educato-brand">

                        <div className="brand-icon">E</div>

                        <div>
                            <h1>AI Tutor</h1>
                            <p>Your AI-powered learning assistant</p>
                        </div>

                    </div>

                    <div className="connection-status">
                        <span className="status-dot"></span>
                        AI Tutor
                    </div>

                </header>

                <div className="box">

                    {/* USER QUESTION */}

                    <article className="chat-card question-card">

                        <div className="card-header">

                            <div className="card-icon">🎤</div>

                            <div>
                                <h3>Your Question</h3>
                                <span>Voice transcription</span>
                            </div>

                        </div>

                        <div className="card-content">

                            {transcript || (
                                <span className="placeholder">
                                    Your speech will appear here...
                                </span>
                            )}

                        </div>

                    </article>

                    {/* AI RESPONSE */}

                    <article className="chat-card response-card">

                        <div className="card-header">

                            <div className="card-icon">🤖</div>

                            <div>
                                <h3>AI Tutor</h3>
                                <span>AI-generated response</span>
                            </div>

                        </div>

                        <div className="card-content">

                            {reply || (
                                <span className="placeholder">
                                    AI's explanation will appear here...
                                </span>
                            )}

                            {speaking && (
                                <p className="speaking-indicator">
                                    <span className="status-dot"></span>
                                    AI is speaking...
                                </p>
                            )}

                        </div>

                        {/* CARTESIA AUDIO CONTROLS */}

                        {reply && audioBase64 && (
                            <div className="speaker-controls">

                                <button
                                    className="speaker-button"
                                    onClick={() => playEducatoVoice()}
                                    disabled={speaking || loading}
                                >
                                    🔊 Play Educato Voice
                                </button>

                                {speaking && (
                                    <button
                                        className="stop-button"
                                        onClick={stopSpeaking}
                                    >
                                        ■ Stop Educato
                                    </button>
                                )}

                                <p className="audio-provider">
                                    Powered by Cartesia TTS
                                </p>

                            </div>
                        )}

                    </article>

                </div>

                {/* MAIN CONTROLS */}

                <section className="controls">

                    <button
                        className={`record-button ${
                            listening ? 'recording' : ''
                        }`}
                        onClick={handleSpeak}
                        disabled={loading || speaking}
                    >
                        {listening
                            ? '■ Stop Recording'
                            : '🎙 Start Speaking'}
                    </button>

                    <div className="activity-status">

                        {listening && (
                            <p className="recording-text">
                                <span className="status-dot"></span>
                                Recording your voice...
                            </p>
                        )}

                        {loading && (
                            <p>
                                Educato is thinking and generating voice...
                            </p>
                        )}

                        {error && (
                            <p className="error-message">
                                {error}
                            </p>
                        )}

                    </div>

                </section>

            </section>

        </main>
    );
};

export default Main;
