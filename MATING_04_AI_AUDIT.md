# MATING — Phase 43 Artifact: AI Audit
**Document:** `MATING_04_AI_AUDIT.md`  
**Timestamp:** 2026-09-26T20:22:00+05:00  
**Author:** AGENT D — AI ENGINEER  
**Scope:** `frontend/src/utils/localParser.ts`, `backend/services/ai_service.py`, `frontend/src/screens/AIScreen.tsx`, `backend/bot/bot.py`, `frontend/src/state/useAppStore.ts`

---

## 1. Executive Summary & Architecture Overview

Mating implements a **Dual-Tier Hybrid Parser Architecture**:
- **Client-Side Tier 1 (`frontend/src/utils/localParser.ts`)**: Deterministic regex-based synchronous parser with 0 ms latency, running entirely on the client without network calls.
- **Backend Tier 1 (`backend/services/ai_service.py -> fast_deterministic_parser`)**: Python mirror of the deterministic parser with in-memory caching (`_parse_cache`, SHA256 key, 600s TTL) and sliding-window rate limiting (`InvertedRateLimiter`, 30 req/min).
- **Backend Tier 2 (`backend/services/ai_service.py -> AIService._call_gemini`)**: Google Gemini 2.5 Flash / Flash-Lite with structured JSON schema output, system prompt-injection guardrails, and deterministic post-processing.

### High-Level Verdict:
| Capability | Status | Assessment |
|---|---|---|
| **Bare Number Rule (single item)** | **PASS** | `Pomidor 10` -> 10,000 UZS; `Pomidor 2kg` -> 2 kg, null price; `Pomidor 2kg 18000` -> 2 kg, 18,000 UZS. |
| **Space-Only Batch Parsing** | **FAIL (CRITICAL)** | `'Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5'` fails deterministic separation because delimiter regex only splits on `[\r\n;,]+`. Produces 1 malformed item. |
| **Multilingual (RU / EN / UZ-Latn)** | **PASS / CONDITIONAL** | Russian and Uzbek Latin core staples are well-mapped. |
| **Multilingual (Uzbek Cyrillic)** | **FAIL (CRITICAL)** | Regex character sets omit Uzbek Cyrillic letters `ў, қ, ғ, ҳ` (U+045E, U+049B, U+0493, U+04B3); `CATEGORY_MAP` and `UNIT_MAP` lack Uzbek Cyrillic entries. |
| **Intent Routing (11 Intents)** | **PARTIAL (3/11 in UI, 5/11 in Bot)** | Only `add`, `delete`, `clear_purchased` handled in `AIScreen`. `restore`, `buy`, `unbuy`, `sort`, `filter`, `history`, `repeat`, `share` fall through to `add`. |
| **AI Screen & Preview Cards** | **PASS with Defect** | Interactive checkboxes and live price aggregation work cleanly; fallback to Gemini API is unreachable dead code due to fallback pattern. |
| **AI Settings Audit (7 settings)** | **FAIL (6 PLACEBOS)** | 6 of 7 settings (`aiEnabled`, `priceInference`, `quantityInference`, `confirmationLevel`, `suggestionFrequency`, `aiLanguage`) have ZERO runtime wiring. |

---

## 2. Bare Number Rule Implementation & Verification

The rule dictates:
> If a number has no unit after the product name:
> - `< 1000` (e.g. `10`, `5`) defaults to price in thousands (`10` -> 10,000 UZS; `5` -> 5,000 UZS).
> - `>= 1000` (e.g. `18000`) is the exact price in UZS (`18,000` UZS).
> - Numbers attached to recognized units (`2kg`, `500g`, `2l`, `4 dona`) represent **quantity**, NOT price.

### Test Case Verification:

#### 1. `'Pomidor 10'`
- **Parser Path:** Matched Pattern 4 (`^([name])\s*[-:]?\s*(\d+)$`).
- **Resolution:** Name `"Pomidor"`, quantity `1.0 шт`, `interpretBareNumber(10)` -> `10000.0`.
- **Verdict:** **PASS**.

#### 2. `'Pomidor 2kg'`
- **Parser Path:** Matched Pattern 3 (`^([name])\s+(\d+(?:[.,]\d+)?)\s*([unit])$`).
- **Resolution:** Name `"Pomidor"`, quantity `2.0 кг`, price `null`.
- **Verdict:** **PASS**.

#### 3. `'Pomidor 2kg 18000'`
- **Parser Path:** Matched Pattern 2 (`^([name])\s+(\d+)\s*([unit])\s+(\d+)$`).
- **Resolution:** Name `"Pomidor"`, quantity `2.0 кг`, price `18000.0`.
- **Verdict:** **PASS**.

#### 4. `'Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5'` (Space-Only Batch Parsing)
- **Input Structure:** Single line, space-delimited.
- **Client Execution (`localParser.ts`):** `text.split(/[\r\n;,]+/)` leaves string intact. Pattern 4 rejects internal digits. Falls to Pattern 5 as 1 giant item.
- **Backend Execution:** Regex rejects internal digits, falls to Gemini. But client never calls backend because local parser returned 1 item!
- **Verdict:** **CRITICAL FAIL**.

