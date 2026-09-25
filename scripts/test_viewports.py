import subprocess
import os

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
viewports = [(320, 640), (360, 800), (375, 812), (390, 844), (430, 932)]

for w, h in viewports:
    out = f"c:\\Users\\Hexo\\Desktop\\Mating\\screenshots\\vp_{w}x{h}.png"
    cmd = [
        chrome,
        "--headless=new",
        f"--window-size={w},{h}",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--screenshot={out}",
        "http://localhost:4173"
    ]
    res = subprocess.run(cmd, capture_output=True)
    print(f"Viewport {w}x{h}: generated={os.path.exists(out)}, size={os.path.getsize(out) if os.path.exists(out) else 0}")

print("All viewports processed.")
