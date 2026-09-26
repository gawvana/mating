import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, generateUUID } from "../api/client";
import { formatCurrency } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { detectCategory, parseShoppingTextDeterministically } from "../utils/localParser";

interface RecipeTemplate {
  id: string;
  title: string;
  uzTitle: string;
  icon: string;
  items: Array<{ name: string; quantity: number; unit: string; category: string; price: number | null }>;
}

const RECIPES: RecipeTemplate[] = [
  {
    id: "plov",
    title: "Плов",
    uzTitle: "Osh / Palov",
    icon: "🥘",
    items: [
      { name: "Рис лазер", quantity: 1, unit: "кг", category: "Бакалея", price: 24000 },
      { name: "Говядина мякоть", quantity: 1, unit: "кг", category: "Мясо и рыба", price: 95000 },
      { name: "Желтая морковь", quantity: 1, unit: "кг", category: "Овощи и фрукты", price: 7000 },
      { name: "Лук репчатый", quantity: 0.5, unit: "кг", category: "Овощи и фрукты", price: 3000 },
      { name: "Масло хлопковое/подсолнечное", quantity: 0.3, unit: "л", category: "Бакалея", price: 6000 },
      { name: "Зира", quantity: 1, unit: "упак", category: "Бакалея", price: 4000 },
      { name: "Чеснок", quantity: 2, unit: "шт", category: "Овощи и фрукты", price: 5000 },
    ],
  },
  {
    id: "breakfast",
    title: "Завтрак",
    uzTitle: "Nonushta",
    icon: "🍳",
    items: [
      { name: "Яйца", quantity: 10, unit: "шт", category: "Бакалея", price: 16000 },
      { name: "Молоко 3.2%", quantity: 1, unit: "л", category: "Молочные продукты", price: 12000 },
      { name: "Хлеб тостовый", quantity: 1, unit: "шт", category: "Хлеб и выпечка", price: 6000 },
      { name: "Сливочное масло 82%", quantity: 1, unit: "упак", category: "Молочные продукты", price: 22000 },
      { name: "Сыр твердый", quantity: 250, unit: "г", category: "Молочные продукты", price: 28000 },
    ],
  },
  {
    id: "borscht",
    title: "Борщ",
    uzTitle: "Borsh",
    icon: "🍲",
    items: [
      { name: "Свекла", quantity: 0.5, unit: "кг", category: "Овощи и фрукты", price: 4000 },
      { name: "Капуста белокочанная", quantity: 1, unit: "кг", category: "Овощи и фрукты", price: 5000 },
      { name: "Картофель", quantity: 1, unit: "кг", category: "Овощи и фрукты", price: 6000 },
      { name: "Говядина на кости", quantity: 0.8, unit: "кг", category: "Мясо и рыба", price: 72000 },
      { name: "Морковь", quantity: 0.4, unit: "кг", category: "Овощи и фрукты", price: 3000 },
      { name: "Томатная паста", quantity: 1, unit: "упак", category: "Бакалея", price: 9000 },
      { name: "Сметана", quantity: 1, unit: "упак", category: "Молочные продукты", price: 11000 },
    ],
  },
  {
    id: "frequent",
    title: "Частые покупки",
    uzTitle: "Doimiy xaridlar",
    icon: "🥛",
    items: [
      { name: "Вода питьевая 5л", quantity: 1, unit: "шт", category: "Напитки", price: 8000 },
      { name: "Молоко", quantity: 1, unit: "л", category: "Молочные продукты", price: 12000 },
      { name: "Хлеб лепешка", quantity: 2, unit: "шт", category: "Хлеб и выпечка", price: 6000 },
      { name: "Яйца", quantity: 10, unit: "шт", category: "Бакалея", price: 16000 },
    ],
  },
];

type AIIntent = "add" | "delete" | "clear_purchased";

interface ParsedActionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price: number | null;
  selected: boolean;
}

