"""Mating Mobile, Stress, Concurrency & Performance Master QA Test."""

from __future__ import annotations

import asyncio
import time
import uuid
import httpx
from scripts.runtime_qa import create_telegram_init_data, PROD_BASE, API_BASE

stress_results = []

def record(area: str, name: str, expected: str, actual: str, status: str):
    print(f"[{status}] {area} -> {name}: {actual}")
    stress_results.append({
        "area": area,
        "name": name,
        "expected": expected,
        "actual": actual,
        "status": status,
    })


async def run_stress_tests():
    print("=" * 60)
    print("STARTING STRESS, CONCURRENCY & MOBILE PERFORMANCE TEST")
    print("=" * 60)

    user_id = 555444333
    init_data = create_telegram_init_data(user_id, "stresstester", "StressUser")
    headers = {"Authorization": f"tma {init_data}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ──────────────────────────────────────────────────────────────────────
        # 1. 10 RAPID DUPLICATE MUTATIONS (IDEMPOTENCY UNDER LOAD)
        # ──────────────────────────────────────────────────────────────────────
        mutation_id = str(uuid.uuid4())
        payload = {
            "name": "Стресс Товар",
            "quantity": 1.0,
            "unit": "шт",
            "category": "Другое",
            "price": 1000.0,
            "client_mutation_id": mutation_id,
        }

        # Fire 10 simultaneous POST /api/v1/items requests with identical client_mutation_id
        start_time = time.time()
        tasks = [
            client.post(f"{API_BASE}/items", json=payload, headers=headers)
            for _ in range(10)
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time

        successful_items = []
        status_codes = []
        for r in responses:
            if isinstance(r, httpx.Response):
                status_codes.append(r.status_code)
                if r.status_code in (200, 201):
                    successful_items.append(r.json()["id"])

        unique_ids = set(successful_items)
        if len(unique_ids) == 1 and all(code in (200, 201) for code in status_codes):
            record("Concurrency", "10 Rapid Duplicate Creates", "Single item created across 10 simultaneous requests", f"All 10 matched ID: {list(unique_ids)[0]} in {duration:.2f}s", "PASS")
        else:
            record("Concurrency", "10 Rapid Duplicate Creates", "Single unique ID", f"Created {len(unique_ids)} IDs: {unique_ids}", "FAIL")

        item_id = list(unique_ids)[0] if unique_ids else None

        # ──────────────────────────────────────────────────────────────────────
        # 2. RAPID CONCURRENT TOGGLES (OPTIMISTIC LOCK INTEGRITY)
        # ──────────────────────────────────────────────────────────────────────
        if item_id:
            # 10 simultaneous toggle requests with version=1
            toggle_tasks = [
                client.patch(f"{API_BASE}/items/{item_id}/toggle", json={"version": 1}, headers=headers)
                for _ in range(10)
            ]
            toggle_responses = await asyncio.gather(*toggle_tasks, return_exceptions=True)
            toggle_codes = [r.status_code for r in toggle_responses if isinstance(r, httpx.Response)]
            ok_count = toggle_codes.count(200)
            conflict_count = toggle_codes.count(409)

            # Exactly 1 request must win version 1 -> 2; remaining 9 must receive 409 Conflict
            if ok_count == 1 and conflict_count == 9:
                record("Concurrency", "Optimistic Lock Race Condition", "Exactly 1 winner (200) and 9 conflicts (409)", f"1 OK, 9 Conflicts caught as expected", "PASS")
            else:
                record("Concurrency", "Optimistic Lock Race Condition", "1 OK, 9 Conflicts", f"Got: {ok_count} OK, {conflict_count} Conflicts (Codes: {toggle_codes})", "PARTIAL" if ok_count >= 1 else "FAIL")

        # ──────────────────────────────────────────────────────────────────────
        # 3. LARGE PAYLOAD & QUERY PERFORMANCE LATENCY
        # ──────────────────────────────────────────────────────────────────────
        # Fetch items and measure response time
        t0 = time.time()
        r_list = await client.get(f"{API_BASE}/items", headers=headers)
        list_lat = (time.time() - t0) * 1000

        t1 = time.time()
        r_stats = await client.get(f"{API_BASE}/stats/monthly", headers=headers)
        stats_lat = (time.time() - t1) * 1000

        if r_list.status_code == 200 and list_lat < 1500:
            record("Performance", "List Retrieval Latency", "P95 latency < 1500ms on serverless cold/warm", f"{list_lat:.1f}ms (Count: {len(r_list.json())})", "PASS")
        else:
            record("Performance", "List Retrieval Latency", "< 1500ms", f"{list_lat:.1f}ms", "FAIL")

        if r_stats.status_code == 200 and stats_lat < 1500:
            record("Performance", "Stats Calculation Latency", "P95 latency < 1500ms on serverless aggregate", f"{stats_lat:.1f}ms", "PASS")
        else:
            record("Performance", "Stats Calculation Latency", "< 1500ms", f"{stats_lat:.1f}ms", "FAIL")

        # ──────────────────────────────────────────────────────────────────────
        # 4. MOBILE VIEWPORT & CSS DESIGN SYSTEM AUDIT
        # ──────────────────────────────────────────────────────────────────────
        # Download production CSS bundle
        r_home = await client.get(f"{PROD_BASE}/")
        import re
        css_match = re.search(r'href="(/assets/[^"]+\.css)"', r_home.text)
        if css_match:
            css_url = f"{PROD_BASE}{css_match.group(1)}"
            r_css = await client.get(css_url)
            css_text = r_css.text

            # Check safe area support
            has_safe_area = "safe-area-inset" in css_text
            # Check capability classes
            has_perf_modes = "perf-minimal" in css_text and "perf-reduced" in css_text
            # Check compact mode
            has_compact = ".compact" in css_text
            # Check reduced motion
            has_motion = "reduced-motion" in css_text
            # Check theme tokens
            has_themes = "[data-theme=dark]" in css_text or "data-theme=\"dark\"" in css_text or "dark" in css_text

            if has_safe_area and has_perf_modes and has_compact and has_motion:
                record("Design System", "CSS Bundle Audit", "Safe area insets, perf modes, compact mode, and reduced motion verified", f"Bundle size: {len(css_text)} bytes", "PASS")
            else:
                record("Design System", "CSS Bundle Audit", "All capability tokens present", f"Safe area: {has_safe_area}, Perf: {has_perf_modes}, Compact: {has_compact}", "FAIL")

    print("\n" + "=" * 60)
    print("STRESS & PERFORMANCE SUMMARY")
    print("=" * 60)
    total = len(stress_results)
    passed = sum(1 for t in stress_results if t["status"] == "PASS")
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ({passed/total*100:.1f}%)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_stress_tests())
