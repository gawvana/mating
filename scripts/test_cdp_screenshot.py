import json
import os
import subprocess
import time
import urllib.request
import urllib.error

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222

# Launch Chrome with remote debugging
proc = subprocess.Popen([
    CHROME,
    "--headless=new",
    f"--remote-debugging-port={PORT}",
    "--disable-gpu",
    "--no-sandbox",
    "http://localhost:4173"
])

time.sleep(2)

try:
    # Get tabs list
    tabs_url = f"http://127.0.0.1:{PORT}/json"
    with urllib.request.urlopen(tabs_url) as resp:
        tabs = json.loads(resp.read().decode())
        print("Tabs count:", len(tabs))
        ws_url = tabs[0]["webSocketDebuggerUrl"]
        print("WebSocket URL:", ws_url)
except Exception as e:
    print("Error connecting to Chrome:", e)
finally:
    proc.terminate()
