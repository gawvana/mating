import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9233
OUT_DIR = r"c:\Users\Hexo\Desktop\Mating\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def capture_shots():
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

            configs = [
                ("iphone_390x844_light", 390, 844, "light"),
                ("iphone_390x844_dark", 390, 844, "dark"),
                ("android_360x800_dark", 360, 800, "dark"),
                ("narrow_320x640_light", 320, 640, "light"),
                ("large_430x932_dark", 430, 932, "dark"),
            ]

            for name, w, h, theme in configs:
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": h,
                    "deviceScaleFactor": 2,
                    "mobile": True,
                })
                await send("Emulation.setEmulatedMedia", {
                    "features": [{"name": "prefers-color-scheme", "value": theme}]
                })
                # Set html data-theme explicitly to match
                await send("Runtime.evaluate", {
                    "expression": f"document.documentElement.setAttribute('data-theme', '{theme}')"
                })
                await asyncio.sleep(0.5)

                shot = await send("Page.captureScreenshot", {"format": "png"})
                if "data" in shot:
                    b = base64.b64decode(shot["data"])
                    path = os.path.join(OUT_DIR, f"{name}.png")
                    with open(path, "wb") as f:
                        f.write(b)
                    print(f"Captured {name}.png ({len(b)} bytes)")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(capture_shots())
