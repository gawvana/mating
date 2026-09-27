"""Micro-benchmark: Measure Add Product Latency across 20+ repetitions via Chrome CDP."""

import asyncio
import base64
import json
import os
import statistics
import subprocess
import time
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9250
TARGET_URL = "http://localhost:4173"
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def run_benchmark():
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

            await send("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 2,
                "mobile": True,
            })
            await send("Page.navigate", {"url": TARGET_URL})
            await asyncio.sleep(2.0)

            # Ensure page mounted
            await send("Runtime.evaluate", {
                "expression": "Boolean(window.__MATING_MOUNTED__)"
            })

            # Run 25 product additions
            latencies = []
            NUM_RUNS = 25

            for i in range(1, NUM_RUNS + 1):
                item_name = f"Яблоки Апорт {i}"
                eval_script = f"""
                new Promise((resolve) => {{
                    // Open sheet
                    const store = window.__MATING_STORE__;
                    if (store && store.getState().openSheet) {{
                        store.getState().openSheet("quick");
                    }} else {{
                        document.getElementById('fab')?.click();
                    }}

                    setTimeout(() => {{
                        const nameInput = document.querySelector('.sheet input[type="text"]');
                        if (!nameInput) {{
                            resolve({{ error: "No input found" }});
                            return;
                        }}

                        // Set input value using native setter to trigger React onChange
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        nativeSetter.call(nameInput, "{item_name}");
                        nameInput.dispatchEvent(new Event("input", {{ bubbles: true }}));

                        setTimeout(() => {{
                            const ctaBtn = document.querySelector('.sheet .glass-btn--prominent') || 
                                           document.querySelector('.sheet button[type="submit"]');
                            if (!ctaBtn) {{
                                resolve({{ error: "No CTA button found" }});
                                return;
                            }}

                            const t0 = performance.now();
                            // Tap CTA
                            ctaBtn.click();

                            // Poll for optimistic item in DOM
                            const checkRender = () => {{
                                const items = Array.from(document.querySelectorAll('.item-name'));
                                const found = items.some(el => el.textContent && el.textContent.includes("{item_name}"));
                                if (found) {{
                                    const t1 = performance.now();
                                    resolve({{ latency: t1 - t0, found: true }});
                                }} else if (performance.now() - t0 > 1000) {{
                                    resolve({{ latency: 1000, timeout: true }});
                                }} else {{
                                    requestAnimationFrame(checkRender);
                                }}
                            }};
                            requestAnimationFrame(checkRender);
                        }}, 50);
                    }}, 100);
                }})
                """

                res = await send("Runtime.evaluate", {
                    "expression": eval_script,
                    "awaitPromise": True,
                    "returnByValue": True
                })

                val = res.get("result", {}).get("value", {})
                latency = val.get("latency", 0)
                latencies.append(latency)
                print(f"Run {i:02d}: {item_name} -> {latency:.2f} ms (found: {val.get('found', False)})", flush=True)
                await asyncio.sleep(0.15)

            # Compute statistics
            valid_latencies = [l for l in latencies if l < 1000]
            if not valid_latencies:
                print("No runs succeeded under 1000ms. Check errors.")
                return

            avg_latency = statistics.mean(valid_latencies)
            median_latency = statistics.median(valid_latencies)
            min_latency = min(valid_latencies)
            max_latency = max(valid_latencies)
            p95_latency = sorted(valid_latencies)[int(len(valid_latencies) * 0.95)]

            print("\n================ LATENCY BENCHMARK RESULTS ================", flush=True)
            print(f"Total Repetitions: {len(latencies)}", flush=True)
            print(f"Successful (<1000ms): {len(valid_latencies)} / {len(latencies)}", flush=True)
            print(f"Min Latency:    {min_latency:.2f} ms", flush=True)
            print(f"Median Latency: {median_latency:.2f} ms", flush=True)
            print(f"Average Latency:{avg_latency:.2f} ms", flush=True)
            print(f"p95 Latency:    {p95_latency:.2f} ms", flush=True)
            print(f"Max Latency:    {max_latency:.2f} ms", flush=True)
            print("===========================================================\n", flush=True)

            # Capture screenshot with newly added items in list
            ss_res = await send("Page.captureScreenshot", {"format": "png"})
            png_bytes = base64.b64decode(ss_res.get("data", ""))
            os.makedirs("screenshots", exist_ok=True)
            with open("screenshots/add_product_liquid_glass_benchmark.png", "wb") as f:
                f.write(png_bytes)
            print("Screenshot saved to screenshots/add_product_liquid_glass_benchmark.png", flush=True)

            # Open AddSheet and take a screenshot of AddSheet with Liquid Glass CTA & Accordion
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const store = window.__MATING_STORE__;
                    if (store) store.getState().openSheet("quick");
                    setTimeout(() => {
                        const toggleBtn = document.querySelector('.details-toggle-btn');
                        if (toggleBtn) toggleBtn.click();
                    }, 200);
                })()
                """
            })
            await asyncio.sleep(0.6)

            ss_sheet = await send("Page.captureScreenshot", {"format": "png"})
            sheet_bytes = base64.b64decode(ss_sheet.get("data", ""))
            with open("screenshots/add_sheet_accordion_liquid_glass.png", "wb") as f:
                f.write(sheet_bytes)
            print("Screenshot saved to screenshots/add_sheet_accordion_liquid_glass.png", flush=True)

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_benchmark())
