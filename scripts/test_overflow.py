import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9232

MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def test_viewports():
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

            viewports = [320, 360, 375, 390, 412, 430]
            results = []

            for w in viewports:
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": 844,
                    "deviceScaleFactor": 2,
                    "mobile": True,
                })
                await asyncio.sleep(0.5)

                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const nav = document.querySelector('.nav');
                        const dock = document.querySelector('.dock');
                        const chrome = document.querySelector('.chrome');
                        const wrap = document.querySelector('.wrap');
                        const app = document.getElementById('app');
                        return JSON.stringify({
                            viewportWidth: window.innerWidth,
                            appClientWidth: app ? app.clientWidth : null,
                            appScrollWidth: app ? app.scrollWidth : null,
                            hasAppOverflow: app ? app.scrollWidth > app.clientWidth : false,
                            docScrollWidth: document.documentElement.scrollWidth,
                            bodyScrollWidth: document.body.scrollWidth,
                            hasWindowOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
                            navWidth: nav ? nav.offsetWidth : null,
                            dockWidth: dock ? dock.offsetWidth : null,
                            chromeRect: chrome ? { left: Math.round(chrome.getBoundingClientRect().left), width: Math.round(chrome.getBoundingClientRect().width) } : null
                        });
                    })()
                    """,
                    "returnByValue": True
                })
                data = json.loads(res.get("result", {}).get("value", "{}"))
                results.append(data)
                print(f"Viewport {w}px result:", data)

            return results
    finally:
        proc.terminate()

if __name__ == "__main__":
    res = asyncio.run(test_viewports())
    has_overflow = any(r.get("hasAppOverflow") or r.get("hasWindowOverflow") for r in res)
    if has_overflow:
        print("FAIL: Horizontal overflow detected!")
        exit(1)
    else:
        print("SUCCESS: Zero horizontal overflow across all tested viewports!")
        exit(0)
