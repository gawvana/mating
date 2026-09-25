# 🧩 Mating — AI-Powered Shopping List for Telegram

> **Mating** is a minimalist, fast, and visually premium AI-assisted shopping list assistant designed specifically for Telegram (Telegram Bot + Telegram Mini App).

Built from zero with a focus on simplicity, speed, reliability, and mobile-first ergonomics.

---

## 🌟 Key Features

- **Smart AI Text Parsing**: Input items in natural language (e.g. *«молоко 2л, картошка 3кг, хлеб, яйца 10шт»*) → AI extracts normalized names, quantities, units, and categories with confidence ratings.
- **Strict User Preview & Selection**: AI never blindly inserts items into your database; users review recognized items and toggle which ones to add.
- **Material 3 Expressive + Liquid Glass + Spring Motion**:
  - **Content = Tonal** (cards, summary chips)
  - **Controls = Glass** (nav, bottom dock, FAB, bottom sheet)
  - **Motion = Springs** (physics-based easing curves)
- **Ergonomic Mobile UX**: Designed for single-handed mobile use (320–430px), swipe actions, non-blocking Undo snackbar.
- **Optimistic Concurrency & Idempotency**: Version-based locking (`409 Conflict` reconciliation) and `client_mutation_id` deduplication to prevent double-clicks or offline replay issues.
- **Soft Deletes**: Safe item deletion with instant restoration (Undo) and accurate monthly statistics preservation.
- **Telegram Native**:
  - Telegram WebApp HMAC-SHA256 authentication (`Authorization: tma <initData>`).
  - SHA-256 hashed Telegram IDs (never stored plaintext).
  - Premium Telegram custom emojis (`<tg-emoji emoji-id="...">`).
  - Native haptic feedback triggers.
- **Multi-language Support (i18n)**: Russian (`ru`), Uzbek (`uz`), and English (`en`) with `Intl` currency/number formatters.
- **Offline Resilience**: Local IndexedDB mutation queue that seamlessly flushes upon network reconnection.

---

## 🏗 System Architecture

```text
               Telegram
                  │
        ┌─────────┴─────────┐
        │                   │
   Telegram Bot      Telegram Mini App
  (aiogram 3.x)     (React / TypeScript)
        │                   │
        │             Canonical API Client
        │                   │
        └─────────┬─────────┘
                  ▼
         FastAPI Async Backend
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
    Services            AI Router
  (Item, User)    (Primary / Fallback)
        │
   Repositories
  (User Isolation)
        │
        ▼
   PostgreSQL / SQLite
  (Alembic Migrations)
```

---

## 🚀 Quick Start

### 1. Requirements

- Python 3.12+
- Node.js 20+ & npm

### 2. Backend Setup

```bash
# Clone or navigate to directory
cd c:/Users/Hexo/Desktop/Mating

# Create virtual environment (optional) and install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your BOT_TOKEN, WEBHOOK_SECRET, etc.

# Run database migrations
alembic upgrade head

# Run tests
python -m pytest backend/tests -v

# Start FastAPI server
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build
```

When built, FastAPI automatically serves the production bundle from `frontend/dist` at the root path (`/`).

### 4. Running with Docker Compose

```bash
docker-compose up -d --build
```

---

## 🔒 Security & Privacy

1. **Telegram HMAC Verification**: Every API request is verified server-side with HMAC-SHA256 using the bot token secret.
2. **Privacy by Default**: Telegram User IDs are never stored in plaintext. All internal tables reference SHA-256 digests (`telegram_id_hash`).
3. **Strict User Scoping**: Every database query is scoped by `user_id`. It is impossible for User A to read or mutate User B's items.
4. **No Auth Bypass in Production**: Development test bypass headers are strictly blocked when `APP_ENV=production`.
5. **Safe Error Handling**: Server errors never expose SQL traces, internal file paths, or private provider tokens.

---

## 🔮 Future Features

The following features were intentionally excluded from the initial MVP to keep the product compact, reliable, and performant:

- Family sharing
- Multiple shopping lists
- Price index
- Bazaar price estimator
- Market comparison
- Favorites
- Reminders
- Notification engine
- Admin panel
- WebSocket realtime
- Family rooms
- Family permissions
- Recurring shopping
- Meal planner
- Shopping planner
- Complex product catalog
- Multi-user synchronization
- Social functionality
