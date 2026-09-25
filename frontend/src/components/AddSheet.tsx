import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { AIParsedItem } from "../types";

const UNITS = ["шт", "кг", "л", "уп", "г"];

const CATEGORIES = [
  "Молочные продукты",
  "Овощи и фрукты",
  "Мясо и рыба",
  "Бакалея",
  "Хлеб и выпечка",
  "Напитки",
  "Сладости",
  "Хозтовары",
  "Другое",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Молочные продукты": ["молок", "сыр", "творог", "масло сливоч", "кефир", "сливк", "йогурт", "ряженк", "сметан", "milk", "cheese", "butter", "sut", "qatiq"],
  "Овощи и фрукты": ["яблок", "банан", "огур", "помидор", "томат", "картоф", "морков", "лук", "чеснок", "зелен", "капуст", "салат", "апельсин", "лимон", "ягод", "клубник", "виноград", "перец", "груш", "fruit", "apple", "banana", "olma", "bodring", "pomidor"],
  "Мясо и рыба": ["мяс", "говядин", "свинин", "куриц", "курин", "птиц", "филе", "рыб", "фарш", "колбас", "сосиск", "лосос", "семг", "кревет", "meat", "chicken", "beef", "fish", "go'sht", "baliq"],
  "Бакалея": ["рис", "гречк", "макарон", "паст", "мук", "сахар", "соль", "хлопь", "круп", "масло раст", "овсянк", "консерв", "горох", "фасол", "чечевиц", "rice", "pasta", "flour", "guruch"],
  "Хлеб и выпечка": ["хлеб", "батон", "булоч", "лаваш", "круассан", "буханк", "багет", "лепешк", "тост", "bread", "non"],
  "Напитки": ["сок", "вод", "кола", "чай", "кофе", "пиво", "вино", "лимонад", "минералк", "water", "juice", "tea", "coffee", "suv", "choy"],
  "Сладости": ["шоколад", "конфет", "печень", "торт", "пирож", "мармелад", "морожен", "вафл", "пряник", "sweets", "candy", "cake", "shirinlik"],
  "Хозтовары": ["мыл", "шампун", "паста зуб", "порошок", "салфет", "бумага", "губк", "пакет", "средство", "щетк", "soap"],
};

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

  // Quick Add Form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("шт");
  const [category, setCategory] = useState("Другое");
  const [price, setPrice] = useState("");

  // AI Parser Form state
  const [aiText, setAiText] = useState("");
  const [parsedItems, setParsedItems] = useState<AIParsedItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);

  // Segmented control: 0 = quick, 1 = ai
  const segIdx = sheetMode === "quick" ? 0 : 1;

  // Escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSheetOpen) return;
      if (e.key === "Escape") {
        closeSheet();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
          )
        ).filter((el) => !(el as HTMLButtonElement | HTMLInputElement).disabled && el.offsetParent !== null);
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSheetOpen, closeSheet]);

  // Manage #app / dock inert when sheet opens
  useEffect(() => {
    const appEl = document.getElementById("app");
    const dockEl = document.getElementById("dock");
    if (isSheetOpen) {
      appEl?.setAttribute("inert", "");
      dockEl?.setAttribute("inert", "");
      const timer = setTimeout(() => {
        const inputEl = sheetRef.current?.querySelector<HTMLInputElement>("input[type='text'], textarea");
        inputEl?.focus();
      }, 60);
      return () => clearTimeout(timer);
    } else {
      appEl?.removeAttribute("inert");
      dockEl?.removeAttribute("inert");
      document.getElementById("fab")?.focus();
    }
  }, [isSheetOpen]);

  // Reset form when sheet opens
  useEffect(() => {
    if (isSheetOpen) {
      setName(sheetInitialText || "");
      setQuantity("1");
      setUnit("шт");
      setCategory("Другое");
      setPrice("");
      setAiText(sheetMode === "ai" ? sheetInitialText : "");
      setParsedItems([]);
      setSelectedIndices(new Set());
      setParseError(null);

      // Auto-categorize initial text if provided
      if (autoCategory && sheetInitialText && sheetInitialText.length >= 3) {
        const lower = sheetInitialText.toLowerCase();
        for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some((kw) => lower.includes(kw))) {
            setCategory(cat);
            break;
          }
        }
      }
    }
  }, [isSheetOpen, sheetInitialText, sheetMode, autoCategory]);

  // ── Drag-to-dismiss ────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current) return;
    dragStartY.current = e.clientY;
    dragStartTime.current = e.timeStamp;
    currentDragY.current = 0;
    sheetRef.current.style.transition = "none";
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = e.clientY - dragStartY.current;
    if (dy <= 0) return;
    currentDragY.current = dy;
    sheetRef.current.style.transform = `translate(-50%, ${dy}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const dy = currentDragY.current;
    const dt = Math.max(1, e.timeStamp - dragStartTime.current);
    const velocity = dy / dt;

    dragStartY.current = null;
    sheetRef.current.style.transition = "";
    sheetRef.current.style.transform = "";

    if (dy > 110 || velocity > 0.6) {
      closeSheet();
    }
  };

  // ── Stepper Handlers ───────────────────────────────────────────────────────
  const handleMinus = () => {
    if (hapticsEnabled) triggerHaptic("light");
    const val = parseFloat(quantity) || 1;
    const step = val > 1 && Number.isInteger(val) ? 1 : 0.5;
    const next = Math.max(0.1, Math.round((val - step) * 10) / 10);
    setQuantity(String(next));
  };

  const handlePlus = () => {
    if (hapticsEnabled) triggerHaptic("light");
    const val = parseFloat(quantity) || 0;
    const step = Number.isInteger(val) ? 1 : 0.5;
    const next = Math.round((val + step) * 10) / 10;
    setQuantity(String(next));
  };

  // ── Name Change with Auto-Category ─────────────────────────────────────────
  const handleNameChange = (val: string) => {
    setName(val);
    if (autoCategory && val.trim().length >= 3) {
      const lower = val.toLowerCase();
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
          setCategory(cat);
          break;
        }
      }
    }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () =>
      api.createItem({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1.0,
        unit: unit.trim() || "шт",
        category: category || "Другое",
        price: price.trim() ? parseFloat(price) : null,
      }),
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
  });

  const parseMutation = useMutation({
    mutationFn: async (text: string) => api.parseAI(text),
    onSuccess: (data) => {
      if (hapticsEnabled) triggerHaptic("medium");
      setParseError(null);
      setParsedItems(data.items);
      setSelectedIndices(new Set(data.items.map((_, idx) => idx)));
    },
    onError: () => {
      if (hapticsEnabled) triggerHaptic("error");
      setParseError(t.aiError ?? "Ошибка разбора. Попробуйте ещё раз.");
    },
  });

  const batchAddMutation = useMutation({
    mutationFn: async () => {
      const selected = parsedItems.filter((_, idx) => selectedIndices.has(idx));
      return api.batchCreateItems(
        selected.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.estimated_price,
          raw_input_text: aiText,
        }))
      );
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
  });

  const toggleItemSelection = (index: number) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const removeParsedItem = (index: number) => {
    if (hapticsEnabled) triggerHaptic("light");
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  const handleParseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setParseError(null);
    parseMutation.mutate(aiText);
  };

  return (
    <>
      <div
        className={`scrim ${isSheetOpen ? "open" : ""}`}
        onClick={closeSheet}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className={`sheet glass ${isSheetOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.addTitle}
      >
        {/* Drag handle */}
        <div
          className="sheet-handle-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="sheet-handle" />
        </div>

        <h3 className="sheet-title">{t.addTitle}</h3>

        {/* Mode switch */}
        <div
          className="seg"
          style={{ "--seg-cols": 2, "--seg-idx": segIdx } as React.CSSProperties}
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

        {sheetMode === "quick" ? (
          <form onSubmit={handleQuickSubmit}>
            {/* Product Name Input */}
            <div style={{ marginBottom: 12, position: "relative" }}>
              <input
                className="input-field"
                type="text"
                placeholder={t.itemNamePlaceholder || "Название товара"}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus
                required
                style={{ paddingRight: name ? 36 : 14 }}
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: 16,
                    padding: 4,
                    cursor: "pointer",
                  }}
                  aria-label="Очистить"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Stepper + Canonical Unit Segmented Control */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <div className="stepper" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={handleMinus}
                  aria-label="Уменьшить"
                >
                  −
                </button>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  className="stepper-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-label={t.quantity}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={handlePlus}
                  aria-label="Увеличить"
                >
                  +
                </button>
              </div>

              <div className="unit-seg" style={{ flex: 1 }}>
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`unit-btn ${unit === u ? "on" : ""}`}
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

            {/* Category Chips Row */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t.category}
              </div>
              <div className="chip-row">
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

            {/* Price (optional) */}
            <div style={{ marginBottom: 16 }}>
              <input
                className="input-field"
                type="number"
                step="any"
                min="0"
                placeholder={t.pricePlaceholder || "Цена (необязательно)"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              className="btn"
              disabled={createMutation.isPending || !name.trim()}
            >
              {createMutation.isPending ? t.syncing : t.addBtn}
            </button>
          </form>
        ) : (
          <div>
            <form onSubmit={handleParseSubmit} style={{ marginBottom: 16 }}>
              <textarea
                className="input-field"
                rows={3}
                placeholder={t.aiPlaceholder}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                disabled={parseMutation.isPending}
                required
              />

              <div style={{ marginTop: 10 }}>
                <button
                  type="submit"
                  className="btn"
                  disabled={parseMutation.isPending || !aiText.trim()}
                >
                  {parseMutation.isPending ? t.parsing : t.parseBtn}
                </button>
              </div>
            </form>

            {parseMutation.isPending && (
              <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                <div className="spinner" />
              </div>
            )}

            {/* Error state with retry */}
            {parseError && !parseMutation.isPending && (
              <div
                style={{
                  background: "var(--err-c)",
                  color: "var(--on-err-c)",
                  borderRadius: "var(--r2)",
                  padding: "12px 16px",
                  marginBottom: 12,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{parseError}</span>
                <button
                  type="button"
                  style={{
                    fontWeight: 700,
                    textDecoration: "underline",
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setParseError(null);
                    parseMutation.mutate(aiText);
                  }}
                >
                  {t.retry ?? "Повторить"}
                </button>
              </div>
            )}

            {parsedItems.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--on)" }}>
                  {t.previewTitle.replace("{count}", parsedItems.length.toString())}
                </div>

                <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
                  {parsedItems.map((item, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        className="ai-preview-item press"
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <div
                          className={`ai-preview-check ${isSelected ? "on" : ""}`}
                          onClick={() => toggleItemSelection(idx)}
                          role="checkbox"
                          aria-checked={isSelected}
                          style={{ cursor: "pointer" }}
                        >
                          {isSelected && (
                            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div
                          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                          onClick={() => toggleItemSelection(idx)}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--on)" }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {item.quantity} {item.unit} • {item.category}
                            {item.estimated_price ? ` • ~${item.estimated_price.toLocaleString()}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeParsedItem(idx);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--muted)",
                            fontSize: 16,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                          aria-label="Удалить позицию"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => batchAddMutation.mutate()}
                  disabled={selectedIndices.size === 0 || batchAddMutation.isPending}
                >
                  {batchAddMutation.isPending
                    ? t.syncing
                    : t.addSelected.replace("{count}", selectedIndices.size.toString())}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
