import subprocess
import os
import sys
import time

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://localhost:4173"
OUT_DIR = r"c:\Users\Hexo\Desktop\Mating\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

viewports = [
    ("mobile_375x812_light", 375, 812, False),
    ("mobile_390x844_dark", 390, 844, True),
    ("mobile_320x640_narrow", 320, 640, False),
    ("mobile_430x932_large", 430, 932, True),
]

for name, w, h, dark in viewports:
    screenshot_file = os.path.join(OUT_DIR, f"{name}.png")
    args = [
        CHROME_PATH,
        "--headless=new",
        f"--window-size={w},{h}",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--screenshot={screenshot_file}",
    ]
    if dark:
        args.append("--blink-settings=forceDarkModeEnabled=true")
    args.append(BASE_URL)

    res = subprocess.run(args, capture_output=True)
    print(f"Generated {name}.png: exists={os.path.exists(screenshot_file)} (size={os.path.getsize(screenshot_file) if os.path.exists(screenshot_file) else 0})")

print("Screenshot generation finished.")
