"""Keyboard builders with Telegram premium custom emojis.
All bot UI uses premium emoji via <tg-emoji> tags (ParseMode.HTML).
"""

from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from backend.core.config import settings

# ── Premium Emoji ID Mapping ──
E = {
    "settings":     "5870982283724328568",
    "profile":      "5870994129244131212",
    "check":        "5870633910337015697",
    "cancel":       "5870657884844462243",
    "delete":       "5870875489362513438",
    "edit":         "5870676941614354370",
    "list":         "5870528606328852614",
    "stats":        "5870921681735781843",
    "trend":        "5870930636742595124",
    "info":         "6028435952299413210",
    "bot":          "6030400221232501136",
    "money":        "5904462880941545555",
    "calendar":     "5890937706803894250",
    "category":     "5886285355279193209",
    "item":         "5884479287171485878",
    "ai_parse":     "5870753782874246579",
    "send":         "5963103826075456248",
    "refresh":      "5345906554510012647",
    "city":         "6042011682497106307",
    "celebrate":    "6041731551845159060",
    "lock":         "6037249452824072506",
    "link":         "5769289093221454192",
    "bell":         "6039486778597970865",
}


def em(name: str, fallback: str = "") -> str:
    """Format custom emoji tag."""
    emoji_id = E.get(name)
    if emoji_id:
        return f'<tg-emoji emoji-id="{emoji_id}">{fallback}</tg-emoji>'
    return fallback


def start_keyboard() -> InlineKeyboardMarkup:
    """Main menu after /start."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            InlineKeyboardButton(
                text=f"{em('item', '📦')} Открыть Mating",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            )
        ])
    else:
        buttons.append([
            InlineKeyboardButton(
                text=f"{em('item', '📦')} Mating App",
                callback_data="cmd_list",
            )
        ])

    buttons.append([
        InlineKeyboardButton(text=f"{em('list', '📋')} Мой список", callback_data="cmd_list"),
        InlineKeyboardButton(text=f"{em('ai_parse', '✨')} Добавить", callback_data="cmd_add"),
    ])
    buttons.append([
        InlineKeyboardButton(text=f"{em('stats', '📊')} Статистика", callback_data="cmd_stats"),
        InlineKeyboardButton(text=f"{em('settings', '⚙')} Настройки", callback_data="cmd_settings"),
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
    for item in items[:15]:  # limit for telegram message size
        check_icon = "✓" if item.is_purchased else "☐"
        name_display = f"{check_icon} {item.name} — {item.quantity} {item.unit}"
        buttons.append([InlineKeyboardButton(text=name_display, callback_data=f"toggle:{item.id}:{item.version}")])

    buttons.append([
        InlineKeyboardButton(text=f"{em('delete', '🗑')} Очистить купленное", callback_data="clear_purchased"),
    ])
    buttons.append([
        InlineKeyboardButton(text="◁ Назад", callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def settings_keyboard(current_lang: str = "ru") -> InlineKeyboardMarkup:
    """Settings menu."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✓ Русский" if current_lang == "ru" else "Русский", callback_data="lang:ru"),
            InlineKeyboardButton(text="✓ O'zbek" if current_lang == "uz" else "O'zbek", callback_data="lang:uz"),
            InlineKeyboardButton(text="✓ English" if current_lang == "en" else "English", callback_data="lang:en"),
        ],
        [InlineKeyboardButton(text="◁ Назад", callback_data="back_main")],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    """Back button."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◁ Назад", callback_data="back_main")],
    ])
