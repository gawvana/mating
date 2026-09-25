"""aiogram 3 bot instance and router registration with standard Unicode emojis."""

from __future__ import annotations

import logging
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    BotCommandScopeDefault,
    CallbackQuery,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

from backend.api.schemas import CreateItemRequest
from backend.bot.keyboards import (
    back_keyboard,
    confirm_items_keyboard,
    em,
    item_list_keyboard,
    settings_keyboard,
    start_keyboard,
)
from backend.core.config import settings
from backend.core.security import hash_telegram_id
from backend.database.engine import AsyncSessionLocal
from backend.repositories.user_repository import UserRepository
from backend.services.ai_service import ai_service
from backend.services.item_service import ItemService

logger = logging.getLogger("mating.bot")

# Global pending batches for AI confirmation: batch_id -> {"user_id": str, "items": list}
pending_batches: dict[str, dict] = {}

dp = Dispatcher()


def get_bot() -> Bot | None:
    if not settings.BOT_TOKEN:
        return None
    return Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


async def setup_bot_commands_and_menu(bot: Bot) -> None:
    """Register official Telegram commands list and WebApp menu button."""
    try:
        commands = [
            BotCommand(command="start", description="Главное меню и Mini App"),
            BotCommand(command="list", description="Список покупок"),
            BotCommand(command="add", description="Добавить товары с AI"),
            BotCommand(command="stats", description="Статистика расходов"),
            BotCommand(command="settings", description="Настройки и язык"),
            BotCommand(command="help", description="Справка по боту"),
        ]
        await bot.set_my_commands(commands=commands, scope=BotCommandScopeDefault())
        logger.info("Bot commands successfully registered")

        if settings.WEBAPP_URL:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Mating",
                    web_app=WebAppInfo(url=settings.WEBAPP_URL),
                )
            )
            logger.info("Bot WebApp menu button set to %s", settings.WEBAPP_URL)

        await bot.set_my_description(
            description=(
                "Mating — современный умный список покупок и трекер расходов внутри Telegram.\n\n"
                "• Распознавание списков через AI (Google Gemini 2.5 Flash)\n"
                "• Премиальный Telegram Mini App интерфейс\n"
                "• Мгновенная синхронизация и контроль бюджета"
            )
        )
        await bot.set_my_short_description(
            short_description="Умный список покупок и трекер расходов в Telegram Mini App."
        )
    except Exception as e:
        logger.warning("Failed to configure bot commands/menu: %s", e)


# ── HANDLERS ──

@dp.message(CommandStart())
async def handle_start(message: Message):
    """Handle /start command."""
    from_user = message.from_user
    if not from_user:
        return

    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(
            telegram_id_hash=tg_hash,
            username=from_user.username,
            first_name=from_user.first_name,
            language_code=from_user.language_code or "ru",
        )

    greeting = (
        f"{em('celebrate', '🎉')} <b>Привет, {from_user.first_name or 'друг'}!</b>\n\n"
        f"Я <b>Mating</b> — твой быстрый умный помощник для покупок.\n\n"
        f"• Напиши мне список текстом обычным языком:\n"
        f"<i>«молоко 2л, картошка 3кг, сыр 300г, хлеб»</i>\n\n"
        f"• Или нажми <b>«Открыть Mating»</b> для работы в удобном Mini App!"
    )
    await message.answer(greeting, reply_markup=start_keyboard())


@dp.message(Command("list"))
async def handle_list_command(message: Message):
    """Handle /list command."""
    from_user = message.from_user
    if not from_user:
        return

    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_hash(tg_hash)
        if not user:
            user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)

        item_repo = ItemService(session)
        items = await item_repo.list_items(user.id)

    if not items:
        await message.answer(
            f"{em('info', 'ℹ️')} Ваш список покупок пуст.\nНапишите товары сообщением или используйте /add.",
            reply_markup=back_keyboard(),
        )
        return

    unpurchased = [i for i in items if not i.is_purchased]
    purchased = [i for i in items if i.is_purchased]

    text = f"{em('list', '📋')} <b>Список покупок ({len(unpurchased)} активных):</b>\n\n"
    if unpurchased:
        for idx, it in enumerate(unpurchased, 1):
            price_str = f" — {it.price:,.0f} {it.currency_code}" if it.price else ""
            text += f"{idx}. <b>{it.name}</b>: {it.quantity} {it.unit} [{it.category}]{price_str}\n"

    if purchased:
        text += f"\n<i>Куплено ({len(purchased)}):</i>\n"
        for it in purchased:
            text += f"<s>{it.name} ({it.quantity} {it.unit})</s>\n"

    await message.answer(text, reply_markup=item_list_keyboard(items))


