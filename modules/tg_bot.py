"""
Optional TG bot handler. Starts only if TELEGRAM_BOT_TOKEN env present.
Uses python-telegram-bot in polling mode running as an asyncio background
task alongside the aiohttp web server.
"""
from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger("tg_bot")


PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://spectrum-app.fly.dev")


_START_TEXT = (
    "Привет! Это Спектр — инструменты для семей с детьми с РАС.\n\n"
    "В Спектре есть:\n"
    "💬 Голос — карточки и фразы\n"
    "📅 День — расписание и шаги\n"
    "😊 Эмоции — игра на распознавание\n"
    "🎚️ Настроение — для подростков\n"
    "📖 Истории — ИИ под ситуацию\n"
    "🌬️ Родителю — совет дня и mindfulness\n\n"
    "Жми кнопку ниже чтобы открыть."
)

_ABOUT_TEXT = (
    "Спектр — бесплатное приложение для семей с детьми с расстройством "
    "аутистического спектра (РАС).\n\n"
    "Что внутри (всё работает офлайн):\n"
    "• AAC-коммуникатор (карточки, фразы, запись родительского голоса)\n"
    "• Визуальное расписание с готовыми и своими распорядками\n"
    "• Игра на распознавание эмоций (8 уровней)\n"
    "• Mood tracker для подростков (Zones of Regulation + coping)\n"
    "• AI-генератор социальных историй по Carol Gray\n"
    "• Hanen-подсказки и mindfulness-практики для родителя\n\n"
    "Никаких рекламы, in-app purchases или сбора персональных данных. "
    "Всё хранится на устройстве.\n\n"
    "Открыть: " + PUBLIC_URL
)


async def _start_handler(update, context):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            text="Открыть Спектр",
            web_app=WebAppInfo(url=PUBLIC_URL + "/"),
        )
    ]])
    await update.message.reply_text(_START_TEXT, reply_markup=kb)


async def _about_handler(update, context):
    await update.message.reply_text(_ABOUT_TEXT)


async def start_bot():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.info("TELEGRAM_BOT_TOKEN not set — skipping TG bot")
        return None

    try:
        from telegram.ext import Application, CommandHandler
    except ImportError:
        logger.warning("python-telegram-bot not installed — skipping TG bot")
        return None

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", _start_handler))
    app.add_handler(CommandHandler("about", _about_handler))

    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("TG bot started (polling)")
    return app


async def stop_bot(app):
    if app is None:
        return
    try:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
    except Exception as e:
        logger.warning(f"Error stopping TG bot: {e}")
