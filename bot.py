"""
Здесь описан сам бот: что он отвечает на команды и как он открывает
вебапп пользователю.

Главное — кнопка с типом WebAppInfo. Именно она превращает обычную
кнопку в "открыть мини-приложение внутри Telegram".
"""

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

import config

bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()


def webapp_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌸 Открыть Musya+",
            web_app=WebAppInfo(url=config.WEBAPP_URL)
        )]
    ])


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    await message.answer(
        "Привет! 🌷 Это Musya+ — твой личный трекер цикла и самочувствия.\n\n"
        "Внутри приложения тебя ждут:\n"
        "🌸 Календарь цикла с прогнозом овуляции и фертильных дней\n"
        "🌷 Ежедневный дневник настроения и симптомов\n"
        "💧 Трекер воды и ⚖️ трекер веса\n"
        "🧘 Дыхательная пауза для снятия стресса\n"
        "📝 Заметки по категориям с напоминаниями\n"
        "📊 Статистика по циклу и симптомам\n\n"
        "Нажми на кнопку ниже, чтобы открыть приложение.\n\n"
        "Напоминания, которые ты создашь в приложении, "
        "я пришлю сюда, в этот чат, в указанное тобой время.",
        reply_markup=webapp_keyboard(),
    )


@dp.message()
async def fallback(message: types.Message):
    await message.answer(
        "Не совсем понимаю эту команду 🙂\n"
        "Нажми /start, чтобы открыть приложение.",
    )
