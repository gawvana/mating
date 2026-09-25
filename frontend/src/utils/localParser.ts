/**
 * Fast deterministic multi-language parser for shopping items.
 * Runs instantly on frontend (0 ms latency) without calling LLM for simple formats.
 * Supports: RU, UZ, EN, and mixed texts.
 * Separators: newline, comma, semicolon, dash, colon, spaces.
 */

import { AIParsedItem } from "../types";

export const CATEGORY_MAP: Record<string, string[]> = {
  "Молочные продукты": [
    "молок", "сыр", "творог", "сметан", "масло сливоч", "йогурт", "кефир", "сливк", "ряженк",
    "milk", "cheese", "butter", "cream", "yogurt",
    "sut", "qatiq", "pishloq", "tvorog", "qaymoq",
  ],
  "Овощи и фрукты": [
    "картоф", "картошк", "лук", "морков", "помидор", "томат", "огур", "яблок", "банан",
    "апельсин", "чеснок", "зелен", "капуст", "перец", "виноград", "груш", "лимон", "зелень", "баклажан",
    "potato", "onion", "carrot", "tomato", "cucumber", "apple", "banana", "fruit", "vegetable",
    "kartoshka", "piyoz", "sabzi", "pomidor", "bodring", "olma", "baqlajon", "baqlojan",
  ],
  "Мясо и рыба": [
    "мяс", "говядин", "куриц", "курин", "баранин", "фарш", "рыб", "филе", "колбас", "сосиск", "стейк",
    "meat", "chicken", "beef", "fish", "sausage",
    "go'sht", "gosht", "tovuq", "baliq", "qazi",
  ],
  "Бакалея": [
    "рис", "гречк", "мук", "сахар", "сол", "макарон", "спагетти", "масло раст", "чай", "кофе", "овсянк",
    "rice", "sugar", "salt", "flour", "pasta", "tea", "coffee", "oil",
    "guruch", "shakar", "tuz", "un", "choy", "yog",
  ],
  "Хлеб и выпечка": [
    "хлеб", "батон", "лаваш", "булоч", "лепешк", "тост", "багет", "круассан",
    "bread", "bun", "baguette",
    "non", "patir", "lavash",
  ],
  "Напитки": [
    "вод", "сок", "кол", "напиток", "пив", "минералк", "газировк",
    "water", "juice", "soda", "beer", "drink",
    "suv", "sharbat",
  ],
  "Сладости": [
    "шоколад", "печень", "конфет", "торт", "пирож", "мармелад", "вафл", "морожен",
    "chocolate", "cookie", "candy", "cake", "sweets",
    "shirinlik", "shokolad", "muzqaymoq",
  ],
  "Хозтовары": [
    "мыл", "салфет", "бумаг", "порошок", "губк", "шампун", "зубн", "пакет", "паста зуб",
    "soap", "tissue", "paper", "shampoo", "detergent",
    "sovun", "shampun", "qogoz",
  ],
};

const UNIT_MAP: Record<string, string> = {
  кг: "кг", kg: "кг", kilo: "кг", кило: "кг", килограмм: "кг",
  г: "г", g: "г", gram: "г", грамм: "г",
  л: "л", l: "л", liter: "л", литр: "л",
  мл: "мл", ml: "мл",
  шт: "шт", pcs: "шт", pc: "шт", piece: "шт", dona: "шт", штука: "шт", штук: "шт",
  уп: "уп", упк: "уп", pack: "уп", упаковка: "уп", пачка: "уп",
};

export function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) {
      return cat;
    }
  }
  return "Другое";
}

export function normalizeUnit(rawUnit?: string): string {
  if (!rawUnit) return "шт";
  const cleaned = rawUnit.toLowerCase().trim();
  return UNIT_MAP[cleaned] || cleaned.slice(0, 8);
}

/**
 * Parses user input deterministically.
 * Handles inputs like:
 *   "Pomidor 15\nBaqlojan 15\nBodring 10"
 *   "Pomidor 15, Baqlojan 15, Bodring 10"
 *   "Pomidor - 15"
 *   "Помидор 2 кг 15000\nОгурцы 1 кг 12000"
 *   "Хлеб 2 шт за 10000"
 */
