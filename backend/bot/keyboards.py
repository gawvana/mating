"""Keyboard builders with standard Unicode emojis.
All bot UI uses standard Unicode emojis for maximum compatibility across all platforms.
"""

from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from backend.core.config import settings

# ── Standard Unicode Emojis ──
EMOJIS = {
    "settings":     "⚙️",
    "profile":      "👤",
    "check":        "✅",
    "cancel":       "❌",
    "delete":       "🗑",
    "edit":         "✏️",
    "list":         "📋",
    "stats":        "📊",
    "trend":        "📈",
    "info":         "ℹ️",
    "bot":          "🤖",
    "money":        "💰",
    "calendar":     "📅",
    "category":     "🏷",
    "item":         "🛍",
    "ai_parse":     "✨",
    "send":         "📤",
    "refresh":      "🔄",
    "city":         "🏙",
    "celebrate":    "🎉",
    "lock":         "🔒",
    "link":         "🔗",
    "bell":         "🔔",
}


def em(name: str, fallback: str = "") -> str:
    """Return standard unicode emoji."""
    return EMOJIS.get(name, fallback or "🔹")


def start_keyboard() -> InlineKeyboardMarkup:
    """Main menu after /start."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            InlineKeyboardButton(
                text=f"{em('item', '🛍')} Открыть Mating",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            )
        ])
    else:
        buttons.append([
            InlineKeyboardButton(
                text=f"{em('item', '🛍')} Mating App",
                callback_data="cmd_list",
            )
        ])

    buttons.append([
        InlineKeyboardButton(text=f"{em('list', '📋')} Мой список", callback_data="cmd_list"),
        InlineKeyboardButton(text=f"{em('ai_parse', '✨')} Добавить", callback_data="cmd_add"),
    ])
    buttons.append([
        InlineKeyboardButton(text=f"{em('stats', '📊')} Статистика", callback_data="cmd_stats"),
        InlineKeyboardButton(text=f"{em('settings', '⚙️')} Настройки", callback_data="cmd_settings"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_items_keyboard(batch_id: str) -> InlineKeyboardMarkup:
    """Confirm/cancel after AI parse."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=f"{em('check', '✅')} Добавить всё", callback_data=f"confirm:{batch_id}"),
            InlineKeyboardButton(text=f"{em('cancel', '❌')} Отмена", callback_data=f"cancel:{batch_id}"),
        ],
    ])


def item_list_keyboard(items: list) -> InlineKeyboardMarkup:
    """Inline buttons to toggle active items."""
    buttons = []
    for item in items[:15]:
        check_icon = "✅" if item.is_purchased else "⬜"
        name_display = f"{check_icon} {item.name} — {item.quantity} {item.unit}"
        buttons.append([InlineKeyboardButton(text=name_display, callback_data=f"toggle:{item.id}:{item.version}")])

    action_row = []
    if any(i.is_purchased for i in items):
        action_row.append(
            InlineKeyboardButton(text=f"{em('delete', '🗑')} Очистить", callback_data="clear_purchased")
        )
    action_row.append(
        InlineKeyboardButton(text=f"{em('ai_parse', '✨')} Добавить", callback_data="cmd_add")
    )
    buttons.append(action_row)

    if settings.WEBAPP_URL:
        buttons.append([
            InlineKeyboardButton(text=f"{em('item', '🛍')} Открыть в Mini App", web_app=WebAppInfo(url=settings.WEBAPP_URL)),
        ])

    buttons.append([
        InlineKeyboardButton(text="◁ Главное меню", callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def settings_keyboard(current_lang: str = "ru") -> InlineKeyboardMarkup:
    """Settings menu."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Русский" if current_lang == "ru" else "🇷🇺 Русский", callback_data="lang:ru"),
            InlineKeyboardButton(text="✅ O'zbek" if current_lang == "uz" else "🇺🇿 O'zbek", callback_data="lang:uz"),
            InlineKeyboardButton(text="✅ English" if current_lang == "en" else "🇬🇧 English", callback_data="lang:en"),
        ],
        [InlineKeyboardButton(text="◁ Главное меню", callback_data="back_main")],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    """Back button."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            InlineKeyboardButton(text=f"{em('item', '🛍')} Открыть Mating", web_app=WebAppInfo(url=settings.WEBAPP_URL))
        ])
    buttons.append([
        InlineKeyboardButton(text="◁ Главное меню", callback_data="back_main")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
