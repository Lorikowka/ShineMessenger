const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = 3000;
const AI_SERVER_URL = 'http://localhost:8000/api/v1/analyze';
const JWT_SECRET = 'RAYA_PRIME_SECURE_KEY_2026'; // В реальном проекте хранить в .env

app.use(helmet()); // Защита заголовков
app.use(express.json());

let db;

// Инициализация БД
(async () => {
    try {
        db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });

        // Таблица пользователей
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                citizen_id TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        `);

        // Таблица сообщений
        await db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chatId TEXT NOT NULL,
                senderId TEXT NOT NULL,
                subject TEXT,
                content TEXT NOT NULL,
                is_system BOOLEAN DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('[DATABASE] SQLite готова и защищена.');

        server.listen(PORT, () => {
            console.log(`[SERVER] Мессенджер СИЯНИЕ запущен на порту ${PORT}`);
        });
    } catch (err) {
        console.error('[CRITICAL] Ошибка запуска:', err);
    }
})();

// API: Регистрация / Логин (упрощенная для примера)
app.post('/api/auth', async (req, res) => {
    const { citizenId, password } = req.body;
    if (!citizenId || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        const user = await db.get('SELECT * FROM users WHERE citizen_id = ?', [citizenId]);
        
        if (!user) {
            // Регистрация
            const hash = await bcrypt.hash(password, 10);
            await db.run('INSERT INTO users (citizen_id, password_hash) VALUES (?, ?)', [citizenId, hash]);
            const token = jwt.sign({ citizenId }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ citizenId, token, message: 'Citizen Registered' });
        } else {
            // Логин
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) return res.status(401).json({ error: 'Invalid algorithm access' });
            
            const token = jwt.sign({ citizenId }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ citizenId, token, message: 'Access Granted' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Сокет-авторизация (Middleware)
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.citizenId = decoded.citizenId;
        next();
    });
});

const onlineCitizens = new Map();

io.on('connection', (socket) => {
    const citizenId = socket.citizenId;
    onlineCitizens.set(citizenId, socket.id);
    console.log(`[DEBUG] Гражданин ${citizenId} в сети.`);

    socket.on('search_citizen', (query) => {
        const results = Array.from(onlineCitizens.keys()).filter(id => 
            id.toLowerCase().includes(query.toLowerCase())
        );
        socket.emit('search_results', results);
    });

    socket.on('initiate_chat', (data) => {
        const { targetIds, chatId, name, type } = data;
        socket.join(chatId);
        targetIds.forEach(targetId => {
            const targetSocketId = onlineCitizens.get(targetId);
            if (targetSocketId) {
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.join(chatId);
                    targetSocket.emit('chat_started', {
                        id: chatId,
                        name: type === 'GROUP' ? name : citizenId,
                        lastMessage: 'НОВЫЙ КАНАЛ',
                        type: type || 'USER'
                    });
                }
            }
        });
    });

    socket.on('join_chat', async (chatId) => {
        socket.join(chatId);
        const history = await db.all('SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC', [chatId]);
        socket.emit('chat_history', { chatId, history });
    });

    socket.on('send_message', async (data) => {
        const { chatId, content, subject } = data;
        const senderId = socket.citizenId;
        
        try {
            const result = await db.run(
                'INSERT INTO messages (chatId, senderId, subject, content) VALUES (?, ?, ?, ?)',
                [chatId, senderId, subject || "", content]
            );
            
            const newMessage = { id: result.lastID, chatId, senderId, content, subject: subject || "", timestamp: new Date() };
            io.to(chatId).emit('new_message', newMessage);

            // AI
            const response = await axios.post(AI_SERVER_URL, { chatId, senderId, content }).catch(() => null);
            if (response && response.data.should_intervene) {
                setTimeout(async () => {
                    const sysSubj = "SECURITY ALERT";
                    const sysRes = await db.run(
                        'INSERT INTO messages (chatId, senderId, subject, content, is_system) VALUES (?, ?, ?, ?, 1)',
                        [chatId, "RAYA_SYSTEM", sysSubj, response.data.response_text]
                    );
                    io.to(chatId).emit('new_message', {
                        id: sysRes.lastID, chatId, senderId: "RAYA_SYSTEM", subject: sysSubj, content: response.data.response_text, is_system: true, timestamp: new Date()
                    });
                }, 800);
            }
        } catch (err) { console.error('Error:', err.message); }
    });

    socket.on('delete_message_global', async (data) => {
        const { messageId, chatId } = data;
        await db.run('DELETE FROM messages WHERE id = ?', [messageId]);
        io.to(chatId).emit('message_deleted', { messageId, chatId });
    });

    socket.on('disconnect', () => {
        onlineCitizens.delete(socket.citizenId);
    });
});
