import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ConflictError } from "../api/client";
import { formatCurrency, Language, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";
import { SwipeableItem } from "../components/SwipeableItem";

const ALL_CATEGORY = "Все";

// ── Smooth Animated Counter for Numbers ───────────────────────────────────────
export const AnimatedCounter: React.FC<{
  value: number;
  formatter?: (val: number) => string;
}> = ({ value, formatter }) => {
  const [current, setCurrent] = useState(value);
  const frameRef = useRef<number | null>(null);
  const startVal = useRef(value);
  const startTime = useRef(0);

  useEffect(() => {
    startVal.current = current;
    startTime.current = performance.now();
    const target = value;
    const diff = target - startVal.current;

    if (Math.abs(diff) < 0.1) {
      setCurrent(target);
      return;
    }

    const duration = 400; // ms

    const tick = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(1, elapsed / duration);
      // Spring-like ease-out (exponential)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextVal = Math.round(startVal.current + diff * ease);
      setCurrent(nextVal);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span>{formatter ? formatter(current) : current}</span>;
};

// ── Context menu for long press ──────────────────────────────────────────────
interface CtxMenuProps {
  item: ShoppingItem;
  top: number;
  left: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const CtxMenu: React.FC<CtxMenuProps> = React.memo(({ item, top, left, onEdit, onToggle, onDelete, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", handle), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", handle);
    };
  }, [onClose]);

  const safeLeft = Math.max(10, Math.min(left, window.innerWidth - 180));
  const safeTop = Math.max(10, Math.min(top, window.innerHeight - 200));

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      role="menu"
      aria-label="Действия"
      style={{ position: "fixed", top: safeTop, left: safeLeft }}
    >
      <button className="ctx-menu-item" role="menuitem" onClick={() => { onEdit(); onClose(); }}>
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        Изменить
      </button>
      <button className="ctx-menu-item" role="menuitem" onClick={() => { onToggle(); onClose(); }}>
        <svg viewBox="0 0 24 24">
          {item.is_purchased
            ? <path d="M3 12h18M12 3l9 9-9 9" />
            : <path d="M20 6L9 17l-5-5" />}
        </svg>
        {item.is_purchased ? "Вернуть" : "Купить"}
      </button>
      <button className="ctx-menu-item danger" role="menuitem" onClick={() => { onDelete(); onClose(); }}>
        <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
        Удалить
      </button>
    </div>
  );
});
CtxMenu.displayName = "CtxMenu";

// ── Single item row ───────────────────────────────────────────────────────────
interface ItemRowProps {
  item: ShoppingItem;
  language: Language;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onOpenCtx: (item: ShoppingItem, x: number, y: number) => void;
  hapticsEnabled: boolean;
}

