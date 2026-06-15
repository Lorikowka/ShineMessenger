import React, { useState, useEffect, useRef } from 'react';
import './MessageWindow.css';

/**
 * Хук глитча для визуальных эффектов.
 */
const useCorruptionEffect = (text, corruptionLevel = 0) => {
    const [displayedText, setDisplayedText] = useState(text || "");
    const glitchChars = "ê╟♦7Ɛ>W╘r◘+♠o╜Hnⁿ►░▒▓█║╬╝╚╗╔╩╦╠═";

    useEffect(() => {
        if (!text) { setDisplayedText(""); return; }
        if (corruptionLevel === 0) { setDisplayedText(text); return; }

        const applyCorruption = () => {
            const intensity = corruptionLevel / 100;
            const result = text.split('').map(char => {
                if (char === ' ') return char;
                return Math.random() < intensity ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char;
            }).join('');
            setDisplayedText(result);
        };

        const interval = setInterval(applyCorruption, 250 - (corruptionLevel * 2));
        return () => clearInterval(interval);
    }, [text, corruptionLevel]);

    return displayedText;
};

const MessageWindow = ({ sender, messages, onSendMessage, onClose, corruption = 0, isArchive = false, type = 'USER', onMarkRead, onDeleteMessage }) => {
    const [msgText, setMsgText] = useState('');
    const [msgSubject, setMsgSubject] = useState('');
    const [readingMessage, setReadingMessage] = useState(null);
    const messagesEndRef = useRef(null);

    const isGroup = type === 'GROUP';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalContent = msgText.trim();
        if (finalContent) {
            const finalSubject = isGroup ? "" : (msgSubject.trim() || "БЕЗ ТЕМЫ");
            
            console.log('[DEBUG] MessageWindow вызывает отправку:', { finalContent, finalSubject });
            onSendMessage(finalContent, finalSubject);
            
            setMsgText('');
            setMsgSubject('');
        }
    };
    
    return (
        <div className="raya-window-container">
            <div className="raya-window message-view-window">
                <div className="raya-scanlines"></div>
                <div className="raya-window-inner">
                    <header className="raya-header">
                        <div className="raya-info">
                            <div className="raya-label">
                                {isArchive ? 'АРХИВНЫЙ ФАЙЛ' : (isGroup ? 'ГРУППОВОЙ КАНАЛ' : 'КОРРЕСПОНДЕНТ')}: 
                                <span className="raya-value"> {sender}</span>
                            </div>
                        </div>
                        {isArchive && (
                            <div className="corruption-meta">
                                <div className="corruption-label">СТАТУС ПОВРЕЖДЕНИЯ: {corruption}%</div>
                                <div className="corruption-bar-container">
                                    <div className="corruption-bar-fill" style={{ width: `${corruption}%` }}></div>
                                </div>
                            </div>
                        )}
                        <button className="raya-close-btn" onClick={onClose}>[X]</button>
                    </header>

                    <main className="raya-body">
                        <div className={`raya-messages-container ${isGroup ? 'chat-mode' : 'email-mode'}`}>
                            {messages.map((msg, index) => {
                                const msgId = msg.id || index;
                                return isGroup ? (
                                    <div key={msgId} className={`simple-message ${msg.is_system ? 'system' : 'user'}`}>
                                        <span className="msg-sender">[{msg.senderId}]:</span> {msg.content}
                                    </div>
                                ) : (
                                    <MessagePreview 
                                        key={msgId} 
                                        msg={msg} 
                                        corruption={isArchive ? corruption : 0} 
                                        onOpen={() => setReadingMessage(msg)}
                                    />
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {!isArchive && (
                            <form className={isGroup ? "raya-simple-chat-form" : "raya-email-form"} onSubmit={handleSubmit}>
                                {!isGroup && (
                                    <div className="email-input-row">
                                        <span className="email-label">ТЕМА:</span>
                                        <input 
                                            type="text" 
                                            className="email-subject-input" 
                                            value={msgSubject}
                                            onChange={(e) => setMsgSubject(e.target.value)}
                                            placeholder="ВВЕДИТЕ ТЕМУ ПИСЬМА..."
                                        />
                                    </div>
                                )}
                                <div className={isGroup ? "simple-input-row" : "email-body-row"}>
                                    {isGroup ? (
                                        <>
                                            <span className="input-prompt">&gt;</span>
                                            <input 
                                                className="simple-chat-input" 
                                                value={msgText}
                                                onChange={(e) => setMsgText(e.target.value)}
                                                placeholder="ВВЕДИТЕ СООБЩЕНИЕ..."
                                                autoFocus
                                            />
                                            <button type="submit" className="simple-send-btn">ОТПРАВИТЬ</button>
                                        </>
                                    ) : (
                                        <>
                                            <textarea 
                                                className="email-body-input" 
                                                value={msgText}
                                                onChange={(e) => setMsgText(e.target.value)}
                                                placeholder="ВВЕДИТЕ ТЕКСТ ПИСЬМА..."
                                                rows="3"
                                            />
                                            <button type="submit" className="email-send-btn">ОТПРАВИТЬ ПАКЕТ</button>
                                        </>
                                    )}
                                </div>
                            </form>
                        )}
                    </main>
                </div>
            </div>

            {readingMessage && (
                <div className="raya-modal-overlay global-overlay">
                    <div className="raya-window email-read-modal">
                        <div className="raya-scanlines"></div>
                        <div className="raya-window-inner">
                            <header className="raya-header-modal">
                                <div className="modal-meta-line">ОТ КОГО: <span className="raya-value">{readingMessage.senderId}</span></div>
                                <div className="modal-meta-line">ТЕМА: <span className="raya-value">
                                    <ModalGlitchText text={readingMessage.subject || "БЕЗ ТЕМЫ"} corruption={isArchive ? corruption : 0} />
                                </span></div>
                            </header>
                            <main className="raya-body modal-body">
                                <div className="email-full-content">
                                    <ModalGlitchText text={readingMessage.content} corruption={isArchive ? corruption : 0} />
                                </div>
                            </main>
                            <footer className="modal-footer">
                                <button className="raya-btn-mini" onClick={() => { onMarkRead(readingMessage); setReadingMessage(null); }}>ПРОЧИТАНО</button>
                                {!isArchive && !readingMessage.is_system && (
                                    <button className="raya-btn-mini" onClick={() => { setMsgSubject(`RE: ${readingMessage.subject || "СООБЩЕНИЕ"}`); setReadingMessage(null); }}>ОТВЕТИТЬ</button>
                                )}
                                {!isArchive && (
                                    <button className="raya-btn-mini danger-text" onClick={() => { onDeleteMessage(readingMessage); setReadingMessage(null); }}>УДАЛИТЬ</button>
                                )}
                                <button className="raya-btn-mini" onClick={() => setReadingMessage(null)}>ЗАКРЫТЬ</button>
                            </footer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ModalGlitchText = ({ text, corruption }) => {
    const glitched = useCorruptionEffect(text, corruption);
    return <span>{glitched}</span>;
};

const MessagePreview = ({ msg, corruption, onOpen }) => {
    const glitchedSubject = useCorruptionEffect(msg.subject || "БЕЗ ТЕМЫ", corruption);
    return (
        <div className={`raya-email-item ${msg.is_system ? 'system' : 'user'}`}>
            <div className="email-item-header">
                <div className="email-header-left">
                    <span className="email-item-sender">ОТ: {msg.senderId}</span>
                    <span className="email-item-subject">ТЕМА: {glitchedSubject}</span>
                </div>
                <button className="email-open-action" onClick={onOpen}>[ОТКРЫТЬ]</button>
            </div>
        </div>
    );
};

export default MessageWindow;
