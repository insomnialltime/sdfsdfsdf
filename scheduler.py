"""
APScheduler каждые 30 секунд "просыпается" и спрашивает у базы данных:
"есть ли напоминания, время которых уже наступило, но которые ещё
не отправлены?". Если такие есть — бот отправляет пользователю
сообщение в чат и помечает напоминание как отправленное.

Это самый простой и надёжный способ сделать напоминания без
дополнительных сервисов очередей (типа Redis/Celery), чего для
старта более чем достаточно.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime

import database as db
from bot import bot


async def check_and_send_reminders():
    now_iso = datetime.utcnow().isoformat(timespec="seconds")
    due = await db.get_due_reminders(now_iso)

    for reminder in due:
        try:
            await bot.send_message(
                chat_id=reminder["user_id"],
                text=f"🔔 Напоминание\n\n{reminder['text']}",
            )
        except Exception as e:
            # Например, если пользователь заблокировал бота —
            # не роняем весь планировщик из-за одной ошибки.
            print(f"Не удалось отправить напоминание {reminder['id']}: {e}")
        finally:
            await db.mark_reminder_sent(reminder["id"])


def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(check_and_send_reminders, "interval", seconds=30)
    scheduler.start()
    return scheduler
