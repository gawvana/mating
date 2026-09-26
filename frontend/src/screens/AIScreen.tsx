import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, generateUUID } from "../api/client";
import { formatCurrency } from "../i18n";
import { SmartSortMode, useAppStore } from "../state/useAppStore";
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
      { name: "Зира", quantity: 1, unit: "уп", category: "Бакалея", price: 4000 },
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
      { name: "Сливочное масло 82%", quantity: 1, unit: "уп", category: "Молочные продукты", price: 22000 },
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
      { name: "Томатная паста", quantity: 1, unit: "уп", category: "Бакалея", price: 9000 },
      { name: "Сметана", quantity: 1, unit: "уп", category: "Молочные продукты", price: 11000 },
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

export type AIIntent =
  | "add"
  | "delete"
  | "clear_purchased"
  | "buy"
  | "unbuy"
  | "restore"
  | "sort"
  | "filter"
  | "history"
  | "stats"
  | "repeat"
  | "share";

interface ParsedActionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price: number | null;
  selected: boolean;
  version?: number;
}

export const AIScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const currency = useAppStore((s) => s.currency);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const showUndoToast = useAppStore((s) => s.showUndoToast);
  const setSmartSortMode = useAppStore((s) => s.setSmartSortMode);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setIsSearchOpen = useAppStore((s) => s.setIsSearchOpen);

  // AI runtime settings
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const priceInference = useAppStore((s) => s.priceInference);
  const quantityInference = useAppStore((s) => s.quantityInference);
  const confirmationLevel = useAppStore((s) => s.confirmationLevel);
  const suggestionFrequency = useAppStore((s) => s.suggestionFrequency);
  const aiPersonality = useAppStore((s) => s.aiPersonality);

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<AIIntent>("add");
  const [targetSortMode, setTargetSortMode] = useState<SmartSortMode>("default");
  const [filterQuery, setFilterQuery] = useState("");
  const [previewItems, setPreviewItems] = useState<ParsedActionItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Existing items in list for delete/buy/update matching
  const { data: currentItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  // Suggestion recipes filtered by frequency setting
  const visibleRecipes = useMemo(() => {
    if (suggestionFrequency === "off") return [];
    if (suggestionFrequency === "low") return RECIPES.slice(0, 2);
    if (suggestionFrequency === "normal") return RECIPES.slice(0, 3);
    return RECIPES;
  }, [suggestionFrequency]);

  // Personality-tailored feedback message formatter
  const formatPersonalityMessage = (
    type: "recognized" | "applied" | "deleted" | "bought" | "unbought" | "restored" | "empty",
    count: number = 0,
    extra?: string
  ): string => {
    if (aiPersonality === "concise") {
      switch (type) {
        case "recognized":
          return language === "uz" ? `Topildi: ${count} ta` : `Найдено: ${count} поз.`;
        case "applied":
          return language === "uz" ? `Qo'shildi: ${count}` : `Добавлено: ${count}`;
        case "deleted":
          return language === "uz" ? `O'chirildi: ${count}` : `Удалено: ${count}`;
        case "bought":
          return language === "uz" ? `Belgilandi: ${count}` : `Отмечено купленным: ${count}`;
        case "unbought":
          return language === "uz" ? `Qaytarildi: ${count}` : `Возвращено: ${count}`;
        case "restored":
          return language === "uz" ? `Tiklandi: ${count}` : `Восстановлено: ${count}`;
        case "empty":
          return language === "uz" ? "Topilmadi" : "Ничего не найдено";
      }
    }

    if (aiPersonality === "analytical") {
      switch (type) {
        case "recognized":
          return language === "uz"
            ? `Aniqlangan mahsulotlar: ${count} ta. Tasdiqlang.`
            : `Распознано позиций: ${count}. Подтвердите операцию.`;
        case "applied":
          return language === "uz"
            ? `Muvaffaqiyatli qo'shildi (${count}).`
            : `Операция добавления успешно выполнена (${count}).`;
        case "deleted":
          return language === "uz"
            ? `Muvaffaqiyatli o'chirildi (${count}).`
            : `Позиции успешно удалены из списка (${count}).`;
        case "bought":
          return language === "uz"
            ? `Mahsulotlar sotib olingan deb belgilandi (${count}).`
            : `Товары отмечены как купленные (${count}).`;
        case "unbought":
          return language === "uz"
            ? `Mahsulotlar faol ro'yxatga qaytarildi (${count}).`
            : `Товары возвращены в активный список (${count}).`;
        case "restored":
          return language === "uz"
            ? `O'chirilgan mahsulotlar tiklandi (${count}).`
            : `Ранее удаленные позиции восстановлены (${count}).`;
        case "empty":
          return language === "uz"
            ? `So'rov bo'yicha mahsulotlar topilmadi: ${extra || ""}`
            : `По вашему запросу товары не найдены: ${extra || ""}`;
      }
    }

    // Friendly (default)
    switch (type) {
      case "recognized":
        return language === "uz"
          ? `Ajoyib! ${count} ta mahsulot tayyor ✦`
          : `Отлично! Я нашёл ${count} поз. ✦`;
      case "applied":
        return language === "uz"
          ? `Barchasi ro'yxatga muvaffaqiyatli qo'shildi!`
          : `Всё добавлено в ваш список!`;
      case "deleted":
        return language === "uz"
          ? `Готово, товары убраны из списка!`
          : `Готово, ${count} товаров удалено!`;
      case "bought":
        return language === "uz"
          ? `Zo'r, ${count} ta mahsulot sotib olindi!`
          : `Отлично! ${count} товаров отмечено купленными.`;
      case "unbought":
        return language === "uz"
          ? `${count} ta mahsulot yana ro'yxatda!`
          : `Вернул ${count} товаров в активный список.`;
      case "restored":
        return language === "uz"
          ? `${count} ta mahsulot tiklandi!`
          : `Восстановлено ${count} товаров!`;
      case "empty":
        return language === "uz"
          ? `"${extra || ""}" ro'yxatda topilmadi`
          : `Товар "${extra || ""}" не найден`;
    }
  };

  const handleInterpret = async (textToParse?: string) => {
    if (!aiEnabled) return;

    const raw = (textToParse !== undefined ? textToParse : input).trim();
    if (!raw) return;

    setIsProcessing(true);
    setStatusMessage(null);
    if (hapticsEnabled) triggerHaptic("medium");

    const lower = raw.toLowerCase();

    // 1. Intent: CLEAR_PURCHASED
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

    // 2. Intent: HISTORY
    if (
      lower === "история" ||
      lower === "tarix" ||
      lower === "history" ||
      lower === "архив" ||
      lower.includes("история покупок")
    ) {
      setDetectedIntent("history");
      setPreviewItems([]);
      setStatusMessage(language === "uz" ? "Xaridlar tarixiga o'tish" : "Переход в историю покупок");
      setIsProcessing(false);
      setActiveTab("history");
      return;
    }

    // 3. Intent: STATS
    if (
      lower === "статистика" ||
      lower === "statistika" ||
      lower === "stats" ||
      lower.includes("расходы") ||
      lower.includes("бюджет") ||
      lower.includes("график")
    ) {
      setDetectedIntent("stats");
      setPreviewItems([]);
      setStatusMessage(language === "uz" ? "Statistika bo'limiga o'tish" : "Переход в аналитику");
      setIsProcessing(false);
      setActiveTab("stats");
      return;
    }

    // 4. Intent: SHARE
    if (
      lower.includes("поделись") ||
      lower.includes("поделиться") ||
      lower.includes("ulash") ||
      lower.includes("share") ||
      lower.includes("отправь список")
    ) {
      setDetectedIntent("share");
      setPreviewItems([]);
      setStatusMessage(language === "uz" ? "Ro'yxatni ulashish" : "Поделиться списком");
      setIsProcessing(false);
      setActiveTab("list");
      return;
    }

    // 5. Intent: SORT
    if (
      lower.startsWith("сортируй") ||
      lower.startsWith("сортировка") ||
      lower.startsWith("sarala") ||
      lower.startsWith("sort") ||
      lower.includes("по цене") ||
      lower.includes("по названию")
    ) {
      let mode: SmartSortMode = "default";
      if (lower.includes("цен") || lower.includes("narx") || lower.includes("price")) {
        mode = "price";
      } else if (
        lower.includes("назван") ||
        lower.includes("имен") ||
        lower.includes("nom") ||
        lower.includes("name") ||
        lower.includes("а-я") ||
        lower.includes("a-z")
      ) {
        mode = "name";
      } else if (lower.includes("категор") || lower.includes("bo'lim") || lower.includes("category")) {
        mode = "category";
      } else if (lower.includes("нов") || lower.includes("yangi") || lower.includes("recent")) {
        mode = "recent";
      }

      setDetectedIntent("sort");
      setTargetSortMode(mode);
      setPreviewItems([]);
      setStatusMessage(
        language === "uz"
          ? `Saralash rejimi: ${mode}. Ro'yxatga o'tish uchun bosing.`
          : `Режим сортировки: ${mode}. Нажмите применить для перехода.`
      );
      setIsProcessing(false);
      return;
    }

    // 6. Intent: FILTER
    if (
      lower.startsWith("фильтр") ||
      lower.startsWith("покажи") ||
      lower.startsWith("ko'rsat") ||
      lower.startsWith("filtr") ||
      lower.startsWith("filter")
    ) {
      const q = lower
        .replace(/^(фильтр|покажи|ko'rsat|filtr|filter)\s+/i, "")
        .trim();
      setDetectedIntent("filter");
      setFilterQuery(q);
      setPreviewItems([]);
      setStatusMessage(
        language === "uz"
          ? `Qidiruv va filtr: "${q}". Ro'yxatda ochish.`
          : `Фильтр списка: "${q}". Нажмите применить для перехода.`
      );
      setIsProcessing(false);
      return;
    }

    // 7. Intent: BUY (Mark active item as purchased)
    const isBuy =
      lower.startsWith("купил ") ||
      lower.startsWith("купила ") ||
      lower.startsWith("отметь ") ||
      lower.startsWith("oldim ") ||
      lower.startsWith("sotib oldim ") ||
      lower.startsWith("bought ") ||
      lower.startsWith("check ");

    if (isBuy) {
      setDetectedIntent("buy");
      const targetQuery = lower
        .replace(/^(купил|купила|отметь|oldim|sotib oldim|bought|check)\s+/i, "")
        .replace(/(?:купленным|как купленное)\s*/i, "")
        .trim();

      const matched = currentItems.filter(
        (it) => !it.is_purchased && it.name.toLowerCase().includes(targetQuery)
      );

      if (matched.length > 0) {
        const items = matched.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          version: it.version,
          selected: true,
        }));
        setPreviewItems(items);
        setStatusMessage(formatPersonalityMessage("recognized", items.length));
      } else {
        setPreviewItems([]);
        setStatusMessage(formatPersonalityMessage("empty", 0, targetQuery));
      }
      setIsProcessing(false);
      return;
    }

    // 8. Intent: UNBUY (Unmark purchased item back to active)
    const isUnbuy =
      lower.startsWith("не купил ") ||
      lower.startsWith("не купила ") ||
      lower.startsWith("верни в список ") ||
      lower.startsWith("olmadim ") ||
      lower.startsWith("unbuy ") ||
      lower.startsWith("uncheck ");

    if (isUnbuy) {
      setDetectedIntent("unbuy");
      const targetQuery = lower
        .replace(/^(не купил|не купила|верни в список|olmadim|unbuy|uncheck)\s+/i, "")
        .trim();

      const matched = currentItems.filter(
        (it) => it.is_purchased && it.name.toLowerCase().includes(targetQuery)
      );

      if (matched.length > 0) {
        const items = matched.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          version: it.version,
          selected: true,
        }));
        setPreviewItems(items);
        setStatusMessage(formatPersonalityMessage("recognized", items.length));
      } else {
        setPreviewItems([]);
        setStatusMessage(formatPersonalityMessage("empty", 0, targetQuery));
      }
      setIsProcessing(false);
      return;
    }

    // 9. Intent: RESTORE (Soft-deleted or history items)
    const isRestore =
      lower.startsWith("верни ") ||
      lower.startsWith("восстанови ") ||
      lower.startsWith("qaytar ") ||
      lower.startsWith("restore ");

    if (isRestore) {
      setDetectedIntent("restore");
      const targetQuery = lower
        .replace(/^(верни|восстанови|qaytar|restore)\s+/i, "")
        .trim();

      // Look in soft-deleted items if available, or purchased items
      const candidateItems = currentItems.filter((it) =>
        it.name.toLowerCase().includes(targetQuery)
      );

      if (candidateItems.length > 0) {
        const items = candidateItems.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          version: it.version,
          selected: true,
        }));
        setPreviewItems(items);
        setStatusMessage(formatPersonalityMessage("recognized", items.length));
      } else {
        setPreviewItems([]);
        setStatusMessage(formatPersonalityMessage("empty", 0, targetQuery));
      }
      setIsProcessing(false);
      return;
    }

    // 10. Intent: DELETE
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
        const items = matched.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          version: it.version,
          selected: true,
        }));
        setPreviewItems(items);
        setStatusMessage(formatPersonalityMessage("recognized", items.length));
      } else {
        setPreviewItems([]);
        setStatusMessage(formatPersonalityMessage("empty", 0, targetQuery));
      }
      setIsProcessing(false);
      return;
    }

    // 11. Intent: REPEAT (Recent items)
    if (
      lower.includes("повтори") ||
      lower.includes("takrorla") ||
      lower.includes("repeat") ||
      lower.includes("как в прошлый раз")
    ) {
      setDetectedIntent("repeat");
      const sample = currentItems.slice(0, 4);
      if (sample.length > 0) {
        const items = sample.map((it) => ({
          id: generateUUID(),
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          selected: true,
        }));
        setPreviewItems(items);
        setStatusMessage(formatPersonalityMessage("recognized", items.length));
      } else {
        setPreviewItems([]);
        setStatusMessage(language === "uz" ? "Tarixda mahsulotlar topilmadi" : "История пуста");
      }
      setIsProcessing(false);
      return;
    }

    // 12. Default Intent: ADD
    setDetectedIntent("add");
    let parsed = parseShoppingTextDeterministically(raw);

    // Reachable Gemini fallback if local parser returned nothing or low confidence
    if ((!parsed || parsed.length === 0 || (parsed.length === 1 && (parsed[0].confidence ?? 1) < 0.85)) && raw.length > 3) {
      try {
        const resp = await api.parseAI(raw);
        if (resp && resp.items && resp.items.length > 0) {
          parsed = resp.items;
        }
      } catch {
        // Fallback gracefully to local fallback
      }
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

    // Apply AI runtime settings: priceInference and quantityInference
    const items: ParsedActionItem[] = parsed.map((p) => ({
      id: generateUUID(),
      name: p.name,
      quantity: quantityInference ? p.quantity : 1,
      unit: quantityInference ? p.unit : "шт",
      category: p.category,
      price: priceInference ? p.estimated_price : null,
      selected: true,
    }));

    setPreviewItems(items);
    setStatusMessage(formatPersonalityMessage("recognized", items.length));
    setIsProcessing(false);

    // Apply confirmationLevel setting: "silent" or "destructive_only" applies adds immediately without modal
    if ((confirmationLevel === "silent" || confirmationLevel === "destructive_only") && items.length > 0) {
      await executeApplyAdd(items);
    }
  };

  const executeApplyAdd = async (itemsToAdd: ParsedActionItem[]) => {
    const selected = itemsToAdd.filter((i) => i.selected);
    if (selected.length === 0) return;

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
    showUndoToast(selected[0].id, formatPersonalityMessage("applied", selected.length));
    setActiveTab("list");
  };

  const handleApply = async () => {
    if (hapticsEnabled) triggerHaptic("medium");

    // Clear purchased
    if (detectedIntent === "clear_purchased") {
      await api.clearPurchased();
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast("clear", language === "uz" ? "Olinganlar o'chirildi" : "Купленные очищены");
      setActiveTab("list");
      return;
    }

    // Sort intent
    if (detectedIntent === "sort") {
      setSmartSortMode(targetSortMode);
      setActiveTab("list");
      showUndoToast("sort", language === "uz" ? "Saralash o'rnatildi" : "Сортировка изменена");
      return;
    }

    // Filter intent
    if (detectedIntent === "filter") {
      setSearchQuery(filterQuery);
      setIsSearchOpen(true);
      setActiveTab("list");
      return;
    }

    const selected = previewItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    // Delete intent (parallelized via Promise.all)
    if (detectedIntent === "delete") {
      await Promise.all(selected.map((item) => api.deleteItem(item.id)));
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(selected[0].id, formatPersonalityMessage("deleted", selected.length));
      setActiveTab("list");
      return;
    }

    // Buy intent (mark purchased in parallel)
    if (detectedIntent === "buy") {
      await Promise.all(
        selected.map((item) => api.togglePurchased(item.id, item.version ?? 1))
      );
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(selected[0].id, formatPersonalityMessage("bought", selected.length));
      setActiveTab("list");
      return;
    }

    // Unbuy intent (unmark purchased in parallel)
    if (detectedIntent === "unbuy") {
      await Promise.all(
        selected.map((item) => api.togglePurchased(item.id, item.version ?? 1))
      );
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(selected[0].id, formatPersonalityMessage("unbought", selected.length));
      setActiveTab("list");
      return;
    }

    // Restore intent
    if (detectedIntent === "restore") {
      await Promise.all(
        selected.map((item) => api.restoreItem(item.id))
      );
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(selected[0].id, formatPersonalityMessage("restored", selected.length));
      setActiveTab("list");
      return;
    }

    // Add or Repeat intent: batch create
    await executeApplyAdd(selected);
  };

  const handleSelectRecipe = (r: RecipeTemplate) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setDetectedIntent("add");
    const items = r.items.map((i) => ({
      id: generateUUID(),
      name: i.name,
      quantity: quantityInference ? i.quantity : 1,
      unit: quantityInference ? i.unit : "шт",
      category: i.category,
      price: priceInference ? i.price : null,
      selected: true,
    }));
    setPreviewItems(items);
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

  // If AI is disabled via settings, show clean state with enable prompt
  if (!aiEnabled) {
    return (
      <div className="ai-screen wrap" role="main" aria-label="AI Ассистент">
        <div className="ai-disabled-card glass" style={{ textAlign: "center", padding: "48px 20px", marginTop: 24, borderRadius: "var(--r3)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            {language === "uz" ? "AI Yordamchi o'chirilgan" : "AI Ассистент отключен"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
            {language === "uz"
              ? "Ushbu xususiyatni ishlatish uchun Sozlamalar bo'limidan 'AI Yordamchi'ni yoqing."
              : "Для голосового и естественного текстового управления включите умный помощник в настройках."}
          </p>
          <button
            type="button"
            className="btn press"
            style={{ width: "auto", margin: "0 auto", padding: "0 28px" }}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setActiveTab("settings");
            }}
          >
            {language === "uz" ? "Sozlamalarga o'tish" : "Открыть настройки"}
          </button>
        </div>
      </div>
    );
  }

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
              ? "Masalan: 2kg pomidor, 1l sut, go'sht 1kg\nyoki: 'o'chir sut', 'tozala', 'sarala narx'"
              : language === "en"
              ? "E.g.: 2kg tomatoes, 1l milk, bread\nor: 'remove milk', 'clear purchased', 'sort price'"
              : "Например: помидоры 2кг, рис 1кг, молоко 10\nили: 'удали молоко', 'очисти купленное', 'сортируй по цене'"
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

      {/* Fast Recipe Chips (Filtered by suggestionFrequency) */}
      {visibleRecipes.length > 0 && (
        <div className="ai-recipes-section">
          <div className="ai-section-title">
            <span>{language === "uz" ? "Tezkor to'plamlar" : "Быстрые наборы и рецепты"}</span>
          </div>
          <div className="ai-recipes-scroll">
            {visibleRecipes.map((r) => (
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
      )}

      {/* Status or Error Message */}
      {statusMessage && (
        <div className="ai-status-banner glass">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Direct Apply for Non-Item Intents (Sort, Filter, Share) */}
      {(detectedIntent === "sort" || detectedIntent === "filter" || detectedIntent === "share") && (
        <div className="ai-preview-card glass" style={{ marginTop: 12, textAlign: "center", padding: "16px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>{statusMessage}</p>
          <button className="ai-apply-btn" style={{ width: "auto", margin: "0 auto", padding: "0 28px" }} onClick={handleApply}>
            {language === "uz" ? "O'tish va qo'llash" : "Применить и открыть"}
          </button>
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
              {detectedIntent === "repeat" && (
                <span className="intent-badge add">+ {selectedCount} повторить</span>
              )}
              {detectedIntent === "delete" && (
                <span className="intent-badge delete">× {selectedCount} к удалению</span>
              )}
              {detectedIntent === "buy" && (
                <span className="intent-badge add">✓ {selectedCount} отметить купленным</span>
              )}
              {detectedIntent === "unbuy" && (
                <span className="intent-badge add">↺ {selectedCount} вернуть в список</span>
              )}
              {detectedIntent === "restore" && (
                <span className="intent-badge add">↺ {selectedCount} восстановить</span>
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
                : detectedIntent === "buy"
                ? `Отметить купленным (${selectedCount})`
                : detectedIntent === "unbuy"
                ? `Вернуть в список (${selectedCount})`
                : detectedIntent === "restore"
                ? `Восстановить (${selectedCount})`
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
