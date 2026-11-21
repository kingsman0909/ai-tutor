
import React, { useState, useRef, useEffect } from 'react';
import '../styles/main.css';

const Main = () => {
    const [transcript, setTranscript] = useState('');
    const [reply, setReply] = useState('');
    const [listening, setListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [error, setError] = useState('');
    const [audioUrl, setAudioUrl] = useState('');

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const audioRef = useRef(null);
    const mountedRef = useRef(true);

    // Automatically play Cartesia-generated audio
    useEffect(() => {
        if (!audioUrl || !audioRef.current) return;

        const playAudio = async () => {
            try {
                await audioRef.current.play();
                setError('');
            } catch (err) {
                console.warn('Autoplay blocked:', err);
                setError('Tap Play Educato Voice to hear the response.');
            }
        };

        playAudio();
    }, [audioUrl]);

    // Cleanup on component unmount
    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }

            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }

            streamRef.current?.getTracks().forEach(track => {
                track.stop();
            });
        };
    }, [audioUrl]);

    // Stop Cartesia audio
    const stopSpeaking = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        setSpeaking(false);
    };

    // Manually play Cartesia audio
    const playEducatoVoice = async () => {
        if (!audioRef.current || !audioUrl) return;

        try {
            audioRef.current.currentTime = 0;
            await audioRef.current.play();
            setError('');
        } catch (err) {
            console.error('Audio Playback Error:', err);
            setError('Unable to play Educato voice. Please try again.');
        }
    };

    // Record microphone
    const handleSpeak = async () => {
        if (listening) {
            recorderRef.current?.stop();
            return;
        }

        try {
            setError('');
            setTranscript('');
            setReply('');

            stopSpeaking();

            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl('');
            }

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

                stream.getTracks().forEach(track => track.stop());

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

                stream.getTracks().forEach(track => track.stop());

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
            setError(err.message || 'Microphone access failed.');
        }
    };

    // Convert Base64 audio into an MP3 Blob URL
    const createAudioUrl = (base64Audio, mimeType = 'audio/mpeg') => {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], {
            type: mimeType
        });

        return URL.createObjectURL(blob);
    };

    // Send recorded audio to backend
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

            const response = await fetch(
                'https://ai-tutor-2mff.onrender.com/api/speech/chat',
                {
                    method: 'POST',
                    body: formData
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || 'Educato failed to respond.'
                );
            }

            const data = result.data;

            if (!data.reply) {
                throw new Error('Educato returned an empty response.');
            }

            if (!data.audio) {
                throw new Error(
                    'Cartesia did not return generated audio.'
                );
            }

            setTranscript(data.transcript);
            setReply(data.reply);

            // Stop previous audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            // Create audio from Cartesia response
            const newAudioUrl = createAudioUrl(
                data.audio,
                data.audioMimeType || 'audio/mpeg'
            );

            setAudioUrl(previousUrl => {
                if (previousUrl) {
                    URL.revokeObjectURL(previousUrl);
                }

                return newAudioUrl;
            });

            console.log('Transcription Provider:', data.transcriptionProvider);
            console.log('TTS Provider:', data.ttsProvider);

        } catch (err) {
            console.error('AI Error:', err);

            setError(
                err.message || 'Failed to connect to Educato.'
            );

        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

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

                    {/* User Question */}

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

                    {/* AI Response */}

                    <article className="chat-card response-card">

                        <div className="card-header">

                            <div className="card-icon">🤖</div>

                            <div>
                                <h3>AI Tutor</h3>
                                <span>
                                    AI-generated response
                                </span>
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

                        {/* Cartesia Audio Controls */}

                        {reply && audioUrl && (
                            <div className="speaker-controls">

                                <button
                                    className="speaker-button"
                                    onClick={playEducatoVoice}
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

                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    preload="auto"
                                    playsInline
                                    onPlay={() => {
                                        setSpeaking(true);
                                        setError('');
                                    }}
                                    onEnded={() => {
                                        setSpeaking(false);
                                    }}
                                    onPause={() => {
                                        setSpeaking(false);
                                    }}
                                    onError={() => {
                                        setSpeaking(false);
                                        setError(
                                            'Unable to load Cartesia audio.'
                                        );
                                    }}
                                />

                                <p className="audio-provider">
                                    Powered by Cartesia TTS
                                </p>

                            </div>
                        )}

                    </article>

                </div>

                {/* Main Controls */}

                <section className="controls">

                    <button
                        className={`record-button ${listening ? 'recording' : ''}`}
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
