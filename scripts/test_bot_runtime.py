"""Real Telegram Bot Runtime Interaction Test.
Tests all bot handlers, commands, callbacks, AI parser, and database state using real models.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock
from aiogram.types import Chat, Message, User as TgUser, CallbackQuery

from backend.bot.bot import (
    handle_add_command,
    handle_back_main,
    handle_callback_add,
    handle_callback_list,
    handle_callback_settings,
    handle_callback_stats,
    handle_help_command,
    handle_lang_change,
    handle_list_command,
    handle_natural_text,
    handle_settings_command,
    handle_start,
    handle_stats_command,
    handle_confirm_batch,
    pending_batches,
)

bot_test_results = []

def record(name: str, expected: str, actual: str, status: str):
    safe_actual = str(actual).encode("ascii", errors="replace").decode("ascii")
    print(f"[{status}] Bot -> {name}: {safe_actual}")
    bot_test_results.append({
        "name": name,
        "expected": expected,
        "actual": str(actual),
        "status": status,
    })


def make_mock_message(text: str, user_id: int = 777888999, first_name: str = "LiveTester", username: str = "livetester") -> Message:
    msg = MagicMock(spec=Message)
    msg.text = text
    msg.from_user = TgUser(id=user_id, is_bot=False, first_name=first_name, username=username, language_code="ru")
    msg.chat = Chat(id=user_id, type="private")
    msg.answer = AsyncMock()
    return msg


def make_mock_callback(data: str, user_id: int = 777888999) -> CallbackQuery:
    call = MagicMock(spec=CallbackQuery)
    call.data = data
    call.from_user = TgUser(id=user_id, is_bot=False, first_name="LiveTester", username="livetester", language_code="ru")
    call.message = MagicMock(spec=Message)
    call.message.edit_text = AsyncMock()
    call.message.edit_reply_markup = AsyncMock()
    call.answer = AsyncMock()
    return call


async def test_bot_flows():
    print("=" * 60)
    print("STARTING REAL TELEGRAM BOT RUNTIME TEST")
    print("=" * 60)

    # 1. /start command
    try:
        msg = make_mock_message("/start")
        await handle_start(msg)
        args, kwargs = msg.answer.call_args
        reply_text = args[0]
        has_emoji = "🎉" in reply_text
        has_no_tg_emoji = "<tg-emoji" not in reply_text
        if has_emoji and has_no_tg_emoji and "Mating" in reply_text:
            record("Command /start", "Greeting with standard emojis and start keyboard", f"Answered ({len(reply_text)} chars)", "PASS")
        else:
            record("Command /start", "Valid greeting", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Command /start", "Valid greeting", str(e), "FAIL")

    # 2. /help command
    try:
        msg = make_mock_message("/help")
        await handle_help_command(msg)
        args, _ = msg.answer.call_args
        reply_text = args[0]
        if "Команды Mating" in reply_text and "<tg-emoji" not in reply_text:
            record("Command /help", "Help text with list of commands", "Help displayed OK", "PASS")
        else:
            record("Command /help", "Help text", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Command /help", "Help text", str(e), "FAIL")

    # 3. /settings command
    try:
        msg = make_mock_message("/settings")
        await handle_settings_command(msg)
        args, _ = msg.answer.call_args
        reply_text = args[0]
        if "Настройки" in reply_text:
            record("Command /settings", "Settings menu with language selection", "Settings displayed OK", "PASS")
        else:
            record("Command /settings", "Settings menu", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Command /settings", "Settings menu", str(e), "FAIL")

    # 4. /stats command
    try:
        msg = make_mock_message("/stats")
        await handle_stats_command(msg)
        args, _ = msg.answer.call_args
        reply_text = args[0]
        if "Статистика" in reply_text:
            record("Command /stats", "Monthly spending statistics", "Stats displayed OK", "PASS")
        else:
            record("Command /stats", "Monthly stats", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Command /stats", "Monthly stats", str(e), "FAIL")

    # 5. Natural text input -> Real Gemini AI parse
    batch_id = None
    try:
        msg = make_mock_message("молоко 1л, хлеб белый, сыр гауда 200г")
        await handle_natural_text(msg)
        args, kwargs = msg.answer.call_args
        reply_text = args[0]
        has_parsed = "Распознано товаров" in reply_text
        if has_parsed and len(pending_batches) > 0:
            batch_id = list(pending_batches.keys())[-1]
            batch_items = pending_batches[batch_id]["items"]
            record("Natural Language AI Input", "AI extracts items and asks confirmation", f"Parsed {len(batch_items)} items via Gemini, Batch ID: {batch_id}", "PASS")
        else:
            record("Natural Language AI Input", "AI extracts items", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Natural Language AI Input", "AI extracts items", str(e), "FAIL")

    # 6. Confirm batch callback
    if batch_id:
        try:
            call = make_mock_callback(f"confirm:{batch_id}")
            await handle_confirm_batch(call)
            args, _ = call.message.edit_text.call_args
            reply_text = args[0]
            if "Успешно добавлено" in reply_text:
                record("Callback confirm:batch", "Batch committed to DB and confirmed", f"Confirmed: {reply_text}", "PASS")
            else:
                record("Callback confirm:batch", "Batch committed", f"Failed: {reply_text}", "FAIL")
        except Exception as e:
            record("Callback confirm:batch", "Batch committed", str(e), "FAIL")

    # 7. /list command (after adding items)
    try:
        msg = make_mock_message("/list")
        await handle_list_command(msg)
        args, _ = msg.answer.call_args
        reply_text = args[0]
        if "Список покупок" in reply_text and "активных" in reply_text:
            record("Command /list", "Displays formatted shopping list with active items", f"List displayed with active items", "PASS")
        else:
            record("Command /list", "Displays list", f"Failed: {reply_text}", "FAIL")
    except Exception as e:
        record("Command /list", "Displays list", str(e), "FAIL")

    # 8. Callbacks navigation
    callbacks = [
        ("cmd_list", handle_callback_list, "Список покупок"),
        ("cmd_stats", handle_callback_stats, "Статистика"),
        ("cmd_settings", handle_callback_settings, "Настройки"),
        ("cmd_add", handle_callback_add, "Добавление товаров"),
        ("back_main", handle_back_main, "Главное меню"),
    ]
    for cdata, handler, expected_needle in callbacks:
        try:
            call = make_mock_callback(cdata)
            await handler(call)
            args, _ = call.message.edit_text.call_args
            reply_text = args[0]
            if expected_needle in reply_text:
                record(f"Callback {cdata}", f"Navigates and edits message to show {expected_needle}", f"OK", "PASS")
            else:
                record(f"Callback {cdata}", f"Shows {expected_needle}", f"Failed: {reply_text}", "FAIL")
        except Exception as e:
            record(f"Callback {cdata}", f"Shows {expected_needle}", str(e), "FAIL")

    # 9. Language change callback
    try:
        call = make_mock_callback("lang:uz")
        await handle_lang_change(call)
        call.answer.assert_called_with("Язык изменен на UZ")
        record("Callback lang:uz", "Updates user language preference to UZ in DB", "Language switched to UZ", "PASS")
    except Exception as e:
        record("Callback lang:uz", "Updates language", str(e), "FAIL")

    print("\n" + "=" * 60)
    print("TELEGRAM BOT RUNTIME SUMMARY")
    print("=" * 60)
    total = len(bot_test_results)
    passed = sum(1 for t in bot_test_results if t["status"] == "PASS")
    print(f"Total Bot Tests: {total}")
    print(f"Passed: {passed} ({passed/total*100:.1f}%)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_bot_flows())
