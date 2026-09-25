import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ConflictError } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";

export const ListScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { language, showUndoToast } = useAppStore();
  const t = translations[language];

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

  // Fetch monthly stats for summary chip
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
        // Refetch to reconcile version
        queryClient.invalidateQueries({ queryKey: ["items"] });
      } else if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
      triggerHaptic("error");
    },
    onSuccess: () => {
      triggerHaptic("selection");
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      return api.deleteItem(item.id);
    },
    onSuccess: (_, item) => {
      triggerHaptic("medium");
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
      triggerHaptic("heavy");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Separate active and purchased
  const { purchasedItems, groupedActive } = useMemo(() => {
    const active = items.filter((i) => !i.is_purchased);
    const purchased = items.filter((i) => i.is_purchased);

    const grouped: Record<string, ShoppingItem[]> = {};
    for (const item of active) {
      const cat = item.category || "Другое";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    return { purchasedItems: purchased, groupedActive: grouped };
  }, [items]);

  const totalCount = items.length;
  const boughtCount = purchasedItems.length;

  return (
    <div className="page-content">
      {/* Greeting Header */}
      <div className="greeting">
        <h1>{t.greetingTitle}</h1>
        <p>{t.greetingSubtitle}</p>

        {/* Real Summary Chips */}
        <div className="summary-chips">
          {stats && (
            <div className="summary-chip accent">
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                {t.monthlySpent}: {formatCurrency(stats.total_spent, stats.currency_code, language)}
              </span>
            </div>
          )}

          <div className="summary-chip">
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>
              {t.purchasedSummary
                .replace("{bought}", boughtCount.toString())
                .replace("{total}", totalCount.toString())}
            </span>
          </div>
        </div>
      </div>

      {isLoading && <div className="spinner" />}

      {isError && (
        <div className="empty-state">
          <h3>Ошибка загрузки</h3>
          <p>Не удалось загрузить список покупок.</p>
          <button className="btn outline" style={{ marginTop: 12 }} onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptySubtitle}</p>
        </div>
      )}

      {/* Active Items grouped by Category */}
      {Object.entries(groupedActive).map(([catName, groupItems]) => (
        <section key={catName} className="cat-group">
          <div className="cat-group-header">
            <div className="cat-title">
              <span className="cat-chip" data-cat={catName}>
                {catName}
              </span>
            </div>
            <span className="cat-badge">{groupItems.length}</span>
          </div>

          <div className="items-list">
            {groupItems.map((item) => (
              <div key={item.id} className="item-row press">
                <div
                  className="item-check"
                  onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
                  role="checkbox"
                  aria-checked={item.is_purchased}
                >
                  {item.is_purchased && (
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                <div
                  className="item-info"
                  onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
                >
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    {item.quantity} {item.unit}
                    {item.price ? ` • ${formatCurrency(item.price, item.currency_code, language)}` : ""}
                  </div>
                </div>

                {item.price && (
                  <div className="item-price">
                    {formatCurrency(item.price, item.currency_code, language)}
                  </div>
                )}

                <div className="item-actions">
                  <button
                    className="item-action-btn del"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(item);
                    }}
                    aria-label={t.delete}
                    title={t.delete}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Purchased Items Section */}
      {purchasedItems.length > 0 && (
        <section className="purchased-section">
          <div className="purchased-header">
            <div
              className={`purchased-toggle ${purchasedOpen ? "open" : ""}`}
              onClick={() => setPurchasedOpen(!purchasedOpen)}
            >
              <svg viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>
                {t.purchasedTitle} ({purchasedItems.length})
              </span>
            </div>

            <button
              className="clear-btn press"
              onClick={() => clearPurchasedMutation.mutate()}
              disabled={clearPurchasedMutation.isPending}
            >
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>{t.clearPurchased}</span>
            </button>
          </div>

          {purchasedOpen && (
            <div className="items-list">
              {purchasedItems.map((item) => (
                <div key={item.id} className="item-row purchased">
                  <div
                    className="item-check checked"
                    onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
                  >
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  <div
                    className="item-info"
                    onClick={() => toggleMutation.mutate({ id: item.id, version: item.version })}
                  >
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">
                      {item.quantity} {item.unit}
                    </div>
                  </div>

                  {item.price && (
                    <div className="item-price">
                      {formatCurrency(item.price, item.currency_code, language)}
                    </div>
                  )}

                  <div className="item-actions">
                    <button
                      className="item-action-btn del"
                      onClick={() => deleteMutation.mutate(item)}
                      aria-label={t.delete}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
