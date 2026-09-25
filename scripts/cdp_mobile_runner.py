import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222
OUT_DIR = r"c:\Users\Hexo\Desktop\Mating\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

async def run_cdp():
    # Start Chrome with remote debugging
    proc = subprocess.Popen([
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu",
        "--no-sandbox",
        "about:blank"
    ])
    await asyncio.sleep(2)

    try:
        # Get target tab
        tabs_url = f"http://127.0.0.1:{PORT}/json"
        with urllib.request.urlopen(tabs_url) as resp:
            tabs = json.loads(resp.read().decode())
            ws_url = tabs[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            msg_id = 1

            async def send_cmd(method, params=None):
                nonlocal msg_id
                cmd = {"id": msg_id, "method": method, "params": params or {}}
                msg_id += 1
                await ws.send(json.dumps(cmd))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == cmd["id"]:
                        return res.get("result", {})

            # Enable Page & Runtime
            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")

            viewports = [
                ("iphone_390x844_light", 390, 844, False),
                ("iphone_390x844_dark", 390, 844, True),
                ("android_360x800", 360, 800, False),
                ("narrow_320x640", 320, 640, False),
                ("large_430x932", 430, 932, True),
            ]

            for name, w, h, is_dark in viewports:
                # 1. Override device metrics (true mobile viewport)
                await send_cmd("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": h,
                    "deviceScaleFactor": 1,
                    "mobile": True,
                    "fitWindow": True,
                })

                # 2. Emulate dark mode if requested
                if is_dark:
                    await send_cmd("Emulation.setEmulatedMedia", {
                        "features": [{"name": "prefers-color-scheme", "value": "dark"}]
                    })
                else:
                    await send_cmd("Emulation.setEmulatedMedia", {
                        "features": [{"name": "prefers-color-scheme", "value": "light"}]
                    })

                # 3. Navigate
                await send_cmd("Page.navigate", {"url": "http://localhost:4173"})
                await asyncio.sleep(1.2)

                # 4. Check layout dimensions via Runtime.evaluate
                eval_res = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    JSON.stringify({
                        innerWidth: window.innerWidth,
                        docScrollWidth: document.documentElement.scrollWidth,
                        bodyScrollWidth: document.body.scrollWidth,
                        chromeRect: document.getElementById('chrome') ? document.getElementById('chrome').getBoundingClientRect() : null,
                        navRect: document.querySelector('.nav') ? document.querySelector('.nav').getBoundingClientRect() : null
                    })
                    """,
                    "returnByValue": True
                })
                layout_info = json.loads(eval_res.get("result", {}).get("value", "{}"))
                print(f"[{name}] Layout: {layout_info}")

                # 5. Capture screenshot
                shot_data = await send_cmd("Page.captureScreenshot", {"format": "png"})
                if "data" in shot_data:
                    img_bytes = base64.b64decode(shot_data["data"])
                    filepath = os.path.join(OUT_DIR, f"{name}.png")
                    with open(filepath, "wb") as f:
                        f.write(img_bytes)
                    print(f"[{name}] Saved screenshot: {len(img_bytes)} bytes")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_cdp())
