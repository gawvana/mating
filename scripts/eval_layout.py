import asyncio
import json
import subprocess
import urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9223

async def main():
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
            ws_url = tabs[0]["webSocketDebuggerUrl"]

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
            eval_res = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const nav = document.querySelector('.nav');
                    const dock = document.querySelector('.dock');
                    const fab = document.querySelector('.fab');
                    const chrome = document.querySelector('.chrome');
                    return JSON.stringify({
                        windowWidth: window.innerWidth,
                        windowHeight: window.innerHeight,
                        bodyWidth: document.body.clientWidth,
                        navWidth: nav ? nav.clientWidth : null,
                        navRect: nav ? nav.getBoundingClientRect() : null,
                        dockWidth: dock ? dock.clientWidth : null,
                        dockRect: dock ? dock.getBoundingClientRect() : null,
                        fabRect: fab ? fab.getBoundingClientRect() : null,
                        chromeRect: chrome ? chrome.getBoundingClientRect() : null
                    });
                })()
                """,
                "returnByValue": True
            })
            print("EVAL:", eval_res.get("result", {}).get("value"))
    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
