import { create } from "zustand";
import { Language, normalizeLanguage } from "../i18n";
import { triggerHaptic } from "../telegram/telegram";

export type ScreenTab = "list" | "stats" | "settings";

function getInitialTab(): ScreenTab {
  if (typeof window !== "undefined") {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("stats")) return "stats";
    if (path.includes("settings")) return "settings";
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("stats")) return "stats";
    if (hash.includes("settings")) return "settings";
  }
  return "list";
}
export type ThemeMode = "auto" | "light" | "dark";
export type SheetMode = "quick" | "ai";
export type AnimationStyle = "Minimal" | "Reduced" | "Normal" | "Expressive";
export type GlassMode = "Full" | "Adaptive" | "Reduced" | "Minimal";
export type HapticMode = "Off" | "Light" | "Normal";

interface UndoToastData {
  id: string;
  name: string;
}

/** One of the 15 configurable animations */
export interface AnimSetting {
  enabled: boolean;
  /** 0..100 intensity multiplier */
  intensity: number;
}

/** Motion profile: 15 named animations + global settings */
export interface MotionProfile {
  animationStyle: AnimationStyle;
  glassMode: GlassMode;
  hapticMode: HapticMode;
  batterySaver: boolean;
  // 15 animations
  fabMorph: AnimSetting;
  sheetSpring: AnimSetting;
  purchaseTransition: AnimSetting;
  animatedTotal: AnimSetting;
  animatedBudget: AnimSetting;
  tabIndicator: AnimSetting;
  checkboxSpring: AnimSetting;
  swipeResistance: AnimSetting;
  longPressMenu: AnimSetting;
  editMorph: AnimSetting;
  statusPill: AnimSetting;
  headerMotion: AnimSetting;
  keyboardSheet: AnimSetting;
  listAddDelete: AnimSetting;
  hapticFeedback: AnimSetting;
}

const DEFAULT_MOTION_PROFILE: MotionProfile = {
  animationStyle: "Normal",
  glassMode: "Adaptive",
  hapticMode: "Normal",
  batterySaver: false,
  fabMorph: { enabled: true, intensity: 100 },
  sheetSpring: { enabled: true, intensity: 100 },
  purchaseTransition: { enabled: true, intensity: 100 },
  animatedTotal: { enabled: true, intensity: 100 },
  animatedBudget: { enabled: true, intensity: 100 },
  tabIndicator: { enabled: true, intensity: 100 },
  checkboxSpring: { enabled: true, intensity: 100 },
  swipeResistance: { enabled: true, intensity: 100 },
  longPressMenu: { enabled: true, intensity: 100 },
  editMorph: { enabled: true, intensity: 100 },
  statusPill: { enabled: true, intensity: 100 },
  headerMotion: { enabled: true, intensity: 100 },
  keyboardSheet: { enabled: true, intensity: 100 },
  listAddDelete: { enabled: true, intensity: 100 },
  hapticFeedback: { enabled: true, intensity: 100 },
};

const MINIMAL_MOTION_PROFILE: Partial<MotionProfile> = {
  animationStyle: "Minimal",
  glassMode: "Minimal",
  batterySaver: true,
  fabMorph: { enabled: false, intensity: 0 },
  sheetSpring: { enabled: false, intensity: 0 },
  purchaseTransition: { enabled: false, intensity: 0 },
  listAddDelete: { enabled: false, intensity: 0 },
  statusPill: { enabled: true, intensity: 50 },  // keep functional
  tabIndicator: { enabled: true, intensity: 50 },  // keep functional
};

function loadMotionProfile(): MotionProfile {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mating_motion_profile");
      if (raw) {
        return { ...DEFAULT_MOTION_PROFILE, ...JSON.parse(raw) };
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_MOTION_PROFILE };
}

function saveMotionProfile(profile: MotionProfile) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mating_motion_profile", JSON.stringify(profile));
    }
  } catch {
    // ignore
  }
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

  // Motion Profile
  motionProfile: MotionProfile;
  setMotionProfile: (profile: MotionProfile) => void;
  updateMotionProfile: (patch: Partial<MotionProfile>) => void;
  updateAnimSetting: (key: keyof Pick<MotionProfile,
    "fabMorph" | "sheetSpring" | "purchaseTransition" | "animatedTotal" |
    "animatedBudget" | "tabIndicator" | "checkboxSpring" | "swipeResistance" |
    "longPressMenu" | "editMorph" | "statusPill" | "headerMotion" |
    "keyboardSheet" | "listAddDelete" | "hapticFeedback"
  >, patch: Partial<AnimSetting>) => void;
  applyMinimalPreset: () => void;
  resetMotionProfile: () => void;

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
  if (_initCompact) document.documentElement.classList.add("compact-mode");
  if (_initMotion) document.documentElement.classList.add("reduced-motion");
}

const _initLanguage: Language = normalizeLanguage(
  typeof localStorage !== "undefined" ? localStorage.getItem("mating_lang") : null
);

const _initCurrency = (typeof localStorage !== "undefined"
  ? (localStorage.getItem("mating_currency") as "UZS" | "RUB" | "USD" | null)
  : null) ?? "UZS";

const _initMotionProfile = loadMotionProfile();

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: getInitialTab(),
  setActiveTab: (tab) => {
    if (typeof window !== "undefined" && window.history?.pushState) {
      const current = window.location.pathname.toLowerCase();
      const target = tab === "list" ? "/" : `/${tab}`;
      if (current !== target && (current === "/" || current === "/stats" || current === "/settings")) {
        window.history.pushState({ tab }, "", target);
      }
    }
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
      document.documentElement.classList.add("compact-mode");
    } else {
      document.documentElement.classList.remove("compact-mode");
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

  // ── MOTION PROFILE ──
  motionProfile: _initMotionProfile,

  setMotionProfile: (profile) => {
    saveMotionProfile(profile);
    set({ motionProfile: profile });
  },

  updateMotionProfile: (patch) => {
    const next = { ...get().motionProfile, ...patch };
    saveMotionProfile(next);
    set({ motionProfile: next });
  },

  updateAnimSetting: (key, patch) => {
    const current = get().motionProfile;
    const next: MotionProfile = {
      ...current,
      [key]: { ...(current[key] as AnimSetting), ...patch },
    };
    saveMotionProfile(next);
    set({ motionProfile: next });
  },

  applyMinimalPreset: () => {
    const next: MotionProfile = { ...DEFAULT_MOTION_PROFILE, ...MINIMAL_MOTION_PROFILE } as MotionProfile;
    saveMotionProfile(next);
    set({ motionProfile: next });
  },

  resetMotionProfile: () => {
    const next = { ...DEFAULT_MOTION_PROFILE };
    saveMotionProfile(next);
    set({ motionProfile: next });
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
