# MATING — Phase 43 Artifact: Security & Data Integrity Audit
**Document:** `MATING_06_SECURITY_DATA_AUDIT.md`  
**Timestamp:** 2026-09-26T20:22:15+05:00  
**Author:** AGENT F — SECURITY / DATA ENGINEER  
**Scope:** Webhook Security, Share Feature Architecture, Guest Mode Fallback, Offline Queue Resilience, Concurrency & Optimistic Locking.

---

### Executive Summary

| Category | Status | Primary Risk Level | Key Summary |
|---|---|---|---|
| **1. Webhook Security** | **Partial Pass** | **HIGH** | Pydantic startup fail-fast works in production for `WEBHOOK_SECRET`. However, `/api/v1/bot/setup-webhook` is completely unauthenticated and public. In non-production, secret validation is bypassed if empty. |
| **2. Share Feature** | **FAILED** | **CRITICAL** | Production snapshots are **memory-only** (`dict`), lost on restart or multi-worker/serverless split. Guest mode share only saves to the creator's local browser `localStorage`, making cross-device sharing 100% broken. UI never routes shared snapshots. Unguessable token generation & privacy filtering pass. |
| **3. Guest Mode** | **FAILED** | **HIGH** | Standalone web mode works for CRUD in a single session, but clearing purchased items permanently purges all purchase history and monthly statistics to zero. Optimistic locking is completely bypassed. `localStorage` errors are silently swallowed. |
| **4. Offline Queue** | **FAILED** | **CRITICAL** | IndexedDB queue mechanics (FIFO, exponential backoff, jitter, retry budget, idempotency IDs) are well engineered in `offlineQueue.ts`, but **`enqueueMutation` is NEVER called anywhere in the app**. All mutation hooks fail fast, roll back optimistic state, and abandon changes. Offline sync is non-operational dead code. |
| **5. Concurrency & Locking** | **Partial Pass** | **MEDIUM** | Version checks & `FOR UPDATE` are enforced on `PATCH /items/{id}` and `/toggle`. However, `DELETE` and `/restore` omit version checks and row locks. Telegram bot silently swallows optimistic lock conflicts and falsely alerts "Status updated". Frontend `toggleMutation` fails to update cache on success. |

---

## Key Findings

### 1. Webhook Security
- `POST /api/v1/bot/setup-webhook` lacks authorization, allowing anyone to trigger `set_webhook(drop_pending_updates=True)`.
- Replay protection passes with `update_id` in Redis/memory with 86400s TTL.
- Constant-time `secrets.compare_digest` protects `X-Telegram-Bot-Api-Secret-Token`.

### 2. Share Feature Ephemeral Storage & Client Incompleteness
- Backend `_shared_snapshots: dict = {}` in `share.py` is in-memory only. On serverless (Vercel) or worker recycle, snapshots vanish.
- Standalone web guest mode saves share to creator's `localStorage` only; cross-device access fails with 404.
- `App.tsx` has no route handler for `?share={token}` or `/share/{token}`.

### 3. Guest Mode History Loss
- `getHistory()` and `getMonthlyStats()` query only `mating_guest_items`.
- When `clearPurchased()` moves bought items to `mating_guest_deleted_items`, history and stats are completely erased.

### 4. Offline Queue Orphaned
- `offlineQueue.ts` contains full FIFO and backoff logic, but `enqueueMutation` is never called by mutation hooks in `ListScreen.tsx`, `QuickAddBar.tsx`, or `AddSheet.tsx`.
- Offline mutations fail immediately, revert optimistic changes, and never queue into IndexedDB.

### 5. Concurrency & Race Conditions
- Telegram bot callback handler swallows `toggle_purchased` exceptions and falsely tells the user "Статус обновлен".
- Frontend `toggleMutation` does not update the query cache with the returned `version`, leading to desynchronization on fast edits.
