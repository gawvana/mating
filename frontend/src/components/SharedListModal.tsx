import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { PublicSnapshotResponse } from "../types";

interface SharedListModalProps {
  snapshot: PublicSnapshotResponse;
  onClose: () => void;
  onImported?: () => void;
}

export const SharedListModal: React.FC<SharedListModalProps> = ({
  snapshot,
  onClose,
  onImported,
}) => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const showUndoToast = useAppStore((s) => s.showUndoToast);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(snapshot.items.map((_, i) => i))
  );

  const toggleSelect = (index: number) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleImport = async () => {
    const selected = snapshot.items.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;

    setIsImporting(true);
    if (hapticsEnabled) triggerHaptic("medium");

    try {
      await api.batchCreateItems(
        selected.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          price: it.price,
          currency_code: it.currency_code || "UZS",
        }))
      );

      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });

      if (hapticsEnabled) triggerHaptic("success");
      showUndoToast(
        "imported_share",
        language === "uz"
          ? `${selected.length} ta mahsulot ro'yxatingizga qo'shildi!`
          : `Добавлено в список: ${selected.length} поз.`
      );

      if (onImported) onImported();
      onClose();
    } catch (err: any) {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка импорта");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="shared-list-overlay" role="dialog" aria-modal="true">
      <div className="shared-list-backdrop" onClick={onClose} />
      <div className="shared-list-sheet glass">
        <div className="shared-list-header">
          <div className="shared-list-title-group">
            <span className="shared-list-badge">
              {language === "uz" ? "Umumiy ro'yxat" : "Общий список"}
            </span>
            <h3 className="shared-list-title">{snapshot.title || "Список покупок"}</h3>
            <p className="shared-list-meta">
              {language === "uz"
                ? `${snapshot.items.length} ta mahsulot • Havola orqali`
                : `${snapshot.items.length} поз. • Открыто по ссылке`}
            </p>
          </div>
          <button
            type="button"
            className="shared-list-close-btn press"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="shared-list-body">
          <div className="shared-list-items">
            {snapshot.items.map((item, idx) => {
              const isSelected = selectedIndices.has(idx);
              return (
                <div
                  key={`${item.name}-${idx}`}
                  className={`shared-item-row ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleSelect(idx)}
                >
                  <div className={`shared-item-check ${isSelected ? "checked" : ""}`}>
                    {isSelected && "✓"}
                  </div>
                  <div className="shared-item-info">
                    <span className="shared-item-name">{item.name}</span>
                    <span className="shared-item-sub">
                      {item.category && item.category !== "Другое" && (
                        <span className="shared-item-cat">{item.category} • </span>
                      )}
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  {item.price ? (
                    <span className="shared-item-price">
                      {item.price.toLocaleString("ru-RU")} {item.currency_code || "UZS"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="shared-list-actions">
          <button
            type="button"
            className="btn btn-secondary press"
            onClick={onClose}
            disabled={isImporting}
          >
            {language === "uz" ? "Bekor qilish" : "Отмена"}
          </button>
          <button
            type="button"
            className="btn btn-primary press"
            onClick={handleImport}
            disabled={isImporting || selectedIndices.size === 0}
          >
            {isImporting
              ? language === "uz"
                ? "Qo'shilmoqda..."
                : "Добавление..."
              : language === "uz"
              ? `Ro'yxatga qo'shish (${selectedIndices.size})`
              : `Добавить в список (${selectedIndices.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};
