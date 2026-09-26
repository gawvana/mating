import React, { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { UndoToastData, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const UndoToastItem: React.FC<{
  toast: UndoToastData;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const t = translations[language];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.restoreItem(id);
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onDismiss(toast.id);
    },
    onError: (err: any) => {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка при восстановлении товара");
    },
  });

  return (
    <div className="undo-toast show" role="alert">
      <span>
        {t.deletedToast}: <b>{toast.name}</b>
      </span>
      <button
        type="button"
        className="undo-toast-btn"
        onClick={() => restoreMutation.mutate(toast.id)}
        disabled={restoreMutation.isPending}
      >
        {restoreMutation.isPending ? "..." : t.undo}
      </button>
    </div>
  );
};

export const UndoToast: React.FC = () => {
  const undoToasts = useAppStore((s) => s.undoToasts);
  const undoToast = useAppStore((s) => s.undoToast);
  const dismissUndoToast = useAppStore((s) => s.dismissUndoToast);

  const activeList: UndoToastData[] = undoToasts && undoToasts.length > 0
    ? undoToasts
    : undoToast
    ? [undoToast]
    : [];

  if (activeList.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Уведомления">
      {activeList.map((item) => (
        <UndoToastItem
          key={item.id}
          toast={item}
          onDismiss={dismissUndoToast}
        />
      ))}
    </div>
  );
};
