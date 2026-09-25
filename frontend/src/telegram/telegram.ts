declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: any;
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        isExpanded?: boolean;
        expand: () => void;
        ready: () => void;
        close: () => void;
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function isTelegramWebApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData && window.Telegram.WebApp.initData.length > 0);
}

export function getTelegramInitData(): string {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  return "";
}

export function initTelegramApp(): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    const webapp = window.Telegram.WebApp;
    try {
      webapp.ready();
      webapp.expand();
    } catch {
      // Ignore if not in full TMA environment
    }
  }
}

export function triggerHaptic(type: "light" | "medium" | "heavy" | "selection" | "success" | "error"): void {
  if (typeof window === "undefined") return;

  // 1. Telegram WebApp Haptic
  if (window.Telegram?.WebApp?.HapticFeedback) {
    try {
      const hf = window.Telegram.WebApp.HapticFeedback;
      if (type === "selection") {
        hf.selectionChanged();
      } else if (type === "success" || type === "error") {
        hf.notificationOccurred(type === "success" ? "success" : "error");
      } else {
        hf.impactOccurred(type);
      }
      return;
    } catch {
      // fallback to navigator.vibrate
    }
  }

  // 2. Browser standard vibration fallback
  try {
    if (navigator.vibrate) {
      if (type === "selection") navigator.vibrate(6);
      else if (type === "light") navigator.vibrate(10);
      else if (type === "medium") navigator.vibrate(20);
      else if (type === "heavy") navigator.vibrate(35);
      else if (type === "error") navigator.vibrate([20, 40, 20]);
      else if (type === "success") navigator.vibrate([15, 30, 25]);
    }
  } catch {
    // Silently ignore if not supported
  }
}
