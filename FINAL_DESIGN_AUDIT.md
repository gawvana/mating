# FINAL_DESIGN_AUDIT.md — Mating v3 Liquid Glass

**Date:** 2026-09-26  
**Version:** 3.0 (Liquid Glass — Material 3 Expressive + Apple interaction quality)  
**Commit:** `d298f5b`

---

## Summary

Full redesign + interaction layer rebuild of Mating frontend. All backend logic preserved. 9 files changed, 2 new components added. Build passes: `tsc && vite build` — **0 errors**.

---

## VISUAL

| Item | Status | Notes |
|------|--------|-------|
| Onest font loaded | PASS | Google Fonts via preconnect in index.html |
| Color tokens from index.html | PASS | All `--bg`, `--on`, `--p`, `--s`, `--t`, `--n`, semantic tokens exact match |
| Dark theme tokens | PASS | Both `@media prefers-color-scheme:dark` and `[data-theme="dark"]` |
| Light theme tokens | PASS | `[data-theme="light"]` override |
| Glass: Header only | PASS | `backdrop-filter` only on `.nav`, `.dock`, `.fab`, `.sheet` |
| Glass: NOT on item rows | PASS | `.item-row` uses tonal `var(--n)` |
| Tonal surfaces (cards, rows) | PASS | `var(--n)` for item rows, `var(--s)` for tags |
| Aurora blobs | PASS | CSS-only animation, parallax via CSS var `--sy` |
| No giant cards | PASS | Compact item rows (52px min-height) |
| Safe-area padding | PASS | `env(safe-area-inset-*)` in header, dock, sheet, FAB |

---

## MOTION

| Animation | Status | Notes |
|-----------|--------|-------|
| FAB morph + → × | PASS | `data-open` attr drives `.fab-icon-plus/close` opacity + rotate via CSS |
| Bottom sheet spring open/close | PASS | `.6s var(--sheet)` cubic-bezier from index.html |
| Sheet follows finger (no React state per px) | PASS | Direct DOM `sheetRef.style.transform`, `dragStartY.current` ref pattern |
| Purchase transition | PASS | `.item-row.purchasing` CSS keyframe |
| Animated total | PARTIAL | CSS `transition: width .7s var(--spring)` on stat bars. Number counter not animated (no Framer Motion dependency added per plan) |
| Animated budget bar | PASS | `.stat-bar-fill { transition: width .7s var(--spring) }` |
| Status pill morph | PASS | `StatusPill` component: `max-width` + `opacity` CSS transition, single element, auto-dismiss synced after 2s |
| Tab indicator slides | PASS | `.lens { transform: translateX(calc(var(--tab-idx, 0) * 100%)) }` spring transition |
| Header compact on scroll | PASS | `#app.sc .nav` via rAF scroll handler |
| Dock hide/show on scroll | PASS | `chrome.classList.toggle("min", d > 0 && y > 120)` |
| Checkbox draw-in SVG | PASS | `@keyframes check-draw` stroke-dashoffset animation |
| List item enter animation | PASS | `.item-row.entering` `@keyframes item-enter` |
| List item exit animation | PASS | `.item-row.exiting` `@keyframes item-exit` |
| Spring bezier from index.html | PASS | Exact `linear()` fallback + cubic-bezier |
| Spring bounce from index.html | PASS | Exact `linear()` fallback |

---

## UX / INTERACTION

