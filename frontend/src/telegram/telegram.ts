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

export function getTelegramInitData(): string {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  // Browser fallback for standalone development/testing:
  const demoPayload = JSON.stringify({
    id: 999999,
    username: "demo_user",
    first_name: "Demo User",
    language_code: "ru",
  });
  return `tma-test ${demoPayload}`;
}

export function initTelegramApp(): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    const webapp = window.Telegram.WebApp;
    webapp.ready();
    webapp.expand();
  }
}

export function triggerHaptic(type: "light" | "medium" | "heavy" | "selection" | "success" | "error"): void {
  if (typeof window === "undefined" || !window.Telegram?.WebApp?.HapticFeedback) {
    return;
  }
  const hf = window.Telegram.WebApp.HapticFeedback;
  try {
    if (type === "selection") {
      hf.selectionChanged();
    } else if (type === "success" || type === "error") {
      hf.notificationOccurred(type === "success" ? "success" : "error");
    } else {
      hf.impactOccurred(type);
    }
  } catch {
    // Graceful fallback if haptics fail
  }
}
