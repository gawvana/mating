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
        BackButton?: {
          isVisible: boolean;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          show: () => void;
          hide: () => void;
        };
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
  if (typeof window === "undefined") return "";

  // 1. Direct Telegram WebApp SDK object
  if (window.Telegram?.WebApp?.initData && window.Telegram.WebApp.initData.length > 0) {
    return window.Telegram.WebApp.initData;
  }

  // 2. Hash parameters (#tgWebAppData=...)
  try {
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const tgData = hashParams.get("tgWebAppData");
      if (tgData) return tgData;
    }

    // 3. Search query parameters (?tgWebAppData=...)
    const searchParams = new URLSearchParams(window.location.search);
    const tgSearchData = searchParams.get("tgWebAppData");
    if (tgSearchData) return tgSearchData;
  } catch {}

  return "";
}

export function isTelegramWebApp(): boolean {
  return getTelegramInitData().length > 0;
}

export function getTelegramStartParam(): string {
  if (typeof window === "undefined") return "";

  // 1. Direct Telegram WebApp SDK initDataUnsafe.start_param
  try {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam && typeof startParam === "string") {
      return startParam;
    }
  } catch {}

  // 2. Query parameter: tgWebAppStartParam, start_param, or share
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const param = searchParams.get("tgWebAppStartParam") || searchParams.get("start_param") || searchParams.get("share");
    if (param) return param;
  } catch {}

  // 3. Hash parameter: tgWebAppStartParam, start_param, or share
  try {
    const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const param = hashParams.get("tgWebAppStartParam") || hashParams.get("start_param") || hashParams.get("share");
      if (param) return param;
    }
  } catch {}

  return "";
}

export function setupTelegramBackButton(onBack: () => void, isVisible: boolean): () => void {
  if (typeof window === "undefined" || !window.Telegram?.WebApp?.BackButton) {
    return () => {};
  }
  const bb = window.Telegram.WebApp.BackButton;
  if (isVisible) {
    bb.show();
    bb.onClick(onBack);
    return () => {
      try {
        bb.offClick(onBack);
      } catch {}
    };
  } else {
    bb.hide();
    return () => {};
  }
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
