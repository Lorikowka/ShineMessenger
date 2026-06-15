import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import ChatList from './components/ChatList/ChatList';
import MessageWindow from './components/MessageWindow/MessageWindow';
import Login from './components/Login/Login';
import './App.css';

const DUMMY_CHATS = [
    { id: '1', name: 'ИНСПЕКТОР_ГРАДИ', lastMessage: 'СВОДКА СЕКТОРА', type: 'SEC' },
    { id: '2', name: 'СЕКТОР_C-13', lastMessage: 'ДЕШИФРОВКА', type: 'SYS' },
    { id: '3', name: 'РАЙЯ_ПРАЙМ', lastMessage: 'SECURITY ALERT', type: 'AI' },
];

let socket;

function App() {
    const [citizenId, setCitizenId] = useState(localStorage.getItem('citizenId') || null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [workingHours, setWorkingHours] = useState(parseInt(localStorage.getItem('workingHours')) || 100);
    const [isEncrypted, setIsEncrypted] = useState(localStorage.getItem('isEncrypted') === 'true');
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState({});
    const [chats, setChats] = useState(DUMMY_CHATS);
    const [searchResults, setSearchResults] = useState([]);
    const [showSettings, setShowSettings] = useState(false);

    const selectedChatRef = useRef(null);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

    useEffect(() => {
        if (!citizenId || !token) return;

        // Инициализация сокета с авторизацией
        socket = io('http://localhost:3000', { 
            auth: { token },
            transports: ['websocket'] 
        });

        const onConnect = () => {
            console.log('[DEBUG] Соединение установлено.');
            socket.emit('register_citizen', citizenId);
        };

        const onNewMessage = (data) => {
            setMessages(prev => ({ 
                ...prev, 
                [data.chatId]: [...(prev[data.chatId] || []), data] 
            }));

            setChats(prevChats => {
                const isCurrent = selectedChatRef.current?.id === data.chatId;
                const exists = prevChats.find(c => c.id === data.chatId);
                const preview = data.subject || "БЕЗ ТЕМЫ";

                if (!exists) {
                    return [{ 
                        id: data.chatId, 
                        name: data.senderId === "RAYA_SYSTEM" ? "РАЙЯ_ПРАЙМ" : data.senderId, 
                        lastMessage: preview, 
                        type: data.chatId.toString().includes('group') ? 'GROUP' : 'USER', 
                        unread: !isCurrent 
                    }, ...prevChats];
                }
                return prevChats.map(c => c.id === data.chatId ? { ...c, lastMessage: preview, unread: !isCurrent } : c);
            });
        };

        const onChatHistory = (data) => {
            setMessages(prev => ({ ...prev, [data.chatId]: data.history }));
        };

        const onMessageDeleted = (data) => {
            setMessages(prev => ({
                ...prev,
                [data.chatId]: (prev[data.chatId] || []).filter(m => m.id !== data.messageId)
            }));
        };

        const onChatStarted = (data) => setChats(prev => prev.find(c => c.id === data.id) ? prev : [data, ...prev]);
        const onSearchResults = (results) => setSearchResults(results.filter(id => id !== citizenId));

        socket.on('connect', onConnect);
        socket.on('new_message', onNewMessage);
        socket.on('chat_history', onChatHistory);
        socket.on('message_deleted', onMessageDeleted);
        socket.on('chat_started', onChatStarted);
        socket.on('search_results', onSearchResults);

        return () => {
            socket.disconnect();
        };
    }, [citizenId, token]);

    const handleLogin = (id, authToken) => {
        setCitizenId(id);
        setToken(authToken);
        localStorage.setItem('citizenId', id);
        localStorage.setItem('token', authToken);
        setWorkingHours(100);
        localStorage.setItem('workingHours', 100);
        setChats(DUMMY_CHATS);
        setMessages({});
    };

    const handleLogout = () => {
        setCitizenId(null);
        setToken(null);
        localStorage.clear();
        setChats(DUMMY_CHATS);
        setMessages({});
        setSelectedChat(null);
    };

    const toggleEncryption = () => {
        const newState = !isEncrypted;
        if (newState && workingHours < 50) return;
        if (newState) { setWorkingHours(prev => prev - 50); localStorage.setItem('workingHours', workingHours - 50); }
        setIsEncrypted(newState);
        localStorage.setItem('isEncrypted', newState);
    };

    const handleDeleteChat = (id) => {
        setChats(prev => prev.filter(c => c.id !== id));
        setMessages(prev => { const newMsgs = { ...prev }; delete newMsgs[id]; return newMsgs; });
        if (selectedChat?.id === id) setSelectedChat(null);
    };

    const handleCreateGroup = (name, participants) => {
        const chatId = `group_${Date.now()}`;
        const newGroup = { id: chatId, name, lastMessage: 'КАНАЛ СОЗДАН', type: 'GROUP', unread: false };
        setChats(prev => [newGroup, ...prev]);
        socket.emit('initiate_chat', { targetIds: participants, chatId, name, type: 'GROUP' });
        setSelectedChat(newGroup);
    };

    const handleSelectArchive = (item) => {
        const archiveChat = { ...item, isArchive: true };
        setSelectedChat(archiveChat);
        setMessages(prev => ({
            ...prev,
            [item.id]: [{ id: `arc_${item.id}`, senderId: 'SYSTEM', subject: item.name, content: `ДАННЫЕ ИЗВЛЕЧЕНЫ.`, is_system: true }]
        }));
    };

    const startNewChat = (targetId) => {
        const chatId = [citizenId, targetId].sort().join('_');
        const newChat = { id: chatId, name: targetId, lastMessage: 'НОВЫЙ КАНАЛ', type: 'USER', unread: false };
        setChats(prev => prev.find(c => c.id === chatId) ? prev : [newChat, ...prev]);
        socket.emit('initiate_chat', { targetIds: [targetId], chatId, type: 'USER' });
        setSelectedChat(newChat);
    };

    const handleSendMessage = (content, subject) => {
        if (selectedChat && socket) {
            socket.emit('send_message', { chatId: selectedChat.id, content, subject });
        }
    };

    if (!citizenId) return <Login onLogin={handleLogin} />;

    return (
        <div className={`raya-app-container ${isEncrypted ? 'high-encryption' : ''}`}>
            <div className="crt-overlay"></div>
            <header className="app-header">
                <h1 className="main-title">СИЯНИЕ OS v1.3</h1>
                <div className="user-stats">
                    <span className="stat-item">WH: {workingHours}</span>
                    <div className="user-badge" onClick={() => setShowSettings(!showSettings)}>{citizenId} [МЕНЮ]</div>
                </div>
            </header>

            {showSettings && (
                <div className="raya-modal-overlay">
                    <div className="raya-window settings-window">
                        <div className="raya-window-inner">
                            <header className="raya-header">НАСТРОЙКИ</header>
                            <div className="raya-body settings-body">
                                <p>ID: {citizenId}</p>
                                <button className="raya-btn" onClick={toggleEncryption}>{isEncrypted ? 'ВЫКЛ. ЛИНИЮ' : 'ЗАЩИТА (50 WH)'}</button>
                                <button className="raya-btn danger" onClick={handleLogout}>ВЫЙТИ</button>
                                <button className="raya-btn" onClick={() => setShowSettings(false)}>ЗАКРЫТЬ</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="workspace side-layout">
                <ChatList 
                    chats={chats} selectedChat={selectedChat}
                    onSelectChat={(c) => { setSelectedChat(c); setChats(prev => prev.map(i => i.id === c.id ? { ...i, unread: false } : i)); socket.emit('join_chat', c.id); }}
                    onSearch={(q) => q.trim() ? socket.emit('search_citizen', q) : setSearchResults([])}
                    searchResults={searchResults} onStartChat={startNewChat} onDeleteChat={handleDeleteChat}
                    onCreateGroup={handleCreateGroup} onSelectArchive={handleSelectArchive}
                />
                <div className="chat-view">
                    {selectedChat ? (
                        <MessageWindow 
                            sender={selectedChat.name} type={selectedChat.type} messages={messages[selectedChat.id] || []}
                            onSendMessage={handleSendMessage} onClose={() => setSelectedChat(null)}
                            corruption={selectedChat.corruption || 0} isArchive={selectedChat.isArchive}
                            onMarkRead={handleMarkRead} onDeleteMessage={(msg) => socket.emit('delete_message_global', { messageId: msg.id, chatId: msg.chatId })}
                        />
                    ) : (
                        <div className="no-chat-selected">ВЫБЕРИТЕ КАНАЛ</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