| Item | Status | Notes |
|------|--------|-------|
| Swipe right → Buy/Restore | PASS | `SwipeableItem` — pointer events, direct DOM transform, `COMMIT_THRESHOLD=80px` |
| Swipe left → Delete | PASS | Same component, left swipe with resistance |
| Swipe resistance + spring back | PASS | `RESIST_FACTOR=0.35` beyond threshold, CSS spring transition on release |
| Long press → context menu | PASS | 500ms timer, `CtxMenu` component at fixed viewport coords |
| Long press haptic | PASS | `triggerHaptic("medium")` on fire |
| FAB toggles sheet | PASS | Click FAB when open → closes sheet |
| Segmented control slide | PASS | `--seg-idx` CSS var drives indicator |
| Switch spring animation | PASS | `transition: transform .55s var(--spring)` on `i` thumb |
| Tab change haptic | PASS | `triggerHaptic("selection")` on tab click |
| Keyboard does not hide primary action | PARTIAL | Sheet scrolls; keyboard behavior depends on Telegram WebView. `max-height: 92vh` prevents overflow |
| Escape closes sheet | PASS | `keydown` listener in AddSheet |
| Scrim tap closes sheet | PASS | `onClick={closeSheet}` on `.scrim` |

---

## PERFORMANCE

| Item | Status | Notes |
|------|--------|-------|
| No state update per scroll pixel | PASS | rAF + `scrollTick` ref pattern, CSS class toggle only |
| No state update per drag frame | PASS | `SwipeableItem` uses `useRef` + direct DOM style, zero React re-renders per drag |
| React.memo on item rows | PASS | `ItemRow`, `CtxMenu`, `SwipeableItem` all `React.memo` |
| Stable `useCallback` handlers | PASS | `handleToggle`, `handleDelete`, `handleOpenCtx` all `useCallback` |
| Backdrop-filter only on 4 elements | PASS | `.nav`, `.dock`, `.fab`, `.sheet` — never on list rows |
| Aurora disabled on perf-minimal | PASS | `.perf-minimal .b { display: none }` |
| Glass solid fallback | PASS | `@supports not (backdrop-filter: blur(10px))` → `var(--glass-solid)` |
| No pointer tracking on touch | PASS | `window.matchMedia("(pointer: fine)").matches` gate |
| passive scroll listener | PASS | `{ passive: true }` on scroll and pointer events |
| No continuous RAF | PASS | `scrollTick.current` single rAF, spring frame in SwipeableItem uses CSS transition not RAF |
| Bundle size | PASS | 79 KB JS + 27 KB CSS gzipped (23 + 6 KB) — no new heavy dependencies |

---

## MOBILE / RESPONSIVE

| Breakpoint | Status | Notes |
|------------|--------|-------|
| 320px | PASS | No horizontal overflow; `.wrap { max-width: 508px }`, all percentage widths |
| 375px (iPhone SE) | PASS | Standard Telegram Mini App width |
| 390–430px | PASS | Standard Android/iOS range |
| 768px+ | PASS | `.wrap { max-width: 560px }` at 768+ |
| Safe-area top | PASS | `env(safe-area-inset-top, 0px)` in `.nav` top |
| Safe-area bottom | PASS | `env(safe-area-inset-bottom, 0px)` in `.chrome`, `.sheet` |
| `-webkit-overflow-scrolling: touch` | PASS | `#app` and `.cat-filter-row` |
| `touch-action: pan-y` | PASS | `.swipe-item` allows vertical scroll while enabling horizontal swipe |

---

## ACCESSIBILITY

| Item | Status | Notes |
|------|--------|-------|
| `aria-label` on all icon buttons | PASS | FAB, theme toggle, item check, delete |
| `role="switch"` on toggles | PASS | All `.sw` elements |
| `role="dialog" aria-modal` on sheet | PASS | `.sheet` element |
| `aria-live="polite"` on status pill | PASS | `StatusPill` component |
| `aria-current="page"` on active tab | PASS | BottomDock tabs |
| `aria-expanded` on collapsible | PASS | Animations list in SettingsScreen |
| Focus visible ring | PASS | `button:focus-visible { outline: 2px solid var(--primary) }` |
| Reduced motion: system | PASS | `@media (prefers-reduced-motion: reduce)` → 0.01ms transitions |
| Reduced motion: manual | PASS | `html.reduced-motion` class → same 0.01ms override |

---

## ADAPTIVE GLASS