---

## 3. Multilingual Support Audit

### A. Russian (RU)
- Coverage: EXCELLENT. Category stem keywords, full units, canonical normalization.

### B. Uzbek Latin (UZ-Latn)
- Coverage: GOOD.
- Defects:
  1. `Qalamir` vs `Qalampir`: Regex in `localParser.ts` line 77 has `/^qalamirl?a?r?$/i`. Standard Uzbek word is `"qalampir"` (with `p`).
  2. Missing greens bundle unit: `"bog'"`.

### C. Uzbek Cyrillic (UZ-Cyrl)
- Coverage: CRITICAL FAILURE.
  1. Characters `ў` (U+045E), `қ` (U+049B), `ғ` (U+0493), `ҳ` (U+04B3) are excluded from `[a-zA-Zа-яА-ЯёЁ]`.
  2. `CATEGORY_MAP` lacks Uzbek Cyrillic entries (`бодринг, пиёз, сабзи, гўшт, нон, сут` categorize as `"Другое"`).
  3. `UNIT_MAP` lacks Cyrillic `"дона", "та"`.

---

## 4. Intent Routing Matrix (11 Required Intents)

| Intent | Query Example | `AIScreen.tsx` Routing | `backend/bot/bot.py` Routing | UI Feature Component | Status |
|---|---|---|---|---|---|
| **1. Add** | `"Помидоры 2кг"` | **HANDLED** (default intent) | **HANDLED** (`/add` or fallback) | `AddSheet.tsx`, `QuickAddBar.tsx` | **FULL SUPPORT** |
| **2. Delete** | `"удали молоко"` | **HANDLED** | **HANDLED** | `SwipeableItem.tsx` | **FULL SUPPORT** |
| **3. Restore** | `"верни молоко"` | **UNHANDLED** (falls to `add`!) | **HANDLED** (`верни, restore, qaytar`) | `UndoToast.tsx` | **PARTIAL** |
| **4. Buy** | `"купи хлеб"` | **UNHANDLED** (falls to `add`!) | **HANDLED** (`купи, bought, sotib oldim`) | `SwipeableItem.tsx` | **PARTIAL** |
| **5. Unbuy** | `"не купил хлеб"` | **UNHANDLED** (falls to `add`!) | **UNHANDLED** | Item checkbox toggle | **UI ONLY** |
| **6. Clear purchased** | `"очисти купленное"` | **HANDLED** | **HANDLED** | `ListScreen.tsx` clear button | **FULL SUPPORT** |
| **7. Sort** | `"сортируй по цене"` | **UNHANDLED** (falls to `add`!) | **UNHANDLED** | `smartSortMode` selector | **UI ONLY** |
| **8. Filter** | `"покажи только овощи"` | **UNHANDLED** (falls to `add`!) | **UNHANDLED** | Category chips | **UI ONLY** |
| **9. History** | `"история покупок"` | **UNHANDLED** (falls to `add`!) | **UNHANDLED** | `HistoryScreen.tsx` tab | **UI ONLY** |
| **10. Repeat** | `"повтори прошлую покупку"` | **UNHANDLED** (falls to `add`!) | **UNHANDLED** | `HistoryScreen.tsx` repeat modal | **UI ONLY** |
| **11. Share** | `"поделись списком"` | **UNHANDLED** (falls to `add`!) | **PARTIAL** (`/share` cmd only) | `ListScreen.tsx` share modal | **PARTIAL** |

---

## 5. AI Settings Audit (Runtime Verification)

- `aiEnabled`: **100% PLACEBO** (never checked, AI runs unconditionally).
- `priceInference`: **100% PLACEBO** (parser always infers price for bare numbers regardless of toggle).
- `quantityInference`: **100% PLACEBO** (quantities always inferred from units/numbers).
- `confirmationLevel`: **100% PLACEBO** (`always`, `destructive_only`, `silent` have zero effect on preview cards).
- `suggestionFrequency`: **100% PLACEBO** (never read).
- `aiLanguage`: **100% PLACEBO** (never passed to backend or parser).
- `aiPersonality`: **COSMETIC ONLY** (rendered as static badge text, never alters prompts).

---

## 6. Recommended Action Plan
1. Delimiter pre-tokenization for space-only batches (`[Name] [Number]` sequence detection).
2. Expand regex character classes to include `\u040E\u045E\u0490\u0491\u0492\u0493\u04BA\u04BB\u049A\u049B\u04B2\u04B3` and add Uzbek Cyrillic vocabulary to maps.
3. Wire intent routing in `AIScreen.tsx` for `restore`, `buy`, `unbuy`, `sort`, `filter`, `history`, `repeat`, `share`.
4. Connect all 7 AI settings to runtime logic in `useAppStore`, `localParser.ts`, and `AIScreen.tsx`.
5. Fix Gemini fallback condition so low-confidence client results trigger backend AI.
6. Replace serial `deleteItem` loop with `Promise.all`.