export function parseShoppingTextDeterministically(text: string): AIParsedItem[] {
  if (!text || !text.trim()) return [];

  const results: AIParsedItem[] = [];

  // Split lines or delimiters (newlines, commas, semicolons)
  const lines = text
    .split(/[\r\n;,]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    // Strip bullet points or numbered lists: "1.", "1)", "-", "•"
    let clean = line.replace(/^[\d+.)\-•*]+\s*/, "").trim();
    if (!clean) continue;

    // 1. Check for price keywords: "за 15000", "по 15000", "15000 сум", "15000 uzs", "15000 руб", "$15"
    let price: number | null = null;
    const priceWithUnitMatch = clean.match(/(?:за|по|price)?\s*(\d+(?:[.,]\d+)?)\s*(?:сум|sum|uzs|руб|rub|\$|евро|eur)\b/i);
    if (priceWithUnitMatch) {
      price = parseFloat(priceWithUnitMatch[1].replace(",", "."));
      clean = clean.slice(0, priceWithUnitMatch.index).trim() + " " + clean.slice(priceWithUnitMatch.index! + priceWithUnitMatch[0].length).trim();
      clean = clean.trim();
    }

    // 2. Pattern: Name Quantity Unit Price
    // Example: "Помидор 2 кг 15000", "Pomidor 2 kg 15000"
    const patternFull = clean.match(/^([a-zA-Zа-яА-ЯёЁ\s'-]+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-ЯёЁ]{1,6})\s+(\d+(?:[.,]\d+)?)$/);
    if (patternFull) {
      const rawName = patternFull[1].trim();
      const qty = parseFloat(patternFull[2].replace(",", "."));
      const unit = normalizeUnit(patternFull[3]);
      const p = parseFloat(patternFull[4].replace(",", "."));
      if (rawName) {
        results.push(createParsedItem(rawName, qty, unit, price ?? p, 0.95));
        continue;
      }
    }

    // 3. Pattern: Name Quantity Unit (without price, e.g. "Молоко 2 л", "Bodring 1 kg")
    const patternQtyUnit = clean.match(/^([a-zA-Zа-яА-ЯёЁ\s'-]+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-ЯёЁ]{1,6})$/);
    if (patternQtyUnit) {
      const rawName = patternQtyUnit[1].trim();
      const qty = parseFloat(patternQtyUnit[2].replace(",", "."));
      const unitCandidate = patternQtyUnit[3].toLowerCase();
      // Check if unitCandidate is a recognized unit or if it was actually a price
      if (UNIT_MAP[unitCandidate]) {
        results.push(createParsedItem(rawName, qty, normalizeUnit(unitCandidate), price, 0.92));
        continue;
      }
    }

    // 4. Pattern: Name Price with optional dash or colon
    // Example: "Pomidor 15", "Baqlojan 15", "Bodring 10", "Pomidor - 15", "Bodring: 10"
    const patternNamePrice = clean.match(/^([a-zA-Zа-яА-ЯёЁ\s'-]+?)\s*[-:]?\s*(\d+(?:[.,]\d+)?)$/);
    if (patternNamePrice) {
      const rawName = patternNamePrice[1].trim();
      const num = parseFloat(patternNamePrice[2].replace(",", "."));
      if (rawName) {
        // If number is small integer (1, 2, 3) and no price detected, could be quantity.
        // But in typical shopping shorthand "Pomidor 15", 15 is price or quantity.
        // If >= 10, it's almost certainly price in rubles/thousands or price in standard notation.
        // Prompt says: "Pomidor 15 -> quantity = 1, unit = шт, unit_price = 15"
        const isLikelyPrice = price === null;
        results.push(
          createParsedItem(
            rawName,
            isLikelyPrice ? 1 : num,
            "шт",
            isLikelyPrice ? num : price,
            0.9
          )
        );
        continue;
      }
    }

    // 5. Pattern: Plain item name
    // Example: "Хлеб", "Pomidor", "Milk"
    const rawName = clean.replace(/[-:]+$/, "").trim();
    if (rawName) {
      results.push(createParsedItem(rawName, 1, "шт", price, 0.85));
    }
  }

  return results;
}

function createParsedItem(
  rawName: string,
  quantity: number,
  unit: string,
  price: number | null,
  confidence: number
): AIParsedItem {
  const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  return {
    name: formattedName,
    quantity: Math.max(0.01, quantity),
    unit: unit || "шт",
    category: detectCategory(formattedName),
    estimated_price: price && price > 0 ? price : null,
    confidence,
  };
}

/**
 * Calculates deterministic totals:
 * line_total = quantity * unit_price
 * grand_total = sum(line_total)
 */
export function calculateTotals(items: { quantity: number; estimated_price?: number | null; unit_price?: number | null }[]) {
  let count = items.length;
  let grandTotal = 0;
  let itemsWithPrice = 0;

  for (const it of items) {
    const p = it.unit_price ?? it.estimated_price ?? null;
    if (p !== null && p > 0) {
      grandTotal += it.quantity * p;
      itemsWithPrice++;
    }
  }

  return {
    count,
    grandTotal: Math.round(grandTotal * 100) / 100,
    itemsWithPrice,
    hasPrices: itemsWithPrice > 0,
  };
}
