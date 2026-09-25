import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ConflictError } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";

const ALL_CATEGORY = "Все";

export const ListScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    language,
    showUndoToast,
    openSheet,
    showPurchased,
    confirmDelete,
    hapticsEnabled,
  } = useAppStore();
  const t = translations[language];

  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [purchasedOpen, setPurchasedOpen] = useState(true);

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

  // Toggle purchased mutation
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

  const handleDelete = (item: ShoppingItem) => {
    if (confirmDelete) {
      if (window.confirm(`Удалить «${item.name}» из списка?`)) {
        deleteMutation.mutate(item);
      }
    } else {
      deleteMutation.mutate(item);
    }
  };

  // Group active and purchased items
  const { activeItems, purchasedItems, categories } = useMemo(() => {
    const active = items.filter((i) => !i.is_purchased);
    const purchased = items.filter((i) => i.is_purchased);

    const cats = new Set<string>();
    items.forEach((it) => {
      if (it.category) cats.add(it.category);
    });

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
      {/* Summary Strip (Compact Header Stats) */}
      <div className="summary-strip">
        <div className="summary-item">
          <span className="summary-val">{activeItems.length}</span>
          <span className="summary-lbl">{t.summaryActive.replace("{count}", "").trim()}</span>
        </div>

        <div className="summary-div" />

        <div className="summary-item">
          <span className="summary-val" style={{ color: "var(--ok)" }}>
            {purchasedItems.length}
          </span>
          <span className="summary-lbl">{t.summaryPurchased.replace("{count}", "").trim()}</span>
        </div>

        {stats && stats.total_spent > 0 && (
          <>
            <div className="summary-div" />
            <div className="summary-item" style={{ textAlign: "right" }}>
              <span className="summary-val" style={{ color: "var(--primary)" }}>
                {formatCurrency(stats.total_spent, stats.currency_code, language)}
              </span>
              <span className="summary-lbl">{t.monthlySpent}</span>
            </div>
          </>
        )}
      </div>

      {/* Category Pills (if more than 1 category present) */}
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
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
          Загрузка списка...
        </div>
      )}

      {/* Error state with retry */}
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
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--p)", color: "var(--on-p)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28 }}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>{t.emptyTitle}</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>{t.emptySubtitle}</p>
          <button
            type="button"
            className="btn press"
            style={{ width: "auto", margin: "0 auto", padding: "0 28px" }}
            onClick={() => openSheet("quick")}
          >
            {t.emptyAddBtn}
          </button>
        </div>
      )}

      {/* Active Items List */}
      {filteredActive.map((item) => (
        <div key={item.id} className="item-row">
          {/* Circular check toggle */}
          <button
            type="button"
            className="item-check"
            onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
            aria-label="Отметить купленным"
          />

          {/* Item details */}
          <div className="item-body">
            <div className="item-name">{item.name}</div>
            <div className="item-meta">
              <span>
                {item.quantity} {item.unit}
              </span>
              {item.category && item.category !== "Другое" && (
                <span className="item-tag">{item.category}</span>
              )}
            </div>
          </div>

          {/* Price */}
          {item.price !== null && item.price !== undefined && (
            <div className="item-price-col">
              <span className="item-price-val">
                {formatCurrency(item.quantity * item.price, item.currency_code, language)}
              </span>
            </div>
          )}

          {/* Delete action */}
          <button
            type="button"
            className="item-del-btn"
            onClick={() => handleDelete(item)}
            aria-label="Удалить"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Purchased Items Section (Collapsible) */}
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
              <span>{t.summaryPurchased.replace("{count}", "").trim()} ({filteredPurchased.length})</span>
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
              <div key={item.id} className="item-row purchased">
                <button
                  type="button"
                  className="item-check checked"
                  onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
                  aria-label="Вернуть в список"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>

                <div className="item-body">
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    <span>
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                </div>

                {item.price !== null && item.price !== undefined && (
                  <div className="item-price-col">
                    <span className="item-price-val">
                      {formatCurrency(item.quantity * item.price, item.currency_code, language)}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="item-del-btn"
                  onClick={() => handleDelete(item)}
                  aria-label="Удалить"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
