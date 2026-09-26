# MATING — Phase 44 Master Implementation Plan
**Document:** `MATING_08_IMPLEMENTATION_PLAN.md`  
**Timestamp:** 2026-09-26T20:28:00+05:00  
**Status:** DRAFT — AWAITING USER APPROVAL (Planning Mode)

---

## 1. Problem Statement & Root Cause Analysis

Following the deep baseline verification and audits across all 8 engineering domains (Architecture, Mobile Performance, Motion System, AI Parsing, Telegram Integration, Security & Data, UI/UX, and QA), seven critical technical and product deficits were identified:

1. **Visual Hierarchy & Atmosphere:** Excessive purple glow, loud background gradients, giant dead central space in empty state, disconnected floating FAB, and competing glass surfaces with equal visual weight.
2. **Space-Only Batch Parsing & Uzbek Cyrillic:** `"Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5"` fails to parse as multiple items because splitting only handles `[\r\n;,]+`. Uzbek Cyrillic characters `ў, қ, ғ, ҳ` fail regex matching. Typo in `qalampir` regex.
3. **AI Screen Intent Routing & Placebo Settings:** In `AIScreen.tsx`, only 3 of 11 intents are handled; the other 8 create bogus items. 6 of 7 AI settings are placebos not checked in runtime code. Gemini fallback is unreachable dead code.
4. **Telegram Webhook Latency & BackButton Blindness:** Inline synchronous `dp.feed_update` blocks the webhook response for up to 24s during Gemini fallback. BackButton is hidden on the main list tab even when modal sheets are open.
5. **Offline Queue Disconnect:** `offlineQueue.ts` contains full FIFO and backoff logic, but `enqueueMutation` is never called by mutation hooks, rendering offline queue inoperative.
6. **Drag Reorder Forced Layout Thrashing:** `getBoundingClientRect()` called on every row in `pointermove` causes severe mobile frame drops.
7. **Share Feature Ephemeral Storage & Client Incompleteness:** Backend snapshots are stored in a memory dictionary lost across serverless workers; frontend never routes `?share={token}`.

---

