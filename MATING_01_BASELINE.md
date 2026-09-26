# MATING — Phase 1: Baseline Verification Artifact
**Document:** `MATING_01_BASELINE.md`  
**Timestamp:** 2026-09-26T20:20:15+05:00  
**Source of Truth:** Real command executions on local machine and production deployment  

---

## 1. Local Baseline Executions & Exit Codes

### A. Frontend Dependency Audit
```bash
$ npm --prefix frontend install
up to date, audited 75 packages in 3s
found 0 vulnerabilities
Exit code: 0
```

### B. TypeScript Strict Typecheck
```bash
$ npm --prefix frontend run typecheck
> mating-frontend@1.0.0 typecheck
> tsc --noEmit
Exit code: 0
```

### C. Vite Production Build & Asset Verification
```bash
$ npm --prefix frontend run build
> mating-frontend@1.0.0 build
> tsc && vite build && node scripts/verify-build.cjs

vite v6.4.3 building for production...
transforming...
✓ 98 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                           3.97 kB │ gzip:  1.71 kB
dist/assets/index-9If5gVqD.css           54.28 kB │ gzip: 11.24 kB
dist/assets/StatsScreen-C4ynmZaD.js       3.54 kB │ gzip:  1.23 kB
dist/assets/HistoryScreen-BEHXFy7s.js     5.82 kB │ gzip:  2.12 kB
dist/assets/AIScreen-8q_h0jzq.js          9.90 kB │ gzip:  3.50 kB
dist/assets/SettingsScreen-D2K-BUnd.js   32.90 kB │ gzip:  7.58 kB
dist/assets/index-C-mDGGls.js           114.23 kB │ gzip: 35.41 kB
dist/assets/vendor-CTxBTlYE.js          184.81 kB │ gzip: 58.15 kB
✓ built in 2.50s
Found scripts: [
  'https://telegram.org/js/telegram-web-app.js',
  '/assets/index-C-mDGGls.js'
]
Found links: [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap',
  '/assets/vendor-CTxBTlYE.js',
  '/assets/index-9If5gVqD.css'
]
✓ Production build verification passed: all assets compiled and validated.
Exit code: 0
```

### D. Backend Pytest Suite
```bash
$ python -m pytest backend/tests -q
...........................................                              [100%]
43 passed in 8.38s
Exit code: 0
```

---

## 2. Production Baseline (`https://mating.vercel.app/`)

- **HTTP Status:** 200 OK
- **HTML Shell:**
  - Script: `/assets/index-C-mDGGls.js` (matches local build chunk exactly)
  - Preload: `/assets/vendor-CTxBTlYE.js` (matches local build chunk exactly)
  - Stylesheet: `/assets/index-9If5gVqD.css` (matches local build chunk exactly)
  - Telegram WebApp SDK: `https://telegram.org/js/telegram-web-app.js`
- **Route Handling:**
  - `/`: 200 OK
  - `/ai`: 200 OK (Rewritten to index.html via vercel.json SPA rewrite)
- **Deployment Status:** In sync with GitHub commit `c0a08be`.
