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

// ── Apply theme to DOM immediately (before first render) to prevent flash ──
// This runs once at module load — only in browser, safe for SSR/TMA.
const _storedTheme = (typeof localStorage !== "undefined"
  ? localStorage.getItem("mating_theme")
  : null) as ThemeMode | null;

const _initTheme: ThemeMode = _storedTheme ?? "auto";

// Apply immediately to <html> before React mounts
if (typeof document !== "undefined") {
  if (_initTheme === "auto" || !_initTheme) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", _initTheme);
  }
}

const _initLanguage = (typeof localStorage !== "undefined"
  ? (localStorage.getItem("mating_lang") as Language | null)
  : null) ?? "ru";

export const useAppStore = create<AppState>((set) => ({
  activeTab: "list",
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  theme: _initTheme,
  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_theme", theme);
    }
    // "auto" → remove attribute so OS preference governs
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

  isSheetOpen: false,
  sheetMode: "quick",
  sheetInitialText: "",
  openSheet: (mode = "quick", initialText = "") => {
    triggerHaptic("medium");
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
