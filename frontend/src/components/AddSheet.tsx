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

  // Atomic selectors for zero unnecessary re-renders
  const isSheetOpen = useAppStore((s) => s.isSheetOpen);
  const closeSheet = useAppStore((s) => s.closeSheet);
  const sheetMode = useAppStore((s) => s.sheetMode);
  const setSheetMode = useAppStore((s) => s.setSheetMode);
  const sheetInitialText = useAppStore((s) => s.sheetInitialText);
  const editingItem = useAppStore((s) => s.editingItem);
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const autoCategory = useAppStore((s) => s.autoCategory);

  const t = translations[language];

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const appElementRef = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef<number>(400);

  const dragStartY = useRef<number | null>(null);
  const dragStartTime = useRef<number>(0);
  const currentDragY = useRef<number>(0);
  const lastMoveY = useRef<number>(0);
  const lastMoveTime = useRef<number>(0);
  const pointerVelocityY = useRef<number>(0);

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

  // Sync editing item or reset on open
  useEffect(() => {
    if (isSheetOpen) {
      if (editingItem) {
        setName(editingItem.name || "");
        setQuantity(String(editingItem.quantity || 1));
        setUnit(editingItem.unit || "шт");
        setCategory(editingItem.category || "Овощи и фрукты");
        setPrice(editingItem.price ? String(editingItem.price) : "");
        setAiError(null);
      } else {
        setName("");
        setQuantity("1");
        setUnit("шт");
        setPrice("");
        setAiError(null);
      }
    }
  }, [isSheetOpen, editingItem]);

  // Auto category detection
  useEffect(() => {
    if (autoCategory && !editingItem && name.trim().length >= 3) {
      const detected = detectCategory(name);
      if (detected && detected !== "Другое") {
        setCategory(detected);
      }
    }
  }, [name, autoCategory, editingItem]);

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

  // Stepper handlers
  const handleQuantityStep = (delta: number) => {
    if (hapticsEnabled) triggerHaptic("selection");
    const current = parseFloat(quantity) || 1;
    const next = Math.max(0.5, current + delta);
    setQuantity(String(Math.round(next * 10) / 10));
  };

  // Quick save mutation (handles both create and edit)
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const numQty = parseFloat(quantity) || 1;
      const numPrice = price.trim() ? parseFloat(price.replace(",", ".")) : null;

      if (editingItem) {
        return api.updateItem(editingItem.id, editingItem.version, {
          name: cleanName,
          quantity: numQty,
          unit,
          category,
          price: numPrice && numPrice > 0 ? numPrice : null,
        });
      }

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
      alert(err.message || "Ошибка при сохранении товара");
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

  // Pointer drag with GPU-composited scrim opacity (NO app.style.filter!)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartY.current = e.clientY;
    dragStartTime.current = e.timeStamp;
    lastMoveY.current = e.clientY;
    lastMoveTime.current = performance.now();
    pointerVelocityY.current = 0;
    currentDragY.current = 0;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const sheet = sheetRef.current;
    if (sheet) {
      sheetHeightRef.current = sheet.offsetHeight || 400; // Measure once
      sheet.style.transition = "none";
      sheet.style.willChange = "transform";
    }

    appElementRef.current = document.getElementById("app");
    if (appElementRef.current) {
      appElementRef.current.style.transition = "none";
    }

    if (scrimRef.current) {
      scrimRef.current.style.transition = "none";
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = e.clientY - dragStartY.current;
    currentDragY.current = dy;

    // Track instantaneous velocity
    const now = performance.now();
    const dt = now - lastMoveTime.current;
    if (dt > 16) {
      pointerVelocityY.current = (e.clientY - lastMoveY.current) / dt;
      lastMoveY.current = e.clientY;
      lastMoveTime.current = now;
    }

    const sheet = sheetRef.current;
    const app = appElementRef.current;
    const scrim = scrimRef.current;
    const h = sheetHeightRef.current;

    // Asymptotic resistance if dragging upward past top edge
    let effectiveY = dy;
    if (dy < 0) {
      const over = -dy;
      effectiveY = -((over * 40) / (over + 40));
    }

    const p = Math.max(0, Math.min(1, effectiveY / h));

    sheet.style.transform = `translate(-50%, ${effectiveY}px)`;

    if (app) {
      const scale = 0.93 + 0.07 * p;
      const translateY = 12 * (1 - p);
      app.style.transform = `scale(${scale}) translateY(${translateY}px)`;
      // app.style.filter is ELIMINATED!
    }

    if (scrim) {
      scrim.style.opacity = String(0.45 * (1 - p));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = currentDragY.current;
    const vy = pointerVelocityY.current;
    dragStartY.current = null;

    const sheet = sheetRef.current;
    const app = appElementRef.current;
    const scrim = scrimRef.current;

    if (sheet) {
      sheet.style.willChange = "";
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    if (app) {
      app.style.transition = "";
      app.style.transform = "";
    }
    if (scrim) {
      scrim.style.transition = "";
      scrim.style.opacity = "";
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Dismiss if dragged down far enough or flicked with downward velocity
    if (dy > 110 || vy > 0.55) {
      closeSheet();
    }
  };

  const sheetTitle = editingItem ? "Изменить товар" : (sheetMode === "quick" ? t.addTitle : t.aiTab);
  const submitBtnText = saveItemMutation.isPending
    ? "Сохранение..."
    : editingItem
    ? "Сохранить изменения"
    : t.addTitle;

  return (
    <>
      {/* Scrim with GPU-composited opacity */}
      <div
        ref={scrimRef}
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
        aria-label={sheetTitle}
      >
        {/* Drag Handle with real-time iOS physics */}
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
        <h3>{sheetTitle}</h3>

        {/* Mode Segmented Control: hidden when editing a specific item */}
        {!editingItem && (
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
        )}

        {/* ── QUICK ADD / EDIT TAB ── */}
        {(sheetMode === "quick" || editingItem) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveItemMutation.mutate();
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

            {/* Category Selector */}
            <div className="field-group">
              <label className="field-label">{t.category}</label>
              <div className="cat-chip-grid">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${category === c ? "on" : ""}`}
                    onClick={() => {
                      if (hapticsEnabled) triggerHaptic("selection");
                      setCategory(c);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Input */}
            <div className="field-group">
              <label className="field-label">
                {t.price} ({language === "uz" ? "so'm" : "сум"})
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="text-input"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Line Total Preview */}
            {quickLineTotal !== null && quickLineTotal > 0 && (
              <div className="line-total-preview">
                <span>{t.estimatedTotal}:</span>
                <b>{formatCurrency(quickLineTotal, "UZS", language)}</b>
              </div>
            )}

            {/* Add / Save Button */}
            <button
              type="submit"
              className="btn press"
              disabled={!name.trim() || saveItemMutation.isPending}
              style={{ marginTop: 16 }}
            >
              {submitBtnText}
            </button>
          </form>
        )}

        {/* ── AI ADD TAB (Only when not editing) ── */}
        {sheetMode === "ai" && !editingItem && (
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
