import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { AIParsedItem } from "../types";

const UNITS = ["шт", "кг", "л", "г", "уп", "бут", "пач"];
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

export const AddSheet: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSheetOpen, closeSheet, sheetMode, setSheetMode, language } = useAppStore();
  const t = translations[language];

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSheetOpen) {
        closeSheet();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSheetOpen, closeSheet]);

  // Reset form when sheet opens
  useEffect(() => {
    if (isSheetOpen) {
      setName("");
      setQuantity("1");
      setUnit("шт");
      setCategory("Другое");
      setPrice("");
      setAiText("");
      setParsedItems([]);
      setSelectedIndices(new Set());
    }
  }, [isSheetOpen]);

  // Touch drag to dismiss with pointer events and direct DOM transform (ZERO React re-renders during drag)
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    currentDragY.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const deltaY = e.clientY - dragStartY.current;
    if (deltaY > 0) {
      currentDragY.current = deltaY;
      sheetRef.current.style.transform = `translate(-50%, ${deltaY}px)`;
      sheetRef.current.style.transition = "none";
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const finalDeltaY = currentDragY.current;
    dragStartY.current = null;
    sheetRef.current.style.transition = "";

    if (finalDeltaY > 100) {
      closeSheet();
    } else {
      sheetRef.current.style.transform = "translate(-50%, 0)";
    }
  };

  // Quick Add Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return api.createItem({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1.0,
        unit: unit.trim() || "шт",
        category: category || "Другое",
        price: price ? parseFloat(price) : null,
      });
    },
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
  });

  // AI Parse Mutation
  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      return api.parseAI(text);
    },
    onSuccess: (data) => {
      triggerHaptic("medium");
      setParsedItems(data.items);
      setSelectedIndices(new Set(data.items.map((_, idx) => idx)));
    },
    onError: () => {
      triggerHaptic("error");
    },
  });

  // Batch Add Mutation
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
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
  });

  const toggleItemSelection = (index: number) => {
    triggerHaptic("selection");
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
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

        <div className="seg" style={{ "--seg-cols": 2 } as React.CSSProperties}>
          <button
            type="button"
            className={sheetMode === "quick" ? "on" : ""}
            onClick={() => setSheetMode("quick")}
          >
            {t.quickTab}
          </button>
          <button
            type="button"
            className={sheetMode === "ai" ? "on" : ""}
            onClick={() => setSheetMode("ai")}
          >
            {t.aiTab}
          </button>
        </div>

        {sheetMode === "quick" ? (
          <form onSubmit={handleQuickSubmit}>
            <div style={{ marginBottom: 12 }}>
              <input
                className="input-field"
                type="text"
                placeholder={t.itemNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <input
                  className="input-field"
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder={t.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div style={{ width: 100 }}>
                <select
                  className="input-field"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <input
                className="input-field"
                type="number"
                step="any"
                min="0"
                placeholder={t.price}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

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

            {parseMutation.isPending && <div className="spinner" />}

            {parsedItems.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  {t.previewTitle.replace("{count}", parsedItems.length.toString())}
                </div>

                <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
                  {parsedItems.map((item, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        className="ai-preview-item"
                        onClick={() => toggleItemSelection(idx)}
                      >
                        <div className={`ai-preview-check ${isSelected ? "on" : ""}`}>
                          {isSelected && (
                            <svg viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {item.quantity} {item.unit} • {item.category}
                            {item.estimated_price ? ` • ~${item.estimated_price.toLocaleString()}` : ""}
                          </div>
                        </div>
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
