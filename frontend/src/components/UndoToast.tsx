import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { UndoToastData, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { IconUndo } from "./Icons";

export const UndoToastItem: React.FC<{
  toast: UndoToastData;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const queryClient = useQueryClient();
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const t = translations[language];

  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 280);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [handleDismiss]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.restoreItem(id);
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      handleDismiss();
    },
    onError: (err: any) => {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка при восстановлении товара");
    },
  });

  return (
    <div
      className={`undo-toast glass ${isExiting ? "is-exiting" : "show"}`}
      role="alert"
    >
      <span className="undo-toast-label">
        {t.deletedToast}: <b>{toast.name}</b>
      </span>
      <button
        type="button"
        className="undo-toast-btn press"
        onClick={() => restoreMutation.mutate(toast.id)}
        disabled={restoreMutation.isPending || isExiting}
      >
        <IconUndo size={15} />
        <span>{restoreMutation.isPending ? "..." : t.undo}</span>
      </button>
    </div>
  );
};

export const UndoToast: React.FC = () => {
  const undoToasts = useAppStore((s) => s.undoToasts);
  const undoToast = useAppStore((s) => s.undoToast);
  const dismissUndoToast = useAppStore((s) => s.dismissUndoToast);

  const activeList: UndoToastData[] =
    undoToasts && undoToasts.length > 0
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
