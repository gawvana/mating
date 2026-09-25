# Mating — Production Deployment & Operations Manual

This document provides complete instructions for deploying, configuring, and maintaining the Mating Telegram Mini App + Bot in production.

---

## 1. Architecture Overview

```
                               GITHUB (gawvana/mating)
                                         │
                                         ▼
                            VERCEL PRODUCTION PROJECT
                               (mating.vercel.app)
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                  React/Vite SPA                  FastAPI Python
                 (Static CDN distribution)      (Serverless ASGI)
                          │                             │
                          └──────────────┬──────────────┘
                                         ▼
                             SUPABASE POSTGRESQL 17
                           (dolmdxbunpfurqrkgxsy)
                                 ┌───────┴───────┐
                                 ▼               ▼
                             SQL Data       Alembic DDL
                                         +
                               TELEGRAM PLATFORM
                                 ┌───────┴───────┐
                                 ▼               ▼
                          Telegram Bot     Telegram Mini App
                     (/api/v1/bot/webhook)  (https://mating.vercel.app)
```

---

## 2. GitHub Setup

- **Canonical Repository**: `https://github.com/gawvana/mating`
- **Default Production Branch**: `main`
- **Git Push Policy**: All secrets (`.env`, `.env.*`, certificates) are excluded via `.gitignore`.
- **Pre-push Verification**:
  ```bash
  git status
  git log --oneline -5
  python -m pytest backend/tests -q
  npm --prefix frontend run build
  ```

---

## 3. Supabase Setup

- **Provider**: Supabase PostgreSQL 17
- **Project URL**: `https://<PROJECT_REF>.supabase.co`
- **Connection Mode**: Supabase Transaction Pooler (PgBouncer, Port `6543`) or Direct Connection (Port `5432`)
- **Serverless Optimization**:
  - `statement_cache_size=0` (disables prepared statement caching for PgBouncer compatibility)
  - `ssl=require` (enforces encrypted transport)
  - Connection pool limits: `pool_size=5`, `max_overflow=2`, `pool_recycle=300`

### Database Migrations
Migrations are managed via Alembic:
```bash
# Apply pending migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1
```

Schema verification query:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT version_num FROM alembic_version;
```

---

## 4. Vercel Project Setup

- **Project Name**: `mating`
- **Production Domain**: `https://mating.vercel.app`
- **Build Configuration**:
  - **Build Command**: `cd frontend && npm install && npm run build`
  - **Output Directory**: `frontend/dist`
  - **Serverless Function**: `api/index.py` (Python 3.12 runtime)
- **Routing (`vercel.json`)**:
  - `/api/(.*)` rewrites to `api/index.py?__path__=/api/$1`
  - `/(.*)` rewrites to `frontend/dist/index.html` (SPA fallback)

---

## 5. Environment Variables

Configure these in the Vercel Project Dashboard (`Settings` → `Environment Variables`):

| Variable | Target | Description | Example Placeholder |
|---|---|---|---|
| `APP_ENV` | Production, Preview | Environment mode | `production` |
| `DATABASE_URL` | Production, Preview | Async PostgreSQL connection string | `postgresql+asyncpg://postgres:[PASS]@[HOST]:5432/postgres` |
| `SUPABASE_URL` | Production, Preview | Public Supabase project URL | `https://[PROJECT_REF].supabase.co` |
| `SUPABASE_ANON_KEY` | Production, Preview | Public Supabase anonymous API key | `[PUBLIC_ANON_KEY]` |
| `BOT_TOKEN` | Production | Telegram Bot API token from @BotFather | `[BOT_TOKEN]` |
| `WEBHOOK_SECRET` | Production | Secret for `X-Telegram-Bot-Api-Secret-Token` | `[WEBHOOK_SECRET_STRING]` |
| `WEBAPP_URL` | Production | Production URL where Mini App is hosted | `https://mating.vercel.app` |
| `ALLOWED_ORIGINS` | Production | Allowed CORS origins (comma-separated) | `https://mating.vercel.app,https://web.telegram.org` |
| `AI_PROVIDER` | Production | Primary AI parsing engine | `gemini` |
| `AI_API_KEY` | Production | API Key for primary AI provider | `[GEMINI_API_KEY]` |
| `AI_MODEL` | Production | AI model identifier | `gemini-2.5-flash` |

> **Warning**: Never prefix server secrets with `VITE_`. Keep all private keys strictly server-side.

---

## 6. Telegram Bot & Webhook Configuration

### 6.1 Registering Webhook
The application provides an automated webhook registration endpoint:
```bash
curl -X POST https://mating.vercel.app/api/v1/bot/setup-webhook
```
Expected response:
```json
{"ok": true, "description": "Webhook configured to https://mating.vercel.app/api/v1/bot/webhook"}
```

### 6.2 Verifying Webhook Status
Check webhook registration directly via Telegram API:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 6.3 Webhook Security Test
Verify that unauthorized requests are rejected:
```bash
# Missing secret token -> Expect 403 Forbidden
curl -X POST https://mating.vercel.app/api/v1/bot/webhook -H "Content-Type: application/json" -d '{}'

# Invalid secret token -> Expect 403 Forbidden
curl -X POST https://mating.vercel.app/api/v1/bot/webhook -H "Content-Type: application/json" -H "X-Telegram-Bot-Api-Secret-Token: invalid" -d '{}'
```

---

## 7. Local Development

```bash
# 1. Clone repository
git clone https://github.com/gawvana/mating.git
cd mating

# 2. Python environment & dependencies
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 3. Frontend dependencies
cd frontend
npm install
cd ..

# 4. Configure local environment
cp .env.example .env
# Edit .env with local test settings

# 5. Run local development servers
# Terminal 1: Backend
python -m backend.api.main

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 8. Production Deployment

### Automated Deployment (GitHub Integration)
Pushing to the `main` branch automatically triggers a production build and deployment on Vercel:
```bash
git push origin main
```

### Manual Deployment (Vercel CLI)
```bash
vercel deploy --prod --yes
```

---

## 9. Smoke Testing & Verification

1. **Health Check**:
   ```bash
   curl https://mating.vercel.app/api/health
   # Returns: {"status": "ok", "app": "Mating", "env": "production"}
   ```
2. **SPA Routing**:
   - `https://mating.vercel.app/`
   - `https://mating.vercel.app/stats`
   - `https://mating.vercel.app/settings`
   All routes return `200 OK` without 404 on refresh.
3. **Database Connectivity**:
   Protected endpoints require Telegram `initData` and verify against Supabase PostgreSQL.
4. **Telegram Bot**:
   Send `/start` in Telegram to receive the greeting and WebApp launch button.

---

## 10. Rollback & Troubleshooting

### Rollback on Vercel
```bash
# List recent deployments
vercel ls mating

# Promote previous deployment to production
vercel alias set <PREVIOUS_DEPLOYMENT_URL> mating.vercel.app
```

### Common Issues & Fixes
- **HTTP 500 on API call**: Inspect runtime logs using `vercel logs https://mating.vercel.app`.
- **ModuleNotFoundError: greenlet**: Ensure `greenlet>=3.1.0` and `sqlalchemy[asyncio]` are present in `requirements.txt`.
- **401 UNAUTHORIZED on frontend API**: Verify `initData` is passed in `Authorization: tma <initData>` header from the Telegram WebApp container.
- **Database Connection Refused**: Verify Supabase database status and ensure `statement_cache_size=0` is enabled for transaction pooler.
