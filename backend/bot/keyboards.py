"""Keyboard builders with Telegram premium custom emojis.
All bot UI keyboards use icon_custom_emoji_id with clean button labels (no raw unicode emojis in text).
"""

from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from backend.core.config import settings

# ── Canonical Telegram Premium Custom Emoji IDs ──
CUSTOM_EMOJIS = {
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
    """Format custom emoji tag for HTML messages (<tg-emoji emoji-id="...">)."""
    emoji_id = CUSTOM_EMOJIS.get(name)
    if emoji_id:
        return f'<tg-emoji emoji-id="{emoji_id}">{fallback or "•"}</tg-emoji>'
    return fallback


def emoji_btn(text: str, emoji_name: str | None = None, **kwargs) -> InlineKeyboardButton:
    """Create an InlineKeyboardButton using icon_custom_emoji_id with clean text."""
    custom_id = CUSTOM_EMOJIS.get(emoji_name) if emoji_name else None
    return InlineKeyboardButton(text=text, icon_custom_emoji_id=custom_id, **kwargs)


def start_keyboard() -> InlineKeyboardMarkup:
    """Main menu after /start with premium custom emoji buttons:
    [🛍 Открыть Mating]
    [🤖 AI] [⚙️ Настройки]
    """
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            emoji_btn(
                "Открыть Mating",
                "item",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            )
        ])
    else:
        buttons.append([
            emoji_btn(
                "Открыть Mating",
                "item",
                callback_data="cmd_list",
            )
        ])

    buttons.append([
        emoji_btn("AI Ассистент", "bot", callback_data="cmd_ai"),
        emoji_btn("Настройки", "settings", callback_data="cmd_settings"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def ai_keyboard() -> InlineKeyboardMarkup:
    """AI Assistant menu."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            emoji_btn(
                "Открыть AI в Mini App",
                "bot",
                web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}#ai"),
            )
        ])
    buttons.append([
        emoji_btn("Список", "list", callback_data="cmd_list"),
        emoji_btn("Главное меню", "link", callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def history_keyboard() -> InlineKeyboardMarkup:
    """History menu."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            emoji_btn(
                "Открыть Историю в Mini App",
                "calendar",
                web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}#history"),
            )
        ])
    buttons.append([
        emoji_btn("Список", "list", callback_data="cmd_list"),
        emoji_btn("Главное меню", "link", callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def share_keyboard(share_url: str) -> InlineKeyboardMarkup:
    """Share menu."""
    buttons = [
        [emoji_btn("Открыть список", "link", url=share_url)],
        [emoji_btn("Главное меню", "link", callback_data="back_main")],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_items_keyboard(batch_id: str) -> InlineKeyboardMarkup:
    """Confirm/cancel after AI parse with custom emoji icons."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            emoji_btn("Добавить всё", "check", callback_data=f"confirm:{batch_id}"),
            emoji_btn("Отмена", "cancel", callback_data=f"cancel:{batch_id}"),
        ],
    ])


def item_list_keyboard(items: list) -> InlineKeyboardMarkup:
    """Inline buttons to toggle active items."""
    buttons = []
    for item in items[:15]:
        name_display = f"{item.name} — {item.quantity} {item.unit}"
        emoji_key = "check" if item.is_purchased else None
        buttons.append([emoji_btn(name_display, emoji_key, callback_data=f"toggle:{item.id}:{item.version}")])

    action_row = []
    if any(i.is_purchased for i in items):
        action_row.append(
            emoji_btn("Очистить", "delete", callback_data="clear_purchased")
        )
    action_row.append(
        emoji_btn("Добавить", "ai_parse", callback_data="cmd_add")
    )
    buttons.append(action_row)

    if settings.WEBAPP_URL:
        buttons.append([
            emoji_btn("Открыть в Mini App", "item", web_app=WebAppInfo(url=settings.WEBAPP_URL)),
        ])

    buttons.append([
        emoji_btn("Главное меню", "link", callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def settings_keyboard(current_lang: str = "ru") -> InlineKeyboardMarkup:
    """Settings menu."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            emoji_btn("Русский", "check" if current_lang == "ru" else None, callback_data="lang:ru"),
            emoji_btn("O'zbek", "check" if current_lang == "uz" else None, callback_data="lang:uz"),
            emoji_btn("English", "check" if current_lang == "en" else None, callback_data="lang:en"),
        ],
        [emoji_btn("Главное меню", "link", callback_data="back_main")],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    """Back button."""
    buttons = []
    if settings.WEBAPP_URL:
        buttons.append([
            emoji_btn("Открыть Mating", "item", web_app=WebAppInfo(url=settings.WEBAPP_URL))
        ])
    buttons.append([
        emoji_btn("Главное меню", "link", callback_data="back_main")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
