import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatCurrency } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { HistoryGroup, HistoryItem } from "../types";

export const HistoryScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const currency = useAppStore((s) => s.currency);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const showUndoToast = useAppStore((s) => s.showUndoToast);

  // Repeat modal state
  const [repeatGroup, setRepeatGroup] = useState<HistoryGroup | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Expanded groups tracking
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Fetch history data
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.getHistory(),
  });

  const toggleGroupExpand = (date: string) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const openRepeatModal = (group: HistoryGroup) => {
    if (hapticsEnabled) triggerHaptic("medium");
    setRepeatGroup(group);
    setSelectedItemIds(new Set(group.items.map((i) => i.id)));
  };

  const closeRepeatModal = () => {
    setRepeatGroup(null);
    setSelectedItemIds(new Set());
  };

  const toggleRepeatItem = (id: string) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Re-add mutation
  const readdMutation = useMutation({
    mutationFn: async (itemsToAdd: HistoryItem[]) => {
      const payloads = itemsToAdd.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        category: it.category,
        price: it.price,
        currency_code: it.currency_code || currency,
      }));
      return await api.batchCreateItems(payloads);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      if (hapticsEnabled) triggerHaptic("medium");
      showUndoToast("repeat", `Добавлено ${created.length} товаров`);
      closeRepeatModal();
      setActiveTab("list");
    },
  });

  const handleConfirmRepeat = () => {
    if (!repeatGroup) return;
    const items = repeatGroup.items.filter((i) => selectedItemIds.has(i.id));
    if (items.length === 0) return;
    readdMutation.mutate(items);
  };

  const handleAddFrequent = (item: { name: string; category: string }) => {
    if (hapticsEnabled) triggerHaptic("medium");
    api.createItem({
      name: item.name,
      quantity: 1,
      unit: "шт",
      category: item.category,
      price: null,
      currency_code: currency,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showUndoToast("freq", `+ ${item.name}`);
    });
  };

  const groups = data?.groups || [];
  const frequentItems = data?.frequent_items || [];

  return (
    <div className="history-screen wrap" role="main" aria-label="История покупок">
      {/* Header */}
      <div className="history-header">
        <h1 className="history-title">История покупок</h1>
        <p className="history-subtitle">
          {language === "uz"
            ? "Barcha olingan mahsulotlar va takroriy xaridlar"
            : language === "en"
            ? "Purchased items archive and repeat orders"
            : "Архив завершенных покупок и повторный заказ в один клик"}
        </p>
      </div>

      {/* Frequently bought / recurring items card */}
      {frequentItems.length > 0 && (
        <div className="frequent-section">
          <div className="frequent-header">
            <span className="frequent-icon">↻</span>
            <span className="frequent-title">Часто покупаете</span>
          </div>
          <div className="frequent-scroll">
            {frequentItems.map((fi, idx) => (
              <div key={idx} className="frequent-chip glass">
                <div className="frequent-chip-text">
                  <span className="frequent-chip-name">{fi.name}</span>
                  <span className="frequent-chip-freq">
                    {language === "uz"
                      ? `har ~${fi.every_days} kunda`
                      : `каждые ~${fi.every_days} дн`}
                  </span>
                </div>
                <button
                  className="frequent-add-btn press"
                  onClick={() => handleAddFrequent(fi)}
                  title="Добавить в список"
                >
                  ＋
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="history-loading glass">
          <div className="loading-spinner" />
          <span>Загрузка истории...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && (
        <div className="history-empty glass">
          <div className="empty-icon">📜</div>
          <h3>История пока пуста</h3>
          <p>Когда вы отметите купленные товары, они сохранятся здесь.</p>
        </div>
      )}

      {/* History Date Groups */}
      <div className="history-groups">
        {groups.map((group) => {
          const isExpanded = expandedDates.has(group.date);
          return (
            <div key={group.date} className="history-group-card glass">
              <div
                className="history-group-header"
                onClick={() => toggleGroupExpand(group.date)}
              >
                <div className="group-info">
                  <span className="group-label">{group.label}</span>
                  <span className="group-meta">
                    {group.item_count} поз. • {formatCurrency(group.total_spent, currency, language)}
                  </span>
                </div>

                <div className="group-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="repeat-btn press"
                    onClick={() => openRepeatModal(group)}
                  >
                    Повторить
                  </button>
                  <button
                    className={`expand-caret ${isExpanded ? "open" : ""}`}
                    onClick={() => toggleGroupExpand(group.date)}
                    aria-label="Развернуть"
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* Items List (expandable) */}
              {isExpanded && (
                <div className="history-group-items">
                  {group.items.map((it) => (
                    <div key={it.id} className="history-item-row">
                      <div className="history-item-bullet">✓</div>
                      <div className="history-item-details">
                        <span className="history-item-name">{it.name}</span>
                        <span className="history-item-qty">
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                      {it.price ? (
                        <span className="history-item-price">
                          {formatCurrency(it.price * it.quantity, currency, language)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Repeat Modal / Batch Re-add preview sheet */}
      {repeatGroup && (
        <>
          <div className="repeat-backdrop" onClick={closeRepeatModal} />
          <div className="repeat-sheet glass">
            <div className="repeat-sheet-header">
              <h3>Повторить покупки ({repeatGroup.label})</h3>
              <button className="repeat-close-btn" onClick={closeRepeatModal}>
                ✕
              </button>
            </div>
            <p className="repeat-hint">
              Выберите товары, которые нужно вернуть в активный список:
            </p>

            <div className="repeat-items-list">
              {repeatGroup.items.map((item) => {
                const isSelected = selectedItemIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`repeat-item-row ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleRepeatItem(item.id)}
                  >
                    <div className={`preview-checkbox ${isSelected ? "checked" : ""}`}>
                      {isSelected && (
                        <svg viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="repeat-item-meta">
                      <span className="repeat-name">{item.name}</span>
                      <span className="repeat-qty">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="repeat-footer">
              <button
                className="repeat-confirm-btn"
                disabled={selectedItemIds.size === 0 || readdMutation.isPending}
                onClick={handleConfirmRepeat}
              >
                {readdMutation.isPending
                  ? "Добавление..."
                  : `Добавить в список (${selectedItemIds.size})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