const ItemRow: React.FC<ItemRowProps> = React.memo(({
  item,
  language,
  onToggle,
  onDelete,
  onOpenCtx,
  hapticsEnabled,
}) => {
  const t = translations[language as keyof typeof translations] || translations.ru;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pressStartPos = useRef({ x: 0, y: 0 });
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    pressStartPos.current = { x: e.clientX, y: e.clientY };
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (hapticsEnabled) triggerHaptic("medium");
      onOpenCtx(item, e.clientX, e.clientY);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - pressStartPos.current.x);
    const dy = Math.abs(e.clientY - pressStartPos.current.y);
    if (dx > 8 || dy > 8) cancelLongPress();
  };

  const handlePointerUp = () => cancelLongPress();

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!longPressFired.current) {
      if (hapticsEnabled) triggerHaptic("selection");
      setIsPurchasing(true);
      setTimeout(() => {
        setIsPurchasing(false);
        onToggle(item);
      }, 150);
    }
  };

  const safePrice = typeof item.price === "number" ? item.price : item.price ? parseFloat(String(item.price)) : null;
  const safeQty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 1;

  return (
    <div
      className={`item-row ${item.is_purchased ? "purchased" : ""} ${isPurchasing ? "purchasing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenCtx(item, e.clientX, e.clientY);
      }}
    >
      {/* Circular check toggle with spring checkmark draw-in */}
      <button
        type="button"
        className={`item-check ${item.is_purchased ? "checked" : ""}`}
        onClick={handleToggleClick}
        aria-label={item.is_purchased ? "Вернуть в список" : "Отметить купленным"}
      >
        {item.is_purchased && (
          <svg viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>

      {/* Item details */}
      <div className="item-body">
        <div className="item-name">{item.name}</div>
        <div className="item-meta">
          <span>{safeQty} {item.unit || "шт"}</span>
          {item.category && item.category !== "Другое" && (
            <span className="item-tag">{item.category}</span>
          )}
        </div>
      </div>

      {/* Price */}
      {safePrice !== null && !isNaN(safePrice) && (
        <div className="item-price-col">
          <span className="item-price-val">
            {formatCurrency(safeQty * safePrice, item.currency_code || "UZS", language)}
          </span>
        </div>
      )}

      {/* Delete action */}
      <button
        type="button"
        className="item-del-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (!longPressFired.current) onDelete(item);
        }}
        aria-label={t.delete || "Удалить"}
      >
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});
ItemRow.displayName = "ItemRow";

// ── Main ListScreen ───────────────────────────────────────────────────────────
export const ListScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    language,
    showUndoToast,
    openSheet,
    showPurchased,
    confirmDelete,
    hapticsEnabled,
    motionProfile,
  } = useAppStore();
  const t = translations[language] || translations.ru;

  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [purchasedOpen, setPurchasedOpen] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ item: ShoppingItem; x: number; y: number } | null>(null);

  const swipeEnabled = motionProfile?.swipeResistance?.enabled ?? true;

  // Fetch items
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  // Fetch monthly stats
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getMonthlyStats(),
  });

  // Toggle purchased mutation with optimistic update
  const toggleMutation = useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      return api.togglePurchased(id, version);
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["items"]);
      queryClient.setQueryData<ShoppingItem[]>(["items"], (old) => {
        if (!old) return [];
        return old.map((it) =>
          it.id === id ? { ...it, is_purchased: !it.is_purchased, version: it.version + 1 } : it
        );
      });
      return { previousItems };
    },
    onError: (err, _, context) => {
      if (err instanceof ConflictError) {
        queryClient.invalidateQueries({ queryKey: ["items"] });
      } else if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
      if (hapticsEnabled) triggerHaptic("error");
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("selection");
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Delete mutation with optimistic update & undo
  const deleteMutation = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      return api.deleteItem(item.id);
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["items"]);
      queryClient.setQueryData<ShoppingItem[]>(["items"], (old) => {
        if (!old) return [];
        return old.filter((it) => it.id !== item.id);
      });
      return { previousItems };
    },
    onError: (_, __, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
      if (hapticsEnabled) triggerHaptic("error");
    },
    onSuccess: (_, item) => {
      if (hapticsEnabled) triggerHaptic("medium");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast(item.id, item.name);
    },
  });

  // Clear purchased mutation
  const clearPurchasedMutation = useMutation({
    mutationFn: async () => {
      return api.clearPurchased();
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("heavy");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleToggle = useCallback((item: ShoppingItem) => {
    toggleMutation.mutate({ id: item.id, version: item.version });
  }, [toggleMutation]);

  const handleDelete = useCallback((item: ShoppingItem) => {
    if (confirmDelete) {
      if (window.confirm(`Удалить «${item.name}» из списка?`)) {
        deleteMutation.mutate(item);
      }
    } else {
      deleteMutation.mutate(item);
    }
  }, [confirmDelete, deleteMutation]);

  const handleOpenCtx = useCallback((item: ShoppingItem, x: number, y: number) => {
    setCtxMenu({ item, x, y });
  }, []);

  const handleCloseCtx = useCallback(() => setCtxMenu(null), []);

  // Group active and purchased items safely
  const { activeItems, purchasedItems, categories } = useMemo(() => {
    const safeList = Array.isArray(items) ? items : [];
    const active = safeList.filter((i) => !i.is_purchased);
    const purchased = safeList.filter((i) => i.is_purchased);
    const cats = new Set<string>();
    safeList.forEach((it) => { if (it.category) cats.add(it.category); });
    return {
      activeItems: active,
      purchasedItems: purchased,
      categories: [ALL_CATEGORY, ...Array.from(cats)],
    };
  }, [items]);

  // Filter items by category if selected
  const filteredActive = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY) return activeItems;
    return activeItems.filter((i) => i.category === selectedCategory);
  }, [activeItems, selectedCategory]);

  const filteredPurchased = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY) return purchasedItems;
    return purchasedItems.filter((i) => i.category === selectedCategory);
  }, [purchasedItems, selectedCategory]);

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Summary Strip with Animated Counters */}
      <div className="summary-strip">
        <div className="summary-item">
          <span className="summary-val">
            <AnimatedCounter value={activeItems.length} />
          </span>
          <span className="summary-lbl">
            {(t.summaryActive || "{count} в списке").replace("{count}", "").trim()}
          </span>
        </div>

        <div className="summary-div" />

        <div className="summary-item">
          <span className="summary-val" style={{ color: "var(--ok)" }}>
            <AnimatedCounter value={purchasedItems.length} />
          </span>
          <span className="summary-lbl">
            {(t.summaryPurchased || "{count} куплено").replace("{count}", "").trim()}
          </span>
        </div>

        {stats && typeof stats.total_spent === "number" && stats.total_spent > 0 && (
          <>
            <div className="summary-div" />
            <div className="summary-item" style={{ textAlign: "right" }}>
              <span className="summary-val" style={{ color: "var(--primary)" }}>
                <AnimatedCounter
                  value={stats.total_spent}
                  formatter={(v) => formatCurrency(v, stats.currency_code || "UZS", language)}
                />
              </span>
              <span className="summary-lbl">{t.monthlySpent || "За месяц"}</span>
            </div>
          </>
        )}
      </div>

      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="cat-filter-row">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`cat-pill ${selectedCategory === cat ? "on" : ""}`}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setSelectedCategory(cat);
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && items.length === 0 && (
        <div style={{ padding: "24px 0", display: "grid", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: "var(--r2)" }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && items.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--n)", borderRadius: "var(--r3)", marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t.errorLoadingTitle}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{t.errorLoading}</div>
          <button
            type="button"
            className="btn outline"
            style={{ width: "auto", margin: "14px auto 0", padding: "0 24px", height: 40 }}
            onClick={() => refetch()}
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && !isError && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28 }}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptySubtitle}</p>
          <button
            type="button"
            className="btn press"
            style={{ width: "auto", padding: "0 28px" }}
            onClick={() => openSheet("quick")}
          >
            {t.emptyAddBtn}
          </button>
        </div>
      )}

      {/* Active Items List */}
      {filteredActive.map((item) => (
        <SwipeableItem
          key={item.id}
          item={item}
          onSwipeRight={handleToggle}
          onSwipeLeft={handleDelete}
          hapticsEnabled={hapticsEnabled}
          swipeEnabled={swipeEnabled}
        >
          <ItemRow
            item={item}
            language={language}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onOpenCtx={handleOpenCtx}
            hapticsEnabled={hapticsEnabled}
          />
        </SwipeableItem>
      ))}

      {/* Purchased Items Section */}
      {showPurchased && filteredPurchased.length > 0 && (
        <div className="purchased-group">
          <div className="purchased-header">
            <div
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setPurchasedOpen(!purchasedOpen);
              }}
            >
              <span>
                {(t.summaryPurchased || "{count} куплено").replace("{count}", "").trim()} ({filteredPurchased.length})
              </span>
              <svg
                viewBox="0 0 24 24"
                style={{
                  width: 16,
                  height: 16,
                  transform: purchasedOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform .3s var(--spring)",
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <button
              type="button"
              className="purchased-clear-btn"
              onClick={() => {
                if (window.confirm("Очистить все купленные товары?")) {
                  clearPurchasedMutation.mutate();
                }
              }}
            >
              {t.clearPurchased}
            </button>
          </div>

          {purchasedOpen &&
            filteredPurchased.map((item) => (
              <SwipeableItem
                key={item.id}
                item={item}
                onSwipeRight={handleToggle}
                onSwipedRight={true}
                onSwipeLeft={handleDelete}
                hapticsEnabled={hapticsEnabled}
                swipeEnabled={swipeEnabled}
              >
                <ItemRow
                  item={item}
                  language={language}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onOpenCtx={handleOpenCtx}
                  hapticsEnabled={hapticsEnabled}
                />
              </SwipeableItem>
            ))}
        </div>
      )}

      {/* Context (long-press) menu */}
      {ctxMenu && (
        <CtxMenu
          item={ctxMenu.item}
          top={ctxMenu.y}
          left={ctxMenu.x}
          onEdit={() => {
            openSheet("quick", ctxMenu.item.name);
          }}
          onToggle={() => handleToggle(ctxMenu.item)}
          onDelete={() => handleDelete(ctxMenu.item)}
          onClose={handleCloseCtx}
        />
      )}
    </div>
  );
};
