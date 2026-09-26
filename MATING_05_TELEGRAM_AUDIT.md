# MATING — Phase 43 Artifact: Telegram Bot & Webhook Architecture Audit
**Document:** `MATING_05_TELEGRAM_AUDIT.md`  
**Timestamp:** 2026-09-26T20:22:45+05:00  
**Author:** AGENT E — TELEGRAM ENGINEER  
**Scope:** `backend/bot/bot.py`, `backend/bot/keyboards.py`, `backend/api/main.py`, `backend/api/routes/bot.py`, `backend/core/security.py`, `frontend/src/telegram/telegram.ts`

---

## 1. Executive Summary

- **Fast Path Verification: PASSED**. Simple deterministic commands (`/start`, `/list`, `/help`, `/settings`, `/history`, `/share`, `/stats`) execute in 0–15 ms without touching LLMs.
- **Dual-Tier AI Text Parser: PASSED**. Before calling external LLMs, `/add` and natural text query a local regex-based deterministic parser resolving standard shopping items in ~0 ms.
- **Webhook Dispatcher Bottleneck: CRITICAL**. `dp.feed_update(bot, update)` is awaited inline inside the FastAPI HTTP handler. If Gemini LLM parsing is triggered, the webhook connection can stall for up to 24 seconds, causing Telegram timeout retries and worker pool starvation.
- **In-Memory Non-Distributed State: HIGH RISK**. `pending_batches` in `bot.py` and `BoundedReplayProtector` in `replay.py` are in-memory dictionaries. In multi-worker setups, callbacks can fail across workers.
- **Telegram WebApp Integration Gaps**:
  - `BackButton` is blind to modals/bottom sheets (`AddSheet`, `ShareModal`). On the main list, BackButton is hidden, causing native back gestures to exit the TMA instead of dismissing open sheets.
  - Deep linking (`start_param` / `tgWebAppStartParam`) is unhandled, breaking share links and parameter passing.
  - Three conflicting share URL formats exist (`/#share` vs `/?share=` vs `/share/{token}`).

---

## 2. Command Route & Latency Separation

| Command | Real Code Path & Handler | Database Access | AI/LLM Invocation | Execution Latency |
| :--- | :--- | :--- | :--- | :--- |
| **/start** | `handle_start` (`CommandStart`) | `UserRepository.get_or_create` | **None** | **Fast** (~5–15 ms) |
| **/help** | `handle_help_command` (`Command("help")`) | None (static text) | **None** | **Instant** (<1 ms) |
| **/list** | `handle_list_command` (`Command("list")`) | `UserRepository` + `ItemService.list_items` | **None** | **Fast** (~5–15 ms) |
| **/settings** | `handle_settings_command` (`Command("settings")`) | `UserRepository.get_by_telegram_hash` | **None** | **Fast** (~5–10 ms) |
| **/history** | `handle_history_command` (`Command("history")`) | `ItemService.get_monthly_stats` | **None** | **Fast** (~10–20 ms) |
| **/share** | `handle_share_command` (`Command("share")`) | None (constructs static URL) | **None** | **Instant** (<1 ms) |
| **/stats** | `handle_stats_command` (`Command("stats")`) | `ItemService.get_monthly_stats` | **None** | **Fast** (~10–20 ms) |
| **/ai** | `handle_ai_command` (`Command("ai")`) | None (educational text + keyboard) | **None** | **Instant** (<1 ms) |
| **/add** | `process_natural_input` | `UserRepository` | **Dual-Tier** (Regex or Gemini) | **0 ms** (T1) / **1.5–24s** (T2) |

---

## 3. Webhook Architecture & Latency Risks

1. **Inline Synchronous Dispatcher**:
   Awaiting `dp.feed_update(bot, update)` directly inside the webhook HTTP route risks Telegram HTTP delivery timeouts (5-10s) when Gemini fallback models are queried sequentially.
2. **Webhook Secret Validation Bypass in Dev/Staging**:
   `if settings.WEBHOOK_SECRET:` bypasses token validation when empty in non-production environments.
3. **Pending Batches Memory Leak**:
   `pending_batches` dictionary has no TTL eviction and is isolated per-process.

---

## 4. Telegram WebApp Bridge Audit

1. **`themeParams` Unused**:
   Declared in TypeScript types but never applied to root CSS variables. Dynamic theme change events (`themeChanged`) are unlistened.
2. **BackButton Modal Blindness**:
   `setupTelegramBackButton` in `App.tsx` only checks `activeTab !== "list"`. When `AddSheet` or `ShareModal` is open on the list tab, `BackButton` remains hidden. Pressing Android back button closes the Telegram Mini App entirely.
3. **Share URL Inconsistency**:
   Unify share URLs on `/?share={token}` or `https://t.me/<bot>?startapp=share_{token}` with automatic client routing in `App.tsx`.
