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

// Глобальная переменная сокета (Singleton)
let socket = null;

function App() {
    const [citizenId, setCitizenId] = useState(localStorage.getItem('citizenId') || null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [workingHours, setWorkingHours] = useState(parseInt(localStorage.getItem('workingHours')) || 100);
    const [isEncrypted, setIsEncrypted] = useState(localStorage.getItem('isEncrypted') === 'true');
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState({});
    const [chats, setChats] = useState(() => {
        const saved = localStorage.getItem('raya_chats');
        return saved ? JSON.parse(saved) : DUMMY_CHATS;
    });

    useEffect(() => {
        localStorage.setItem('raya_chats', JSON.stringify(chats));
    }, [chats]);    const [searchResults, setSearchResults] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [mobileView, setMobileView] = useState('list'); // 'list' or 'chat'
    const [connected, setConnected] = useState(false);

    const selectedChatRef = useRef(null);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

    // Функция инициализации (вынесена для возможности ручного вызова)
    const initSocket = (id, tkn) => {
        if (socket) return socket;
        if (!id || !tkn) {
            console.warn('[DEBUG] Невозможно инициализировать сокет: отсутствуют данные.', { id: !!id, tkn: !!tkn });
            return null;
        }

        const apiUrl = 'https://shinemessenger-production.up.railway.app';
        console.log('[DEBUG] Инициализация глобального сокета для:', id, 'URL:', apiUrl);
        socket = io(apiUrl, {
            auth: { token: tkn },
            transports: ['websocket']
        });

        socket.on('connect', () => {
            console.log('[DEBUG] Соединение установлено (Global).');
            setConnected(true);
            socket.emit('register_citizen', id);
        });

        socket.on('sync_chats', (serverChats) => {
            console.log('[DEBUG] Синхронизация чатов с сервером:', serverChats);
            setChats(prevChats => {
                // Объединяем локальные DUMMY и серверные, приоритет серверным
                const merged = [...serverChats];
                const serverIds = new Set(serverChats.map(c => c.id));
                DUMMY_CHATS.forEach(dc => {
                    if (!serverIds.has(dc.id) && !prevChats.find(pc => pc.id === dc.id && pc.isDeleted)) {
                        merged.push(dc);
                    }
                });
                return merged;
            });
        });

        socket.on('disconnect', () => {
            console.log('[DEBUG] Соединение потеряно.');
            setConnected(false);
        });

        socket.on('new_message', (data) => {
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
        });

        socket.on('chat_history', (data) => {
            setMessages(prev => ({ ...prev, [data.chatId]: data.history }));
        });

        socket.on('message_deleted', (data) => {
            setMessages(prev => ({
                ...prev,
                [data.chatId]: (prev[data.chatId] || []).filter(m => m.id !== data.messageId)
            }));
        });

        socket.on('chat_started', (data) => setChats(prev => prev.find(c => c.id === data.id) ? prev : [data, ...prev]));
        socket.on('search_results', (results) => setSearchResults(results.filter(id => id !== citizenId)));
        
        return socket;
    };

    useEffect(() => {
        if (citizenId && token) {
            initSocket(citizenId, token);
        } else if (socket) {
            socket.disconnect();
            socket = null;
            setConnected(false);
        }
    }, [citizenId, token]);

    const handleLogin = (id, authToken, initialWh = 100) => {
        if (!id || !authToken) {
            console.error('[DEBUG] Попытка входа с неполными данными:', { id: !!id, token: !!authToken });
            return;
        }
        console.log('[DEBUG] Вход выполнен:', id);
        setCitizenId(id);
        setToken(authToken);
        localStorage.setItem('citizenId', id);
        localStorage.setItem('token', authToken);
        
        // Use server provided WH
        setWorkingHours(initialWh);
        localStorage.setItem('workingHours', initialWh);

        setChats(DUMMY_CHATS);
        setMessages({});
        initSocket(id, authToken);
    };

    const handleLogout = () => {
        console.log('[DEBUG] Выход из системы...');
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        setCitizenId(null);
        setToken(null);
        localStorage.removeItem('citizenId');
        localStorage.removeItem('token');
        localStorage.removeItem('workingHours');
        localStorage.removeItem('isEncrypted');
        setChats(DUMMY_CHATS);
        setMessages({});
        setSelectedChat(null);
        setMobileView('list');
        setConnected(false);
    };

    const toggleEncryption = async () => {
        const newState = !isEncrypted;
        if (newState && workingHours < 50) return;
        
        if (newState) { 
            const newWh = workingHours - 50;
            setWorkingHours(newWh); 
            localStorage.setItem('workingHours', newWh); 
            
            // Sync with server
            const apiUrl = 'https://shinemessenger-production.up.railway.app';
            await fetch(`${apiUrl}/api/user/wh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citizenId, newWh })
            });
        }
        setIsEncrypted(newState);
        localStorage.setItem('isEncrypted', newState);
    };

    useEffect(() => {
        if (socket) {
            socket.on('wh_updated', (newWh) => {
                setWorkingHours(newWh);
                localStorage.setItem('workingHours', newWh);
            });
        }
        return () => {
            if (socket) socket.off('wh_updated');
        };
    }, [socket]);

    const AdminPanel = () => {
        const [targetId, setTargetId] = useState('');
        const [amount, setAmount] = useState(100);
        
        const handleWhAction = async (action) => {
            const apiUrl = 'https://shinemessenger-production.up.railway.app';
            await fetch(`${apiUrl}/api/admin/wh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: citizenId, targetId, amount, action })
            });
            alert(`WH ${action === 'add' ? 'добавлены' : 'списаны'}`);
        };

        return (
            <div className="admin-panel">
                <h4>АДМИНИСТРИРОВАНИЕ WH</h4>
                <input 
                    className="simple-chat-input" 
                    placeholder="ID ГРАЖДАНИНА" 
                    value={targetId} 
                    onChange={e => setTargetId(e.target.value)} 
                />
                <input 
                    type="number" 
                    className="simple-chat-input" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                />
                <div style={{display: 'flex', gap: '5px', marginTop: '10px'}}>
                    <button className="raya-btn-mini primary" onClick={() => handleWhAction('add')}>НАЧИСЛИТЬ</button>
                    <button className="raya-btn-mini danger" onClick={() => handleWhAction('remove')}>ШТРАФ</button>
                </div>
            </div>
        );
    };

    const handleDeleteChat = (id) => {
        setChats(prev => prev.filter(c => c.id !== id));
        setMessages(prev => { const newMsgs = { ...prev }; delete newMsgs[id]; return newMsgs; });
        if (selectedChat?.id === id) {
            setSelectedChat(null);
            setMobileView('list');
        }
    };

    const handleCreateGroup = (name, participants) => {
        const chatId = `group_${Date.now()}`;
        const newGroup = { id: chatId, name, lastMessage: 'КАНАЛ СОЗДАН', type: 'GROUP', unread: false };
        setChats(prev => [newGroup, ...prev]);
        const s = socket || initSocket(citizenId, token);
        if (s) {
            s.emit('initiate_chat', { targetIds: participants, chatId, name, type: 'GROUP' });
        }
        setSelectedChat(newGroup);
        setMobileView('chat');
    };

    const handleSelectArchive = (item) => {
        const archiveChat = { ...item, isArchive: true };
        setSelectedChat(archiveChat);
        setMobileView('chat');
        setMessages(prev => ({
            ...prev,
            [item.id]: [{ id: `arc_${item.id}`, senderId: 'SYSTEM', subject: item.name, content: `ДАННЫЕ ИЗВЛЕЧЕНЫ.`, is_system: true }]
        }));
    };

    const startNewChat = (targetId) => {
        const chatId = [citizenId, targetId].sort().join('_');
        const newChat = { id: chatId, name: targetId, lastMessage: 'НОВЫЙ КАНАЛ', type: 'USER', unread: false };
        setChats(prev => prev.find(c => c.id === chatId) ? prev : [newChat, ...prev]);
        const s = socket || initSocket(citizenId, token);
        if (s) {
            s.emit('initiate_chat', { targetIds: [targetId], chatId, type: 'USER' });
        }
        setSelectedChat(newChat);
        setMobileView('chat');
    };

    const handleSendMessage = (content, subject) => {
        const currentChat = selectedChatRef.current;
        const s = socket || initSocket(citizenId, token);
        
        if (currentChat && s) {
            console.log('[DEBUG] Отправка сообщения:', { chatId: currentChat.id, content, subject });
            s.emit('send_message', { chatId: currentChat.id, content, subject });
        } else {
            console.warn('[DEBUG] Не удалось отправить сообщение: socket или selectedChat отсутствуют.', { 
                hasSocket: !!s, 
                hasChat: !!currentChat 
            });
        }
    };

    const handleMarkRead = (msg) => {
        console.log('[DEBUG] Сообщение прочитано:', msg.id);
    };

    if (!citizenId || !token) return <Login onLogin={handleLogin} />;

    return (
        <div className={`raya-app-container ${isEncrypted ? 'high-encryption' : ''} mobile-view-${mobileView}`}>
            <div className="crt-overlay"></div>
            <header className="app-header">
                <h1 className="main-title">СИЯНИЕ OS v1.3 {connected ? '' : '[OFFLINE]'}</h1>
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
                                {citizenId === 'LorikowkaShine' && <AdminPanel />}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="workspace side-layout">
                <div className={`chat-list-wrapper ${mobileView === 'chat' ? 'mobile-hidden' : ''}`}>
                    <ChatList 
                        chats={chats} selectedChat={selectedChat}
                        onSelectChat={(c) => { 
                            setSelectedChat(c); 
                            setMobileView('chat');
                            setChats(prev => prev.map(i => i.id === c.id ? { ...i, unread: false } : i)); 
                            const s = socket || initSocket(citizenId, token);
                            if (s) s.emit('join_chat', c.id); 
                        }}
                        onSearch={(q) => {
                            if (!q.trim()) return setSearchResults([]);
                            const s = socket || initSocket(citizenId, token);
                            if (s) s.emit('search_citizen', q);
                        }}
                        searchResults={searchResults} onStartChat={startNewChat} onDeleteChat={handleDeleteChat}
                        onCreateGroup={handleCreateGroup} onSelectArchive={handleSelectArchive}
                    />
                </div>
                <div className={`chat-view ${mobileView === 'list' ? 'mobile-hidden' : ''}`}>
                    {selectedChat ? (
                        <MessageWindow 
                            sender={selectedChat.name} type={selectedChat.type} messages={messages[selectedChat.id] || []}
                            onSendMessage={handleSendMessage} onClose={() => { setSelectedChat(null); setMobileView('list'); }}
                            corruption={selectedChat.corruption || 0} isArchive={selectedChat.isArchive}
                            onMarkRead={handleMarkRead} onDeleteMessage={(msg) => {
                                const s = socket || initSocket(citizenId, token);
                                if (s) s.emit('delete_message_global', { messageId: msg.id, chatId: msg.chatId });
                            }}
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
