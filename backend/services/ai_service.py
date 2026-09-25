"""AI parsing service with provider router, sanitization, rate limiting, and structured output."""

from __future__ import annotations

import hashlib
import json
import re
import time
from typing import Any
import httpx

from backend.api.schemas import AIParsedItem, AIParseResponse
from backend.core.config import settings


class AIError(Exception):
    """Base AI parsing error."""
    def __init__(self, message: str, code: str = "AI_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class AIRateLimitError(AIError):
    def __init__(self, message: str = "Rate limit exceeded. Please wait a moment."):
        super().__init__(message, code="AI_RATE_LIMIT")


class InvertedRateLimiter:
    """Simple in-memory token bucket / sliding window rate limiter."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = {}

    def check(self, key: str) -> bool:
        now = time.time()
        timestamps = self._history.get(key, [])
        # Filter timestamps within window
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
        if len(valid_timestamps) >= self.max_requests:
            self._history[key] = valid_timestamps
            return False
        valid_timestamps.append(now)
        self._history[key] = valid_timestamps
        return True


rate_limiter = InvertedRateLimiter(max_requests=settings.AI_RATE_LIMIT_PER_MINUTE)
_parse_cache: dict[str, tuple[float, list[AIParsedItem]]] = {}
CACHE_TTL = 600  # 10 minutes


def sanitize_input(text: str) -> str:
    """Sanitize and validate natural language user input."""
    if not text:
        raise AIError("Empty input text", code="EMPTY_INPUT")
    # Remove null bytes and control chars
    cleaned = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t")
    # Collapse excess whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) > 500:
        cleaned = cleaned[:500].strip()
    if not cleaned:
        raise AIError("Input contains no usable text", code="EMPTY_INPUT")
    return cleaned


# Category keywords mapping for normalization
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Молочные продукты": ["молоко", "сыр", "творог", "сметана", "масло сливочное", "йогурт", "кефир", "сливки", "ряженка", "qatiq", "sut", "pishloq", "tvorog", "qaymoq"],
    "Овощи и фрукты": ["картошка", "картофель", "лук", "морковь", "помидор", "огурец", "яблоко", "банан", "апельсин", "чеснок", "зелень", "капуста", "kartoshka", "piyoz", "sabzi", "pomidor", "bodring", "olma"],
    "Мясо и рыба": ["мясо", "говядина", "курица", "баранина", "фарш", "рыба", "филе", "колбаса", "сосиски", "go'sht", "tovuq", "baliq", "qazi"],
    "Бакалея": ["рис", "гречка", "мука", "сахар", "соль", "макароны", "спагетти", "масло", "чай", "кофе", "guruch", "shakar", "tuz", "un", "choy"],
    "Хлеб и выпечка": ["хлеб", "батон", "лаваш", "булочка", "лепешка", "non", "lavash"],
    "Напитки": ["вода", "сок", "кола", "напиток", "пиво", "suv", "sharbat"],
    "Сладости": ["шоколад", "печенье", "конфеты", "торт", "shokolad"],
    "Хозтовары": ["мыло", "салфетки", "бумага", "порошок", "губки", "shampun", "sovun"],
}

UNIT_MAP: dict[str, str] = {
    "л": "л", "литр": "л", "литра": "л", "литров": "л", "l": "л", "liter": "л",
    "кг": "кг", "кило": "кг", "килограмм": "кг", "килограмма": "кг", "килограммов": "кг", "kg": "кг",
    "г": "г", "грамм": "г", "грамма": "г", "граммов": "г", "g": "г",
    "шт": "шт", "штука": "шт", "штуки": "шт", "штук": "шт", "pcs": "шт", "dona": "шт",
    "уп": "уп", "упаковка": "уп", "упаковки": "уп", "пачка": "уп", "пачки": "уп",
    "бут": "бут", "бутылка": "бут", "бутылки": "бут",
}


def normalize_unit(unit_raw: str | None) -> str:
    if not unit_raw:
        return "шт"
    u = unit_raw.lower().strip()
    return UNIT_MAP.get(u, u[:10] if u else "шт")


def detect_category(name: str) -> str:
    name_lower = name.lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        for kw in kws:
            if kw in name_lower:
                return cat
    return "Другое"


def heuristic_nlp_parser(text: str) -> list[AIParsedItem]:
    """Robust heuristic parser for natural language lists:
    Handles: "молоко 2л, картошка 3кг, хлеб, яйца 10шт, рис 1 кг 15000 сум"
    Used as an ultra-reliable offline fallback or primary parser when LLM keys are absent.
    """
    items: list[AIParsedItem] = []
    # Split by commas, newlines, semicolons, or "и"
    chunks = re.split(r"[,;\n\r]+", text)
    
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        # Also handle " и " as delimiter if chunk contains multiple items
        sub_chunks = [chunk]
        if " и " in chunk.lower() and not any(w in chunk.lower() for w in ["овощи и фрукты", "мясо и рыба", "хлеб и выпечка"]):
            sub_chunks = [s.strip() for s in chunk.split(" и ") if s.strip()]

        for sub in sub_chunks:
            # Check for price pattern (e.g. "15000 сум", "5000 UZS", "200 руб", "10$")
            price = None
            price_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:сум|sum|uzs|руб|rub|\$|евро|eur)\b", sub, re.IGNORECASE)
            if price_match:
                try:
                    price = float(price_match.group(1).replace(",", "."))
                    sub = sub[:price_match.start()] + sub[price_match.end():]
                except ValueError:
                    pass

            # Match: name + quantity + unit (e.g., "молоко 2л", "картошка 3 кг", "яйца 10 шт", "2 л молока")
            # Pattern A: Name followed by quantity and unit: "молоко 2.5 л"
            m = re.search(
                r"^(.*?)\s+(\d+(?:[.,]\d+)?)\s*([а-яa-z]{1,10})\b\s*$",
                sub,
                re.IGNORECASE,
            )
            # Pattern B: Quantity and unit followed by name: "2 л молока"
            m_rev = re.search(
                r"^(\d+(?:[.,]\d+)?)\s*([а-яa-z]{1,10})\s+(.*?)$",
                sub,
                re.IGNORECASE,
            ) if not m else None

            if m:
                raw_name = m.group(1).strip()
                qty = float(m.group(2).replace(",", "."))
                unit = normalize_unit(m.group(3))
            elif m_rev:
                qty = float(m_rev.group(1).replace(",", "."))
                unit = normalize_unit(m_rev.group(2))
                raw_name = m_rev.group(3).strip()
            else:
                # Pattern C: Name with just number: "яйца 10"
                m_num = re.search(r"^(.*?)\s+(\d+(?:[.,]\d+)?)\s*$", sub)
                if m_num:
                    raw_name = m_num.group(1).strip()
                    qty = float(m_num.group(2).replace(",", "."))
                    unit = "шт"
                else:
                    raw_name = sub.strip()
                    qty = 1.0
                    unit = "шт"

            # Clean raw_name
            name = raw_name.strip(" -:–—.")
            if not name:
                continue

            # Capitalize first letter
            name = name[0].upper() + name[1:] if len(name) > 1 else name.upper()
            category = detect_category(name)

            items.append(
                AIParsedItem(
                    name=name,
                    quantity=qty,
                    unit=unit,
                    category=category,
                    estimated_price=price,
                    confidence=0.92 if m or m_rev else 0.85,
                )
            )

    return items


class AIService:
    """AI Service with Provider Router and resilient fallbacks."""

    SYSTEM_PROMPT = (
        "You are an expert grocery and shopping list item extractor for the Mating app. "
        "Extract shopping items from user natural language input. "
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "items": [\n'
        "    {\n"
        '      "name": "string (capitalized item name, no quantity)",\n'
        '      "quantity": float (number),\n'
        '      "unit": "string (шт, кг, г, л, мл, уп, бут)",\n'
        '      "category": "string (Молочные продукты, Овощи и фрукты, Мясо и рыба, Бакалея, Хлеб и выпечка, Напитки, Сладости, Хозтовары, Другое)",\n'
        '      "estimated_price": null or float (ONLY if explicitly mentioned in user text, NEVER invent fake prices),\n'
        '      "confidence": float (between 0.0 and 1.0)\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Do not include any explanation or markdown formatting, only valid JSON."
    )

    def __init__(self):
        self.primary_provider = settings.AI_PROVIDER
        self.primary_key = settings.AI_PRIMARY_KEY
        self.fallback_key = settings.AI_FALLBACK_KEY
        self.model = settings.AI_MODEL

    async def _call_gemini(self, text: str, api_key: str) -> list[AIParsedItem]:
        """Call Gemini REST API."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{self.SYSTEM_PROMPT}\n\nUser input: {text}"}],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise AIError(f"Gemini API returned status {resp.status_code}: {resp.text}", code="PROVIDER_ERROR")
            data = resp.json()
            raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse_json_result(raw_json)

    async def _call_openai_compatible(self, text: str, api_key: str, base_url: str = "https://api.groq.com/openai/v1") -> list[AIParsedItem]:
        """Call Groq or OpenAI-compatible endpoint."""
        url = f"{base_url}/chat/completions"
        payload = {
            "model": self.model if "groq" not in base_url else "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }
        headers = {"Authorization": f"Bearer {api_key}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise AIError(f"Provider API returned status {resp.status_code}", code="PROVIDER_ERROR")
            data = resp.json()
            raw_json = data["choices"][0]["message"]["content"]
            return self._parse_json_result(raw_json)

    def _parse_json_result(self, raw_json: str) -> list[AIParsedItem]:
        """Parse and validate JSON response with Pydantic."""
        try:
            # Strip potential ```json fences
            clean = raw_json.strip()
            if clean.startswith("```"):
                clean = re.sub(r"^```(?:json)?\s*", "", clean)
                clean = re.sub(r"\s*```$", "", clean)
            parsed = json.loads(clean)
        except Exception as e:
            raise AIError(f"Malformed JSON from AI provider: {e}", code="JSON_PARSE_ERROR")

        raw_items = parsed.get("items", [])
        if not isinstance(raw_items, list):
            raise AIError("Response missing 'items' list", code="INVALID_STRUCTURE")

        results: list[AIParsedItem] = []
        for raw in raw_items:
            try:
                name = str(raw.get("name", "")).strip()
                if not name:
                    continue
                qty = float(raw.get("quantity", 1.0))
                unit = normalize_unit(raw.get("unit"))
                category = str(raw.get("category", "Другое")).strip()
                if not category or category not in CATEGORY_KEYWORDS:
                    category = detect_category(name)

                # Never hallucinate fake prices:
                price = raw.get("estimated_price")
                if price is not None:
                    try:
                        price = float(price)
                    except (ValueError, TypeError):
                        price = None

                conf = float(raw.get("confidence", 0.95))
                conf = max(0.0, min(1.0, conf))

                results.append(
                    AIParsedItem(
                        name=name[0].upper() + name[1:] if len(name) > 1 else name.upper(),
                        quantity=qty,
                        unit=unit,
                        category=category,
                        estimated_price=price,
                        confidence=conf,
                    )
                )
            except Exception:
                continue

        return results

    async def parse_text(self, text: str, user_id: str = "default") -> AIParseResponse:
        """Execute full parsing pipeline: sanitize -> rate limit -> cache -> provider router -> response."""
        sanitized = sanitize_input(text)

        # Rate limiting check
        if not rate_limiter.check(user_id):
            raise AIRateLimitError()

        # Cache check
        cache_key = hashlib.sha256(sanitized.lower().encode("utf-8")).hexdigest()
        now = time.time()
        if cache_key in _parse_cache:
            ts, items = _parse_cache[cache_key]
            if now - ts < CACHE_TTL:
                return AIParseResponse(items=items, raw_text=sanitized)

        items: list[AIParsedItem] = []
        # Attempt Primary Provider
        if self.primary_key:
            try:
                if self.primary_provider == "gemini":
                    items = await self._call_gemini(sanitized, self.primary_key)
                elif self.primary_provider == "groq":
                    items = await self._call_openai_compatible(sanitized, self.primary_key, base_url="https://api.groq.com/openai/v1")
                elif self.primary_provider == "openai":
                    items = await self._call_openai_compatible(sanitized, self.primary_key, base_url="https://api.openai.com/v1")
            except Exception:
                # Attempt Fallback Provider if primary failed
                if self.fallback_key:
                    try:
                        items = await self._call_openai_compatible(sanitized, self.fallback_key)
                    except Exception:
                        items = heuristic_nlp_parser(sanitized)
                else:
                    items = heuristic_nlp_parser(sanitized)
        else:
            # Fallback to deterministic NLP heuristic parser
            items = heuristic_nlp_parser(sanitized)

        # Store in cache
        if items:
            _parse_cache[cache_key] = (now, items)

        return AIParseResponse(items=items, raw_text=sanitized)


ai_service = AIService()