@dp.message(Command("stats"))
async def handle_stats_command(message: Message):
    """Handle /stats command."""
    from_user = message.from_user
    if not from_user:
        return

    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        service = ItemService(session)
        stats = await service.get_monthly_stats(user.id)

    budget_info = (
        f"\nБюджет: <b>{stats.monthly_budget:,.0f} {stats.currency_code}</b>"
        f"\nОстаток: <b>{stats.budget_remaining:,.0f} {stats.currency_code}</b>"
        if stats.monthly_budget
        else ""
    )

    text = (
        f"{em('stats', '📊')} <b>Статистика за текущий месяц:</b>\n\n"
        f"Потрачено: <b>{stats.total_spent:,.0f} {stats.currency_code}</b>"
        f"{budget_info}\n"
        f"Куплено товаров: <b>{stats.items_purchased_count}</b>\n"
        f"Активных в списке: <b>{stats.active_items_count}</b>\n"
    )
    await message.answer(text, reply_markup=back_keyboard())


@dp.message(Command("help"))
async def handle_help_command(message: Message):
    """Handle /help command."""
    text = (
        f"{em('info', 'ℹ️')} <b>Команды Mating:</b>\n\n"
        f"/start — Главное меню и запуск\n"
        f"/list — Просмотреть текущий список покупок\n"
        f"/add &lt;текст&gt; — Добавить товары с AI разбором\n"
        f"/stats — Аналитика и расходы за месяц\n"
        f"/settings — Настройки языка и валюты\n"
        f"/help — Справка по работе с ботом\n\n"
        f"<b>Умный ввод:</b> просто отправьте боту список сообщением:\n"
        f"<i>«молоко 2л, картошка 3кг, сыр 300г»</i>"
    )
    await message.answer(text, reply_markup=back_keyboard())


@dp.message(Command("settings"))
async def handle_settings_command(message: Message):
    """Handle /settings command."""
    from_user = message.from_user
    if not from_user:
        return

    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        lang = user.language_code

    text = (
        f"{em('settings', '⚙️')} <b>Настройки:</b>\n\n"
        f"Язык: <b>{lang.upper()}</b>\n"
        f"Валюта: <b>{user.currency_code}</b>\n"
        f"Город: <b>{user.city or 'Не указан'}</b>\n"
        f"Бюджет на месяц: <b>{f'{user.monthly_budget:,.0f} {user.currency_code}' if user.monthly_budget else 'Не задан'}</b>\n\n"
        f"Выберите язык интерфейса:"
    )
    await message.answer(text, reply_markup=settings_keyboard(lang))


@dp.message(Command("add"))
async def handle_add_command(message: Message):
    """Handle /add <text> command."""
    args = message.text.partition(" ")[2].strip() if message.text else ""
    if not args:
        await message.answer(
            f"{em('ai_parse', '✍️')} Укажите товары после команды, например:\n"
            f"<code>/add яблоки 1кг, бананы 5шт, хлеб</code>"
        )
        return
    await process_natural_input(message, args)


@dp.message(F.text)
async def handle_natural_text(message: Message):
    """Handle natural language text message without command."""
    if message.text.startswith("/"):
        return
    await process_natural_input(message, message.text)


async def process_natural_input(message: Message, text: str):
    """Extract items using AI and ask user confirmation."""
    from_user = message.from_user
    if not from_user:
        return

    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        user_id = user.id

    try:
        parsed_res = await ai_service.parse_text(text, user_id=user_id)
    except Exception as e:
        logger.error("AI parse failed: %s", e)
        await message.answer(f"{em('cancel', '❌')} Не удалось разобрать список. Попробуйте еще раз.")
        return

    if not parsed_res.items:
        await message.answer(f"{em('info', 'ℹ️')} Не удалось найти товары в тексте. Попробуйте уточнить запрос.")
        return

    import uuid
    batch_id = str(uuid.uuid4())[:8]
    pending_batches[batch_id] = {
        "user_id": user_id,
        "items": parsed_res.items,
        "raw_text": text,
    }

    preview_lines = []
    for idx, it in enumerate(parsed_res.items, 1):
        price_note = f" (~{it.estimated_price:,.0f} UZS)" if it.estimated_price else ""
        preview_lines.append(f"{idx}. <b>{it.name}</b> — {it.quantity} {it.unit} <i>({it.category})</i>{price_note}")

    msg_text = (
        f"{em('ai_parse', '✨')} <b>Распознано товаров: {len(parsed_res.items)}</b>\n\n"
        + "\n".join(preview_lines)
        + "\n\nДобавить в ваш список покупок?"
    )
    await message.answer(msg_text, reply_markup=confirm_items_keyboard(batch_id))


# ── CALLBACKS ──

@dp.callback_query(F.data.startswith("confirm:"))
async def handle_confirm_batch(call: CallbackQuery):
    batch_id = call.data.split(":", 1)[1]
    batch = pending_batches.pop(batch_id, None)
    if not batch:
        await call.answer("Срок действия подтверждения истек", show_alert=True)
        return

    user_id = batch["user_id"]
    items = batch["items"]

    requests = [
        CreateItemRequest(
            name=it.name,
            quantity=it.quantity,
            unit=it.unit,
            category=it.category,
            price=it.estimated_price,
            raw_input_text=batch["raw_text"],
        )
        for it in items
    ]

    async with AsyncSessionLocal() as session:
        service = ItemService(session)
        created = await service.batch_create(user_id, requests)

    await call.message.edit_text(
        f"{em('check', '✅')} <b>Успешно добавлено {len(created)} позиций в список!</b>",
        reply_markup=back_keyboard(),
    )
    await call.answer()


