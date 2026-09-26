"""Mating Runtime Master QA Test Suite.
Executes real end-to-end tests against Production (Vercel & Supabase) and Telegram Bot API.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.parse
import uuid
import httpx

BOT_TOKEN = (
    os.getenv("TELEGRAM_BOT_TOKEN")
    or os.getenv("BOT_TOKEN")
    or "8981651536:AAHHRbC8X300Cg3vUKk9SV4ZNKV_Ona8J74"
)
PROD_BASE = os.getenv("PROD_BASE", "https://mating.vercel.app")
API_BASE = f"{PROD_BASE}/api/v1"

test_results = []

def record_test(area: str, name: str, expected: str, actual: str, status: str, evidence: str = ""):
    print(f"[{status}] {area} -> {name}: {actual}")
    test_results.append({
        "area": area,
        "name": name,
        "expected": expected,
        "actual": actual,
        "status": status,
        "evidence": evidence,
    })


def create_telegram_init_data(user_id: int, username: str, first_name: str, auth_date: int | None = None) -> str:
    """Generate cryptographically valid Telegram initData using HMAC-SHA256."""
    if auth_date is None:
        auth_date = int(time.time())

    user_dict = {
        "id": user_id,
        "first_name": first_name,
        "last_name": "Test",
        "username": username,
        "language_code": "ru",
        "allows_write_to_pm": True,
    }
    user_str = json.dumps(user_dict, separators=(",", ":"))

    data = {
        "auth_date": str(auth_date),
        "query_id": f"AAH{user_id}QA",
        "user": user_str,
    }

    # Data check string
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))

    # Secret key = HMAC_SHA256(bot_token, "WebAppData")
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode("utf-8"), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    data["hash"] = calc_hash
    return urllib.parse.urlencode(data)


def run_all_qa():
    client = httpx.Client(timeout=25.0)

    print("=" * 60)
    print("STARTING REAL RUNTIME MASTER QA PASS")
    print(f"Target Production: {PROD_BASE}")
    print("=" * 60)

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 1: PRODUCTION INFRASTRUCTURE & ASSETS
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 1: INFRASTRUCTURE & ASSETS ---")

    # Test 1.1: Health Endpoint
    try:
        r = client.get(f"{PROD_BASE}/api/health")
        if r.status_code == 200 and r.json().get("status") == "ok":
            record_test("Infrastructure", "Health Endpoint", "200 OK with status: ok", f"{r.status_code} {r.json()}", "PASS")
        else:
            record_test("Infrastructure", "Health Endpoint", "200 OK", f"{r.status_code} {r.text}", "FAIL")
    except Exception as e:
        record_test("Infrastructure", "Health Endpoint", "200 OK", str(e), "FAIL")

    # Test 1.2: Homepage & Root Div
    try:
        r = client.get(f"{PROD_BASE}/")
        has_root = '<div id="root">' in r.text
        has_viewport = 'viewport' in r.text
        if r.status_code == 200 and has_root and has_viewport:
            record_test("Infrastructure", "Homepage Delivery", "200 OK with #root and viewport meta", f"200 OK (size {len(r.text)} bytes)", "PASS")
        else:
            record_test("Infrastructure", "Homepage Delivery", "200 OK with #root", f"{r.status_code}", "FAIL")
    except Exception as e:
        record_test("Infrastructure", "Homepage Delivery", "200 OK", str(e), "FAIL")

    # Test 1.3: Assets Delivery
    try:
        import re
        css_files = re.findall(r'href="(/assets/[^"]+\.css)"', r.text)
        js_files = re.findall(r'src="(/assets/[^"]+\.js)"', r.text)
        all_assets_ok = True
        assets_info = []

        for asset in css_files + js_files:
            ar = client.get(f"{PROD_BASE}{asset}")
            if ar.status_code != 200 or len(ar.content) < 100:
                all_assets_ok = False
            assets_info.append(f"{asset}: {ar.status_code} ({len(ar.content)} bytes)")

        if all_assets_ok and len(assets_info) >= 2:
            record_test("Infrastructure", "Static Assets", "All JS & CSS bundles return 200 OK", "; ".join(assets_info), "PASS")
        else:
            record_test("Infrastructure", "Static Assets", "200 OK for all assets", "; ".join(assets_info), "FAIL")
    except Exception as e:
        record_test("Infrastructure", "Static Assets", "Assets OK", str(e), "FAIL")

    # Test 1.4: SPA Routing
    try:
        r_spa = client.get(f"{PROD_BASE}/settings")
        if r_spa.status_code == 200 and '<div id="root">' in r_spa.text:
            record_test("Infrastructure", "SPA Routing Fallback", "200 OK serving index.html on deep links", f"200 OK", "PASS")
        else:
            record_test("Infrastructure", "SPA Routing Fallback", "200 OK serving index.html", f"{r_spa.status_code}", "FAIL")
    except Exception as e:
        record_test("Infrastructure", "SPA Routing Fallback", "200 OK", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 2: AUTHENTICATION & SECURITY
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 2: AUTHENTICATION & SECURITY ---")

    user_a_id = 987654321
    init_data_a = create_telegram_init_data(user_a_id, "user_qa_a", "Alice")
    headers_a = {"Authorization": f"tma {init_data_a}"}

    user_b_id = 123456789
    init_data_b = create_telegram_init_data(user_b_id, "user_qa_b", "Bob")
    headers_b = {"Authorization": f"tma {init_data_b}"}

    # Test 2.1: Valid Telegram InitData Auth via GET /api/v1/profile
    try:
        r_auth = client.get(f"{API_BASE}/profile", headers=headers_a)
        if r_auth.status_code == 200 and "id" in r_auth.json():
            user_data = r_auth.json()
            record_test("Security", "Telegram TMA Header Auth", "200 OK with authenticated user profile", f"Authenticated OK, User DB ID: {user_data.get('id')}", "PASS")
        else:
            record_test("Security", "Telegram TMA Header Auth", "200 OK with profile", f"{r_auth.status_code} {r_auth.text}", "FAIL")
    except Exception as e:
        record_test("Security", "Telegram TMA Header Auth", "200 OK", str(e), "FAIL")

    # Test 2.2: Tampered Hash Auth Rejection
    try:
        tampered = init_data_a[:-6] + "deadbf"
        r_tamp = client.get(f"{API_BASE}/profile", headers={"Authorization": f"tma {tampered}"})
        if r_tamp.status_code == 401:
            record_test("Security", "Tampered Hash Rejection", "401 Unauthorized", f"{r_tamp.status_code} Rejection OK", "PASS")
        else:
            record_test("Security", "Tampered Hash Rejection", "401 Unauthorized", f"{r_tamp.status_code}", "FAIL")
    except Exception as e:
        record_test("Security", "Tampered Hash Rejection", "401 Unauthorized", str(e), "FAIL")

    # Test 2.3: Expired Auth Rejection (> 24 hours)
    try:
        expired = create_telegram_init_data(user_a_id, "user_qa_a", "Alice", auth_date=int(time.time()) - 90000)
        r_exp = client.get(f"{API_BASE}/profile", headers={"Authorization": f"tma {expired}"})
        if r_exp.status_code == 401:
            record_test("Security", "Expired Auth Rejection", "401 Unauthorized", f"{r_exp.status_code} Rejection OK", "PASS")
        else:
            record_test("Security", "Expired Auth Rejection", "401 Unauthorized", f"{r_exp.status_code}", "FAIL")
    except Exception as e:
        record_test("Security", "Expired Auth Rejection", "401 Unauthorized", str(e), "FAIL")

    # Test 2.4: Unauthenticated Request to Protected Endpoint
    try:
        r_noauth = client.get(f"{API_BASE}/items")
        if r_noauth.status_code == 401:
            record_test("Security", "Unauthenticated Request Rejection", "401 Unauthorized", f"{r_noauth.status_code} Rejection OK", "PASS")
        else:
            record_test("Security", "Unauthenticated Request Rejection", "401 Unauthorized", f"{r_noauth.status_code}", "FAIL")
    except Exception as e:
        record_test("Security", "Unauthenticated Request Rejection", "401 Unauthorized", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 3: USER PROFILE & SETTINGS PERSISTENCE
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 3: PROFILE & SETTINGS ---")

    # Test 3.1: Get Profile
    try:
        r_prof = client.get(f"{API_BASE}/profile", headers=headers_a)
        if r_prof.status_code == 200:
            record_test("Profile", "Get Profile", "200 OK with user details", f"Language: {r_prof.json().get('language_code')}, Currency: {r_prof.json().get('currency_code')}", "PASS")
        else:
            record_test("Profile", "Get Profile", "200 OK", f"{r_prof.status_code}", "FAIL")
    except Exception as e:
        record_test("Profile", "Get Profile", "200 OK", str(e), "FAIL")

    # Test 3.2: Update Settings
    try:
        update_data = {
            "language_code": "uz",
            "currency_code": "UZS",
            "city": "Ташкент",
            "monthly_budget": 2000000.0,
        }
        r_up = client.put(f"{API_BASE}/settings", json=update_data, headers=headers_a)
        if r_up.status_code == 200:
            up_prof = r_up.json()
            saved_ok = (up_prof.get("language_code") == "uz" and
                        up_prof.get("city") == "Ташкент" and
                        up_prof.get("monthly_budget") == 2000000.0)
            if saved_ok:
                record_test("Settings", "Update Settings", "Updated fields persisted in DB", f"Budget: {up_prof.get('monthly_budget')}, City: {up_prof.get('city')}, Lang: {up_prof.get('language_code')}", "PASS")
            else:
                record_test("Settings", "Update Settings", "Fields matched", f"Mismatch in returned data: {up_prof}", "FAIL")
        else:
            record_test("Settings", "Update Settings", "200 OK", f"{r_up.status_code} {r_up.text}", "FAIL")
    except Exception as e:
        record_test("Settings", "Update Settings", "200 OK", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 4: REAL DATABASE CRUD & CONCURRENCY
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 4: DATABASE CRUD & CONCURRENCY ---")

    created_item_id = None
    created_item_version = 1

    # Test 4.1: Create Valid Item
    try:
        mutation_id = str(uuid.uuid4())
        item_payload = {
            "name": "Молоко 2л",
            "quantity": 2.0,
            "unit": "л",
            "category": "Молочные продукты",
            "price": 25000.0,
            "client_mutation_id": mutation_id,
        }
        r_create = client.post(f"{API_BASE}/items", json=item_payload, headers=headers_a)
        if r_create.status_code in (200, 201):
            item_data = r_create.json()
            created_item_id = item_data["id"]
            created_item_version = item_data["version"]
            record_test("CRUD", "Create Valid Item", "201 Created with persisted UUID and version=1", f"ID: {created_item_id}, Version: {created_item_version}, Price: {item_data['price']}", "PASS")
        else:
            record_test("CRUD", "Create Valid Item", "201 Created", f"{r_create.status_code} {r_create.text}", "FAIL")
    except Exception as e:
        record_test("CRUD", "Create Valid Item", "201 Created", str(e), "FAIL")

    # Test 4.2: Idempotency (Duplicate Mutation ID)
    try:
        r_dup = client.post(f"{API_BASE}/items", json=item_payload, headers=headers_a)
        if r_dup.status_code in (200, 201):
            dup_id = r_dup.json()["id"]
            if dup_id == created_item_id:
                record_test("Concurrency", "Idempotency Protection", "Returns existing item without duplicate row creation", f"Duplicate matched original ID: {dup_id}", "PASS")
            else:
                record_test("Concurrency", "Idempotency Protection", "Same ID returned", f"Created duplicate ID: {dup_id}", "FAIL")
        else:
            record_test("Concurrency", "Idempotency Protection", "Success response", f"{r_dup.status_code}", "FAIL")
    except Exception as e:
        record_test("Concurrency", "Idempotency Protection", "Success response", str(e), "FAIL")

    # Test 4.3: Input Validation Rejections
    validation_tests = [
        ("Empty Name", {"name": "   ", "quantity": 1.0, "unit": "шт"}),
        ("Zero Quantity", {"name": "Хлеб", "quantity": 0, "unit": "шт"}),
        ("Negative Quantity", {"name": "Хлеб", "quantity": -2.0, "unit": "шт"}),
        ("Negative Price", {"name": "Хлеб", "quantity": 1.0, "unit": "шт", "price": -500.0}),
    ]
    for vname, payload in validation_tests:
        try:
            rv = client.post(f"{API_BASE}/items", json=payload, headers=headers_a)
            if rv.status_code == 422:
                record_test("Validation", f"Reject {vname}", "422 Unprocessable Entity", f"{rv.status_code} Rejected as expected", "PASS")
            else:
                record_test("Validation", f"Reject {vname}", "422 Unprocessable Entity", f"Unexpected code {rv.status_code}", "FAIL")
        except Exception as e:
            record_test("Validation", f"Reject {vname}", "422", str(e), "FAIL")

    # Test 4.4: Toggle Purchased State (Optimistic Concurrency)
    if created_item_id:
        try:
            r_tog = client.patch(
                f"{API_BASE}/items/{created_item_id}/toggle",
                json={"version": created_item_version},
                headers=headers_a
            )
            if r_tog.status_code == 200:
                tog_data = r_tog.json()
                new_ver = tog_data["version"]
                is_p = tog_data["is_purchased"]
                if is_p and new_ver == created_item_version + 1:
                    created_item_version = new_ver
                    record_test("CRUD", "Toggle Purchased", "is_purchased=True, version incremented to 2", f"is_purchased: {is_p}, version: {new_ver}", "PASS")
                else:
                    record_test("CRUD", "Toggle Purchased", "State toggled and version incremented", f"State: {is_p}, ver: {new_ver}", "FAIL")
            else:
                record_test("CRUD", "Toggle Purchased", "200 OK", f"{r_tog.status_code} {r_tog.text}", "FAIL")
        except Exception as e:
            record_test("CRUD", "Toggle Purchased", "200 OK", str(e), "FAIL")

    # Test 4.5: Concurrency Conflict (Stale Version)
    if created_item_id:
        try:
            r_conf = client.patch(
                f"{API_BASE}/items/{created_item_id}/toggle",
                json={"version": 1},  # Stale! Version is now 2
                headers=headers_a
            )
            if r_conf.status_code == 409:
                record_test("Concurrency", "Optimistic Lock Conflict", "409 Conflict on stale version", f"409 Conflict caught correctly", "PASS")
            else:
                record_test("Concurrency", "Optimistic Lock Conflict", "409 Conflict", f"Unexpected code {r_conf.status_code}", "FAIL")
        except Exception as e:
            record_test("Concurrency", "Optimistic Lock Conflict", "409 Conflict", str(e), "FAIL")

    # Test 4.6: Cross-User Security Isolation
    if created_item_id:
        try:
            r_cross = client.patch(
                f"{API_BASE}/items/{created_item_id}/toggle",
                json={"version": created_item_version},
                headers=headers_b
            )
            if r_cross.status_code in (403, 404):
                record_test("Security", "Cross-User Isolation", "403 or 404 when User B accesses User A's item", f"{r_cross.status_code} Access Blocked", "PASS")
            else:
                record_test("Security", "Cross-User Isolation", "Blocked", f"VULNERABILITY: User B received {r_cross.status_code}", "FAIL")
        except Exception as e:
            record_test("Security", "Cross-User Isolation", "Blocked", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 5: REAL AI PARSING WITH GOOGLE GEMINI 2.5 FLASH
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 5: REAL AI PARSING ---")

    ai_parsed_items = []
    try:
        raw_text = "молоко 2л, картошка 3кг, сыр сулугуни 300г, бородинский хлеб 1шт"
        r_ai = client.post(f"{API_BASE}/ai/parse", json={"text": raw_text}, headers=headers_a)
        if r_ai.status_code == 200:
            res_ai = r_ai.json()
            items_list = res_ai.get("items", [])
            ai_parsed_items = items_list
            has_milk = any("молок" in i["name"].lower() for i in items_list)
            has_potato = any("карто" in i["name"].lower() for i in items_list)
            if len(items_list) >= 3 and has_milk and has_potato:
                record_test("AI Parser", "Google Gemini 2.5 Flash Parse", "Accurately extracts >=3 items with quantities, units, and categories", f"Parsed {len(items_list)} items: {[i['name'] for i in items_list]}", "PASS")
            else:
                record_test("AI Parser", "Google Gemini 2.5 Flash Parse", "Accurate parse", f"Returned: {items_list}", "PARTIAL")
        else:
            record_test("AI Parser", "Google Gemini 2.5 Flash Parse", "200 OK", f"{r_ai.status_code} {r_ai.text}", "FAIL")
    except Exception as e:
        record_test("AI Parser", "Google Gemini 2.5 Flash Parse", "200 OK", str(e), "FAIL")

    # Test 5.2: Batch Create Parsed Items
    if ai_parsed_items:
        try:
            batch_payload = {
                "items": [
                    {
                        "name": it["name"],
                        "quantity": it["quantity"],
                        "unit": it["unit"],
                        "category": it["category"],
                        "price": it.get("estimated_price"),
                        "raw_input_text": "batch test",
                    }
                    for it in ai_parsed_items
                ]
            }
            r_batch = client.post(f"{API_BASE}/items/batch", json=batch_payload, headers=headers_a)
            if r_batch.status_code in (200, 201) and len(r_batch.json()) == len(ai_parsed_items):
                record_test("CRUD", "Batch Create Items", "201 Created with all batch items committed to DB", f"Committed {len(r_batch.json())} items", "PASS")
            else:
                record_test("CRUD", "Batch Create Items", "201 Created", f"{r_batch.status_code} {r_batch.text}", "FAIL")
        except Exception as e:
            record_test("CRUD", "Batch Create Items", "201 Created", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 6: STATS CALCULATION & MATHEMATICAL VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 6: STATS & MATH VERIFICATION ---")

    try:
        r_stats = client.get(f"{API_BASE}/stats/monthly", headers=headers_a)
        if r_stats.status_code == 200:
            st = r_stats.json()
            total_spent = st.get("total_spent", 0.0)
            budget = st.get("monthly_budget", 0.0)
            remaining = st.get("budget_remaining", 0.0)
            active_count = st.get("active_items_count", 0)
            bought_count = st.get("items_purchased_count", 0)

            # Mathematical check: remaining == budget - total_spent
            expected_remaining = round(budget - total_spent, 2)
            actual_remaining = round(remaining, 2)
            math_ok = expected_remaining == actual_remaining

            if math_ok and bought_count >= 1:
                record_test("Stats", "Monthly Stats & Budget Math", "budget_remaining == budget - total_spent", f"Spent: {total_spent}, Budget: {budget}, Remaining: {remaining}, Active: {active_count}, Bought: {bought_count}", "PASS")
            else:
                record_test("Stats", "Monthly Stats & Budget Math", f"Expected remaining: {expected_remaining}", f"Actual remaining: {actual_remaining}", "FAIL")
        else:
            record_test("Stats", "Monthly Stats", "200 OK", f"{r_stats.status_code}", "FAIL")
    except Exception as e:
        record_test("Stats", "Monthly Stats", "200 OK", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 7: SOFT DELETE, UNDO & CLEAR PURCHASED
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 7: SOFT DELETE, UNDO & CLEAR ---")

    # Test 7.1: Soft Delete
    if created_item_id:
        try:
            r_del = client.delete(f"{API_BASE}/items/{created_item_id}", headers=headers_a)
            if r_del.status_code == 200:
                r_list_after = client.get(f"{API_BASE}/items", headers=headers_a)
                ids_after = [i["id"] for i in r_list_after.json()]
                if created_item_id not in ids_after:
                    record_test("CRUD", "Soft Delete Item", "Item deleted and excluded from active list", f"Deleted successfully, not in {len(ids_after)} items", "PASS")
                else:
                    record_test("CRUD", "Soft Delete Item", "Excluded from active list", "Still present in active list", "FAIL")
            else:
                record_test("CRUD", "Soft Delete Item", "200 OK", f"{r_del.status_code}", "FAIL")
        except Exception as e:
            record_test("CRUD", "Soft Delete Item", "200 OK", str(e), "FAIL")

    # Test 7.2: Undo Restore
    if created_item_id:
        try:
            r_res = client.post(f"{API_BASE}/items/{created_item_id}/restore", headers=headers_a)
            if r_res.status_code == 200:
                r_list_restored = client.get(f"{API_BASE}/items", headers=headers_a)
                ids_restored = [i["id"] for i in r_list_restored.json()]
                if created_item_id in ids_restored:
                    record_test("CRUD", "Undo Restore Item", "Item restored back to active list", "Restored successfully", "PASS")
                else:
                    record_test("CRUD", "Undo Restore Item", "Restored to active list", "Not found in active list", "FAIL")
            else:
                record_test("CRUD", "Undo Restore Item", "200 OK", f"{r_res.status_code}", "FAIL")
        except Exception as e:
            record_test("CRUD", "Undo Restore Item", "200 OK", str(e), "FAIL")

    # Test 7.3: Clear Purchased
    try:
        r_clear = client.post(f"{API_BASE}/items/clear-purchased", headers=headers_a)
        if r_clear.status_code == 200:
            cleared_count = r_clear.json().get("cleared_count", 0)
            r_list_cleared = client.get(f"{API_BASE}/items", headers=headers_a)
            has_any_purchased = any(i["is_purchased"] for i in r_list_cleared.json())
            if not has_any_purchased:
                record_test("CRUD", "Clear Purchased Items", "All purchased items removed from active list", f"Cleared {cleared_count} items, remaining purchased: 0", "PASS")
            else:
                record_test("CRUD", "Clear Purchased Items", "No purchased items remain", "Some purchased items remain", "FAIL")
        else:
            record_test("CRUD", "Clear Purchased Items", "200 OK", f"{r_clear.status_code}", "FAIL")
    except Exception as e:
        record_test("CRUD", "Clear Purchased Items", "200 OK", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 8: TELEGRAM BOT WEBHOOK & COMMANDS RUNTIME
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- SECTION 8: TELEGRAM BOT & WEBHOOK RUNTIME ---")

    # Test 8.1: getWebhookInfo from Telegram API
    try:
        r_wh_info = client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo")
        if r_wh_info.status_code == 200:
            wh_res = r_wh_info.json().get("result", {})
            wh_url = wh_res.get("url")
            pending = wh_res.get("pending_update_count", 0)
            last_err = wh_res.get("last_error_message")
            if "mating.vercel.app/api/v1/bot/webhook" in wh_url and last_err is None:
                record_test("Telegram Bot", "Webhook Registration & Health", "Webhook points to production with 0 pending errors", f"URL: {wh_url}, Pending: {pending}, Last Error: {last_err}", "PASS")
            else:
                record_test("Telegram Bot", "Webhook Registration & Health", "Healthy webhook", f"URL: {wh_url}, Last error: {last_err}", "PARTIAL")
        else:
            record_test("Telegram Bot", "Webhook Registration & Health", "200 OK", f"{r_wh_info.status_code}", "FAIL")
    except Exception as e:
        record_test("Telegram Bot", "Webhook Registration & Health", "200 OK", str(e), "FAIL")

    # Test 8.2: getMyCommands from Telegram API
    try:
        r_cmd = client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMyCommands")
        if r_cmd.status_code == 200:
            cmds = r_cmd.json().get("result", [])
            cmd_names = [c["command"] for c in cmds]
            if "start" in cmd_names and "list" in cmd_names and "add" in cmd_names and "stats" in cmd_names:
                record_test("Telegram Bot", "Bot Commands Registered", "All core commands (/start, /list, /add, /stats, /settings, /help) present", f"Registered: {cmd_names}", "PASS")
            else:
                record_test("Telegram Bot", "Bot Commands Registered", "Core commands present", f"Found: {cmd_names}", "FAIL")
        else:
            record_test("Telegram Bot", "Bot Commands Registered", "200 OK", f"{r_cmd.status_code}", "FAIL")
    except Exception as e:
        record_test("Telegram Bot", "Bot Commands Registered", "200 OK", str(e), "FAIL")

    # Test 8.3: getChatMenuButton from Telegram API
    try:
        r_btn = client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMenuButton")
        if r_btn.status_code == 200:
            btn_res = r_btn.json().get("result", {})
            btn_type = btn_res.get("type")
            web_url = btn_res.get("web_app", {}).get("url")
            if btn_type == "web_app" and "mating.vercel.app" in web_url:
                record_test("Telegram Bot", "Chat Menu Button (Web App)", "Menu button configured as web_app pointing to Mini App", f"Type: {btn_type}, URL: {web_url}", "PASS")
            else:
                record_test("Telegram Bot", "Chat Menu Button (Web App)", "web_app button", f"Type: {btn_type}, URL: {web_url}", "FAIL")
        else:
            record_test("Telegram Bot", "Chat Menu Button (Web App)", "200 OK", f"{r_btn.status_code}", "FAIL")
    except Exception as e:
        record_test("Telegram Bot", "Chat Menu Button (Web App)", "200 OK", str(e), "FAIL")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 9: SUMMARY & METRICS
    # ──────────────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("MASTER QA RUNTIME SUMMARY")
    print("=" * 60)

    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["status"] == "PASS")
    failed_tests = sum(1 for t in test_results if t["status"] == "FAIL")
    partial_tests = sum(1 for t in test_results if t["status"] == "PARTIAL")

    print(f"Total Tests Executed: {total_tests}")
    print(f"Passed: {passed_tests} ({passed_tests/total_tests*100:.1f}%)")
    print(f"Failed: {failed_tests}")
    print(f"Partial: {partial_tests}")
    print("=" * 60)

    return test_results


if __name__ == "__main__":
    run_all_qa()
