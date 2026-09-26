# MATING — Phase 43 Artifact: Architecture & Code Quality Audit
**Document:** `MATING_02_ARCHITECTURE_AUDIT.md`  
**Timestamp:** 2026-09-26T20:25:00+05:00  
**Repository:** `https://github.com/gawvana/mating`  

---

## 1. System Architecture Map

```
[ Telegram Client / Mobile Web Client ]
                │
                ├── HTTPS / WSS
                ▼
        [ Vercel CDN / Edge ]
                │
       ┌────────┴────────┐
       ▼                 ▼
[ Static Assets ]   [ /api/index.py (FastAPI) ]
  index.html                 │
  JS / CSS                   ├── routes/items.py
                             ├── routes/ai.py
                             ├── routes/history.py
                             ├── routes/share.py
                             └── routes/bot.py (aiogram 3.x)
                                     │
                                     ├── Supabase PostgreSQL
                                     ├── Gemini 2.5 Flash API
                                     └── Telegram Bot API
```

---

## 2. Frontend Layer Analysis

### 2.1 Entry Point & Lifecycle
- `frontend/index.html`: Contains `#mating-preloader` with a fallback timeout of 8000ms. Once React mounts, `window.__mating_mounted = true` cleanly removes the preloader DOM node.
- `frontend/src/main.tsx`: Sets up TanStack `QueryClient` with `staleTime: 1000 * 60 * 2` and `retry: 1`, wraps app in `ErrorBoundary`.
- `frontend/src/App.tsx`: Central coordinator managing 5 navigation tabs (`list`, `ai`, `history`, `stats`, `settings`). Synchronizes with browser `window.location.hash` and `popstate` events.

### 2.2 State Management (`frontend/src/state/useAppStore.ts`)
- Zustand store managing UI preferences, personalization, motion profiles, liquid glass settings, and sheet modes.
- Uses `useShallow` in screens to prevent unnecessary rerenders when sibling store properties change.
- Persistence: 14 distinct `localStorage` keys (`mating_theme`, `mating_accent`, `mating_liquid_glass`, etc.).
- `applyThemeStyles()` dynamically injects 11 CSS variables into `document.documentElement` (`--primary`, `--p`, `--r1`..`--r5`, `--blur`, `--glass`, `--glass2`, `--edge`, `--sh`).

---

## 3. Backend & API Layer Analysis

### 3.1 REST Architecture (`backend/api/`)
- Clean separation into domain routers:
  - `items`: CRUD, toggle purchased, batch create.
  - `stats`: Monthly totals, category aggregates.
  - `ai`: Multi-tier natural language parser endpoint.
  - `history`: Date grouping and frequent purchase calculations.
  - `share`: Token generation and public snapshot endpoint.
  - `bot`: Telegram webhook and inline callbacks.
- Dependency injection for database sessions via `get_db` and user authentication via `get_current_user`.

### 3.2 Database & Persistence
- PostgreSQL (Supabase) via SQLAlchemy 2.0 async engine.
- Models: `User`, `ShoppingItem`, `ItemHistory`.
- Concurrency protection: `ShoppingItem.version` with `FOR UPDATE` lock on `toggle` and `update`.

---

## 4. Architectural Risks & Technical Debt

1. **Ephemeral In-Memory Stores on Serverless Backend**:
   - `_shared_snapshots` in `share.py` and `pending_batches` in `bot.py` are Python dictionaries stored in process memory. On Vercel serverless functions, state is lost between invocations or isolated across concurrent execution instances.
2. **Conflicting Share URL Standards**:
   - Bot generates `{settings.WEBAPP_URL}/#share`.
   - REST API generates `{settings.WEBAPP_URL}/?share={token}`.
   - Frontend client generates `{origin}/share/{token}`.
   - `App.tsx` has no route listener to parse tokens and fetch shared snapshots.
3. **Telegram BackButton Modal Blindness**:
   - Back button visibility in `App.tsx` is tied only to `activeTab !== "list"`. When `AddSheet`, `QuickAddBar`, or `ShareModal` is open on the list tab, native back gestures close the entire Telegram Mini App rather than dismissing the overlay.
4. **Offline Queue Disconnect**:
   - `offlineQueue.ts` contains complete IndexedDB queue mechanics, but mutation error handlers never call `enqueueMutation`.
