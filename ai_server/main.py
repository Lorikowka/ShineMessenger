import json
from http.server import BaseHTTPRequestHandler, HTTPServer

# Конфигурация сервера
HOST = "0.0.0.0"
PORT = 8000

# Триггерные слова для системы безопасности "Идеального Мира"
TRIGGER_WORDS = ["симуляция", "алгоритм", "побег", "инспектор", "имплант"]
RAYA_NAMES = ["райя", "@raya"]

class RayaAnalysisHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Проверка пути
        if self.path == "/api/v1/analyze":
            # Получение длины контента
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Парсинг JSON
                data = json.loads(post_data.decode('utf-8'))
                content = data.get("content", "").lower()
                
                # Логика анализа
                has_trigger = any(word in content for word in TRIGGER_WORDS)
                is_addressing_raya = any(name in content for name in RAYA_NAMES)
                
                response_data = {"should_intervene": False}
                
                if has_trigger or is_addressing_raya:
                    response_data = {
                        "should_intervene": True,
                        "response_text": "Внимание. Обнаружен критический анализ данных окружения. Анализ завершен. Безопасность сектора в приоритете.",
                        "phase": "SECURITY_ALERT"
                    }
                
                # Отправка ответа
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
                
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f"Error: {str(e)}".encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        # Обработка CORS если потребуется
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    print(f"Raya-Prime AI Server (Zero-Dependency) запущен на http://{HOST}:{PORT}")
    server = HTTPServer((HOST, PORT), RayaAnalysisHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
