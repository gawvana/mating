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
      // Focus trap inside sheet
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

  // Manage #app / dock inert when sheet opens — keeps screen reader focus inside sheet
  useEffect(() => {
    const appEl = document.getElementById("app");
    const dockEl = document.getElementById("dock");
    if (isSheetOpen) {
      appEl?.setAttribute("inert", "");
      dockEl?.setAttribute("inert", "");
      // Focus first focusable in sheet after open transition
      const timer = setTimeout(() => {
        const first = sheetRef.current?.querySelector<HTMLElement>(
          "button, input, select, textarea"
        );
        first?.focus();
      }, 50);
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
      setName("");
      setQuantity("1");
      setUnit("шт");
      setCategory("Другое");
      setPrice("");
      setAiText("");
      setParsedItems([]);
      setSelectedIndices(new Set());
      setParseError(null);
    }
  }, [isSheetOpen]);

  // ── Drag-to-dismiss (velocity-aware, zero React re-renders during drag) ──
  // Mirrors reference implementation: velocity = dy / dt; dismiss if dy>110 OR v>0.6
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
    if (dy <= 0) return; // Never drag upward
    currentDragY.current = dy;
    // Mirror reference: upward drag is dampened by 0.12, downward is 1:1
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
    // velocity in px/ms — matches reference threshold v > 0.6
    const velocity = dy / dt;

    dragStartY.current = null;
    sheetRef.current.style.transition = "";
    sheetRef.current.style.transform = "";

    if (dy > 110 || velocity > 0.6) {
      closeSheet();
    }
    // else: CSS transition snaps back to translate(-50%, 0) via .sheet.open rule
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () =>
      api.createItem({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1.0,
        unit: unit.trim() || "шт",
        category: category || "Другое",
        price: price ? parseFloat(price) : null,
      }),
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
  });

  const parseMutation = useMutation({
    mutationFn: async (text: string) => api.parseAI(text),
    onSuccess: (data) => {
      triggerHaptic("medium");
      setParseError(null);
      setParsedItems(data.items);
      setSelectedIndices(new Set(data.items.map((_, idx) => idx)));
    },
    onError: () => {
      triggerHaptic("error");
      setParseError(t.aiError ?? "Ошибка парсинга. Попробуйте ещё раз.");
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
      next.has(index) ? next.delete(index) : next.add(index);
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
        {/* Drag handle — pointer events only on this zone */}
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

        {/* Segmented control with spring-animated pill indicator */}
        <div
          className="seg"
          style={{ "--seg-cols": 2, "--seg-idx": segIdx } as React.CSSProperties}
        >
          {/* Pill indicator — CSS animates via --seg-idx */}
          <i aria-hidden="true" />
          <button
            type="button"
            className={sheetMode === "quick" ? "on" : ""}
            onClick={() => { triggerHaptic("selection"); setSheetMode("quick"); }}
          >
            {t.quickTab}
          </button>
          <button
            type="button"
            className={sheetMode === "ai" ? "on" : ""}
            onClick={() => { triggerHaptic("selection"); setSheetMode("ai"); }}
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
                    <option key={u} value={u}>{u}</option>
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
                  <option key={c} value={c}>{c}</option>
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

            {/* Error state with retry — no silent failures */}
            {parseError && !parseMutation.isPending && (
              <div
                style={{
                  background: "var(--err-c)", color: "var(--on-err-c)",
                  borderRadius: "var(--r2)", padding: "12px 16px",
                  marginBottom: 12, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span>{parseError}</span>
                <button
                  type="button"
                  style={{ fontWeight: 700, textDecoration: "underline", flexShrink: 0 }}
                  onClick={() => { setParseError(null); parseMutation.mutate(aiText); }}
                >
                  {t.retry ?? "Повторить"}
                </button>
              </div>
            )}

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
                        className="ai-preview-item press"
                        onClick={() => toggleItemSelection(idx)}
                        role="checkbox"
                        aria-checked={isSelected}
                      >
                        <div className={`ai-preview-check ${isSelected ? "on" : ""}`}>
                          {isSelected && (
                            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
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
