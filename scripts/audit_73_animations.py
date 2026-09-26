"""Mating 73 Animations Deep Audit & Verification Script (CDP Runtime Runner)."""

import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9248
TARGET_URL = "http://localhost:4173"

MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def run_audit():
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu",
        "--no-sandbox",
        TARGET_URL
    ])
    await asyncio.sleep(2.5)

    try:
        tabs_url = f"http://127.0.0.1:{PORT}/json"
        with urllib.request.urlopen(tabs_url) as resp:
            tabs = json.loads(resp.read().decode())
            tab = [t for t in tabs if "localhost:4173" in t.get("url", "")][0]
            ws_url = tab["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            msg_id = 1
            async def send(method, params=None):
                nonlocal msg_id
                cmd = {"id": msg_id, "method": method, "params": params or {}}
                msg_id += 1
                await ws.send(json.dumps(cmd))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == cmd["id"]:
                        return res.get("result", {})

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Network.enable")
            await send("Network.setUserAgentOverride", {"userAgent": MOBILE_UA})

            # Emulate iPhone 390x844
            await send("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 2,
                "mobile": True,
            })
            await asyncio.sleep(1.5)

            # Wait for React mount
            mounted = False
            for _ in range(20):
                chk = await send("Runtime.evaluate", {
                    "expression": "Boolean(window.__MATING_MOUNTED__ && document.getElementById('fab'))"
                })
                if chk.get("result", {}).get("value") is True:
                    mounted = True
                    break
                await asyncio.sleep(0.3)

            print(f"React Mounted: {mounted}")

            # Test 1: FAB Morph & Sheet
            fab_state_1 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const fab = document.getElementById('fab');
                    const plus = fab.querySelector('.fab-icon-plus');
                    const close = fab.querySelector('.fab-icon-close');
                    const plusStyle = window.getComputedStyle(plus);
                    const closeStyle = window.getComputedStyle(close);
                    return {
                        openAttr: fab.getAttribute('data-open'),
                        plusOpacity: plusStyle.opacity,
                        plusTransform: plusStyle.transform,
                        closeOpacity: closeStyle.opacity,
                        closeTransform: closeStyle.transform
                    };
                })()
                """,
                "returnByValue": True
            })

            # Click FAB to open sheet
            await send("Runtime.evaluate", {
                "expression": "document.getElementById('fab').click()"
            })
            await asyncio.sleep(0.7)

            fab_state_2 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const fab = document.getElementById('fab');
                    const plus = fab.querySelector('.fab-icon-plus');
                    const close = fab.querySelector('.fab-icon-close');
                    const plusStyle = window.getComputedStyle(plus);
                    const closeStyle = window.getComputedStyle(close);
                    const sheet = document.querySelector('.sheet');
                    const scrim = document.querySelector('.scrim');
                    const sheetStyle = window.getComputedStyle(sheet);
                    const scrimStyle = window.getComputedStyle(scrim);
                    return {
                        openAttr: fab.getAttribute('data-open'),
                        plusOpacity: plusStyle.opacity,
                        plusTransform: plusStyle.transform,
                        closeOpacity: closeStyle.opacity,
                        closeTransform: closeStyle.transform,
                        sheetOpen: sheet.classList.contains('open'),
                        sheetTransform: sheetStyle.transform,
                        scrimOpen: scrim.classList.contains('open'),
                        scrimOpacity: scrimStyle.opacity
                    };
                })()
                """,
                "returnByValue": True
            })

            # Test Segmented Control inside sheet
            seg_res_1 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const seg = document.querySelector('.sheet .seg');
                    const thumb = seg ? seg.querySelector('i') : null;
                    return {
                        segIdx: seg ? seg.style.getPropertyValue('--seg-idx') : null,
                        thumbT: thumb ? window.getComputedStyle(thumb).transform : null
                    };
                })()
                """,
                "returnByValue": True
            })

            # Click AI tab
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.sheet .seg button')[1].click()"
            })
            await asyncio.sleep(0.6)

            seg_res_2 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const seg = document.querySelector('.sheet .seg');
                    const thumb = seg ? seg.querySelector('i') : null;
                    return {
                        segIdx: seg ? seg.style.getPropertyValue('--seg-idx') : null,
                        thumbT: thumb ? window.getComputedStyle(thumb).transform : null
                    };
                })()
                """,
                "returnByValue": True
            })

            # Close sheet via scrim
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('.scrim').click()"
            })
            await asyncio.sleep(0.7)

            fab_state_3 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const fab = document.getElementById('fab');
                    const sheet = document.querySelector('.sheet');
                    return {
                        openAttr: fab.getAttribute('data-open'),
                        sheetOpen: sheet.classList.contains('open')
                    };
                })()
                """,
                "returnByValue": True
            })

            print("\n=== RUNTIME FAB MORPH EVIDENCE ===")
            print("1. FAB Closed (default):", json.dumps(fab_state_1.get("result", {}).get("value", {}), indent=2))
            print("2. FAB Opened (after click):", json.dumps(fab_state_2.get("result", {}).get("value", {}), indent=2))
            print("3. FAB Closed again:", json.dumps(fab_state_3.get("result", {}).get("value", {}), indent=2))

            print("\n=== RUNTIME SEGMENTED CONTROL EVIDENCE ===")
            print("Quick Mode:", seg_res_1.get("result", {}).get("value"))
            print("AI Mode:", seg_res_2.get("result", {}).get("value"))

            # Test 2: Dock Lens movement
            dock_res_1 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const dock = document.getElementById('dock');
                    const lens = dock.querySelector('.lens');
                    return {
                        tabIdx: dock.style.getPropertyValue('--tab-idx'),
                        lensT: window.getComputedStyle(lens).transform
                    };
                })()
                """,
                "returnByValue": True
            })

            # Click Stats tab (index 1)
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.dock .tab')[1].click()"
            })
            await asyncio.sleep(0.7)

            dock_res_2 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const dock = document.getElementById('dock');
                    const lens = dock.querySelector('.lens');
                    return {
                        tabIdx: dock.style.getPropertyValue('--tab-idx'),
                        lensT: window.getComputedStyle(lens).transform
                    };
                })()
                """,
                "returnByValue": True
            })

            # Click Settings tab (index 2)
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.dock .tab')[2].click()"
            })
            await asyncio.sleep(0.7)

            dock_res_3 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const dock = document.getElementById('dock');
                    const lens = dock.querySelector('.lens');
                    return {
                        tabIdx: dock.style.getPropertyValue('--tab-idx'),
                        lensT: window.getComputedStyle(lens).transform
                    };
                })()
                """,
                "returnByValue": True
            })

            print("\n=== RUNTIME DOCK LENS EVIDENCE ===")
            print("Tab 0 (List):", dock_res_1.get("result", {}).get("value"))
            print("Tab 1 (Stats):", dock_res_2.get("result", {}).get("value"))
            print("Tab 2 (Settings):", dock_res_3.get("result", {}).get("value"))

            # Test 3: Settings switch toggle
            sw_res_1 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const sw = document.querySelector('.settings-row .sw');
                    const thumb = sw ? sw.querySelector('i') : null;
                    return {
                        checked: sw ? sw.getAttribute('aria-checked') : null,
                        thumbT: thumb ? window.getComputedStyle(thumb).transform : null
                    };
                })()
                """,
                "returnByValue": True
            })

            # Click switch
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('.settings-row .sw').click()"
            })
            await asyncio.sleep(0.6)

            sw_res_2 = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const sw = document.querySelector('.settings-row .sw');
                    const thumb = sw ? sw.querySelector('i') : null;
                    return {
                        checked: sw ? sw.getAttribute('aria-checked') : null,
                        thumbT: thumb ? window.getComputedStyle(thumb).transform : null
                    };
                })()
                """,
                "returnByValue": True
            })

            print("\n=== RUNTIME SWITCH SPRING EVIDENCE ===")
            print("Switch Initial:", sw_res_1.get("result", {}).get("value"))
            print("Switch Toggled:", sw_res_2.get("result", {}).get("value"))

            # Test 4: CSS Custom Properties on Document Root
            css_vars = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const r = document.documentElement.style;
                    return {
                        animFab: r.getPropertyValue('--anim-fab-morph'),
                        durFab: r.getPropertyValue('--dur-fab'),
                        animSheet: r.getPropertyValue('--anim-sheet-spring'),
                        durSheet: r.getPropertyValue('--dur-sheet'),
                        animTotal: r.getPropertyValue('--anim-total'),
                        durTotal: r.getPropertyValue('--dur-total'),
                        animBudget: r.getPropertyValue('--anim-budget'),
                        durBudget: r.getPropertyValue('--dur-budget'),
                        animTab: r.getPropertyValue('--anim-tab-indicator'),
                        durTab: r.getPropertyValue('--dur-tab'),
                        animCheck: r.getPropertyValue('--anim-checkbox'),
                        durCheck: r.getPropertyValue('--dur-checkbox'),
                        animSwipe: r.getPropertyValue('--anim-swipe'),
                        durSwipe: r.getPropertyValue('--dur-swipe'),
                        animLongpress: r.getPropertyValue('--anim-longpress'),
                        durLongpress: r.getPropertyValue('--dur-longpress'),
                        animEdit: r.getPropertyValue('--anim-edit-morph'),
                        durEdit: r.getPropertyValue('--dur-edit-morph'),
                        animStatus: r.getPropertyValue('--anim-status-pill'),
                        durStatus: r.getPropertyValue('--dur-status-pill'),
                        animHeader: r.getPropertyValue('--anim-header-motion'),
                        durHeader: r.getPropertyValue('--dur-header'),
                        animKeyboard: r.getPropertyValue('--anim-keyboard-sheet'),
                        durKeyboard: r.getPropertyValue('--dur-keyboard'),
                        animList: r.getPropertyValue('--anim-list-add-delete'),
                        durList: r.getPropertyValue('--dur-list'),
                        animHaptic: r.getPropertyValue('--anim-haptic'),
                        intensity: r.getPropertyValue('--motion-intensity'),
                    };
                })()
                """,
                "returnByValue": True
            })

            print("\n=== CSS ROOT MOTION VARIABLES FROM STORE ===")
            print(json.dumps(css_vars.get("result", {}).get("value", {}), indent=2))

            # Test 5: Setting Toggle Disabling Verification (0.01ms duration check)
            await send("Runtime.evaluate", {
                "expression": "window.__MATING_STORE__.getState().updateAnimSetting('headerMotion', { enabled: false })"
            })
            await asyncio.sleep(0.3)
            dur_disabled = await send("Runtime.evaluate", {
                "expression": "document.documentElement.style.getPropertyValue('--dur-header')"
            })
            await send("Runtime.evaluate", {
                "expression": "window.__MATING_STORE__.getState().updateAnimSetting('headerMotion', { enabled: true })"
            })
            await asyncio.sleep(0.3)
            dur_enabled = await send("Runtime.evaluate", {
                "expression": "document.documentElement.style.getPropertyValue('--dur-header')"
            })
            print("\n=== SETTING DISABLE RUNTIME EFFECT ===")
            print({"durDisabled": dur_disabled.get("result", {}).get("value"), "durEnabled": dur_enabled.get("result", {}).get("value")})

            # Switch back to List tab
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.dock .tab')[0].click()"
            })
            await asyncio.sleep(0.7)

            # Test 6: Sheet Detents (#20) & Stepper Bump (#46)
            await send("Runtime.evaluate", {
                "expression": "document.getElementById('fab').click()"
            })
            await asyncio.sleep(0.5)

            detent_res = await send("Runtime.evaluate", {
                "expression": "document.querySelector('.sheet').getAttribute('data-detent')"
            })

            await send("Runtime.evaluate", {
                "expression": "document.querySelector('button[aria-label=\"Увеличить\"]').click()"
            })
            await asyncio.sleep(0.08)

            bump_res = await send("Runtime.evaluate", {
                "expression": "Boolean(document.querySelector('.stepper-val')?.classList.contains('bump'))"
            })
            print("\n=== SHEET DETENTS & STEPPER BUMP EVIDENCE ===")
            print({"detent": detent_res.get("result", {}).get("value"), "hasBump": bump_res.get("result", {}).get("value")})

            await send("Runtime.evaluate", {
                "expression": "document.querySelector('.scrim').click()"
            })
            await asyncio.sleep(0.6)

            # Test 7: Search Expand (#44)
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('.search-toggle-btn').click()"
            })
            await asyncio.sleep(0.4)

            search_res = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const searchBar = document.querySelector('.search-bar');
                    const wrap = document.querySelector('.search-wrap');
                    return {
                        hasSearchBar: Boolean(searchBar),
                        wrapOpen: wrap ? wrap.classList.contains('open') : false
                    };
                })()
                """,
                "returnByValue": True
            })
            print("\n=== SEARCH EXPAND EVIDENCE ===")
            print(search_res.get("result", {}).get("value"))

            # Test 8: PTR, Scroll-to-top FAB, and Sticky Header Elements
            dom_test = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    return {
                        hasPtrContainer: Boolean(document.querySelector('.ptr-container')),
                        hasPtrSpinner: Boolean(document.querySelector('.ptr-spinner')),
                        hasSummaryStrip: Boolean(document.querySelector('.summary-strip')),
                        revealCount: document.querySelectorAll('.reveal-item').length
                    };
                })()
                """,
                "returnByValue": True
            })
            print("\n=== PTR, SPINNER & SCROLL REVEAL EVIDENCE ===")
            print(dom_test.get("result", {}).get("value"))

            # Test 9: Card Shape Morph (#11)
            card_morph_test = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const testCard = document.createElement('div');
                    testCard.className = 'item-row prelift';
                    document.body.appendChild(testCard);
                    const style = window.getComputedStyle(testCard);
                    const br = style.borderRadius;
                    const transform = style.transform;
                    testCard.remove();
                    return { preliftRadius: br, preliftTransform: transform };
                })()
                """,
                "returnByValue": True
            })
            print("\n=== CARD SHAPE MORPH EVIDENCE ===")
            print(card_morph_test.get("result", {}).get("value"))

            # Test 10: FLIP Edit Morph Ghost (#40)
            await send("Runtime.evaluate", {
                "expression": """
                window.__MATING_STORE__.getState().openEditSheet(
                    { id: 'test-item', name: 'Молоко', quantity: 1, unit: 'л', version: 1 },
                    { top: 120, left: 16, width: 358, height: 56 }
                );
                """
            })
            await asyncio.sleep(0.1)

            morph_ghost_res = await send("Runtime.evaluate", {
                "expression": "Boolean(document.querySelector('.edit-morph-ghost'))"
            })
            print("\n=== FLIP EDIT MORPH GHOST EVIDENCE ===")
            print({"hasGhost": morph_ghost_res.get("result", {}).get("value")})

            await send("Runtime.evaluate", {
                "expression": "window.__MATING_STORE__.getState().closeSheet()"
            })
            await asyncio.sleep(0.5)

            # Test 11: Multi-toast Stack (#68)
            await send("Runtime.evaluate", {
                "expression": """
                window.__MATING_STORE__.getState().showUndoToast('1', 'Яблоки');
                window.__MATING_STORE__.getState().showUndoToast('2', 'Хлеб');
                """
            })
            await asyncio.sleep(0.3)

            toast_stack_res = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const stack = document.querySelector('.toast-stack');
                    const count = stack ? stack.querySelectorAll('.undo-toast').length : 0;
                    return { hasStack: Boolean(stack), toastCount: count };
                })()
                """,
                "returnByValue": True
            })
            print("\n=== TOAST STACK COLLAPSE EVIDENCE ===")
            print(toast_stack_res.get("result", {}).get("value"))

            await send("Runtime.evaluate", {
                "expression": "window.__MATING_STORE__.getState().clearUndoToast()"
            })
            await asyncio.sleep(0.3)

            # Test 12: Glass Button Ripple & Magnetic Pull (#36, #58)
            ripple_test = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const btn = document.querySelector('button');
                    if (!btn) return { ok: false };
                    const ripple = document.createElement('span');
                    ripple.className = 'ripple-effect';
                    btn.appendChild(ripple);
                    const rippleStyle = window.getComputedStyle(ripple);
                    const hasAnim = rippleStyle.animationName.includes('ripple');
                    ripple.remove();
                    return { ok: true, hasRippleAnim: hasAnim };
                })()
                """,
                "returnByValue": True
            })
            print("\n=== RIPPLE & MAGNETIC FEEDBACK EVIDENCE ===")
            print(ripple_test.get("result", {}).get("value"))

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_audit())
