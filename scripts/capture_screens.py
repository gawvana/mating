import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9235
OUT_DIR = r"c:\Users\Hexo\Desktop\Mating\screenshots"

MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def capture_screens():
    proc = subprocess.Popen([
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu",
        "--no-sandbox",
        "http://localhost:4173"
    ])
    await asyncio.sleep(2)

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
            await send("Runtime.evaluate", {
                "expression": "document.documentElement.setAttribute('data-theme', 'dark')"
            })
            await asyncio.sleep(0.5)

            # Click Stats tab (index 1)
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.dock .tab')[1].click()"
            })
            await asyncio.sleep(0.5)
            shot1 = await send("Page.captureScreenshot", {"format": "png"})
            if "data" in shot1:
                b1 = base64.b64decode(shot1["data"])
                with open(os.path.join(OUT_DIR, "stats_screen_dark.png"), "wb") as f:
                    f.write(b1)
                print("Captured stats_screen_dark.png")

            # Click Settings tab (index 2)
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.dock .tab')[2].click()"
            })
            await asyncio.sleep(0.5)
            shot2 = await send("Page.captureScreenshot", {"format": "png"})
            if "data" in shot2:
                b2 = base64.b64decode(shot2["data"])
                with open(os.path.join(OUT_DIR, "settings_screen_dark.png"), "wb") as f:
                    f.write(b2)
                print("Captured settings_screen_dark.png")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(capture_screens())
