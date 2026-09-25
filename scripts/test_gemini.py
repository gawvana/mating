import os
import urllib.request
import json

key = os.getenv("GEMINI_API_KEY", "")
url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={key}'
prompt = 'Extract shopping items: Pomidor 2 kg 15000, Bodring 1 kg. Return JSON {"items": [{"name": "string", "quantity": 1.0, "unit": "kg", "unit_price": 15000, "category": "Овощи и фрукты", "confidence": 0.95}]}'
payload = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.1}
}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print('SUCCESS:')
        print(data['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print('Error:', e)
