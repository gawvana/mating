import urllib.request
import urllib.error
import json

url = "https://mating.vercel.app/api/v1/items"
headers = {
    "Authorization": 'tma-test {"id": 999999, "username": "demo_user", "first_name": "Demo User", "language_code": "ru"}'
}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        print("Body:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Response:", e.read().decode())
except Exception as ex:
    print("Exception:", ex)
