-- Инициализация базы данных Raya-Prime Messenger

-- Таблица пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    citizen_id VARCHAR(8) UNIQUE NOT NULL, -- Формат 'A-000000'
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица чатов
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(20) DEFAULT 'group', -- 'private' или 'group'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сообщений
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id VARCHAR(50), -- Может быть ID пользователя или 'RAYA_SYSTEM'
    content TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Комментарий к структуре
COMMENT ON COLUMN users.citizen_id IS 'Идентификатор гражданина в формате A-000000';
COMMENT ON COLUMN messages.sender_id IS 'ID отправителя или системный идентификатор RAYA_SYSTEM';
