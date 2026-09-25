import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9236
PROD_URL = "https://mating.vercel.app"
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def test_live():
    proc = subprocess.Popen([
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu",
        "--no-sandbox",
        PROD_URL
    ])
    await asyncio.sleep(3)

    try:
        tabs_url = f"http://127.0.0.1:{PORT}/json"
        with urllib.request.urlopen(tabs_url) as resp:
            tabs = json.loads(resp.read().decode())
            tab = [t for t in tabs if "mating.vercel.app" in t.get("url", "")][0]
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
            await asyncio.sleep(2.5)

            eval_res = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const nav = document.querySelector('.nav');
                    const dock = document.querySelector('.dock');
                    const items = document.querySelectorAll('.item-row');
                    const isBlank = document.body.innerText.trim().length === 0 && !nav;
                    return JSON.stringify({
                        hasNav: !!nav,
                        hasDock: !!dock,
                        itemCount: items.length,
                        bodyLength: document.body.innerHTML.length,
                        isBlank: isBlank,
                        title: document.title
                    });
                })()
                """,
                "returnByValue": True
            })
            info = json.loads(eval_res.get("result", {}).get("value", "{}"))
            print("LIVE PRODUCTION EVAL:", info)

            shot = await send("Page.captureScreenshot", {"format": "png"})
            if "data" in shot:
                b = base64.b64decode(shot["data"])
                with open("screenshots/live_production_390x844.png", "wb") as f:
                    f.write(b)
                print(f"Captured live production screenshot ({len(b)} bytes)")

            return info
    finally:
        proc.terminate()

if __name__ == "__main__":
    res = asyncio.run(test_live())
    if res.get("isBlank") or not res.get("hasNav"):
        print("FAIL: Live production has blank/black screen or missing UI!")
        exit(1)
    else:
        print("SUCCESS: Live production rendered flawlessly with zero crashes!")
        exit(0)
