import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ConflictError } from "../api/client";
import { formatCurrency, Language, translations } from "../i18n";
import { SmartSortMode, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";
import { SwipeableItem } from "../components/SwipeableItem";

const ALL_CATEGORY = "Все";

// ── Smooth Animated Counter for Numbers (Direct DOM Mutation, 0 React Rerenders) ──
export const AnimatedCounter: React.FC<{
  value: number;
  formatter?: (val: number) => string;
}> = ({ value, formatter }) => {
  const motionProfile = useAppStore((s) => s.motionProfile);
  const isEnabled = motionProfile?.animatedTotal?.enabled ?? true;
  const isBattery = motionProfile?.batterySaver ?? false;
  const duration = isEnabled && !isBattery
    ? Math.round((motionProfile?.animatedTotal?.duration ?? 400) * ((motionProfile?.intensity ?? 100) / 100))
    : 0;

  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValRef = useRef(value);

  useEffect(() => {
    const start = prevValRef.current;
    const target = value;
    prevValRef.current = target;

    if (duration === 0 || start === target || !spanRef.current) {
      if (spanRef.current) {
        spanRef.current.textContent = formatter ? formatter(target) : String(target);
      }
      return;
    }

    const startTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Spring-like ease-out (exponential)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (target - start) * ease);

      if (spanRef.current) {
        spanRef.current.textContent = formatter ? formatter(current) : String(current);
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        if (spanRef.current) {
          spanRef.current.textContent = formatter ? formatter(target) : String(target);
        }
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration, formatter]);

  return <span ref={spanRef}>{formatter ? formatter(value) : value}</span>;
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
  const safeLeft = Math.max(10, Math.min(left, window.innerWidth - 180));
  const safeTop = Math.max(10, Math.min(top, window.innerHeight - 200));

  return (
    <>
      <div
        className="ctx-backdrop"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="ctx-menu"
        role="menu"
        aria-label="Действия"
        style={{ position: "fixed", top: safeTop, left: safeLeft, zIndex: 30 }}
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
    </>
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
  onOpenEdit?: (item: ShoppingItem, rect?: { top: number; left: number; width: number; height: number } | null) => void;
  onDragStart?: (itemId: string, e: React.PointerEvent) => void;
  onDragMove?: (e: React.PointerEvent) => void;
  onDragEnd?: (e: React.PointerEvent) => void;
  hapticsEnabled: boolean;
  longPressEnabled?: boolean;
  longPressDuration?: number;
  isExiting?: boolean;
}

const ItemRow: React.FC<ItemRowProps> = React.memo(({
  item,
  language,
  onToggle,
  onDelete,
  onOpenCtx,
  onOpenEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  hapticsEnabled,
  longPressEnabled = true,
  longPressDuration = 480,
  isExiting = false,
}) => {
  const t = translations[language as keyof typeof translations] || translations.ru;
  const rowRef = useRef<HTMLDivElement>(null);
  const preliftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purchaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pressStartPos = useRef({ x: 0, y: 0 });
  const [pressStage, setPressStage] = useState<"idle" | "pressing" | "prelift">("idle");
  const [isPurchasing, setIsPurchasing] = useState(false);

  const cancelLongPress = useCallback(() => {
    if (preliftTimer.current) {
      clearTimeout(preliftTimer.current);
      preliftTimer.current = null;
    }
    if (popTimer.current) {
      clearTimeout(popTimer.current);
      popTimer.current = null;
    }
    setPressStage("idle");
  }, []);

  useEffect(() => {
    return () => {
      cancelLongPress();
      if (purchaseTimer.current) {
        clearTimeout(purchaseTimer.current);
        purchaseTimer.current = null;
      }
    };
  }, [cancelLongPress]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pressStartPos.current = { x: e.clientX, y: e.clientY };
    longPressFired.current = false;

    if (!longPressEnabled) return;

    setPressStage("pressing");

    const preliftDelay = Math.round(longPressDuration * 0.4);
    preliftTimer.current = setTimeout(() => {
      setPressStage("prelift");
      if (hapticsEnabled) triggerHaptic("light");
    }, preliftDelay);

    popTimer.current = setTimeout(() => {
      setPressStage("idle");
      longPressFired.current = true;
      if (hapticsEnabled) triggerHaptic("medium");
      onOpenCtx(item, e.clientX, e.clientY);
    }, longPressDuration);
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
      purchaseTimer.current = setTimeout(() => {
        setIsPurchasing(false);
        onToggle(item);
      }, 150);
    }
  };

  const safePrice = typeof item.price === "number" ? item.price : item.price ? parseFloat(String(item.price)) : null;
  const safeQty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 1;

  return (
    <div
      ref={rowRef}
      className={`item-row reveal-item ${item.is_purchased ? "purchased" : ""} ${isPurchasing ? "purchasing" : ""} ${isExiting ? "exiting" : ""} ${pressStage !== "idle" ? pressStage : ""}`}
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

      {/* Item details — accessible edit trigger on click/Enter */}
      <div
        className="item-body"
        role="button"
        tabIndex={0}
        aria-label={`${item.name}, ${safeQty} ${item.unit || "шт"}, нажмите чтобы изменить`}
        onClick={() => {
          if (!longPressFired.current) {
            if (onOpenEdit && rowRef.current) {
              const r = rowRef.current.getBoundingClientRect();
              onOpenEdit(item, { top: r.top, left: r.left, width: r.width, height: r.height });
            } else {
              onOpenCtx(item, window.innerWidth / 2, window.innerHeight / 2);
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onOpenEdit && rowRef.current) {
              const r = rowRef.current.getBoundingClientRect();
              onOpenEdit(item, { top: r.top, left: r.left, width: r.width, height: r.height });
            } else {
              onOpenCtx(item, window.innerWidth / 2, window.innerHeight / 2);
            }
          }
        }}
      >
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

      {/* Drag handle for manual reorder */}
      {!item.is_purchased && onDragStart && (
        <button
          type="button"
          className="item-drag-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(item.id, e);
          }}
          onPointerMove={(e) => {
            if (onDragMove) onDragMove(e);
          }}
          onPointerUp={(e) => {
            if (onDragEnd) onDragEnd(e);
          }}
          onPointerCancel={(e) => {
            if (onDragEnd) onDragEnd(e);
          }}
          aria-label="Перетащить"
          title="Перетащить"
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: "currentColor", opacity: 0.45 }}>
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>
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
  const language = useAppStore((s) => s.language);
  const showUndoToast = useAppStore((s) => s.showUndoToast);
  const openSheet = useAppStore((s) => s.openSheet);
  const openEditSheet = useAppStore((s) => s.openEditSheet);
  const showPurchased = useAppStore((s) => s.showPurchased);
  const confirmDelete = useAppStore((s) => s.confirmDelete);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const motionProfile = useAppStore((s) => s.motionProfile);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const isSearchOpen = useAppStore((s) => s.isSearchOpen);
  const setIsSearchOpen = useAppStore((s) => s.setIsSearchOpen);
  const categoryOrder = useAppStore((s) => s.categoryOrder);
  const setCategoryOrder = useAppStore((s) => s.setCategoryOrder);
  const smartSortMode = useAppStore((s) => s.smartSortMode);
  const setSmartSortMode = useAppStore((s) => s.setSmartSortMode);
  const customItemOrder = useAppStore((s) => s.customItemOrder);
  const setCustomItemOrder = useAppStore((s) => s.setCustomItemOrder);
  const t = translations[language] || translations.ru;

  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [purchasedOpen, setPurchasedOpen] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ item: ShoppingItem; x: number; y: number } | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [floatingBadge, setFloatingBadge] = useState<{ text: string; x: number; y: number } | null>(null);
  const [ptrDistance, setPtrDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draggedCat, setDraggedCat] = useState<string | null>(null);

  // Drag and drop manual reordering state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const activeDragElement = useRef<HTMLElement | null>(null);

  // Share list state
  const [shareSnapshot, setShareSnapshot] = useState<{ token: string; url: string; count: number } | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const swipeEnabled = motionProfile?.swipeResistance?.enabled ?? true;
  const longPressEnabled = motionProfile?.longPressMenu?.enabled ?? true;
  const longPressDuration = Math.round((motionProfile?.longPressMenu?.duration ?? 480) * ((motionProfile?.intensity ?? 100) / 100));

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

  // Pull-to-refresh elastic drag (#55)
  const ptrTouchStartY = useRef(0);
  const isPtrActive = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        ptrTouchStartY.current = e.touches[0].clientY;
        isPtrActive.current = true;
      } else {
        isPtrActive.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPtrActive.current) return;
      const dy = e.touches[0].clientY - ptrTouchStartY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const dist = (dy * 60) / (dy + 60);
        setPtrDistance(dist);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPtrActive.current) return;
      isPtrActive.current = false;
      if (ptrDistance > 35) {
        setIsRefreshing(true);
        if (hapticsEnabled) triggerHaptic("medium");
        try {
          await refetch();
        } finally {
          setIsRefreshing(false);
          setPtrDistance(0);
        }
      } else {
        setPtrDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ptrDistance, hapticsEnabled, refetch]);

  // Scroll to Top FAB trigger (#66)
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 280);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Single IntersectionObserver for scroll-reveal items (#13)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05 }
    );
    const elements = document.querySelectorAll(".reveal-item:not(.revealed)");
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });

  // Success badge helper (#51)
  const triggerSuccess = useCallback((text: string, y?: number) => {
    setFloatingBadge({
      text,
      x: window.innerWidth / 2,
      y: y || Math.min(window.innerHeight - 120, 300),
    });
    setTimeout(() => setFloatingBadge(null), 1200);
  }, []);

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
    triggerSuccess(item.is_purchased ? "Возвращено" : "Куплено!");
  }, [toggleMutation, triggerSuccess]);

  const handleDelete = useCallback((item: ShoppingItem) => {
    const doDelete = () => {
      const animEnabled = motionProfile?.listAddDelete?.enabled ?? true;
      if (animEnabled) {
        setExitingIds((prev) => new Set(prev).add(item.id));
        setTimeout(() => {
          deleteMutation.mutate(item);
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }, 240);
      } else {
        deleteMutation.mutate(item);
      }
    };

    if (confirmDelete) {
      if (window.confirm(`Удалить «${item.name}» из списка?`)) {
        doDelete();
      }
    } else {
      doDelete();
    }
  }, [confirmDelete, deleteMutation, motionProfile?.listAddDelete?.enabled]);

  const handleOpenCtx = useCallback((item: ShoppingItem, x: number, y: number) => {
    setCtxMenu({ item, x, y });
  }, []);

  const handleCloseCtx = useCallback(() => setCtxMenu(null), []);

  const handleOpenEdit = useCallback((item: ShoppingItem, rect?: { top: number; left: number; width: number; height: number } | null) => {
    openEditSheet(item, rect);
  }, [openEditSheet]);

  // Group active and purchased items safely
  const { activeItems, purchasedItems, rawCategories } = useMemo(() => {
    const safeList = Array.isArray(items) ? items : [];
    const active = safeList.filter((i) => !i.is_purchased);
    const purchased = safeList.filter((i) => i.is_purchased);
    const cats = new Set<string>();
    safeList.forEach((it) => { if (it.category) cats.add(it.category); });
    return {
      activeItems: active,
      purchasedItems: purchased,
      rawCategories: Array.from(cats),
    };
  }, [items]);

  const categories = useMemo(() => {
    const orderMap = new Map((categoryOrder || []).map((cat, idx) => [cat, idx]));
    const sorted = [...rawCategories].sort((a, b) => {
      const orderA = orderMap.has(a) ? (orderMap.get(a) as number) : 999;
      const orderB = orderMap.has(b) ? (orderMap.get(b) as number) : 999;
      return orderA - orderB;
    });
    return [ALL_CATEGORY, ...sorted];
  }, [rawCategories, categoryOrder]);

  const handleChipDragStart = (cat: string) => {
    if (cat === ALL_CATEGORY) return;
    setDraggedCat(cat);
  };

  const handleChipDragOver = (e: React.DragEvent, targetCat: string) => {
    e.preventDefault();
    if (!draggedCat || draggedCat === targetCat || targetCat === ALL_CATEGORY) return;
    const currentList = categories.filter((c) => c !== ALL_CATEGORY);
    const fromIdx = currentList.indexOf(draggedCat);
    const toIdx = currentList.indexOf(targetCat);
    if (fromIdx !== -1 && toIdx !== -1) {
      const next = [...currentList];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedCat);
      setCategoryOrder(next);
    }
  };

  const handleChipDragEnd = () => {
    setDraggedCat(null);
  };

  // Filter items by category & search
  const filteredActive = useMemo(() => {
    let list = activeItems;
    if (selectedCategory !== ALL_CATEGORY) {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
    }
    return list;
  }, [activeItems, selectedCategory, searchQuery]);

  const filteredPurchased = useMemo(() => {
    let list = purchasedItems;
    if (selectedCategory !== ALL_CATEGORY) {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
    }
    return list;
  }, [purchasedItems, selectedCategory, searchQuery]);

  // Sorted active items based on smartSortMode
  const sortedActive = useMemo(() => {
    const list = [...filteredActive];
    if (smartSortMode === "price") {
      return list.sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    if (smartSortMode === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name, language === "uz" ? "uz" : "ru"));
    }
    if (smartSortMode === "recent") {
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (smartSortMode === "category") {
      return list.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
    }
    if (smartSortMode === "custom") {
      const orderMap = new Map((customItemOrder || []).map((id, idx) => [id, idx]));
      return list.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 99999;
        const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 99999;
        return orderA - orderB;
      });
    }
    return list;
  }, [filteredActive, smartSortMode, customItemOrder, language]);

  // Section grouping for long list reveal (#73)
  const groupedSections = useMemo(() => {
    if (sortedActive.length < 8 || selectedCategory !== ALL_CATEGORY || searchQuery.trim() || smartSortMode !== "default") {
      return null;
    }
    const map = new Map<string, ShoppingItem[]>();
    sortedActive.forEach((it) => {
      const c = it.category || "Другое";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(it);
    });
    return Array.from(map.entries());
  }, [sortedActive, selectedCategory, searchQuery, smartSortMode]);

  // Drag and drop reorder handlers
  const handleStartDrag = useCallback((itemId: string, e: React.PointerEvent) => {
    if (hapticsEnabled) triggerHaptic("medium");
    setDraggedItemId(itemId);
    dragStartY.current = e.clientY;
    const target = e.currentTarget as HTMLElement;
    activeDragElement.current = target.closest(".swipe-item") as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
  }, [hapticsEnabled]);

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const dy = e.clientY - dragStartY.current;
    if (activeDragElement.current) {
      activeDragElement.current.style.transform = `translateY(${dy}px) scale(1.02)`;
      activeDragElement.current.style.zIndex = "20";
      activeDragElement.current.classList.add("drag-lift");
    }

    const itemsContainer = document.querySelector(".active-list-container");
    if (itemsContainer) {
      const rows = Array.from(itemsContainer.querySelectorAll(".swipe-item"));
      const hoverIndex = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return e.clientY >= rect.top && e.clientY <= rect.bottom;
      });
      if (hoverIndex !== -1 && hoverIndex !== dragOverIndex) {
        setDragOverIndex(hoverIndex);
        if (hapticsEnabled) triggerHaptic("selection");
      }
    }
  }, [draggedItemId, dragOverIndex, hapticsEnabled]);

  const handleDragPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggedItemId) return;
    if (activeDragElement.current) {
      activeDragElement.current.style.transform = "";
      activeDragElement.current.style.zIndex = "";
      activeDragElement.current.classList.remove("drag-lift");
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const fromIdx = sortedActive.findIndex((i) => i.id === draggedItemId);
    const toIdx = dragOverIndex;

    if (fromIdx !== -1 && toIdx !== null && toIdx !== -1 && fromIdx !== toIdx) {
      const newItems = [...sortedActive];
      const [moved] = newItems.splice(fromIdx, 1);
      newItems.splice(toIdx, 0, moved);
      const newOrder = newItems.map((i) => i.id);
      setCustomItemOrder(newOrder);
      setSmartSortMode("custom");
      if (hapticsEnabled) triggerHaptic("light");
    }

    setDraggedItemId(null);
    setDragOverIndex(null);
    activeDragElement.current = null;
  }, [draggedItemId, dragOverIndex, sortedActive, setCustomItemOrder, setSmartSortMode, hapticsEnabled]);

  // Share list snapshot handler
  const handleShareList = async () => {
    if (hapticsEnabled) triggerHaptic("medium");
    setIsSharing(true);
    try {
      const payloads = activeItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        price: i.price,
        currency_code: i.currency_code,
        is_purchased: i.is_purchased,
      }));
      const res = await api.createShareSnapshot(
        language === "uz" ? "Mating xaridlar ro'yxati" : "Список покупок Mating",
        payloads
      );
      setShareSnapshot({ token: res.token, url: res.share_url, count: res.item_count });

      if (navigator.share) {
        try {
          await navigator.share({
            title: "Mating — Список покупок",
            text: `Список покупок (${res.item_count} поз.):\n` + activeItems.slice(0, 5).map((i) => `• ${i.name} ${i.quantity} ${i.unit}`).join("\n"),
            url: res.share_url,
          });
        } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.share_url);
        showUndoToast("share", language === "uz" ? "Havola nusxalandi!" : "Ссылка скопирована!");
      }
    } catch (err) {
      console.error("Share error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div style={{ paddingTop: 8, position: "relative" }}>
      {/* Pull-to-refresh elastic indicator (#55) */}
      <div
        className="ptr-container"
        style={{
          height: `${ptrDistance}px`,
          opacity: Math.min(1, ptrDistance / 35),
        }}
      >
        <div className={`ptr-spinner ${isRefreshing ? "refreshing" : ""}`}>
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>
      </div>

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

      {/* Category Pills & Search Expand (#44, #60) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div className={`search-wrap ${isSearchOpen ? "open" : ""}`} style={{ display: "flex", alignItems: "center", flex: isSearchOpen ? 1 : "0 0 auto" }}>
          <button
            type="button"
            className="cat-pill search-toggle-btn"
            style={{ padding: "0 10px", height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery("");
            }}
            aria-label="Поиск"
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {isSearchOpen && (
            <input
              type="text"
              className="search-bar"
              placeholder="Поиск покупок..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ flex: 1, marginLeft: 6, height: 32, padding: "0 12px", borderRadius: "16px", border: "1px solid var(--border-glass)", background: "var(--n)", color: "var(--t1)", fontSize: 13 }}
            />
          )}
        </div>

        {!isSearchOpen && categories.length > 2 && (
          <div className="cat-filter-row" style={{ flex: 1, margin: 0 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                draggable={cat !== ALL_CATEGORY}
                onDragStart={() => handleChipDragStart(cat)}
                onDragOver={(e) => handleChipDragOver(e, cat)}
                onDragEnd={handleChipDragEnd}
                className={`cat-pill ${selectedCategory === cat ? "on" : ""} ${draggedCat === cat ? "dragging" : ""}`}
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
      </div>

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

      {/* Smart Sort Toolbar & Share */}
      {!isLoading && items.length > 0 && (
        <div className="smart-sort-bar">
          <div className="smart-sort-select-wrap glass">
            <svg viewBox="0 0 24 24" className="smart-sort-icon">
              <path d="M3 6h18M6 12h12M9 18h6" />
            </svg>
            <select
              className="smart-sort-select"
              value={smartSortMode}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("selection");
                setSmartSortMode(e.target.value as SmartSortMode);
              }}
              aria-label="Сортировка"
            >
              <option value="default">
                {language === "uz" ? "Odatiy tartib" : "По умолчанию"}
              </option>
              <option value="category">
                {language === "uz" ? "Kategoriya bo'yicha" : "По категории"}
              </option>
              <option value="price">
                {language === "uz" ? "Avval qimmatlari" : "Сначала дорогие"}
              </option>
              <option value="name">
                {language === "uz" ? "Nomi bo'yicha (A-Z)" : "По названию (А-Я)"}
              </option>
              <option value="recent">
                {language === "uz" ? "Avval yangilari" : "Сначала новые"}
              </option>
              <option value="custom">
                {language === "uz" ? "O'z tartibingiz (Drag)" : "Свой порядок (Drag)"}
              </option>
            </select>
          </div>

          <button
            type="button"
            className="share-list-btn glass press"
            onClick={handleShareList}
            disabled={isSharing || activeItems.length === 0}
            title="Поделиться списком"
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{isSharing ? "..." : language === "uz" ? "Ulashish" : "Поделиться"}</span>
          </button>
        </div>
      )}

      {/* Active Items List: Grouped sections or flat list (#73) */}
      <div className="active-list-container">
        {groupedSections ? (
          groupedSections.map(([catName, catItems]) => (
            <div key={catName} className="category-section" style={{ marginTop: 12 }}>
              <div className="section-sticky-header">{catName} ({catItems.length})</div>
              {catItems.map((item) => (
                <SwipeableItem
                  key={item.id}
                  item={item}
                  onSwipeRight={handleToggle}
                  onSwipeLeft={handleDelete}
                  hapticsEnabled={hapticsEnabled}
                  swipeEnabled={swipeEnabled}
                  isExiting={exitingIds.has(item.id)}
                >
                  <ItemRow
                    item={item}
                    language={language}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onOpenCtx={handleOpenCtx}
                    onOpenEdit={handleOpenEdit}
                    onDragStart={handleStartDrag}
                    onDragMove={handleDragPointerMove}
                    onDragEnd={handleDragPointerUp}
                    hapticsEnabled={hapticsEnabled}
                    longPressEnabled={longPressEnabled}
                    longPressDuration={longPressDuration}
                    isExiting={exitingIds.has(item.id)}
                  />
                </SwipeableItem>
              ))}
            </div>
          ))
        ) : (
          sortedActive.map((item) => (
            <SwipeableItem
              key={item.id}
              item={item}
              onSwipeRight={handleToggle}
              onSwipeLeft={handleDelete}
              hapticsEnabled={hapticsEnabled}
              swipeEnabled={swipeEnabled}
              isExiting={exitingIds.has(item.id)}
            >
              <ItemRow
                item={item}
                language={language}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onOpenCtx={handleOpenCtx}
                onOpenEdit={handleOpenEdit}
                onDragStart={handleStartDrag}
                onDragMove={handleDragPointerMove}
                onDragEnd={handleDragPointerUp}
                hapticsEnabled={hapticsEnabled}
                longPressEnabled={longPressEnabled}
                longPressDuration={longPressDuration}
                isExiting={exitingIds.has(item.id)}
              />
            </SwipeableItem>
          ))
        )}
      </div>

      {/* Purchased Items Section */}
      {showPurchased && filteredPurchased.length > 0 && (
        <div className="purchased-group">
          <div className="purchased-header">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={purchasedOpen}
              aria-label={`${(t.summaryPurchased || "{count} куплено").replace("{count}", "").trim()} (${filteredPurchased.length})`}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setPurchasedOpen(!purchasedOpen);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (hapticsEnabled) triggerHaptic("selection");
                  setPurchasedOpen(!purchasedOpen);
                }
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
                isExiting={exitingIds.has(item.id)}
              >
                <ItemRow
                  item={item}
                  language={language}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onOpenCtx={handleOpenCtx}
                  onOpenEdit={handleOpenEdit}
                  hapticsEnabled={hapticsEnabled}
                  longPressEnabled={longPressEnabled}
                  longPressDuration={longPressDuration}
                  isExiting={exitingIds.has(item.id)}
                />
              </SwipeableItem>
            ))}
        </div>
      )}

      {/* Floating Success Badge (#51) */}
      {floatingBadge && (
        <div
          className="floating-success-badge"
          style={{
            position: "fixed",
            top: floatingBadge.y,
            left: floatingBadge.x,
            transform: "translate(-50%, -50%)",
            zIndex: 100,
          }}
        >
          {floatingBadge.text}
        </div>
      )}

      {/* Scroll to Top FAB (#66) */}
      {showScrollTop && (
        <button
          type="button"
          className="scroll-top-btn"
          aria-label="Наверх"
          onClick={() => {
            if (hapticsEnabled) triggerHaptic("light");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}

      {/* Context (long-press) menu */}
      {ctxMenu && (
        <CtxMenu
          item={ctxMenu.item}
          top={ctxMenu.y}
          left={ctxMenu.x}
          onEdit={() => {
            openEditSheet(ctxMenu.item, {
              top: ctxMenu.y,
              left: ctxMenu.x,
              width: 200,
              height: 60,
            });
          }}
          onToggle={() => handleToggle(ctxMenu.item)}
          onDelete={() => handleDelete(ctxMenu.item)}
          onClose={handleCloseCtx}
        />
      )}

      {/* Share Snapshot Modal */}
      {shareSnapshot && (
        <>
          <div className="share-backdrop" onClick={() => setShareSnapshot(null)} />
          <div className="share-modal glass">
            <div className="share-modal-header">
              <h3>{language === "uz" ? "Ro'yxatni ulashish" : "Поделиться списком"}</h3>
              <button className="share-close-btn" onClick={() => setShareSnapshot(null)}>
                ✕
              </button>
            </div>
            <p className="share-modal-hint">
              {language === "uz"
                ? `Xavfsiz havola yaratildi (${shareSnapshot.count} ta mahsulot):`
                : `Создана защищенная ссылка (${shareSnapshot.count} поз.):`}
            </p>
            <div className="share-link-box glass">
              <input type="text" readOnly value={shareSnapshot.url} className="share-link-input" />
              <button
                type="button"
                className="share-copy-btn press"
                onClick={async () => {
                  if (hapticsEnabled) triggerHaptic("medium");
                  await navigator.clipboard.writeText(shareSnapshot.url);
                  showUndoToast("share_copied", language === "uz" ? "Havola nusxalandi!" : "Ссылка скопирована!");
                }}
              >
                {language === "uz" ? "Nusxa" : "Копировать"}
              </button>
            </div>
            <div className="share-modal-actions">
              <button
                type="button"
                className="btn primary press"
                onClick={() => setShareSnapshot(null)}
              >
                {language === "uz" ? "Tushunarli" : "Готово"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
