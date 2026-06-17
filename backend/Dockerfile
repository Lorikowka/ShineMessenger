# Используем стабильную версию Node.js на базе Debian Bookworm (там нужная версия GLIBC)
FROM node:20-bookworm-slim

# Устанавливаем зависимости для сборки нативных модулей (если понадобятся)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости и принудительно пересобираем sqlite3 из исходников
RUN npm install && npm rebuild sqlite3 --build-from-source

# Копируем остальной код
COPY . .

# Railway сам подставит PORT
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
