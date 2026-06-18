const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const AI_SERVER_URL = 'http://localhost:8000/api/v1/analyze';
const JWT_SECRET = 'RAYA_PRIME_SECURE_KEY_2026';

app.use(cors());
app.use(helmet());
app.use(express.json());

// Инициализация PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Важно для Railway
    }
});

const initDb = async () => {
    try {
        const client = await pool.connect();
        console.log('[DATABASE] PostgreSQL подключена.');

        // Таблица пользователей
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                citizen_id TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                working_hours INTEGER DEFAULT 100
            )
        `);

        // Таблица сообщений
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chatId TEXT NOT NULL,
                senderId TEXT NOT NULL,
                subject TEXT,
                content TEXT NOT NULL,
                is_system BOOLEAN DEFAULT false,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица связи пользователей и чатов
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_chats (
                citizen_id TEXT NOT NULL,
                chatId TEXT NOT NULL,
                chatName TEXT,
                chatType TEXT,
                lastMessage TEXT,
                unread BOOLEAN DEFAULT false,
                PRIMARY KEY (citizen_id, chatId)
            )
        `);
        client.release();
        
        server.listen(PORT, () => {
            console.log(`[SERVER] Мессенджер СИЯНИЕ запущен на порту ${PORT}`);
        });
    } catch (err) {
        console.error('[CRITICAL] Ошибка инициализации PostgreSQL:', err);
    }
};

initDb();