@dp.callback_query(F.data.startswith("cancel:"))
async def handle_cancel_batch(call: CallbackQuery):
    batch_id = call.data.split(":", 1)[1]
    pending_batches.pop(batch_id, None)
    await call.message.edit_text(f"{em('cancel', '❌')} Добавление отменено.", reply_markup=back_keyboard())
    await call.answer()


@dp.callback_query(F.data.startswith("toggle:"))
async def handle_toggle_item(call: CallbackQuery):
    parts = call.data.split(":")
    item_id = parts[1]
    version = int(parts[2]) if len(parts) > 2 else 1

    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_hash(tg_hash)
        if not user:
            await call.answer("Пользователь не найден", show_alert=True)
            return

        service = ItemService(session)
        try:
            await service.toggle_purchased(user.id, item_id, expected_version=version)
        except Exception:
            pass

        items = await service.list_items(user.id)

    await call.message.edit_reply_markup(reply_markup=item_list_keyboard(items))
    await call.answer("Статус обновлен")


@dp.callback_query(F.data == "clear_purchased")
async def handle_clear_purchased(call: CallbackQuery):
    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_hash(tg_hash)
        if not user:
            await call.answer()
            return

        service = ItemService(session)
        cleared = await service.clear_purchased(user.id)
        items = await service.list_items(user.id)

    await call.answer(f"Очищено {cleared} купленных товаров", show_alert=True)
    await call.message.edit_reply_markup(reply_markup=item_list_keyboard(items))


@dp.callback_query(F.data.startswith("lang:"))
async def handle_lang_change(call: CallbackQuery):
    new_lang = call.data.split(":", 1)[1]
    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)

    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_hash(tg_hash)
        if user:
            await user_repo.update_settings(user.id, language_code=new_lang)

    await call.answer(f"Язык изменен на {new_lang.upper()}")
    await call.message.edit_reply_markup(reply_markup=settings_keyboard(new_lang))


@dp.callback_query(F.data == "back_main")
async def handle_back_main(call: CallbackQuery):
    await call.message.edit_text(
        f"{em('item', '🛍')} <b>Главное меню Mating:</b>",
        reply_markup=start_keyboard(),
    )
    await call.answer()


@dp.callback_query(F.data == "cmd_add")
async def handle_callback_add(call: CallbackQuery):
    text = (
        f"{em('ai_parse', '✨')} <b>Добавление товаров:</b>\n\n"
        f"Просто напишите товары ответным сообщением, например:\n"
        f"<code>молоко 2л, хлеб, бананы 1кг</code>\n\n"
        f"AI автоматически распознает количество, единицы и категории!"
    )
    await call.message.edit_text(text, reply_markup=back_keyboard())
    await call.answer()


@dp.callback_query(F.data == "cmd_list")
async def handle_callback_list(call: CallbackQuery):
    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_hash(tg_hash)
        if not user:
            user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        service = ItemService(session)
        items = await service.list_items(user.id)

    if not items:
        await call.message.edit_text(
            f"{em('info', 'ℹ️')} Ваш список покупок пуст.\nОтправьте текст с товарами для добавления.",
            reply_markup=back_keyboard(),
        )
    else:
        unpurchased = [i for i in items if not i.is_purchased]
        text = f"{em('list', '📋')} <b>Список покупок ({len(unpurchased)} активных):</b>"
        await call.message.edit_text(text, reply_markup=item_list_keyboard(items))
    await call.answer()


@dp.callback_query(F.data == "cmd_settings")
async def handle_callback_settings(call: CallbackQuery):
    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        lang = user.language_code

    text = f"{em('settings', '⚙️')} <b>Настройки:</b>\nВыберите язык:"
    await call.message.edit_text(text, reply_markup=settings_keyboard(lang))
    await call.answer()


@dp.callback_query(F.data == "cmd_stats")
async def handle_callback_stats(call: CallbackQuery):
    from_user = call.from_user
    tg_hash = hash_telegram_id(from_user.id)
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_or_create(tg_hash, from_user.username, from_user.first_name)
        service = ItemService(session)
        stats = await service.get_monthly_stats(user.id)

    budget_info = (
        f"\nБюджет: <b>{stats.monthly_budget:,.0f} {stats.currency_code}</b>"
        f"\nОстаток: <b>{stats.budget_remaining:,.0f} {stats.currency_code}</b>"
        if stats.monthly_budget
        else ""
    )

    text = (
        f"{em('stats', '📊')} <b>Статистика за текущий месяц:</b>\n\n"
        f"Потрачено: <b>{stats.total_spent:,.0f} {stats.currency_code}</b>"
        f"{budget_info}\n"
        f"Куплено товаров: <b>{stats.items_purchased_count}</b>\n"
        f"Активных в списке: <b>{stats.active_items_count}</b>\n"
    )
    await call.message.edit_text(text, reply_markup=back_keyboard())
    await call.answer()
