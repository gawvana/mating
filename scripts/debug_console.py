import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9231

async def debug_page():
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

            await send("Runtime.enable")
            await send("Page.enable")
            await asyncio.sleep(2)

            eval_res = await send("Runtime.evaluate", {
                "expression": "document.body.innerHTML",
                "returnByValue": True
            })
            html = eval_res.get("result", {}).get("value", "")
            with open("scripts/page_dump.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("WROTE HTML TO scripts/page_dump.html (size:", len(html), "chars)")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(debug_page())