## 2. Proposed Architecture & Solution Plan

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MATING 2.0 OVERHAUL ARCHITECTURE                │
└────────────────────────────────────────────────────────────────────────┘
  1. Calm Liquid Glass UI: Neutral dark base (#0c0d12), hairline edges,
     integrated dock & FAB, compact balanced empty state.
  2. Enhanced Parser: Multi-item space pre-tokenizer, full Uzbek Cyrillic
     Unicode support, 11-intent routing in AIScreen, wired AI settings.
  3. Non-Blocking Telegram Webhook: Async task dispatch (<20ms response),
     BackButton sheet-aware stack, unified share deep links.
  4. Operational Offline Queue: Mutation hooks call enqueueMutation on
     network failure, preserving optimistic state until reconnection flush.
  5. 60 FPS Drag Reorder: Geometry cached on pointerdown, zero layout
     thrashing in pointermove.
  6. Persistent Share: Server-persisted snapshot store and client share router.
```

---

## 3. Detailed Phase-by-Phase Implementation Tasks

### Phase A: Visual & UI Overhaul (Calm Native Liquid Glass)
- **Target Files:** `frontend/src/styles/design-system.css`, `frontend/src/screens/ListScreen.tsx`, `frontend/src/components/BottomDock.tsx`
- **Changes:**
  - Shift dark theme background from high-opacity purple radial clouds to calm, neutral dark base (`#0c0d12` / `#111218`) with subtle, localized 5% accent illumination.
  - Refine `.nav` header: replace stark white border with subtle hairline edge (`var(--edge)` at 0.12 opacity).
  - Compact empty state: reduce padding from 48px to 20px, small 32px icon, short title & subtitle, single clear CTA.
  - Bottom dock & FAB: slim dock height to 56px, visually integrate FAB into dock center or balanced floating anchor without heavy neon glow.

### Phase B: Parser Enhancement (Space Batches, Uzbek Cyrillic & Bare Numbers)
- **Target Files:** `frontend/src/utils/localParser.ts`, `backend/services/ai_service.py`
- **Changes:**
  - Implement space-delimited batch pre-tokenizer: when no commas/newlines exist, detect `[Word(s)] [Number]` recurring sequences (e.g. `"Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5"`) and segment into discrete items.
  - Expand Cyrillic regex ranges to include Uzbek Cyrillic characters `ў, қ, ғ, ҳ` (`\u040E\u045E\u0490\u0491\u0492\u0493\u04BA\u04BB\u049A\u049B\u04B2\u04B3`).
  - Fix Uzbek Latin regex typo: support both `qalampir` and `qalamir`.
  - Add Uzbek Cyrillic vocabulary to `CATEGORY_MAP` and `"дона", "та"` to `UNIT_MAP`.

### Phase C: AI Screen Intent Routing & Real AI Settings
- **Target Files:** `frontend/src/screens/AIScreen.tsx`, `frontend/src/state/useAppStore.ts`
- **Changes:**
  - Add intent handlers in `AIScreen.tsx` for `restore`, `buy`, `unbuy`, `sort`, `filter`, `history`, `repeat`, `share`.
  - Connect store settings to runtime:
    - `priceInference`: toggle bare number price inference on/off.
    - `quantityInference`: toggle quantity extraction on/off.
    - `confirmationLevel`: if `silent`, apply directly without modal; if `destructive_only`, confirm only on delete/clear.
    - `aiEnabled`: display disabled state when toggled off.
  - Fix Gemini fallback trigger in `AIScreen.tsx`: fallback when local parser returns low-confidence or generic fallback tokens.
  - Replace serial `deleteItem` loop with `Promise.all`.

### Phase D: Telegram Webhook Non-Blocking Dispatch & WebApp Bridge
- **Target Files:** `backend/api/routes/bot.py`, `frontend/src/telegram/telegram.ts`, `frontend/src/App.tsx`
- **Changes:**
  - Wrap `dp.feed_update` in `asyncio.create_task` to return 200 OK within 20ms, preventing Telegram webhook timeouts.
  - Add authorization check to `POST /api/v1/bot/setup-webhook`.
  - In `App.tsx`, connect `BackButton` to active overlays: if `isSheetOpen`, `isQuickAddOpen`, or `shareSnapshot` is open, BackButton dismisses the overlay before navigating to list.
  - Support deep linking: detect `?share={token}` and `tgWebAppStartParam=share_{token}` upon launch.

### Phase E: Offline Queue Wiring
- **Target Files:** `frontend/src/screens/ListScreen.tsx`, `frontend/src/components/QuickAddBar.tsx`, `frontend/src/components/AddSheet.tsx`
- **Changes:**
  - In mutation hooks (toggle, delete, restore, create, batch_create), catch network errors/offline status to call `enqueueMutation(...)`.
  - Keep optimistic UI state active while offline; flush queue automatically upon `online` event.

### Phase F: 60 FPS Drag Reorder Optimization
- **Target Files:** `frontend/src/screens/ListScreen.tsx`
- **Changes:**
  - Cache container `top` and item `rowHeight` at `dragStart`.
  - Replace `querySelectorAll(".swipe-item")` and `getBoundingClientRect()` inside `pointermove` with arithmetic calculation `Math.floor((e.clientY - cachedTop) / cachedRowHeight)`.
  - Eliminate layout thrashing during drag interactions.

### Phase G: Share Feature Persistence & Snapshot Routing
- **Target Files:** `backend/api/routes/share.py`, `frontend/src/screens/ListScreen.tsx`, `frontend/src/App.tsx`
- **Changes:**
  - Store shared snapshots persistently in database (or persistent file cache) with timestamp and TTL.
  - In `App.tsx`, render a public read-only snapshot view when `?share={token}` is present, with an "Импортировать в список" button.

---

## 4. Verification Plan

1. **Automated Unit & Integration Tests:**
   - Run `python -m pytest backend/tests -q` (all existing 43 tests + new tests must pass).
   - Add new tests in `backend/tests/test_ai_parser.py` for space-only batch parsing and Uzbek Cyrillic.
2. **Frontend Typecheck & Production Build:**
   - Run `npm --prefix frontend run typecheck` (0 errors).
   - Run `npm --prefix frontend run build` (clean Vite build, verified assets).
3. **Motion Audit Verification:**
   - Run `python scripts/audit_73_animations.py` (ensure 73/73 PASS is preserved).
4. **Browser Verification:**
   - Verify calm dark and light theme appearance.
   - Test QuickAdd instant focus (<16ms) and space-only batch parsing.
   - Test AI screen intent routing.
   - Test drag reorder at 60 FPS without layout thrashing.
   - Test share link generation and read-only viewing.
   - Test offline mutation queuing and reconnection flushing.

---

## 5. Rollback Strategy

All modifications are modular and version-controlled via git on branch `main`. If any regression occurs:
- Code changes can be inspected via `git diff`.
- Atomic commits per phase allow targeted revert with `git revert <commit-hash>`.
- Build verification script `scripts/verify-build.cjs` guarantees that no broken asset references reach production.
