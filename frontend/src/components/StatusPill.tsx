import React, { useEffect, useRef } from "react";

interface StatusPillProps {
  isSyncing: boolean;
  isOffline: boolean;
  hasError?: boolean;
}

type PillState = "idle" | "saving" | "synced" | "offline" | "error";

export const StatusPill: React.FC<StatusPillProps> = ({ isSyncing, isOffline, hasError }) => {
  const [state, setState] = React.useState<PillState>("idle");
  const [visible, setVisible] = React.useState(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSyncingRef = useRef(isSyncing);

  useEffect(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);

    const wasSyncing = prevSyncingRef.current;
    prevSyncingRef.current = isSyncing;

    let next: PillState = "idle";
    if (hasError) next = "error";
    else if (isOffline) next = "offline";
    else if (isSyncing) next = "saving";
    else next = "idle";

    // If transitioning from saving → nothing, briefly show "synced"
    if (wasSyncing && next === "idle") {
      setState("synced");
      setVisible(true);
      autoHideTimer.current = setTimeout(() => {
        setVisible(false);
        autoHideTimer.current = setTimeout(() => setState("idle"), 350);
      }, 2000);
      return;
    }

    if (next === "idle") {
      setVisible(false);
      autoHideTimer.current = setTimeout(() => setState("idle"), 350);
    } else {
      setState(next);
      setVisible(true);
    }

    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [isSyncing, isOffline, hasError]);

  const labels: Record<PillState, string> = {
    idle: "",
    saving: "Сохраняем…",
    synced: "Синхронизировано ✓",
    offline: "Офлайн",
    error: "Ошибка",
  };

  if (state === "idle" && !visible) return null;

  return (
    <span className={`status-pill ${state} ${visible ? "visible" : ""}`} aria-live="polite" aria-atomic="true">
      <span className="status-pill-dot" aria-hidden="true" />
      {labels[state]}
    </span>
  );
};
