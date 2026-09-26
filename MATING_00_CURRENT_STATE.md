# MATING — Phase 0: Freeze Current State Artifact
**Document:** `MATING_00_CURRENT_STATE.md`  
**Timestamp:** 2026-09-26T20:20:00+05:00  
**Commit Baseline:** `c0a08be` on `main`  
**Repository:** `https://github.com/gawvana/mating`  
**Production Deployment:** `https://mating.vercel.app/`

---

## 1. Executive Architecture Map

Mating is structured as a decoupled full-stack application optimized for Telegram WebApp and Standalone Mobile Safari/Chrome:

```
gawvana/mating/
├── api/                    # Vercel Serverless Function entry point (api/index.py)
├── backend/                # FastAPI Backend Application & Telegram Bot
│   ├── api/                # REST endpoints
│   │   ├── routes/         # items, stats, ai, history, share, bot
│   │   └── main.py         # FastAPI app factory, CORS, Webhook route
│   ├── bot/                # Telegram Bot (aiogram 3.x / webhook dispatch)
│   │   ├── bot.py          # Command handlers: /start, /ai, /history, /share, /help
│   │   └── keyboards.py    # Inline keyboards & WebApp launch buttons
│   ├── core/               # config.py, database.py (Supabase/PostgreSQL)
│   ├── services/           # ai_service.py (Gemini 2.5 Flash + Deterministic Parser)
│   └── tests/              # 43 automated pytest integration & unit tests
├── frontend/               # React 19 + TypeScript + Vite PWA / Telegram WebApp
│   ├── src/
│   │   ├── api/            # client.ts (TanStack Query API client + Guest Mode)
│   │   ├── components/     # QuickAddBar, BottomDock, AddSheet, SwipeableItem, etc.
│   │   ├── screens/        # ListScreen, AIScreen, HistoryScreen, StatsScreen, SettingsScreen
│   │   ├── state/          # useAppStore.ts (Zustand), offlineQueue.ts
│   │   ├── styles/         # design-system.css (Liquid Glass token system)
│   │   ├── telegram/       # telegram.ts (Telegram WebApp Bridge, Haptics)
│   │   └── utils/          # localParser.ts (Bare number rule, multilingual parsing)
│   ├── index.html          # Lightweight preloader with #mating-preloader & fast-boot
│   ├── vite.config.ts      # Chunk splitting, terser/esbuild, CSS extraction
│   └── package.json        # Dependencies: Zustand, TanStack Query, Lucide-react
├── migrations/             # SQL schema migrations
├── scripts/                # audit_73_animations.py, verify-build.cjs
└── vercel.json             # Rewrites to /api/index.py & SPA routing
```

---

## 2. Current Features & Capabilities

1. **5-Tab Navigation System:**
   - Tabs: `List` (Список), `AI` (Ассистент), `History` (История), `Stats` (Статистика), `Settings` (Настройки).
   - Glass Dock Lens with dynamic width `calc((100% - 12px) / 5)`.
   - Morphing Floating Action Button (FAB `+` ↔ `×`).

2. **Mobile Quick Add Bar:**
   - Positioned above dock (`bottom: calc(76px + env(safe-area-inset-bottom))`).
   - Focused within `<16ms` using `requestAnimationFrame`.
   - Batch parsing with comma/newline delimiters.
   - Optimistic addition to TanStack Query cache.
   - Secondary "Подробнее" sheet trigger.

3. **AI Natural Language Assistant & Parser:**
   - Bare Number Rule: `bodring 10` = 10,000 UZS price inference; `bodring 2kg` = 2 kg quantity inference.
   - Multi-item batch parsing: `Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5`.
   - Command intents: `add`, `delete`, `clear_purchased`.
   - Pre-packaged recipes: Плов (Osh), Завтрак (Nonushta), Борщ (Borsh), Частые покупки.
   - Interactive preview card with checkboxes before applying mutations.

4. **Purchase History & Re-Add Basket:**
   - Dynamic grouping by dates: «Сегодня», «Вчера», specific calendar dates.
   - 1-Click batch repeat modal (`Повторить`).
   - Recurrence detection (`Часто покупаете`) with frequency chip.

