"""
Это главный файл, который ты будешь запускать: python main.py

Он одновременно поднимает три вещи внутри одного процесса:
1. Веб-сервер (FastAPI/uvicorn) — обслуживает вебапп и API.
2. Бота (aiogram) — принимает команды /start и т.д.
3. Планировщик — раз в 30 секунд проверяет напоминания.

Всё это работает "параллельно" благодаря asyncio — библиотеке Python
для асинхронного программирования.
"""

import asyncio
import uvicorn

import config
import database as db
from api import app as fastapi_app
from bot import bot, dp
from scheduler import start_scheduler


async def main():
    await db.init_db()
    print("База данных готова.")

    start_scheduler()
    print("Планировщик напоминаний запущен.")

    uvicorn_config = uvicorn.Config(
        fastapi_app, host="0.0.0.0", port=config.PORT, log_level="info"
    )
    server = uvicorn.Server(uvicorn_config)

    print(f"Сервер запускается на порту {config.PORT}...")
    print("Бот запускается...")

    # Запускаем сервер и бота одновременно
    await asyncio.gather(
        server.serve(),
        dp.start_polling(bot),
    )


if __name__ == "__main__":
    asyncio.run(main())
