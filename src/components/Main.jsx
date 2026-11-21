
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

    const speakReply = (text) => {
        if (!('speechSynthesis' in window)) {
            setError('Your browser does not support text-to-speech.');
            return;
        }

        window.speechSynthesis.cancel();

        const cleanedText = cleanText(text);
        const utterance = new SpeechSynthesisUtterance(cleanedText);

        const voices = window.speechSynthesis.getVoices();

        const voice =
            voices.find(v => v.lang.toLowerCase() === 'fil-ph') ||
            voices.find(v => v.lang.toLowerCase().startsWith('fil')) ||
            voices.find(v => v.lang.toLowerCase() === 'en-ph') ||
            voices.find(v => v.lang.toLowerCase().startsWith('en'));

        if (voice) utterance.voice = voice;

        utterance.lang = voice?.lang || 'en-US';
        utterance.rate = 1;
        utterance.pitch = 0.95;
        utterance.volume = 1;

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);

        utterance.onerror = (event) => {
            console.error('Speech Error:', event);
            setSpeaking(false);
            setError('Unable to play Educato voice.');
        };

        window.speechSynthesis.speak(utterance);
    };

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

            window.speechSynthesis.cancel();
            setSpeaking(false);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4'
            ].find(type => MediaRecorder.isTypeSupported(type));

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
                    type: recorder.mimeType
                });

                stream.getTracks().forEach(track => track.stop());
                streamRef.current = null;

                if (!audioBlob.size) {
                    setError('No audio recorded. Please try again.');
                    return;
                }

                await sendAudio(audioBlob);
            };

            recorder.start();
            setListening(true);

        } catch (err) {
            console.error('Microphone Error:', err);
            setError(err.message || 'Microphone access failed.');
        }
    };

    const sendAudio = async (audioBlob) => {
        try {
            setLoading(true);
            setError('');

            const formData = new FormData();

            const extension = audioBlob.type.includes('mp4')
                ? 'mp4'
                : 'webm';

            formData.append('audio', audioBlob, `recording.${extension}`);
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

            speakReply(answer);

        } catch (err) {
            console.error('AI Error:', err);
            setError(err.message || 'Failed to connect to Educato.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

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
                    </article>

                </div>

                <section className="controls">

                    <button
                        className={`record-button ${listening ? 'recording' : ''}`}
                        onClick={handleSpeak}
                        disabled={loading || speaking}
                    >
                        {listening ? '■ Stop Recording' : '🎙 Start Speaking'}
                    </button>

                    {speaking && (
                        <button
                            className="stop-button"
                            onClick={() => {
                                window.speechSynthesis.cancel();
                                setSpeaking(false);
                            }}
                        >
                            ■ Stop Educato
                        </button>
                    )}

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
                            <p className="error-message">{error}</p>
                        )}
                    </div>

                </section>

            </section>

        </main>
    );
};

export default Main;
