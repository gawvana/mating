/**
 * Fast deterministic multi-language hybrid parser for shopping items.
 * Enforces the Mating Bare Number Rule and canonical normalization.
 * Supports: RU, UZ (Latin & Cyrillic), EN.
 */

import { AIParsedItem } from "../types";

export const CATEGORY_MAP: Record<string, string[]> = {
  "Молочные продукты": [
    "молок", "сыр", "творог", "сметан", "масло сливоч", "йогурт", "кефир", "сливк", "ряженк",
    "milk", "cheese", "butter", "cream", "yogurt",
    "sut", "qatiq", "pishloq", "tvorog", "qaymoq",
    "сут", "қатиқ", "катиқ", "пишлоқ", "пишлок", "қаймоқ", "каймок",
  ],
  "Овощи и фрукты": [
    "картоф", "картошк", "лук", "морков", "помидор", "томат", "огур", "яблок", "банан",
    "апельсин", "чеснок", "зелен", "капуст", "перец", "виноград", "груш", "лимон", "зелень", "баклажан",
    "potato", "onion", "carrot", "tomato", "cucumber", "apple", "banana", "fruit", "vegetable",
    "kartoshka", "piyoz", "sabzi", "pomidor", "bodring", "olma", "baqlajon", "baqlojan", "qalamir", "qalampir",
    "бодринг", "бақлажон", "баклажон", "қалампир", "калампир", "каламир", "қаламир", "сабзи", "пиёз", "олма",
  ],
  "Мясо и рыба": [
    "мяс", "говядин", "куриц", "курин", "баранин", "фарш", "рыб", "филе", "колбас", "сосиск", "стейк",
    "meat", "chicken", "beef", "fish", "sausage",
    "go'sht", "gosht", "tovuq", "baliq", "qazi",
    "гўшт", "гошт", "товуқ", "товук", "балиқ", "балик", "қази", "кази",
  ],
  "Бакалея": [
    "рис", "гречк", "мук", "сахар", "сол", "макарон", "спагетти", "масло раст", "чай", "кофе", "овсянк",
    "rice", "sugar", "salt", "flour", "pasta", "tea", "coffee", "oil",
    "guruch", "shakar", "tuz", "un", "choy", "yog", "yog'",
    "гуруч", "шакар", "туз", "ун", "чой", "ёғ", "ёг",
  ],
  "Хлеб и выпечка": [
    "хлеб", "батон", "лаваш", "булоч", "лепешк", "тост", "багет", "круассан",
    "bread", "bun", "baguette",
    "non", "patir", "lavash",
    "нон", "патир",
  ],
  "Напитки": [
    "вод", "сок", "кол", "напиток", "пив", "минералк", "газировк",
    "water", "juice", "soda", "beer", "drink",
    "suv", "sharbat",
    "сув", "шарбат",
  ],
  "Сладости": [
    "шоколад", "печень", "конфет", "торт", "пирож", "мармелад", "вафл", "морожен",
    "chocolate", "cookie", "candy", "cake", "sweets",
    "shirinlik", "shokolad", "muzqaymoq",
    "ширинлик", "музқаймоқ", "музкаймок",
  ],
  "Хозтовары": [
    "мыл", "салфет", "бумаг", "порошок", "губк", "шампун", "зубн", "пакет", "паста зуб",
    "soap", "tissue", "paper", "shampoo", "detergent",
    "sovun", "shampun", "qogoz",
    "совун", "шампунь", "қоғоз", "коғоз",
  ],
};

const UNIT_MAP: Record<string, string> = {
  кг: "кг", kg: "кг", kilo: "кг", кило: "кг", килограмм: "кг", килограмма: "кг", килограммов: "кг",
  г: "г", g: "г", gram: "г", грамм: "г", грамма: "г", граммов: "г",
  л: "л", l: "л", liter: "л", литр: "л", литра: "л", литров: "л",
  мл: "мл", ml: "мл",
  шт: "шт", pcs: "шт", pc: "шт", piece: "шт", dona: "шт", ta: "шт", штука: "шт", штуки: "шт", штук: "шт",
  дона: "шт", та: "шт",
  уп: "уп", упк: "уп", pack: "уп", упаковка: "уп", упаковки: "уп", пачка: "уп", пачки: "уп",
  бут: "бут", бутылка: "бут", бутылки: "бут", бутылок: "бут", bottle: "бут", shisha: "бут", шиша: "бут",
};