// Debug API
app.get('/api/debug/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, citizen_id, working_hours FROM users');
        res.json({ count: result.rowCount, users: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Регистрация / Логин
app.post('/api/auth', async (req, res) => {
    const { citizenId, password } = req.body;
    if (!citizenId || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE citizen_id = $1', [citizenId]);
        const user = result.rows[0];
        
        if (!user) {
            const hash = await bcrypt.hash(password, 10);
            const newUser = await pool.query(
                'INSERT INTO users (citizen_id, password_hash) VALUES ($1, $2) RETURNING citizen_id, working_hours', 
                [citizenId, hash]
            );
            const token = jwt.sign({ citizenId }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ citizenId: newUser.rows[0].citizen_id, token, message: 'Citizen Registered', workingHours: 100 });
        } else {
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) return res.status(401).json({ error: 'Invalid algorithm access' });
            
            const token = jwt.sign({ citizenId }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ citizenId, token, message: 'Access Granted', workingHours: user.working_hours });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin API
app.post('/api/admin/wh', async (req, res) => {
    const { adminId, targetId, amount, action } = req.body;
    if (!adminId || adminId.toLowerCase() !== 'lorikowkashine') {
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE citizen_id ILIKE $1', [targetId]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'Citizen not found' });

        let newWh = user.working_hours;
        if (action === 'add') newWh += parseInt(amount);
        else if (action === 'remove') newWh = Math.max(0, newWh - parseInt(amount));

        await pool.query('UPDATE users SET working_hours = $1 WHERE citizen_id = $2', [newWh, user.citizen_id]);
        
        const targetSocketId = onlineCitizens.get(user.citizen_id);
        if (targetSocketId) {
            io.to(targetSocketId).emit('wh_updated', newWh);
        }

        res.json({ message: 'Success', targetId: user.citizen_id, newWh });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/wh', async (req, res) => {
     const { citizenId, newWh } = req.body;
     try {
         await pool.query('UPDATE users SET working_hours = $1 WHERE citizen_id = $2', [newWh, citizenId]);
         res.json({ success: true });
     } catch(e) {
         res.status(500).json({ error: e.message });
     }
});

// Сокет-авторизация
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

io.on('connection', async (socket) => {
    const citizenId = socket.citizenId;
    onlineCitizens.set(citizenId, socket.id);
    console.log(`[DEBUG] Гражданин ${citizenId} в сети.`);

    try {
        const result = await pool.query(
            'SELECT chatId as id, chatName as name, chatType as type, lastMessage, unread FROM user_chats WHERE citizen_id = $1', 
            [citizenId]
        );
        socket.emit('sync_chats', result.rows);
    } catch (err) {
        console.error('Error syncing chats:', err.message);
    }

    socket.on('search_citizen', async (query) => {
        try {
            const result = await pool.query(
                'SELECT citizen_id FROM users WHERE citizen_id ILIKE $1 LIMIT 20', 
                [`%${query}%`]
            );
            const results = result.rows.map(u => u.citizen_id);
            socket.emit('search_results', results);
        } catch (err) {
            console.error('Error searching citizens:', err);
        }
    });

    socket.on('initiate_chat', async (data) => {
        const { targetIds, chatId, name, type } = data;
        socket.join(chatId);
        
        await pool.query(
            'INSERT INTO user_chats (citizen_id, chatId, chatName, chatType, lastMessage) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', 
            [citizenId, chatId, type === 'GROUP' ? name : targetIds[0], type, 'НОВЫЙ КАНАЛ']
        );

        for (const targetId of targetIds) {
            await pool.query(
                'INSERT INTO user_chats (citizen_id, chatId, chatName, chatType, lastMessage) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', 
                [targetId, chatId, type === 'GROUP' ? name : citizenId, type, 'НОВЫЙ КАНАЛ']
            );

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
        }
    });

    socket.on('join_chat', async (chatId) => {
        socket.join(chatId);
        await pool.query('UPDATE user_chats SET unread = false WHERE citizen_id = $1 AND chatId = $2', [citizenId, chatId]);
        const result = await pool.query('SELECT * FROM messages WHERE chatId = $1 ORDER BY id ASC', [chatId]);
        socket.emit('chat_history', { chatId, history: result.rows });
    });

    socket.on('send_message', async (data) => {
        const { chatId, content, subject } = data;
        const senderId = socket.citizenId;
        const preview = subject || "БЕЗ ТЕМЫ";
        
        try {
            const result = await pool.query(
                'INSERT INTO messages (chatId, senderId, subject, content) VALUES ($1, $2, $3, $4) RETURNING id',
                [chatId, senderId, subject || "", content]
            );
            
            await pool.query('UPDATE user_chats SET lastMessage = $1, unread = true WHERE chatId = $2 AND citizen_id != $3', [preview, chatId, senderId]);
            await pool.query('UPDATE user_chats SET lastMessage = $1 WHERE chatId = $2 AND citizen_id = $3', [preview, chatId, senderId]);

            const newMessage = { id: result.rows[0].id, chatId, senderId, content, subject: subject || "", timestamp: new Date() };
            io.to(chatId).emit('new_message', newMessage);

            // AI
            const response = await axios.post(AI_SERVER_URL, { chatId, senderId, content }).catch(() => null);
            if (response && response.data.should_intervene) {
                setTimeout(async () => {
                    const sysSubj = "SECURITY ALERT";
                    const sysRes = await pool.query(
                        'INSERT INTO messages (chatId, senderId, subject, content, is_system) VALUES ($1, $2, $3, $4, true) RETURNING id',
                        [chatId, "RAYA_SYSTEM", sysSubj, response.data.response_text]
                    );
                    await pool.query('UPDATE user_chats SET lastMessage = $1, unread = true WHERE chatId = $2', [sysSubj, chatId]);
                    
                    io.to(chatId).emit('new_message', {
                        id: sysRes.rows[0].id, chatId, senderId: "RAYA_SYSTEM", subject: sysSubj, content: response.data.response_text, is_system: true, timestamp: new Date()
                    });
                }, 800);
            }
        } catch (err) { console.error('Error:', err.message); }
    });

    socket.on('delete_message_global', async (data) => {
        const { messageId, chatId } = data;
        await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
        io.to(chatId).emit('message_deleted', { messageId, chatId });
    });

    socket.on('delete_chat_for_user', async (chatId) => {
        await pool.query('DELETE FROM user_chats WHERE citizen_id = $1 AND chatId = $2', [citizenId, chatId]);
    });

    socket.on('disconnect', () => {
        onlineCitizens.delete(socket.citizenId);
    });
});
