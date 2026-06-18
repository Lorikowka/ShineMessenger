# Используем стабильную версию Node.js
FROM node:20-bookworm-slim

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Railway сам подставит PORT
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
