import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, generateUUID } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { enqueueMutation } from "../state/offlineQueue";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { AIParsedItem, ShoppingItem } from "../types";
import { calculateTotals, detectCategory, parseShoppingTextDeterministically } from "../utils/localParser";
import { LiquidGlassSegment } from "./LiquidGlassSegment";

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
  const editSourceRect = useAppStore((s) => s.editSourceRect);
  const motionProfile = useAppStore((s) => s.motionProfile);
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const autoCategory = useAppStore((s) => s.autoCategory);
  const currency = useAppStore((s) => s.currency);

  const t = translations[language];

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const appElementRef = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef<number>(400);

  const dragStartY = useRef<number | null>(null);
  const currentDragY = useRef<number>(0);
  const lastMoveY = useRef<number>(0);
  const lastMoveTime = useRef<number>(0);
  const pointerVelocityY = useRef<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Stepper bump animation state
  const [isBumping, setIsBumping] = useState(false);

  // FLIP Ghost morph state
  const [morphActive, setMorphActive] = useState(false);
  const [ghostStyle, setGhostStyle] = useState<React.CSSProperties | null>(null);

  // Quick Add Form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("шт");
  const [category, setCategory] = useState("Овощи и фрукты");
  const [price, setPrice] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // AI Parser Form state
  const [aiText, setAiText] = useState("");
  const [parsedItems, setParsedItems] = useState<AIParsedItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
      setFormError(null);
      if (editingItem) {
        setName(editingItem.name || "");
        setQuantity(String(editingItem.quantity || 1));
        setUnit(editingItem.unit || "шт");
        setCategory(editingItem.category || "Овощи и фрукты");
        setPrice(editingItem.price ? String(editingItem.price) : "");
        setShowDetails(Boolean(editingItem.price));
        setAiError(null);
      } else {
        setName("");
        setQuantity("1");
        setUnit("шт");
        setPrice("");
        setShowDetails(false);
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

  // Cancel any pending AI requests when sheet closes or unmounts
  useEffect(() => {
    if (!isSheetOpen && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [isSheetOpen]);

  // Keyboard Sheet Adaptation
  useEffect(() => {
    if (!isSheetOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const isKeyboard = vv.height < window.innerHeight * 0.82;
      const kbSetting = motionProfile?.keyboardSheet?.enabled ?? true;
      if (isKeyboard && kbSetting) {
        sheet.classList.add("keyboard-open");
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        sheet.style.setProperty("--keyboard-offset", `${offset}px`);
      } else {
        sheet.classList.remove("keyboard-open");
        sheet.style.removeProperty("--keyboard-offset");
      }
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, [isSheetOpen, motionProfile?.keyboardSheet?.enabled]);

  // FLIP Edit Continuity
  useEffect(() => {
    const morphEnabled = motionProfile?.editMorph?.enabled ?? true;
    if (isSheetOpen && editingItem && editSourceRect && morphEnabled) {
      setGhostStyle({
        position: "fixed",
        top: editSourceRect.top,
        left: editSourceRect.left,
        width: editSourceRect.width,
        height: editSourceRect.height,
        opacity: 0.9,
        borderRadius: "16px",
        background: "var(--bg-glass)",
        border: "1px solid var(--border-glass)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "none",
      });
      setMorphActive(true);

      const frame = requestAnimationFrame(() => {
        const sheetEl = sheetRef.current;
        if (sheetEl) {
          const r = sheetEl.getBoundingClientRect();
          setGhostStyle({
            position: "fixed",
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            opacity: 0,
            borderRadius: "28px",
            background: "var(--bg-glass)",
            border: "1px solid var(--border-glass)",
            pointerEvents: "none",
            zIndex: 9999,
            transition: `all var(--dur-edit-morph, 400ms) var(--spring-snappy)`,
          });
        }
      });
      const timer = setTimeout(() => {
        setMorphActive(false);
        setGhostStyle(null);
      }, 450);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    } else {
      setMorphActive(false);
      setGhostStyle(null);
    }
  }, [isSheetOpen, editingItem, editSourceRect, motionProfile?.editMorph?.enabled]);

  // Focus trap and Escape key
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
    setIsBumping(true);
    setTimeout(() => setIsBumping(false), 220);
  };

  // Quick save mutation (handles create and edit with offline fallback)
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
      const isOfflineMode = typeof navigator !== "undefined" && !navigator.onLine;
      const cleanName = name.trim();
      const numQty = parseFloat(quantity) || 1;
      const numPrice = price.trim() ? parseFloat(price.replace(",", ".")) : null;

      if (isOfflineMode) {
        if (editingItem) {
          // Robust Offline Edit / Update Support
          enqueueMutation({
            type: "update",
            payload: {
              id: editingItem.id,
              version: editingItem.version,
              data: {
                name: cleanName,
                quantity: numQty,
                unit,
                category,
                price: numPrice && numPrice > 0 ? numPrice : null,
              },
            },
          });
          queryClient.setQueryData<ShoppingItem[]>(["items"], (old = []) =>
            old.map((it) =>
              it.id === editingItem.id
                ? {
                    ...it,
                    name: cleanName,
                    quantity: numQty,
                    unit,
                    category,
                    price: numPrice && numPrice > 0 ? numPrice : null,
                    version: it.version + 1,
                    updated_at: new Date().toISOString(),
                  }
                : it
            )
          );
        } else {
          // Robust Offline Create Support
          enqueueMutation({
            type: "create",
            payload: {
              name: cleanName,
              quantity: numQty,
              unit,
              category,
              price: numPrice && numPrice > 0 ? numPrice : null,
            },
          });
          queryClient.setQueryData<ShoppingItem[]>(["items"], (old = []) => [
            {
              id: generateUUID(),
              user_id: "local_temp",
              name: cleanName,
              quantity: numQty,
              unit,
              category,
              price: numPrice && numPrice > 0 ? numPrice : null,
              currency_code: "UZS",
              is_purchased: false,
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            ...old,
          ]);
        }
        if (hapticsEnabled) triggerHaptic("success");
        closeSheet();
        return;
      }

      if (hapticsEnabled) triggerHaptic("error");
      setFormError(err.message || "Не удалось сохранить товар");
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
    onError: (err: any, itemsToAdd) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueMutation({
          type: "batch_create",
          payload: itemsToAdd.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            category: it.category,
            price: it.estimated_price,
          })),
        });
        queryClient.setQueryData<ShoppingItem[]>(["items"], (old = []) => [
          ...itemsToAdd.map((it) => ({
            id: generateUUID(),
            user_id: "local_temp",
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            category: it.category,
            price: it.estimated_price,
            currency_code: "UZS",
            is_purchased: false,
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
          ...old,
        ]);
        if (hapticsEnabled) triggerHaptic("success");
        closeSheet();
        return;
      }
      if (hapticsEnabled) triggerHaptic("error");
      setAiError(err.message || "Ошибка при пакетном добавлении товаров");
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
        setAiError("Не удалось распознать товары. Попробуйте: Помидоры 15, Огурцы 10");
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

  // Pointer drag on Header only (isolates form scrolling from sheet drag)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartY.current = e.clientY;
    lastMoveY.current = e.clientY;
    lastMoveTime.current = performance.now();
    pointerVelocityY.current = 0;
    currentDragY.current = 0;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const sheet = sheetRef.current;
    if (sheet) {
      sheetHeightRef.current = sheet.offsetHeight || 400;
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

    let effectiveY = dy;
    if (dy < 0) {
      const over = -dy;
      effectiveY = -((over * 35) / (over + 35));
    }

    const p = Math.max(0, Math.min(1, effectiveY / h));
    sheet.style.transform = `translate(-50%, ${effectiveY}px)`;

    if (app) {
      const scale = 0.94 + 0.06 * p;
      const translateY = 10 * (1 - p);
      app.style.transform = `scale(${scale}) translateY(${translateY}px)`;
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

    // Dismiss threshold
    if (dy > 120 || (dy > 50 && vy > 0.5)) {
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

      {/* Morph ghost element for FLIP transition */}
      {morphActive && ghostStyle && (
        <div className="edit-morph-ghost" style={ghostStyle} aria-hidden="true" />
      )}

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

        {/* Compact Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{sheetTitle}</h3>
          <button
            type="button"
            onClick={closeSheet}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: 14,
            }}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Mode Segmented Control: hidden when editing */}
        {!editingItem && (
          <div style={{ marginBottom: 14 }}>
            <LiquidGlassSegment
              options={[
                { value: "quick", label: t.quickTab },
                { value: "ai", label: t.aiTab },
              ]}
              value={sheetMode}
              onChange={(val) => setSheetMode(val as "quick" | "ai")}
              size="md"
            />
          </div>
        )}

        {formError && (
          <div style={{ color: "var(--err)", fontSize: 13, padding: "8px 12px", background: "color-mix(in srgb, var(--err) 12%, transparent)", borderRadius: "var(--r1)", marginBottom: 12 }}>
            {formError}
          </div>
        )}

        {/* ── QUICK ADD / EDIT TAB ── */}
        {(sheetMode === "quick" || editingItem) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveItemMutation.mutate();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* Primary Product Name Input */}
            <div className="field-group" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="text-input"
                placeholder="Что купить? (например: Помидоры)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{ fontSize: 16, height: 50, fontWeight: 500 }}
              />
            </div>

            {/* Quantity Stepper & Sliding Unit Segment */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Compact Stepper */}
              <div
                className="stepper-row"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--track)",
                  borderRadius: "999px",
                  padding: "3px 4px",
                  border: "1px solid var(--outline)",
                  width: "auto",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleQuantityStep(-1)}
                  aria-label="Уменьшить"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", fontSize: 18, color: "var(--on)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  −
                </button>
                <input
                  type="number"
                  step="any"
                  className={`stepper-val ${isBumping ? "bump" : ""}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: 44, textAlign: "center", border: "none", background: "transparent", fontSize: 15, fontWeight: 700, color: "var(--on)" }}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleQuantityStep(1)}
                  aria-label="Увеличить"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", fontSize: 18, color: "var(--on)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  +
                </button>
              </div>

              {/* Units Sliding Selector */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <LiquidGlassSegment
                  options={UNITS.map((u) => ({ value: u, label: u }))}
                  value={unit}
                  onChange={(u) => setUnit(u)}
                  size="sm"
                />
              </div>
            </div>

            {/* Collapsible Details: Category & Price */}
            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 2px",
                }}
              >
                <span>{showDetails ? "Скрыть подробности" : "Подробнее (цена, категория)"}</span>
                <span style={{ fontSize: 10 }}>{showDetails ? "▲" : "▼"}</span>
              </button>

              {showDetails && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginTop: 10,
                    padding: "12px 14px",
                    background: "color-mix(in srgb, var(--track) 60%, transparent)",
                    borderRadius: "var(--r2)",
                    border: "1px solid var(--outline)",
                  }}
                >
                  {/* Category Horizontal Scrolling Selector */}
                  <div>
                    <label className="field-label" style={{ marginBottom: 6, display: "block" }}>
                      Категория {category ? `· ${category}` : ""}
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        overflowX: "auto",
                        paddingBottom: 4,
                        scrollbarWidth: "none",
                      }}
                    >
                      {CATEGORIES.map((c) => {
                        const isSel = category === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              if (hapticsEnabled) triggerHaptic("selection");
                              setCategory(c);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "999px",
                              border: isSel ? "1px solid var(--primary)" : "1px solid var(--outline)",
                              background: isSel ? "var(--primary)" : "var(--track)",
                              color: isSel ? "#ffffff" : "var(--muted)",
                              fontSize: 12,
                              fontWeight: isSel ? 700 : 500,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Input */}
                  <div>
                    <label className="field-label" style={{ marginBottom: 6, display: "block" }}>
                      {t.price} ({currency})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="text-input"
                      placeholder="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      style={{ height: 42, fontSize: 14 }}
                    />
                  </div>

                  {/* Line Total Preview */}
                  {quickLineTotal !== null && quickLineTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, paddingTop: 4 }}>
                      <span style={{ color: "var(--muted)" }}>{t.estimatedTotal}:</span>
                      <b style={{ color: "var(--primary)", fontSize: 14 }}>
                        {formatCurrency(quickLineTotal, currency, language)}
                      </b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Primary CTA */}
            <button
              type="submit"
              className="btn press"
              disabled={!name.trim() || saveItemMutation.isPending}
              style={{
                marginTop: 6,
                height: 48,
                borderRadius: "var(--r2)",
                background: "var(--primary)",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)",
                cursor: !name.trim() || saveItemMutation.isPending ? "not-allowed" : "pointer",
                opacity: !name.trim() ? 0.45 : 1,
              }}
            >
              {submitBtnText}
            </button>
          </form>
        )}

        {/* ── AI ADD TAB (Only when not editing) ── */}
        {sheetMode === "ai" && !editingItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Напишите товары текстом (RU, UZ, EN)</label>
              <textarea
                className="text-area"
                rows={3}
                placeholder="Помидоры 2 кг 15000&#10;Огурцы 1 кг 12000&#10;Хлеб 2 шт за 10000"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                style={{ width: "100%", borderRadius: "var(--r2)", border: "1.5px solid var(--outline)", background: "var(--n)", color: "var(--on)", padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }}
              />
            </div>

            <button
              type="button"
              className="btn tn press"
              onClick={handleParseAI}
              disabled={!aiText.trim() || isAiLoading}
              style={{ height: 42, borderRadius: "var(--r2)", fontSize: 14, fontWeight: 700 }}
            >
              {isAiLoading ? "Распознавание..." : "Разобрать список"}
            </button>

            {aiError && (
              <div style={{ color: "var(--err)", fontSize: 13, textAlign: "center", padding: "6px 10px", background: "color-mix(in srgb, var(--err) 12%, transparent)", borderRadius: "var(--r1)" }}>
                {aiError}
              </div>
            )}

            {/* Parsed Items Preview List */}
            {parsedItems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                    Распознано ({parsedItems.length})
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
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

                <div
                  className="ai-preview-container"
                  style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}
                >
                  {parsedItems.map((item, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        className={`ai-preview-row ${isSelected ? "selected" : "deselected"}`}
                        role="checkbox"
                        tabIndex={0}
                        aria-checked={isSelected}
                        aria-label={`${item.name} (${item.quantity} ${item.unit})`}
                        onClick={() => toggleParsedItem(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleParsedItem(idx);
                          }
                        }}
                      >
                        <div
                          className={`preview-checkbox ${isSelected ? "checked" : ""}`}
                          aria-hidden="true"
                        >
                          {isSelected && (
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

                        {item.estimated_price !== null && (
                          <span className="preview-item-price">
                            {formatCurrency(item.quantity * item.estimated_price, currency, language)}
                          </span>
                        )}

                        <button
                          type="button"
                          aria-label={`Удалить ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeParsedItem(idx);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--muted)",
                            fontSize: 14,
                            cursor: "pointer",
                            padding: "4px 8px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Deterministic Grand Total Summary */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 700, padding: "8px 12px", background: "var(--track)", borderRadius: "var(--r1)" }}>
                  <span>Выбрано: {previewTotals.count} поз.</span>
                  {previewTotals.hasPrices && (
                    <span style={{ color: "var(--primary)" }}>
                      Итого: {formatCurrency(previewTotals.grandTotal, currency, language)}
                    </span>
                  )}
                </div>

                {/* Batch Add Actions */}
                <button
                  type="button"
                  className="btn press"
                  disabled={selectedItems.length === 0 || batchCreateMutation.isPending}
                  onClick={() => batchCreateMutation.mutate(selectedItems)}
                  style={{
                    height: 48,
                    borderRadius: "var(--r2)",
                    background: "var(--primary)",
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: 700,
                    border: "none",
                    boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)",
                    cursor: selectedItems.length === 0 || batchCreateMutation.isPending ? "not-allowed" : "pointer",
                    opacity: selectedItems.length === 0 ? 0.45 : 1,
                  }}
                >
                  {batchCreateMutation.isPending
                    ? "Добавление..."
                    : `Добавить выбранное (${selectedItems.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
