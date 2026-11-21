
import React, { useState, useRef, useEffect } from 'react';
import '../styles/main.css';

const Main = () => {
    const [transcript, setTranscript] = useState('');
    const [reply, setReply] = useState('');
    const [listening, setListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [error, setError] = useState('');

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const voicesRef = useRef([]);
    const mountedRef = useRef(true);

    // Clean AI response before speaking
    const cleanText = (text) => {
        return text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/#{1,6}\s?/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^\s*[-*]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .trim();
    };

    // Load available system voices
    useEffect(() => {
        mountedRef.current = true;

        if (!('speechSynthesis' in window)) {
            return;
        }

        const synth = window.speechSynthesis;

        const loadVoices = () => {
            voicesRef.current = synth.getVoices();

            console.log(
                'Available voices:',
                voicesRef.current.map(voice => ({
                    name: voice.name,
                    lang: voice.lang
                }))
            );
        };

        loadVoices();

        synth.addEventListener('voiceschanged', loadVoices);

        return () => {
            mountedRef.current = false;

            synth.removeEventListener('voiceschanged', loadVoices);
            synth.cancel();

            streamRef.current?.getTracks().forEach(track => {
                track.stop();
            });
        };
    }, []);

    // Select the best available voice
    const getBestVoice = () => {
        const voices = voicesRef.current;

        return (
            voices.find(v => v.lang.toLowerCase() === 'fil-ph') ||
            voices.find(v => v.lang.toLowerCase().startsWith('fil')) ||
            voices.find(v => v.lang.toLowerCase() === 'en-ph') ||
            voices.find(v => v.lang.toLowerCase().startsWith('en-us')) ||
            voices.find(v => v.lang.toLowerCase().startsWith('en'))
        );
    };

    // Stop Educato voice
    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        setSpeaking(false);
    };

    // Speak AI response
    const speakReply = (text) => {
        if (!text || !text.trim()) return;

        if (!('speechSynthesis' in window)) {
            setError('Your browser does not support text-to-speech.');
            return;
        }

        const synth = window.speechSynthesis;

        synth.cancel();

        const cleanedText = cleanText(text);

        const utterance = new SpeechSynthesisUtterance(cleanedText);

        const voice = getBestVoice();

        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = 'en-US';
        }

        utterance.rate = 0.95;
        utterance.pitch = 0.95;
        utterance.volume = 1;

        utterance.onstart = () => {
            setSpeaking(true);
            setError('');
        };

        utterance.onend = () => {
            setSpeaking(false);
        };

        utterance.onerror = (event) => {
            console.error('Speech Error:', event.error);

            setSpeaking(false);

            if (event.error !== 'canceled' && event.error !== 'interrupted') {
                setError('Unable to play Educato voice. Try pressing the speaker button.');
            }
        };

        synth.speak(utterance);
    };

    // Record microphone
    const handleSpeak = async () => {
        if (listening) {
            recorderRef.current?.stop();
            setListening(false);
            return;
        }

        try {
            setError('');
            setTranscript('');
            setReply('');

            stopSpeaking();

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Microphone is not supported by this browser.');
            }

            if (!window.MediaRecorder) {
                throw new Error('Audio recording is not supported by this browser.');
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

            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;

            setListening(false);
            setError(err.message || 'Microphone access failed.');
        }
    };

    // Send recorded audio to backend
    const sendAudio = async (audioBlob) => {
        try {
            setLoading(true);
            setError('');

            const formData = new FormData();

            const extension = audioBlob.type.includes('mp4')
                ? 'mp4'
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
                throw new Error(result.message || 'AI failed.');
            }

            const answer = result.data.reply;

            setTranscript(result.data.transcript);
            setReply(answer);

            // Attempt automatic speech playback
            speakReply(answer);

        } catch (err) {
            console.error('AI Error:', err);

            setError(err.message || 'Failed to connect to Educato.');

        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="main">

            <section className="educato-container">

                <header className="educato-header">

                    <div className="educato-brand">
                        <div className="brand-icon">E</div>

                        <div>
                            <h1>Educato</h1>
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

                        {/* Speaker Controls */}

                        {reply && (
                            <div className="speaker-controls">

                                <button
                                    className="speaker-button"
                                    onClick={() => speakReply(reply)}
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
                            <p>AI is thinking...</p>
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
