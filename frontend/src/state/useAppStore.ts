import { create } from "zustand";
import { Language } from "../i18n";
import { triggerHaptic } from "../telegram/telegram";

export type ScreenTab = "list" | "stats" | "settings";
export type ThemeMode = "auto" | "light" | "dark";
export type SheetMode = "quick" | "ai";

interface UndoToastData {
  id: string;
  name: string;
}

interface AppState {
  activeTab: ScreenTab;
  setActiveTab: (tab: ScreenTab) => void;

  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  language: Language;
  setLanguage: (lang: Language) => void;

  currency: "UZS" | "RUB" | "USD";
  setCurrency: (currency: "UZS" | "RUB" | "USD") => void;

  // UX & Behavioral settings
  compactMode: boolean;
  setCompactMode: (enabled: boolean) => void;

  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;

  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;

  showPurchased: boolean;
  setShowPurchased: (enabled: boolean) => void;

  confirmDelete: boolean;
  setConfirmDelete: (enabled: boolean) => void;

  autoCategory: boolean;
  setAutoCategory: (enabled: boolean) => void;

  isSheetOpen: boolean;
  sheetMode: SheetMode;
  sheetInitialText: string;
  openSheet: (mode?: SheetMode, initialText?: string) => void;
  closeSheet: () => void;
  setSheetMode: (mode: SheetMode) => void;

  undoToast: UndoToastData | null;
  showUndoToast: (id: string, name: string) => void;
  clearUndoToast: () => void;

  isOffline: boolean;
  isSyncing: boolean;
  setOffline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
}

// ── Initial Local Storage Readers ──
const _storedTheme = (typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_theme")
  : null) as ThemeMode | null;

const _initTheme: ThemeMode = _storedTheme ?? "auto";

const _initCompact = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_compact") === "true"
  : false;

const _initMotion = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_reduced_motion") === "true"
  : false;

const _initHaptics = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_haptics") !== "false"
  : true;

const _initShowPurchased = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_show_purchased") !== "false"
  : true;

const _initConfirmDelete = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_confirm_delete") === "true"
  : false;

const _initAutoCat = typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_auto_cat") !== "false"
  : true;

// Apply immediately to <html> before React mounts
if (typeof document !== "undefined") {
  if (_initTheme === "auto" || !_initTheme) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", _initTheme);
  }
  if (_initCompact) document.documentElement.classList.add("compact");
  if (_initMotion) document.documentElement.classList.add("reduced-motion");
}

const _initLanguage = (typeof localStorage !== "undefined"
  ? (localStorage.getItem("mating_lang") as Language | null)
  : null) ?? "ru";

const _initCurrency = (typeof localStorage !== "undefined"
  ? (localStorage.getItem("mating_currency") as "UZS" | "RUB" | "USD" | null)
  : null) ?? "UZS";

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "list",
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  theme: _initTheme,
  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_theme", theme);
    }
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    set({ theme });
  },

  language: _initLanguage,
  setLanguage: (language) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_lang", language);
    }
    set({ language });
  },

  currency: _initCurrency,
  setCurrency: (currency) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_currency", currency);
    }
    set({ currency });
  },

  compactMode: _initCompact,
  setCompactMode: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_compact", String(enabled));
    }
    if (enabled) {
      document.documentElement.classList.add("compact");
    } else {
      document.documentElement.classList.remove("compact");
    }
    set({ compactMode: enabled });
  },

  reducedMotion: _initMotion,
  setReducedMotion: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_reduced_motion", String(enabled));
    }
    if (enabled) {
      document.documentElement.classList.add("reduced-motion");
    } else {
      document.documentElement.classList.remove("reduced-motion");
    }
    set({ reducedMotion: enabled });
  },

  hapticsEnabled: _initHaptics,
  setHapticsEnabled: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_haptics", String(enabled));
    }
    set({ hapticsEnabled: enabled });
  },

  showPurchased: _initShowPurchased,
  setShowPurchased: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_show_purchased", String(enabled));
    }
    set({ showPurchased: enabled });
  },

  confirmDelete: _initConfirmDelete,
  setConfirmDelete: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_confirm_delete", String(enabled));
    }
    set({ confirmDelete: enabled });
  },

  autoCategory: _initAutoCat,
  setAutoCategory: (enabled) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_auto_cat", String(enabled));
    }
    set({ autoCategory: enabled });
  },

  isSheetOpen: false,
  sheetMode: "quick",
  sheetInitialText: "",
  openSheet: (mode = "quick", initialText = "") => {
    if (get().hapticsEnabled) triggerHaptic("medium");
    document.body.classList.add("open");
    set({ isSheetOpen: true, sheetMode: mode, sheetInitialText: initialText });
  },
  closeSheet: () => {
    document.body.classList.remove("open");
    set({ isSheetOpen: false, sheetInitialText: "" });
  },
  setSheetMode: (sheetMode) => {
    set({ sheetMode });
  },

  undoToast: null,
  showUndoToast: (id, name) => set({ undoToast: { id, name } }),
  clearUndoToast: () => set({ undoToast: null }),

  isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  isSyncing: false,
  setOffline: (isOffline) => set({ isOffline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
