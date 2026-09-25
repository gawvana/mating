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

export const useAppStore = create<AppState>((set) => ({
  activeTab: "list",
  setActiveTab: (tab) => {
    triggerHaptic("selection");
    set({ activeTab: tab });
  },

  theme: (localStorage.getItem("mating_theme") as ThemeMode) || "auto",
  setTheme: (theme) => {
    localStorage.setItem("mating_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  language: (localStorage.getItem("mating_lang") as Language) || "ru",
  setLanguage: (language) => {
    localStorage.setItem("mating_lang", language);
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
    triggerHaptic("selection");
    set({ sheetMode });
  },

  undoToast: null,
  showUndoToast: (id, name) => {
    set({ undoToast: { id, name } });
  },
  clearUndoToast: () => set({ undoToast: null }),

  isOffline: !navigator.onLine,
  isSyncing: false,
  setOffline: (isOffline) => set({ isOffline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