/**
 * Normalizes item names to canonical forms while preserving the user's language (UZ/RU/EN).
 */
export function normalizeCanonicalName(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  const isLatin = /^[a-zA-Z\s'-]+$/.test(trimmed);

  // Uzbek / Latin canonical map
  if (isLatin) {
    if (/^pomid[ro]+l?a?r?$/i.test(lower)) return "Pomidor";
    if (/^bodringl?a?r?$/i.test(lower)) return "Bodring";
    if (/^baql?o?janl?a?r?$/i.test(lower)) return "Baqlajon";
    if (/^qalampirl?a?r?$/i.test(lower)) return "Qalampir";
    if (/^qalamirl?a?r?$/i.test(lower)) return "Qalamir";
    if (/^kartoshkal?a?r?$/i.test(lower)) return "Kartoshka";
    if (/^sabzil?a?r?$/i.test(lower)) return "Sabzi";
    if (/^piyozl?a?r?$/i.test(lower)) return "Piyoz";
    if (/^go['`]?shtl?a?r?$/i.test(lower)) return "Go'sht";
    if (/^nonl?a?r?$/i.test(lower)) return "Non";
    if (/^suvl?a?r?$/i.test(lower)) return "Suv";
    if (/^tuxuml?a?r?$/i.test(lower)) return "Tuxum";
    if (/^sut$/i.test(lower)) return "Sut";
    if (/^pishloq$/i.test(lower)) return "Pishloq";
    if (/^choy$/i.test(lower)) return "Choy";
    if (/^shakar$/i.test(lower)) return "Shakar";
    if (/^tuz$/i.test(lower)) return "Tuz";
    if (/^un$/i.test(lower)) return "Un";
    if (/^yog['`]?$/i.test(lower)) return "Yog'";
  } else {
    // Uzbek Cyrillic canonical map
    if (/^[қк]алампир[лар]*$/i.test(lower)) return "Қалампир";
    if (/^[қк]аламир[лар]*$/i.test(lower)) return "Қалампир";
    if (/^бодринг[лар]*$/i.test(lower)) return "Бодринг";
    if (/^ба[қк]лажон[лар]*$/i.test(lower)) return "Бақлажон";
    if (/^сабзи[лар]*$/i.test(lower)) return "Сабзи";
    if (/^пиёз[лар]*$/i.test(lower)) return "Пиёз";
    if (/^г[ўо]шт[лар]*$/i.test(lower)) return "Гўшт";
    if (/^нон[лар]*$/i.test(lower)) return "Нон";
    if (/^сув[лар]*$/i.test(lower)) return "Сув";
    if (/^тухум[лар]*$/i.test(lower)) return "Тухум";
    if (/^сут$/i.test(lower)) return "Сут";
    if (/^[қк]ати[қк]$/i.test(lower)) return "Қатиқ";
    if (/^пишло[қк]$/i.test(lower)) return "Пишлоқ";
    if (/^[қк]аймо[қк]$/i.test(lower)) return "Қаймоқ";
    if (/^чой$/i.test(lower)) return "Чой";
    if (/^шакар$/i.test(lower)) return "Шакар";
    if (/^туз$/i.test(lower)) return "Туз";
    if (/^ун$/i.test(lower)) return "Ун";
    if (/^[её]ғ$/i.test(lower)) return "Ёғ";
    if (/^гуруч$/i.test(lower)) return "Гуруч";

    // Cyrillic / Russian canonical map
    if (/^помидор[ыа]?$/i.test(lower)) return "Помидор";
    if (/^огур[ецы]+$/i.test(lower)) return "Огурцы";
    if (/^карто[фельшкаы]+$/i.test(lower)) return "Картошка";
    if (/^морков[ькаы]*$/i.test(lower)) return "Морковь";
    if (/^лук$/i.test(lower)) return "Лук";
    if (/^баклажан[ы]?$/i.test(lower)) return "Баклажан";
    if (/^перец$/i.test(lower)) return "Перец";
    if (/^хлеб[а]?$/i.test(lower)) return "Хлеб";
    if (/^я(?:йц[аоы]?|иц[а]?)$/i.test(lower)) return "Яйца";
    if (/^молок[оа]?$/i.test(lower)) return "Молоко";
    if (/^сыр[ыа]?$/i.test(lower)) return "Сыр";
    if (/^яблок[ои]?$/i.test(lower)) return "Яблоки";
    if (/^банан[ы]?$/i.test(lower)) return "Бананы";
  }

  // Fallback: Title case
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

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
 * Enforces the Mating Bare Number Rule:
 * If a number has no unit after product name:
 * - < 1000 (e.g. 10, 5, 15, 2) defaults to price in thousands (10 -> 10,000 UZS; 5 -> 5,000 UZS).
 * - >= 1000 (e.g. 18000) is the exact price (18,000 UZS).
 */
export function interpretBareNumber(num: number): number {
  if (num <= 0) return num;
  if (num < 1000) {
    return num * 1000;
  }
  return num;
}

const CURRENCIES = new Set([
  "сум", "sum", "uzs", "руб", "rub", "usd", "$", "eur", "евро", "тыс", "k", "к"
]);

const PRICE_PREPOSITIONS = new Set([
  "за", "по", "price", "цена"
]);

/**
 * Splits a single space-separated line into multiple items if it contains
 * multiple distinct items (e.g. "Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5").
 */
export function splitSpaceBatch(line: string): string[] {
  const words = line.trim().split(/\s+/);
  if (words.length <= 1) return words.filter(Boolean);

  type TokType = "NUM" | "NUM_UNIT" | "NUM_CURR" | "UNIT" | "CURRENCY" | "PREP" | "WORD";
  interface ParsedTok {
    type: TokType;
    raw: string;
  }

  const parsed: ParsedTok[] = [];
  for (const w of words) {
    const cleanW = w.toLowerCase().replace(/^[,;.]+|[,;.]+$/g, "");
    if (/^\d+(?:[.,]\d+)?$/.test(cleanW)) {
      parsed.push({ type: "NUM", raw: w });
    } else {
      const m = cleanW.match(/^(\d+(?:[.,]\d+)?)([a-zA-Z\u0400-\u04FF]+)$/);
      if (m) {
        const suffix = m[2];
        if (UNIT_MAP[suffix]) {
          parsed.push({ type: "NUM_UNIT", raw: w });
        } else if (CURRENCIES.has(suffix)) {
          parsed.push({ type: "NUM_CURR", raw: w });
        } else {
          parsed.push({ type: "WORD", raw: w });
        }
      } else if (PRICE_PREPOSITIONS.has(cleanW)) {
        parsed.push({ type: "PREP", raw: w });
      } else if (CURRENCIES.has(cleanW)) {
        parsed.push({ type: "CURRENCY", raw: w });
      } else if (UNIT_MAP[cleanW]) {
        parsed.push({ type: "UNIT", raw: w });
      } else {
        parsed.push({ type: "WORD", raw: w });
      }
    }
  }

  const items: string[] = [];
  let currentTokens: string[] = [];
  let hasLeadingNum = false;
  let hasName = false;
  let hasTrailingNum = false;
  let hasUnit = false;

  for (let i = 0; i < parsed.length; i++) {
    const tok = parsed[i];
    let splitHere = false;

    if (currentTokens.length > 0) {
      if ((hasTrailingNum || (hasName && hasUnit)) && tok.type === "WORD") {
        splitHere = true;
      } else if (hasLeadingNum && hasName && (tok.type === "NUM" || tok.type === "NUM_UNIT")) {
        splitHere = true;
      }
    }

    if (splitHere) {
      items.push(currentTokens.join(" "));
      currentTokens = [];
      hasLeadingNum = false;
      hasName = false;
      hasTrailingNum = false;
      hasUnit = false;
    }

    currentTokens.push(tok.raw);
    if (tok.type === "NUM" || tok.type === "NUM_UNIT") {
      if (!hasName) {
        hasLeadingNum = true;
      } else {
        hasTrailingNum = true;
      }
      if (tok.type === "NUM_UNIT") {
        hasUnit = true;
      }
    } else if (tok.type === "UNIT") {
      hasUnit = true;
    } else if (tok.type === "WORD") {
      hasName = true;
    }
  }

  if (currentTokens.length > 0) {
    items.push(currentTokens.join(" "));
  }

  return items;
}

/**
 * Parses user input deterministically.
 * Supports:
 * - "Pomidor 10" -> Pomidor, qty: 1, unit: шт, price: 10,000 UZS
 * - "bodring 10" -> Bodring, qty: 1, unit: шт, price: 10,000 UZS
 * - "Qalamir 5" -> Qalamir, qty: 1, unit: шт, price: 5,000 UZS
 * - "Pomidor 2kg" -> Pomidor, qty: 2, unit: кг, price: null
 * - "Pomidor 2 kg" -> Pomidor, qty: 2, unit: кг, price: null
 * - "Pomidor 500g" -> Pomidor, qty: 500, unit: г, price: null
 * - "Suv 2l" -> Suv, qty: 2, unit: л, price: null
 * - "Yogurt 4 dona" -> Yogurt, qty: 4, unit: шт, price: null
 * - "Pomidor 18000" -> Pomidor, price: 18,000 UZS
 * - "Pomidor 18k" -> Pomidor, price: 18,000 UZS
 * - "Pomidor 2kg 18000" -> Pomidor, qty: 2, unit: кг, price: 18,000 UZS
 * - "10 яиц" -> Яйца, qty: 10, unit: шт
 * - "10kg pomidor" -> Pomidor, qty: 10, unit: кг
 * - "молоко 2 бутылки" -> Молоко, qty: 2, unit: бут
 * - "2 молока" -> Молоко, qty: 2, unit: шт
 * - Batch: "Молоко 2л, яйца 10шт, хлеб"
 * - Space batch: "Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5"
 * - Multiline input
 */
export function parseShoppingTextDeterministically(text: string): AIParsedItem[] {
  if (!text || !text.trim()) return [];

  const results: AIParsedItem[] = [];

  // Split lines or delimiters (newlines, commas, semicolons)
  const rawLines = text
    .split(/[\r\n;,]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Pre-tokenize space-delimited batch lines
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const subLines = splitSpaceBatch(rawLine);
    lines.push(...subLines);
  }

  for (const line of lines) {
    // Strip bullet points or numbered lists: "1.", "1)", "-", "•", "*"
    let clean = line.replace(/^(?:\d+[\.\)]|[\-•*+])\s*/, "").trim();
    if (!clean) continue;

    // Check for explicit currency or 'k' notation: "18k", "18к", "18 000 сум", "18000 uzs", "15 тыс"
    let explicitPrice: number | null = null;
    const kMatch = clean.match(/(?:(?:за|по|price)\s+)?(\d+(?:[.,]\d+)?)\s*(?:k|к|тыс)\b/i);
    if (kMatch) {
      explicitPrice = parseFloat(kMatch[1].replace(",", ".")) * 1000;
      clean = (clean.slice(0, kMatch.index) + " " + clean.slice(kMatch.index! + kMatch[0].length)).trim();
    } else {
      let priceWithUnitMatch = clean.match(/(?:за|по|price)\s+(\d+(?:[\s.,]\d+)?)(?:\s*(?:сум|sum|uzs|руб|rub|\$|евро|eur))?\b/i);
      if (!priceWithUnitMatch) {
        priceWithUnitMatch = clean.match(/(\d+(?:[\s.,]\d+)?)\s*(?:сум|sum|uzs|руб|rub|\$|евро|eur)\b/i);
      }
      if (priceWithUnitMatch) {
        const rawNum = priceWithUnitMatch[1].replace(/\s+/g, "").replace(",", ".");
        explicitPrice = parseFloat(rawNum);
        clean = (clean.slice(0, priceWithUnitMatch.index) + " " + clean.slice(priceWithUnitMatch.index! + priceWithUnitMatch[0].length)).trim();
      }
    }

    // Pattern 1a: Leading quantity with recognized unit: "10kg pomidor", "2 л молока"
    const leadingWithUnit = clean.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z\u0400-\u04FF]{1,6})\s+([a-zA-Z\u0400-\u04FF\s'-]+)$/);
    if (leadingWithUnit) {
      const u = leadingWithUnit[2].toLowerCase();
      if (UNIT_MAP[u]) {
        const qty = parseFloat(leadingWithUnit[1].replace(",", "."));
        const rawName = leadingWithUnit[3].trim();
        results.push(createParsedItem(rawName, qty, normalizeUnit(u), explicitPrice, 0.95));
        continue;
      }
    }

    // Pattern 1b: Leading quantity without unit: "10 яиц", "2 молока"
    const leadingNoUnit = clean.match(/^(\d+(?:[.,]\d+)?)\s+([a-zA-Z\u0400-\u04FF\s'-]+)$/);
    if (leadingNoUnit) {
      const qty = parseFloat(leadingNoUnit[1].replace(",", "."));
      const rawName = leadingNoUnit[2].trim();
      results.push(createParsedItem(rawName, qty, "шт", explicitPrice, 0.94));
      continue;
    }

    // Pattern 2: Name + Quantity + Unit + Price
    // Example: "Pomidor 2kg 18000", "Pomidor 2 kg 18 000", "Помидор 2 кг 15000"
    const patternFull = clean.match(/^([a-zA-Z\u0400-\u04FF\s'-]+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z\u0400-\u04FF]{1,6})\s+(\d+(?:[\s.,]\d+)?)$/);
    if (patternFull) {
      const rawName = patternFull[1].trim();
      const qty = parseFloat(patternFull[2].replace(",", "."));
      const unitCand = patternFull[3].toLowerCase();
      const rawPrice = parseFloat(patternFull[4].replace(/\s+/g, "").replace(",", "."));
      if (rawName && UNIT_MAP[unitCand]) {
        const finalPrice = explicitPrice ?? (rawPrice < 1000 ? rawPrice * 1000 : rawPrice);
        results.push(createParsedItem(rawName, qty, normalizeUnit(unitCand), finalPrice, 0.96));
        continue;
      }
    }

    // Pattern 3: Name + Quantity + Unit (without price)
    // Example: "Pomidor 2kg", "Pomidor 2 kg", "Suv 2l", "Yogurt 4 dona", "Молоко 2 л"
    const patternQtyUnit = clean.match(/^([a-zA-Z\u0400-\u04FF\s'-]+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z\u0400-\u04FF]{1,6})$/);
    if (patternQtyUnit) {
      const rawName = patternQtyUnit[1].trim();
      const qty = parseFloat(patternQtyUnit[2].replace(",", "."));
      const unitCandidate = patternQtyUnit[3].toLowerCase();
      if (UNIT_MAP[unitCandidate]) {
        results.push(createParsedItem(rawName, qty, normalizeUnit(unitCandidate), explicitPrice, 0.95));
        continue;
      }
    }

    // Pattern 4: Name + Bare Number (Enforces Critical Bare Number Rule)
    // Example: "Pomidor 10", "bodring 10", "Baqlajon 10", "Qalamir 5", "Pomidor 18000"
    const patternNamePrice = clean.match(/^([a-zA-Z\u0400-\u04FF\s'-]+?)\s*[-:]?\s*(\d+(?:[\s.,]\d+)?)$/);
    if (patternNamePrice) {
      const rawName = patternNamePrice[1].trim();
      const rawNum = parseFloat(patternNamePrice[2].replace(/\s+/g, "").replace(",", "."));
      if (rawName) {
        const finalPrice = explicitPrice ?? interpretBareNumber(rawNum);
        results.push(createParsedItem(rawName, 1.0, "шт", finalPrice, 0.93));
        continue;
      }
    }

    // Pattern 5: Plain Item Name
    // Example: "Хлеб", "Pomidor", "Milk"
    const rawName = clean.replace(/[-:]+$/, "").trim();
    if (rawName) {
      results.push(createParsedItem(rawName, 1.0, "шт", explicitPrice, 0.88));
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
  const canonicalName = normalizeCanonicalName(rawName);
  return {
    name: canonicalName,
    quantity: Math.max(0.01, quantity),
    unit: unit || "шт",
    category: detectCategory(canonicalName),
    estimated_price: price && price > 0 ? price : null,
    confidence,
  };
}

/**
 * Calculates totals deterministically:
 * line_total = quantity * unit_price
 * grand_total = sum(line_total)
 */
export function calculateTotals(items: { quantity: number; estimated_price?: number | null; unit_price?: number | null }[]) {
  const count = items.length;
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