| Mode | Status | Notes |
|------|--------|-------|
| FULL (glass-full) | PASS | Full blur + saturation, default |
| ADAPTIVE (glass-adaptive) | PASS | Default class, no override |
| REDUCED (glass-reduced) | PASS | `--blur: 12px`, lighter saturation |
| MINIMAL (glass-minimal) | PASS | `backdrop-filter: none`, solid fallback |
| Auto on weak device | PASS | `perf-minimal` set by `hardwareConcurrency <= 2 || deviceMemory <= 2` |
| Battery Saver → glass-minimal | PASS | `applyMinimalPreset()` sets `glassMode: "Minimal"` |

---

## MOTION SETTINGS

| Item | Status | Notes |
|------|--------|-------|
| 15 animation toggles | PASS | All 15 listed in `ANIM_KEYS`, collapsible list |
| Animation Style selector | PASS | Minimal/Reduced/Normal/Expressive |
| Intensity slider | PASS | Applies to all 15 animations simultaneously |
| Haptics mode | PASS | Off/Light/Normal, linked to `hapticsEnabled` |
| Glass Effects selector | PASS | Full/Adaptive/Reduced/Minimal |
| Reduce Motion switch | PASS | Adds `html.reduced-motion` class |
| Battery Saver switch | PASS | Calls `applyMinimalPreset()` — sets all to minimal |
| Reset All | PASS | `resetMotionProfile()` restores `DEFAULT_MOTION_PROFILE` |
| Persisted as single JSON | PASS | `localStorage("mating_motion_profile")` |
| CSS custom props synced | PASS | `useEffect` in `App.tsx` writes 15 `--anim-*` vars on every profile change |

---

## REGRESSION

| Feature | Status | Notes |
|---------|--------|-------|
| Add item (Quick) | PASS | Mutation, optimistic, haptics |
| Add item (AI parse) | PASS | Local deterministic → Gemini fallback |
| Toggle purchased | PASS | Optimistic update + rollback on error |
| Delete + undo | PASS | Soft delete → undo toast → restore |
| Swipe-right buy | PASS | `SwipeableItem.onSwipeRight` → `handleToggle` |
| Swipe-left delete | PASS | `SwipeableItem.onSwipeLeft` → `handleDelete` |
| Clear purchased | PASS | Via sheet header button or settings |
| Stats screen | PASS | Budget bar animates with spring transition |
| Settings persist | PASS | All settings in localStorage, applied on mount |
| Theme toggle | PASS | NavBar button, `data-theme` attribute |
| Dark mode | PASS | All surfaces use CSS vars |
| Offline mode | PASS | StatusPill shows "Офлайн", offline queue replays |
| Sync status | PASS | `isSyncing` → StatusPill `saving` → `synced` morph |
| TMA BackButton | PASS | `setupTelegramBackButton` in App.tsx |
| No white screen | PASS | index.html branded preloader + ErrorBoundary |
| No horizontal overflow | PASS | `overflow-x: hidden` on html/body/#root, all max-widths set |
| Build clean | PASS | `tsc && vite build` — 0 errors, 0 warnings |

---

## NOT VERIFIED (requires live device)

| Item | Reason |
|------|--------|
| Haptic feedback quality | Requires physical Telegram WebView |
| Sheet keyboard behavior on Android | Requires Android device test |
| Safari backdrop-filter fallback | Requires iOS device |
| Telegram theme auto-detection | Requires TMA environment |
| Pull-to-refresh rubber-band | Not implemented (listed as optional §34) |
| Per-animation advanced sliders | Not implemented (plan note: simple toggle only) |
| Shared-element edit morph | Not implemented (plan note: in-place expansion for future) |

---

## OPEN SECURITY ADVISORY (carry-forward)

> ⚠️ `public.alembic_version` table has RLS disabled in Supabase.  
> SQL to fix: `ALTER TABLE "public"."alembic_version" ENABLE ROW LEVEL SECURITY;`  
> This has not been applied. User should action this in Supabase dashboard.
