"""
Здесь мы просто читаем настройки из файла .env,
чтобы не хранить токен бота прямо в коде (это небезопасно
и его нельзя будет выложить на GitHub, например).
"""
import os
from dotenv import load_dotenv

load_dotenv()  # подгружает переменные из файла .env в окружение

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")
PORT = int(os.getenv("PORT", 8000))

if not BOT_TOKEN:
    raise RuntimeError(
        "Не найден BOT_TOKEN. Скопируй .env.example в .env и впиши туда токен бота."
    )

if not WEBAPP_URL:
    raise RuntimeError(
        "Не найден WEBAPP_URL. Впиши в .env адрес, по которому будет открываться вебапп."
    )
