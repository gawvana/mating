import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const UndoToast: React.FC = () => {
  const queryClient = useQueryClient();
  const undoToast = useAppStore((s) => s.undoToast);
  const clearUndoToast = useAppStore((s) => s.clearUndoToast);
  const language = useAppStore((s) => s.language);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);

  const t = translations[language];
  const [animVisible, setAnimVisible] = useState(false);

  useEffect(() => {
    if (!undoToast) {
      setAnimVisible(false);
      return;
    }

    // Trigger spring slide-in on next animation frame
    const frame = requestAnimationFrame(() => {
      setAnimVisible(true);
    });

    const timer = setTimeout(() => {
      setAnimVisible(false);
      setTimeout(clearUndoToast, 350);
    }, 5000);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [undoToast, clearUndoToast]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.restoreItem(id);
    },
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setAnimVisible(false);
      setTimeout(clearUndoToast, 300);
    },
    onError: (err: any) => {
      if (hapticsEnabled) triggerHaptic("error");
      alert(err.message || "Ошибка при восстановлении товара");
    },
  });

  if (!undoToast) return null;

  return (
    <div className={`undo-toast ${animVisible ? "show" : ""}`} role="alert">
      <span>
        {t.deletedToast}: <b>{undoToast.name}</b>
      </span>
      <button
        type="button"
        className="undo-toast-btn"
        onClick={() => restoreMutation.mutate(undoToast.id)}
        disabled={restoreMutation.isPending}
      >
        {restoreMutation.isPending ? "..." : t.undo}
      </button>
    </div>
  );
};
