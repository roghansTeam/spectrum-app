"""
TG bot обвязка spectrum-app.

- /start, /about — info commands
- Любое другое сообщение от user'а — relay админу (forwarded copy +
  metadata), чтобы публично не светить @skol4356
- Reply админа в DM на forwarded message → бот пересылает текст автору
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import pathlib
from typing import Any

logger = logging.getLogger("tg_bot")


PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://spectrum-app.fly.dev")
ADMIN_ID = int(os.environ.get("TG_ADMIN_ID", "390121493"))


DATA = pathlib.Path(os.environ.get("DATA_PATH", pathlib.Path(__file__).resolve().parent.parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
RELAY_MAP_FILE = DATA / "tg_relay_map.json"


_START_TEXT = (
    "Привет! Это Спектр — инструменты для общения и поддержки детей с аутизмом.\n\n"
    "Внутри:\n"
    "💬 Голос — карточки и фразы\n"
    "📅 День — расписание и шаги\n"
    "😊 Эмоции — игра на распознавание\n"
    "🎚️ Настроение — для подростков\n"
    "📖 Истории — ИИ под ситуацию\n"
    "🌬️ Родителю — совет дня и mindfulness\n\n"
    "Жми кнопку ниже чтобы открыть.\n\n"
    "📣 Новости и истории родителей: @spectrum_app\n\n"
    "Что-то спросить, предложить или рассказать историю — просто напиши сюда. "
    "Я (автор) прочитаю и отвечу."
)

_ABOUT_TEXT = (
    "Спектр — бесплатное приложение для общения и поддержки детей с аутизмом.\n\n"
    "Что внутри (всё работает офлайн):\n"
    "• AAC-коммуникатор (карточки, фразы, запись родительского голоса)\n"
    "• Визуальное расписание с готовыми и своими распорядками\n"
    "• Игра на распознавание эмоций (8 уровней)\n"
    "• Mood tracker для подростков (Zones of Regulation + coping)\n"
    "• AI-генератор социальных историй по Carol Gray\n"
    "• Hanen-подсказки и mindfulness-практики для родителя\n\n"
    "Никаких рекламы, in-app purchases или сбора персональных данных. "
    "Всё хранится на устройстве.\n\n"
    "Открыть: " + PUBLIC_URL + "\n"
    "Канал: @spectrum_app\n\n"
    "Хотите написать автору? Напишите прямо сюда — я (автор) прочитаю и отвечу через этот бот."
)


# Map of admin-side forwarded message_id → original sender chat_id.
# Loaded from disk to survive restarts. Format: { "admin_msg_id": user_chat_id }
_relay_map: dict[str, int] = {}


def _load_relay_map() -> None:
    global _relay_map
    if RELAY_MAP_FILE.exists():
        try:
            _relay_map = json.loads(RELAY_MAP_FILE.read_text(encoding="utf-8"))
        except Exception:
            _relay_map = {}


def _save_relay_map() -> None:
    try:
        # Keep at most last 1000 mappings to avoid unbounded growth
        if len(_relay_map) > 1000:
            keys = sorted(_relay_map.keys(), key=int)
            for k in keys[:-1000]:
                _relay_map.pop(k, None)
        RELAY_MAP_FILE.write_text(json.dumps(_relay_map), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not save relay map: {e}")


async def _start_handler(update: Any, context: Any) -> None:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            text="Открыть Спектр",
            web_app=WebAppInfo(url=PUBLIC_URL + "/"),
        )
    ]])
    await update.message.reply_text(_START_TEXT, reply_markup=kb)


async def _about_handler(update: Any, context: Any) -> None:
    await update.message.reply_text(_ABOUT_TEXT)


async def _relay_to_admin(update: Any, context: Any) -> None:
    """Any non-command message from a non-admin user → forwarded to admin
    + a metadata header so the admin can reply via the bot."""
    msg = update.message
    if msg is None or msg.from_user is None:
        return
    sender = msg.from_user
    sender_id = sender.id
    if sender_id == ADMIN_ID:
        await _admin_reply_handler(update, context)
        return

    bot = context.bot
    # Forward the original message (preserves voice/photo/sticker/etc.)
    try:
        fwd = await bot.forward_message(
            chat_id=ADMIN_ID,
            from_chat_id=msg.chat_id,
            message_id=msg.message_id,
        )
    except Exception as e:
        logger.warning(f"forward to admin failed: {e}")
        await msg.reply_text(
            "Не получилось доставить сообщение. Попробуйте чуть позже."
        )
        return

    # Build header that the admin will see
    username = f"@{sender.username}" if sender.username else "(без username)"
    name = " ".join(filter(None, [sender.first_name, sender.last_name])) or "—"
    header = (
        "📨 Сообщение от пользователя\n"
        f"От: {name} {username}\n"
        f"ID: {sender_id}\n\n"
        "Ответьте reply'ем на это сообщение — текст уйдёт автору."
    )
    try:
        header_msg = await bot.send_message(chat_id=ADMIN_ID, text=header,
                                            reply_to_message_id=fwd.message_id)
    except Exception as e:
        logger.warning(f"send header to admin failed: {e}")
        header_msg = fwd

    # Map ALL related admin messages (forwarded + header) → sender id
    _relay_map[str(fwd.message_id)] = sender_id
    _relay_map[str(header_msg.message_id)] = sender_id
    _save_relay_map()

    # Confirm to sender
    try:
        await msg.reply_text("Спасибо! Получил, постараюсь ответить.")
    except Exception:
        pass


async def _admin_reply_handler(update: Any, context: Any) -> None:
    """When admin types a message in DM with bot AS REPLY to a relayed
    message, send admin's text to the original user."""
    msg = update.message
    reply_to = msg.reply_to_message
    if reply_to is None:
        # Not a reply — admin probably just chatting with bot; ignore quietly
        await msg.reply_text(
            "Чтобы ответить пользователю — сделайте reply на его сообщение."
        )
        return
    target_id = _relay_map.get(str(reply_to.message_id))
    if target_id is None:
        await msg.reply_text(
            "Не нашёл, кому это адресовать (mapping не найден). "
            "Возможно сообщение слишком старое."
        )
        return
    bot = context.bot
    try:
        if msg.text:
            await bot.send_message(chat_id=target_id, text=msg.text)
        else:
            # For non-text replies, copy the message
            await bot.copy_message(
                chat_id=target_id,
                from_chat_id=msg.chat_id,
                message_id=msg.message_id,
            )
        await msg.reply_text("✓ Отправил")
    except Exception as e:
        logger.warning(f"relay to user {target_id} failed: {e}")
        await msg.reply_text(f"Не смог отправить: {type(e).__name__}")


async def start_bot() -> Any:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.info("TELEGRAM_BOT_TOKEN not set — skipping TG bot")
        return None

    try:
        from telegram.ext import Application, CommandHandler, MessageHandler, filters
    except ImportError:
        logger.warning("python-telegram-bot not installed — skipping TG bot")
        return None

    _load_relay_map()
    logger.info(f"Loaded {len(_relay_map)} relay mappings")

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", _start_handler))
    app.add_handler(CommandHandler("about", _about_handler))
    # Everything else → relay (private chats only)
    app.add_handler(MessageHandler(
        filters.ChatType.PRIVATE & ~filters.COMMAND,
        _relay_to_admin,
    ))

    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info(f"TG bot started (polling), admin_id={ADMIN_ID}")
    return app


async def stop_bot(app: Any) -> None:
    if app is None:
        return
    try:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
    except Exception as e:
        logger.warning(f"Error stopping TG bot: {e}")
