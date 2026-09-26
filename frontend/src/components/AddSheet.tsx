import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { AIParsedItem } from "../types";
import { calculateTotals, detectCategory, parseShoppingTextDeterministically } from "../utils/localParser";

const UNITS = ["шт", "кг", "г", "л", "мл", "упак"];

const CATEGORIES = [
  "Овощи и фрукты",
  "Молочные продукты",
  "Мясо и рыба",
  "Бакалея",
  "Хлеб и выпечка",
  "Напитки",
  "Сладости",
  "Хозтовары",
  "Другое",
];

export const AddSheet: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    isSheetOpen,
    closeSheet,
    sheetMode,
    setSheetMode,
    sheetInitialText,
    language,
    hapticsEnabled,
    autoCategory,
  } = useAppStore();
  const t = translations[language];

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartTime = useRef<number>(0);
  const currentDragY = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick Add Form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("шт");
  const [category, setCategory] = useState("Овощи и фрукты");
  const [price, setPrice] = useState("");

  // AI Parser Form state
  const [aiText, setAiText] = useState("");
  const [parsedItems, setParsedItems] = useState<AIParsedItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Segment index: 0 = quick, 1 = ai
  const segIdx = sheetMode === "quick" ? 0 : 1;

  // Sync initial text from store
  useEffect(() => {
    if (sheetInitialText) {
      setAiText(sheetInitialText);
      setSheetMode("ai");
    }
  }, [sheetInitialText, setSheetMode]);

  // Auto category detection
  useEffect(() => {
    if (autoCategory && name.trim().length >= 3) {
      const detected = detectCategory(name);
      if (detected && detected !== "Другое") {
        setCategory(detected);
      }
    }
  }, [name, autoCategory]);

  // Focus trap, Escape key, and inert management
  useEffect(() => {
    if (!isSheetOpen) return;

    const appEl = document.getElementById("app");
    const dockEl = document.getElementById("dock");

    if (appEl) (appEl as any).inert = true;
    if (dockEl) (dockEl as any).inert = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSheet();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute("disabled") && n.offsetParent !== null);

        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      const input = sheetRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input[type='text'], textarea");
      input?.focus();
    }, 60);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      if (appEl) (appEl as any).inert = false;
      if (dockEl) (dockEl as any).inert = false;
    };
  }, [isSheetOpen, closeSheet]);

  // Reset state when opening
  useEffect(() => {
    if (isSheetOpen) {
      setName("");
      setQuantity("1");
      setUnit("шт");
      setPrice("");
      setAiError(null);
    }
  }, [isSheetOpen]);

  // Stepper handlers
  const handleQuantityStep = (delta: number) => {
    if (hapticsEnabled) triggerHaptic("selection");
    const current = parseFloat(quantity) || 1;
    const next = Math.max(0.5, current + delta);
    setQuantity(String(Math.round(next * 10) / 10));
  };

  // Quick add mutation
  const createItemMutation = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const numQty = parseFloat(quantity) || 1;
      const numPrice = price.trim() ? parseFloat(price.replace(",", ".")) : null;

      return api.createItem({
        name: cleanName,
        quantity: numQty,
        unit,
        category,
        price: numPrice && numPrice > 0 ? numPrice : null,
      });
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
    onError: (err: any) => {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка при добавлении товара");
    },
  });

  // Batch add mutation
  const batchCreateMutation = useMutation({
    mutationFn: async (itemsToAdd: AIParsedItem[]) => {
      return api.batchCreateItems(
        itemsToAdd.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.estimated_price,
        }))
      );
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
    onError: (err: any) => {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка при пакетном добавлении товаров");
    },
  });

  // AI text parsing handler
  const handleParseAI = async () => {
    if (!aiText.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAiLoading(true);
    setAiError(null);
    if (hapticsEnabled) triggerHaptic("medium");

    try {
      const localResults = parseShoppingTextDeterministically(aiText);
      if (localResults && localResults.length > 0) {
        setParsedItems(localResults);
        setSelectedIndices(new Set(localResults.map((_, i) => i)));
        setIsAiLoading(false);
        return;
      }

      const resp = await api.parseAI(aiText, controller.signal);
      if (resp.items && resp.items.length > 0) {
        setParsedItems(resp.items);
        setSelectedIndices(new Set(resp.items.map((_, i) => i)));
      } else {
        setAiError("Не удалось распознать товары. Попробуйте написать в формате: Помидоры 15, Огурцы 10");
      }
    } catch (err: any) {
      if (err.name !== "AbortError" && err.code !== "ABORTED") {
        setAiError(err.message || "Ошибка при обращении к AI парсеру");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleParsedItem = (index: number) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const removeParsedItem = (index: number) => {
    if (hapticsEnabled) triggerHaptic("light");
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  };

  // Deterministic totals for preview
  const selectedItems = parsedItems.filter((_, i) => selectedIndices.has(i));
  const previewTotals = calculateTotals(selectedItems);

  // Line total for quick add
  const quickQty = parseFloat(quantity) || 1;
  const quickPrice = price ? parseFloat(price.replace(",", ".")) : null;
  const quickLineTotal = quickPrice ? quickQty * quickPrice : null;

  // Pointer drag to dismiss header (Apple-like real-time background presentation)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartY.current = e.clientY;
    dragStartTime.current = e.timeStamp;
    currentDragY.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const sheet = sheetRef.current;
    const app = document.getElementById("app");
    if (sheet) sheet.style.transition = "none";
    if (app) app.style.transition = "none";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = e.clientY - dragStartY.current;
    currentDragY.current = dy;

    const sheet = sheetRef.current;
    const app = document.getElementById("app");
    const h = sheet.offsetHeight || 400;
    const p = Math.max(0, Math.min(1, dy / h));

    sheet.style.transform = `translate(-50%, ${dy < 0 ? dy * 0.12 : dy}px)`;
    if (app) {
      app.style.transform = `scale(${0.93 + 0.07 * p}) translateY(${12 * (1 - p)}px)`;
      app.style.filter = `brightness(${0.82 + 0.18 * p})`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = currentDragY.current;
    const elapsed = Math.max(1, e.timeStamp - dragStartTime.current);
    const velocity = dy / elapsed;

    const sheet = sheetRef.current;
    const app = document.getElementById("app");
    if (sheet) {
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    if (app) {
      app.style.transition = "";
      app.style.transform = "";
      app.style.filter = "";
    }

    dragStartY.current = null;

    if (dy > 110 || velocity > 0.6) {
      closeSheet();
    }
  };

  return (
    <>
      {/* Scrim */}
      <div
        className={`scrim ${isSheetOpen ? "open" : ""}`}
        onClick={closeSheet}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        ref={sheetRef}
        className={`sheet glass ${isSheetOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.addTitle}
      >
        {/* Drag Handle with real-time iOS scale & brightness presentation */}
        <div
          className="sheet-hd"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="sheet-grab">
            <i />
          </div>
        </div>

        {/* Title */}
        <h3>{t.addTitle}</h3>

        {/* Mode Segmented Control: dual --k and --seg-idx */}
        <div
          className="seg"
          style={
            {
              "--seg-cols": 2,
              "--seg-idx": segIdx,
              "--k": segIdx,
            } as React.CSSProperties
          }
        >
          <i aria-hidden="true" />
          <button
            type="button"
            className={sheetMode === "quick" ? "on" : ""}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setSheetMode("quick");
            }}
          >
            {t.quickTab}
          </button>
          <button
            type="button"
            className={sheetMode === "ai" ? "on" : ""}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setSheetMode("ai");
            }}
          >
            {t.aiTab}
          </button>
        </div>

        {/* ── QUICK ADD TAB ── */}
        {sheetMode === "quick" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createItemMutation.mutate();
            }}
          >
            {/* Product Name Input */}
            <div className="field-group">
              <label className="field-label">{t.itemName}</label>
              <input
                type="text"
                className="text-input"
                placeholder="Например: Помидоры"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quantity Stepper & Unit Selector */}
            <div className="field-group">
              <label className="field-label">{t.quantity}</label>
              <div className="stepper-row">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleQuantityStep(-1)}
                  aria-label="Уменьшить"
                >
                  −
                </button>
                <input
                  type="number"
                  step="any"
                  className="stepper-val"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleQuantityStep(1)}
                  aria-label="Увеличить"
                >
                  +
                </button>
              </div>

              {/* Units */}
              <div className="unit-chip-row">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`unit-chip ${unit === u ? "on" : ""}`}
                    onClick={() => {
                      if (hapticsEnabled) triggerHaptic("selection");
                      setUnit(u);
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Price */}
            <div className="field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="field-label">{t.price}</label>
                {quickLineTotal !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                    Итого: {formatCurrency(quickLineTotal, "UZS", language)}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                className="text-input"
                placeholder="Опционально, например 15000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Category Selector */}
            <div className="field-group">
              <label className="field-label">{t.category}</label>
              <div className="cat-filter-row">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill ${category === cat ? "on" : ""}`}
                    onClick={() => {
                      if (hapticsEnabled) triggerHaptic("selection");
                      setCategory(cat);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Button */}
            <button
              type="submit"
              className="btn press"
              disabled={!name.trim() || createItemMutation.isPending}
              style={{ marginTop: 16 }}
            >
              {createItemMutation.isPending ? "Добавление..." : t.addTitle}
            </button>
          </form>
        )}

        {/* ── AI ADD TAB ── */}
        {sheetMode === "ai" && (
          <div>
            <div className="field-group">
              <label className="field-label">Напишите список текстом (RU, UZ, EN)</label>
              <textarea
                className="text-area"
                rows={4}
                placeholder="Помидоры 2 кг 15000&#10;Огурцы 1 кг 12000&#10;Хлеб 2 шт за 10000"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn tn press"
              onClick={handleParseAI}
              disabled={!aiText.trim() || isAiLoading}
            >
              {isAiLoading ? "Распознавание..." : "Разобрать список"}
            </button>

            {aiError && (
              <div style={{ color: "var(--err)", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                {aiError}
              </div>
            )}

            {/* Parsed Items Preview List */}
            {parsedItems.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                    Найдено ({parsedItems.length})
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}
                    onClick={() => {
                      if (selectedIndices.size === parsedItems.length) {
                        setSelectedIndices(new Set());
                      } else {
                        setSelectedIndices(new Set(parsedItems.map((_, i) => i)));
                      }
                    }}
                  >
                    {selectedIndices.size === parsedItems.length ? "Снять всё" : "Выбрать всё"}
                  </button>
                </div>

                <div className="ai-preview-container">
                  {parsedItems.map((item, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        className={`ai-preview-card ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleParsedItem(idx)}
                      >
                        <div className={`item-check ${isSelected ? "checked" : ""}`}>
                          {isSelected && (
                            <svg viewBox="0 0 24 24">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>

                        <div className="item-body">
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            <span>
                              {item.quantity} {item.unit}
                            </span>
                            <span className="item-tag">{item.category}</span>
                          </div>
                        </div>

                        {item.estimated_price !== null && (
                          <div className="item-price-col">
                            <span className="item-price-val">
                              {formatCurrency(item.quantity * item.estimated_price, "UZS", language)}
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          className="item-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeParsedItem(idx);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Deterministic Grand Total Summary */}
                <div className="ai-preview-total">
                  <span>Выбрано: {previewTotals.count} поз.</span>
                  {previewTotals.hasPrices && (
                    <span>Итого: {formatCurrency(previewTotals.grandTotal, "UZS", language)}</span>
                  )}
                </div>

                {/* Batch Add Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn press"
                    disabled={selectedItems.length === 0 || batchCreateMutation.isPending}
                    onClick={() => batchCreateMutation.mutate(selectedItems)}
                  >
                    {batchCreateMutation.isPending
                      ? "Добавление..."
                      : `Добавить выбранное (${selectedItems.length})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