export const AIScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const currency = useAppStore((s) => s.currency);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const showUndoToast = useAppStore((s) => s.showUndoToast);
  const aiPersonality = useAppStore((s) => s.aiPersonality);

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<AIIntent>("add");
  const [previewItems, setPreviewItems] = useState<ParsedActionItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Existing items in list for delete/update matching
  const { data: currentItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const handleInterpret = async (textToParse?: string) => {
    const raw = (textToParse !== undefined ? textToParse : input).trim();
    if (!raw) return;

    setIsProcessing(true);
    setStatusMessage(null);
    if (hapticsEnabled) triggerHaptic("medium");

    const lower = raw.toLowerCase();

    // Check command intents
    if (
      lower.includes("очисти купленное") ||
      lower.includes("очистить купленные") ||
      lower.includes("tozala") ||
      lower.includes("clear purchased")
    ) {
      setDetectedIntent("clear_purchased");
      setPreviewItems([]);
      setStatusMessage(
        language === "uz"
          ? "Olingan mahsulotlarni o'chirish tayyor"
          : language === "en"
          ? "Ready to clear purchased items"
          : "Готово к удалению всех купленных товаров"
      );
      setIsProcessing(false);
      return;
    }

    // Check delete intent
    const isDelete =
      lower.startsWith("удали ") ||
      lower.startsWith("убери ") ||
      lower.startsWith("o'chir ") ||
      lower.startsWith("delete ") ||
      lower.startsWith("remove ");

    if (isDelete) {
      setDetectedIntent("delete");
      const targetQuery = lower
        .replace(/^(удали|убери|o'chir|delete|remove)\s+/i, "")
        .trim();
      const matched = currentItems.filter((it) =>
        it.name.toLowerCase().includes(targetQuery)
      );

      if (matched.length > 0) {
        setPreviewItems(
          matched.map((it) => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            category: it.category,
            price: it.price,
            selected: true,
          }))
        );
        setStatusMessage(
          language === "uz"
            ? `O'chirish uchun topildi: ${matched.length} ta`
            : language === "en"
            ? `Found for deletion: ${matched.length} items`
            : `Найдено для удаления: ${matched.length}`
        );
      } else {
        setPreviewItems([]);
        setStatusMessage(
          language === "uz"
            ? `"${targetQuery}" ro'yxatda topilmadi`
            : language === "en"
            ? `"${targetQuery}" not found in current list`
            : `Товар "${targetQuery}" не найден в вашем списке`
        );
      }
      setIsProcessing(false);
      return;
    }

    // Default intent: ADD
    setDetectedIntent("add");
    let parsed = parseShoppingTextDeterministically(raw);

    // If local parser returned nothing and Telegram webview is active, fallback to Gemini
    if ((!parsed || parsed.length === 0) && raw.length > 3) {
      try {
        const resp = await api.parseAI(raw);
        if (resp && resp.items && resp.items.length > 0) {
          parsed = resp.items;
        }
      } catch {}
    }

    if (!parsed || parsed.length === 0) {
      parsed = [
        {
          name: raw,
          quantity: 1,
          unit: "шт",
          category: detectCategory(raw),
          estimated_price: null,
          confidence: 0.5,
        },
      ];
    }

    const items: ParsedActionItem[] = parsed.map((p) => ({
      id: generateUUID(),
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      category: p.category,
      price: p.estimated_price,
      selected: true,
    }));

    setPreviewItems(items);
    setStatusMessage(
      language === "uz"
        ? `Aniqlangan mahsulotlar: ${items.length} ta`
        : language === "en"
        ? `Recognized ${items.length} items`
        : `Распознано позиций: ${items.length}`
    );
    setIsProcessing(false);
  };

  const handleApply = async () => {
    if (hapticsEnabled) triggerHaptic("medium");

    if (detectedIntent === "clear_purchased") {
      await api.clearPurchased();
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast("clear", "Купленные очищены");
      setActiveTab("list");
      return;
    }

    const selected = previewItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    if (detectedIntent === "delete") {
      for (const item of selected) {
        await api.deleteItem(item.id);
      }
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(selected[0].id, `Удалено ${selected.length} поз.`);
      setActiveTab("list");
      return;
    }

    // Add intent: batch create
    const payloads = selected.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
      price: i.price,
      currency_code: currency,
    }));

    await api.batchCreateItems(payloads);
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    showUndoToast(selected[0].id, `Добавлено ${selected.length} поз.`);
    setActiveTab("list");
  };

  const handleSelectRecipe = (r: RecipeTemplate) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setDetectedIntent("add");
    setPreviewItems(
      r.items.map((i) => ({
        id: generateUUID(),
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        price: i.price,
        selected: true,
      }))
    );
    setStatusMessage(
      language === "uz"
        ? `"${r.uzTitle}" to'plami tanlandi`
        : `Набор "${r.title}" готов к добавлению`
    );
  };

  const toggleItemSelection = (id: string) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setPreviewItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const selectedCount = previewItems.filter((i) => i.selected).length;
  const estimatedCost = previewItems
    .filter((i) => i.selected && i.price)
    .reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0);

  return (
    <div className="ai-screen wrap" role="main" aria-label="AI Ассистент">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-badge-chip">
          <span className="ai-sparkle">✦</span>
          <span>Mating AI Assistant</span>
          <span className="ai-personality-badge">{aiPersonality}</span>
        </div>
        <h1 className="ai-title">Умный помощник</h1>
        <p className="ai-subtitle">
          {language === "uz"
            ? "Ovozli yoki oddiy matn orqali ro'yxatni boshqaring"
            : language === "en"
            ? "Manage your shopping list with natural language"
            : "Добавляйте списки, рецепты или удаляйте товары текстом"}
        </p>
      </div>

      {/* Natural Language Prompt Input */}
      <div className="ai-input-card glass">
        <textarea
          className="ai-textarea"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === "uz"
              ? "Masalan: 2kg pomidor, 1l sut, go'sht 1kg\nyoki: 'o'chir sut', 'tozala'"
              : language === "en"
              ? "E.g.: 2kg tomatoes, 1l milk, bread\nor: 'remove milk', 'clear purchased'"
              : "Например: помидоры 2кг, рис 1кг, молоко 10\nили: 'удали молоко', 'очисти купленное'"
          }
        />
        <div className="ai-input-footer">
          <span className="ai-hint">Bare number = narx mingda (bodring 10 = 10,000)</span>
          <button
            className="ai-interpret-btn"
            disabled={!input.trim() || isProcessing}
            onClick={() => handleInterpret()}
          >
            {isProcessing ? "Обработка..." : "Распознать ✦"}
          </button>
        </div>
      </div>

      {/* Fast Recipe Chips */}
      <div className="ai-recipes-section">
        <div className="ai-section-title">
          <span>{language === "uz" ? "Tezkor to'plamlar" : "Быстрые наборы и рецепты"}</span>
        </div>
        <div className="ai-recipes-scroll">
          {RECIPES.map((r) => (
            <button
              key={r.id}
              className="ai-recipe-chip glass press"
              onClick={() => handleSelectRecipe(r)}
            >
              <span className="recipe-icon">{r.icon}</span>
              <span className="recipe-name">
                {language === "uz" ? r.uzTitle : r.title}
              </span>
              <span className="recipe-count">+{r.items.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status or Error Message */}
      {statusMessage && (
        <div className="ai-status-banner glass">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Interactive Preview Card before Apply */}
      {previewItems.length > 0 && (
        <div className="ai-preview-card glass">
          <div className="ai-preview-header">
            <div className="preview-badges">
              {detectedIntent === "add" && (
                <span className="intent-badge add">+ {selectedCount} к добавлению</span>
              )}
              {detectedIntent === "delete" && (
                <span className="intent-badge delete">× {selectedCount} к удалению</span>
              )}
            </div>

            {estimatedCost > 0 && (
              <span className="preview-total">
                ~{formatCurrency(estimatedCost, currency, language)}
              </span>
            )}
          </div>

          <div className="ai-preview-list">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className={`ai-preview-row ${item.selected ? "selected" : "deselected"}`}
                onClick={() => toggleItemSelection(item.id)}
              >
                <div className={`preview-checkbox ${item.selected ? "checked" : ""}`}>
                  {item.selected && (
                    <svg viewBox="0 0 24 24">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>

                <div className="preview-item-info">
                  <span className="preview-item-name">{item.name}</span>
                  <span className="preview-item-meta">
                    {item.quantity} {item.unit} • {item.category}
                  </span>
                </div>

                {item.price ? (
                  <span className="preview-item-price">
                    {formatCurrency(item.price * item.quantity, currency, language)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="ai-preview-actions">
            <button
              className="ai-apply-btn"
              disabled={selectedCount === 0}
              onClick={handleApply}
            >
              {detectedIntent === "delete"
                ? `Удалить выбранное (${selectedCount})`
                : `Применить (${selectedCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Clear purchased direct confirm card */}
      {detectedIntent === "clear_purchased" && (
        <div className="ai-clear-card glass">
          <p>Будет удалено все ранее купленное из текущего списка.</p>
          <button className="ai-danger-btn" onClick={handleApply}>
            Очистить купленные
          </button>
        </div>
      )}
    </div>
  );
};
