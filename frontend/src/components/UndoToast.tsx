import React, { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const UndoToast: React.FC = () => {
  const queryClient = useQueryClient();
  const { undoToast, clearUndoToast, language } = useAppStore();
  const t = translations[language];

  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => {
      clearUndoToast();
    }, 5000);
    return () => clearTimeout(timer);
  }, [undoToast, clearUndoToast]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.restoreItem(id);
    },
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      clearUndoToast();
    },
  });

  if (!undoToast) return null;

  return (
    <div className="undo-toast" role="alert">
      <span>
        {t.deletedToast}: <b>{undoToast.name}</b>
      </span>
      <button
        className="undo-toast-btn"
        onClick={() => restoreMutation.mutate(undoToast.id)}
        disabled={restoreMutation.isPending}
      >
        {t.undo}
      </button>
    </div>
  );
};
