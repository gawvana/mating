# MATING — Phase 43 Artifact: Visual Design & UX Hierarchy Audit
**Document:** `MATING_07_UI_UX_AUDIT.md`  
**Timestamp:** 2026-09-26T20:26:00+05:00  
**Visual Baseline:** `screenshots/live_production_390x844.png`, `screenshots/iphone_390x844_dark.png`  

---

## 1. Concrete Visual Problems Identified

### 1. Excessive Purple Glow & Visual Noise
- **Issue:** The screen background utilizes prominent radial purple/indigo gradients (`color-mix` with high opacity) that wash over the entire viewport.
- **Result:** Instead of feeling like a minimal, calm, Apple-inspired utility, the app has a "neon / gaming" atmosphere.
- **Fix:** Establish a calm, neutral dark base (`#0c0d12` / `#111218`) with localized, low-opacity (4–8%) subtle illumination.

### 2. Giant Empty Central Space
- **Issue:** Between the stats pill and the empty state icon, there is ~180px of dead space, and another ~160px between the "Добавить товар" button and the bottom dock.
- **Result:** The UI feels hollow and disconnected.
- **Fix:** Compact the empty state into a balanced card with a smaller icon (36px), 2-line title & subtitle, and integrated placement.

### 3. Detached FAB & Competing Primary Actions
- **Issue:**
  - The `+` FAB floats in the bottom-right corner, isolated from the bottom dock.
  - In empty state, there is both a large center pill button ("Добавить товар") AND the bottom-right FAB, both demanding primary focus.
- **Fix:** Visually unify the primary action with the dock or integrate the FAB into the navigation center, establishing a single unambiguous entry point for adding items.

### 4. Competing Glass Surfaces with Equal Visual Weight
- **Issue:**
  - Header capsule, stats pill, empty state card, center button, FAB, and bottom dock all share heavy borders (`1.5px solid rgba(255,255,255,0.2)`) and large rounded corners (`28px`).
- **Fix:** Apply Material 3 / iOS Liquid Glass elevation hierarchy:
  - Base: Flat neutral background.
  - Surface: Subtle translucent header and summary strip (hairline 1px border, low opacity).
  - Raised: Interactive cards and sheet.
  - Accent: Reserved exclusively for active selection indicators, checkmarks, and primary triggers.

### 5. Bottom Navigation Footprint
- **Issue:** Bottom dock is overly tall (72px) with heavy glass borders and prominent glow.
- **Fix:** Slim the dock down to 54–58px, reduce border stroke to subtle hairline, and refine the sliding lens for crisp, modern haptic feedback.
