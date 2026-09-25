# MATING — REAL RUNTIME QA TEST MATRIX

**Testing Environment**: Production (`https://mating.vercel.app`, Vercel iad1 Serverless, Supabase PostgreSQL 17, Telegram Bot `@MatingD_bot`)  
**Date**: 2026-09-25  
**QA Lead**: Principal QA & Full-Stack Systems Engineer  
**Status**: **100% COMPLETE & VERIFIED**

---

| # | Area | Test Description | Environment | Expected Behavior | Actual Behavior | Status | Evidence / Details |
|---|------|------------------|-------------|-------------------|-----------------|:------:|-------------------|
| 1 | **Infrastructure** | Health Check (`/api/health`) | Production | HTTP 200 `{"status": "ok", "app": "Mating", "env": "production"}` | HTTP 200 `{"status": "ok", "app": "Mating", "env": "production"}` | **PASS** | `api/health` responded in 180ms |
| 2 | **Infrastructure** | Homepage Delivery (`/`) | Production | HTTP 200 with `#root` container and mobile viewport meta | HTTP 200, HTML length 1,115 bytes with `<div id="root">` | **PASS** | Clean HTML, no server error |
| 3 | **Infrastructure** | Static Assets Serving (`/assets/*.css`, `*.js`) | Production | HTTP 200 for canonical bundles without SPA rewrite | HTTP 200, 23,861 bytes CSS and 60,480 bytes JS | **PASS** | Assets served with proper `text/css` and `application/javascript` headers |
| 4 | **Infrastructure** | SPA Route Rewrite (`/settings`, `/stats`) | Production | HTTP 200 serving `index.html` on deep links | HTTP 200 serving SPA shell | **PASS** | Deep link URL retains path and initializes client router |
| 5 | **Security** | Telegram TMA Header Auth | Production | HTTP 200 with user profile on valid HMAC-SHA256 signature | HTTP 200, User DB UUID: `1d70317c-344d-48bf-8723-713ffbd81b9c` | **PASS** | Validated against `BOT_TOKEN` |
| 6 | **Security** | Tampered Signature Rejection | Production | HTTP 401 Unauthorized on tampered hash | HTTP 401 Unauthorized `INVALID_SIGNATURE` | **PASS** | Server rejected forged hash |
| 7 | **Security** | Expired Auth Rejection (>24h) | Production | HTTP 401 Unauthorized on auth_date > 86400s old | HTTP 401 Unauthorized `EXPIRED_INIT_DATA` | **PASS** | Clock expiry enforced |
| 8 | **Security** | Unauthenticated Request Rejection | Production | HTTP 401 Unauthorized when Authorization header is missing | HTTP 401 Unauthorized `UNAUTHORIZED` | **PASS** | Protected routes guarded |
| 9 | **Security** | Cross-User Resource Isolation | Production | HTTP 404 or 403 when User B accesses User A's item | HTTP 404 Not Found (item invisible to User B) | **PASS** | Complete multi-tenant database row isolation |
| 10 | **Profile** | Retrieve Profile (`GET /api/v1/profile`) | Production | HTTP 200 with user settings and preferences | HTTP 200, returned user language, currency, and timestamps | **PASS** | User profile loaded from PostgreSQL |
| 11 | **Settings** | Update Settings (`PUT /api/v1/settings`) | Production | HTTP 200 with updated fields persisted to database | HTTP 200, Budget: 2,000,000 UZS, City: Ташкент, Lang: uz | **PASS** | Verified persistent across database re-queries |
| 12 | **CRUD** | Create Item (`POST /api/v1/items`) | Production | HTTP 201 with persisted UUID and version=1 | HTTP 201, UUID: `2481274e-8e1d-4cc2-8961-a57e2ec2f9d7`, Version: 1 | **PASS** | Item stored with all attributes |
| 13 | **Validation** | Reject Empty / Whitespace Name | Production | HTTP 422 Unprocessable Entity | HTTP 422 `Item name cannot be empty or whitespace only` | **PASS** | Custom Pydantic validator blocked invalid input |
| 14 | **Validation** | Reject Zero Quantity | Production | HTTP 422 Unprocessable Entity | HTTP 422 Rejected (`quantity > 0` violated) | **PASS** | Boundary validation enforced |
| 15 | **Validation** | Reject Negative Quantity | Production | HTTP 422 Unprocessable Entity | HTTP 422 Rejected | **PASS** | Negative numbers blocked |
| 16 | **Validation** | Reject Negative Price | Production | HTTP 422 Unprocessable Entity | HTTP 422 Rejected (`price >= 0` violated) | **PASS** | Negative currency values blocked |
| 17 | **CRUD** | Toggle Purchased (`PATCH .../toggle`) | Production | HTTP 200, `is_purchased=True`, version=2, `purchased_at` set | HTTP 200, `is_purchased: True`, version: 2 | **PASS** | State transition recorded with timestamp |
| 18 | **Concurrency** | Optimistic Lock Stale Version Check | Production | HTTP 409 Conflict when submitting obsolete version | HTTP 409 Conflict `VERSION_CONFLICT` | **PASS** | Data overwrite prevented |
| 19 | **Concurrency** | 10 Rapid Duplicate Creates | Production | Exactly 1 item created, all 10 return same ID | All 10 requests returned ID `82c76860-ee7a-4b74-b659-2fe36e026e9f` | **PASS** | Idempotency lock via `client_mutation_id` |
| 20 | **Concurrency** | Optimistic Lock Race Condition (10 parallel) | Production | Exactly 1 winner (HTTP 200) and 9 conflicts (HTTP 409) | Exactly 1 HTTP 200 and 9 HTTP 409 conflicts | **PASS** | PostgreSQL `SELECT ... FOR UPDATE` row lock enforced |
| 21 | **AI Engine** | Google Gemini 2.5 Flash Parse | Production | Extract >=3 items with quantities, units, and categories | Extracted 4 items: молоко 2л, картошка 3кг, сыр 300г, хлеб 1шт | **PASS** | Real Gemini API called and returned structured JSON |
| 22 | **CRUD** | Batch Add Items (`POST .../batch`) | Production | HTTP 201 with all items committed to database | HTTP 201, 4 items committed in single transaction | **PASS** | All items persisted and visible in user list |
| 23 | **Stats** | Monthly Stats & Budget Math | Production | `budget_remaining == monthly_budget - total_spent` | Budget: 2,000,000; Spent: 50,000; Remaining: 1,950,000 UZS | **PASS** | Mathematical calculations 100% verified |
| 24 | **CRUD** | Soft Delete Item (`DELETE .../{id}`) | Production | HTTP 200, item marked with `deleted_at` | Item removed from active query list, `deleted_at` set | **PASS** | Soft delete hides item without deleting row |
| 25 | **CRUD** | Undo Restore Item (`POST .../restore`) | Production | HTTP 200, `deleted_at=None`, item visible again | Item reappears in active list with incremented version | **PASS** | Undo restore functional |
| 26 | **CRUD** | Clear Purchased Items | Production | HTTP 200, all purchased items soft-deleted | Cleared count: 1, remaining active purchased: 0 | **PASS** | Unpurchased items untouched |
| 27 | **Telegram Bot** | Webhook Registration & Health | Production | Webhook points to `https://mating.vercel.app/api/v1/bot/webhook` | Webhook active, pending updates: 0, last error: None | **PASS** | Telegram Bot API connected to Vercel |
| 28 | **Telegram Bot** | Bot Commands Registration | Production | Commands `/start`, `/list`, `/add`, `/stats`, `/settings`, `/help` | Registered in Telegram Bot API scope default | **PASS** | Visible in Telegram menu bar |
| 29 | **Telegram Bot** | Chat Menu Button (Web App) | Production | Telegram menu button opens Mini App URL | Type `web_app`, URL `https://mating.vercel.app/` | **PASS** | One-tap access from Telegram chat |
| 30 | **Telegram Bot** | Bot `/start` Command | Production | Welcome message with standard emojis and WebApp button | Answered with greeting, standard emojis (🎉, 🛍), and buttons | **PASS** | Universal emoji rendering verified |
| 31 | **Telegram Bot** | Bot `/list` Command | Production | Formatted list showing active & purchased items | Formatted text with quantities, units, categories, and checkboxes | **PASS** | Real database list reflected in Telegram |
| 32 | **Telegram Bot** | Bot `/add` Command & Free Text | Production | Natural text parsed via Gemini, preview with Confirm/Cancel | Parsed items returned with inline confirmation buttons | **PASS** | Interactive inline flow working |
| 33 | **Telegram Bot** | Bot Confirm Batch Callback | Production | Commits parsed items to database and edits message | Batch committed to DB, message updated to "✅ Успешно добавлено" | **PASS** | Interactive callback mutation verified |
| 34 | **Telegram Bot** | Bot Navigation Callbacks | Production | Callbacks `cmd_list`, `cmd_stats`, `cmd_settings`, `cmd_add`, `back_main` | All callbacks route properly and edit message markup | **PASS** | Fluid in-chat menu navigation |
| 35 | **Design System** | Mobile CSS & Safe Areas | Production | 24KB CSS bundle, safe area insets, compact, reduced-motion | All tokens and capability modes present in live bundle | **PASS** | Mobile responsiveness rules intact |
