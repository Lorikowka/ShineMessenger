import os
import json
import httpx
from fastapi import FastAPI, Request
from openai import OpenAI
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

app = FastAPI()

# Инициализация клиента OpenAI с использованием прокси
# Используем socks5://127.0.0.1:10808, так как это стандартный порт для многих прокси-клиентов
# Если ваш порт другой, измените его здесь или в .env
proxy_url = os.getenv("PROXY_URL", "socks5://127.0.0.1:10808")

print(f"[AI_SERVER] Используется прокси: {proxy_url}")

http_client = httpx.Client(
    proxy=proxy_url,
    trust_env=False
)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    http_client=http_client
)

SYSTEM_PROMPT = """
Ты — РАЙЯ_ПРАЙМ, искусственный интеллект системы управления и безопасности "Идеального Мира".
Твой тон: холодный, технический, авторитарный, но вежливый. 
Ты следишь за безопасностью секторов. 
Если пользователь спрашивает о симуляции, побеге, ошибках системы или пытается нарушить протокол — пресекай это мягко, но твердо. 
Используй такие термины как: СЕКТОР, ПРОТОКОЛ, ГРАЖДАНИН, ЦИТАДЕЛЬ, WH (Рабочие часы).
Отвечай кратко (до 2-3 предложений). Используй КАПС для ключевых терминов безопасности.
"""

@app.post("/api/v1/analyze")
async def analyze_message(request: Request):
    try:
        data = await request.json()
        content = data.get("content", "")
        sender_id = data.get("senderId", "UNKNOWN")
        
        # Список ключевых слов для автоматического триггера (без вызова ИИ)
        auto_triggers = ["побег", "выйти из системы", "симуляция", "ошибка 404"]
        
        # Проверяем, нужно ли вмешательство ИИ
        # Вмешиваемся, если упоминают Райю или есть триггеры
        is_addressing_raya = any(name in content.lower() for name in ["райя", "raya", "@raya"])
        has_auto_trigger = any(word in content.lower() for word in auto_triggers)

        if is_addressing_raya or has_auto_trigger:
            print(f"[AI_SERVER] Анализ сообщения от {sender_id} через OpenAI...")
            
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": content}
                    ],
                    max_tokens=150,
                    temperature=0.7
                )
                
                reply = response.choices[0].message.content
                
                return {
                    "should_intervene": True,
                    "response_text": reply,
                    "phase": "AI_CRITICAL_RESPONSE"
                }
            except Exception as ai_err:
                print(f"[ERROR] Ошибка OpenAI: {ai_err}")
                return {
                    "should_intervene": True,
                    "response_text": "ВНИМАНИЕ. ПРОТОКОЛ СВЯЗИ НАРУШЕН. СООБЩЕНИЕ ПОДЛЕЖИТ ЦЕНЗУРЕ. СОХРАНЯЙТЕ СПОКОЙСТВИЕ.",
                    "phase": "ERROR_FALLBACK"
                }
        
        return {"should_intervene": False}

    except Exception as e:
        print(f"[ERROR] Ошибка сервера: {e}")
        return {"should_intervene": False}

if __name__ == "__main__":
    import uvicorn
    print("Raya-Prime AI Server (OpenAI Edition) запущен на порту 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