5. **List Operations & Gestures:**
   - Horizontal Swipe right to buy / restore; Swipe left to delete.
   - Long-press contextual action menu (450ms).
   - Pointer-captured vertical Drag-and-Drop reorder handle.
   - 6 Smart sort modes: `default`, `category`, `price`, `name`, `recent`, `custom`.

6. **Unguessable Snapshot Sharing:**
   - `/api/v1/share` generating 64-bit random URL-safe tokens.
   - Web Share API mobile integration with clipboard fallback.
   - Read-only snapshot viewing without sensitive credentials.

7. **Personalization & Liquid Glass System:**
   - Accent color palette (6 presets + custom HEX input).
   - WCAG AA Luminance contrast check with interactive warning badge.
   - Corner radius presets (8px, 16px, 22px, 28px, custom slider).
   - Master motion global toggle.
   - Liquid Glass presets: `crystal`, `frosted`, `deep`, `tinted`, `ultra-clear`, `custom`.
   - Live Micro-Preview card reflecting real-time token adjustments.

8. **Telegram Bot Webhook:**
   - Endpoints for `/start`, `/ai`, `/history`, `/share`, `/help`.
   - Natural language item creation from chat.

---

## 3. Existing Components Matrix

| Component | Path | Role | Key Dependencies |
| :--- | :--- | :--- | :--- |
| `App` | `frontend/src/App.tsx` | App shell, 5-tab switch, popstate routing | Zustand, TanStack Query |
| `BottomDock` | `frontend/src/components/BottomDock.tsx` | 5 tabs, sliding glass lens, FAB | `useAppStore`, `triggerHaptic` |
| `QuickAddBar` | `frontend/src/components/QuickAddBar.tsx` | Mobile fast input (<16ms) | `localParser`, `api.createItem` |
| `AddSheet` | `frontend/src/components/AddSheet.tsx` | Expanded bottom sheet editor | `useAppStore`, `localParser` |
| `SwipeableItem` | `frontend/src/components/SwipeableItem.tsx` | Swipe buy/delete gestures | `triggerHaptic` |
| `GlassButton` | `frontend/src/components/GlassButton.tsx` | Liquid glass button primitive | CSS variables |
| `UndoToast` | `frontend/src/components/UndoToast.tsx` | Undo toast stack | `useAppStore` |
| `ListScreen` | `frontend/src/screens/ListScreen.tsx` | Shopping list, sort, search, drag reorder | `api.getItems`, `useAppStore` |
| `AIScreen` | `frontend/src/screens/AIScreen.tsx` | AI prompt, preview card, recipes | `localParser`, `api.batchCreate` |
| `HistoryScreen`| `frontend/src/screens/HistoryScreen.tsx` | Date groups, repeat modal, recurring chips | `api.getHistory` |
| `StatsScreen` | `frontend/src/screens/StatsScreen.tsx` | Monthly spending, categories | `api.getMonthlyStats` |
| `SettingsScreen` | `frontend/src/screens/SettingsScreen.tsx` | Personalization, glass, 15 motion settings | `useAppStore` |

---

## 4. Known Risks & Technical Debt Identified

1. **Visual Balance & Dominance of Purple Glow:**
   - Overly dominant accent glow on dark theme (`--primary` wash). Needs calm neutral dark base with subtle localized illumination.
   - Center empty state has excessive empty vertical space.
   - Bottom dock footprint and FAB visual cohesion need to feel like native iOS/Telegram hardware.

2. **Telegram Bot Latency on Fast Path:**
   - Any LLM invocation in bot commands must be strictly avoided for deterministic commands (`/start`, `/list`, `/help`).

3. **Offline Queue Completeness:**
   - Offline queue must reliably persist across reloads and handle all 5 mutation types (`create`, `batch_create`, `toggle`, `delete`, `restore`).

4. **Drag Reorder DOM Operations:**
   - Drag reorder must avoid `getBoundingClientRect` on every pointer movement to guarantee 60 FPS on 1000+ item lists. Geometry should be cached on drag start.

5. **Motion System Real-World Integrity:**
   - All 15 settings must have verifiable CSS variable or runtime JS effects, with zero fake settings.
