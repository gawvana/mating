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
export type SpringCurve = "snappy" | "balanced" | "soft" | "linear";
export type MotionPreset = "Apple-like" | "Minimal" | "Battery Saver" | "Custom";

interface UndoToastData {
  id: string;
  name: string;
}

/** One of the 15 configurable animations */
export interface AnimSetting {
  enabled: boolean;
  /** 0..100 intensity multiplier */
  intensity: number;
  /** 100..600 ms duration */
  duration: number;
  /** Easing / spring curve preset */
  curve: SpringCurve;
}

export const ANIM_KEYS = [
  "fabMorph",
  "sheetSpring",
  "purchaseTransition",
  "animatedTotal",
  "animatedBudget",
  "tabIndicator",
  "checkboxSpring",
  "swipeResistance",
  "longPressMenu",
  "editMorph",
  "statusPill",
  "headerMotion",
  "keyboardSheet",
  "listAddDelete",
  "hapticFeedback",
] as const;

export type AnimKey = typeof ANIM_KEYS[number];

/** Motion profile: 15 named animations + global settings */
export interface MotionProfile {
  preset: MotionPreset;
  animationStyle: AnimationStyle;
  glassMode: GlassMode;
  hapticMode: HapticMode;
  batterySaver: boolean;
  intensity: number;
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

const DEFAULT_ANIM_SETTING: AnimSetting = {
  enabled: true,
  intensity: 100,
  duration: 450,
  curve: "snappy",
};

export const DEFAULT_MOTION_PROFILE: MotionProfile = {
  preset: "Apple-like",
  animationStyle: "Normal",
  glassMode: "Adaptive",
  hapticMode: "Normal",
  batterySaver: false,
  intensity: 100,
  fabMorph: { enabled: true, intensity: 100, duration: 450, curve: "snappy" },
  sheetSpring: { enabled: true, intensity: 100, duration: 600, curve: "snappy" },
  purchaseTransition: { enabled: true, intensity: 100, duration: 400, curve: "snappy" },
  animatedTotal: { enabled: true, intensity: 100, duration: 400, curve: "balanced" },
  animatedBudget: { enabled: true, intensity: 100, duration: 700, curve: "snappy" },
  tabIndicator: { enabled: true, intensity: 100, duration: 650, curve: "snappy" },
  checkboxSpring: { enabled: true, intensity: 100, duration: 350, curve: "snappy" },
  swipeResistance: { enabled: true, intensity: 100, duration: 450, curve: "snappy" },
  longPressMenu: { enabled: true, intensity: 100, duration: 250, curve: "snappy" },
  editMorph: { enabled: true, intensity: 100, duration: 400, curve: "snappy" },
  statusPill: { enabled: true, intensity: 100, duration: 400, curve: "snappy" },
  headerMotion: { enabled: true, intensity: 100, duration: 600, curve: "snappy" },
  keyboardSheet: { enabled: true, intensity: 100, duration: 350, curve: "snappy" },
  listAddDelete: { enabled: true, intensity: 100, duration: 350, curve: "snappy" },
  hapticFeedback: { enabled: true, intensity: 100, duration: 200, curve: "snappy" },
};

function loadMotionProfile(): MotionProfile {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mating_motion_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const profile: MotionProfile = { ...DEFAULT_MOTION_PROFILE };

          if (parsed.preset) profile.preset = parsed.preset;
          if (parsed.animationStyle) profile.animationStyle = parsed.animationStyle;
          if (parsed.glassMode) profile.glassMode = parsed.glassMode;
          if (parsed.hapticMode) profile.hapticMode = parsed.hapticMode;
          if (typeof parsed.batterySaver === "boolean") profile.batterySaver = parsed.batterySaver;
          if (typeof parsed.intensity === "number") profile.intensity = parsed.intensity;

          // Safely copy each animation setting with fallbacks
          ANIM_KEYS.forEach((key) => {
            const rawSetting = parsed[key];
            if (rawSetting && typeof rawSetting === "object") {
              profile[key] = {
                enabled: typeof rawSetting.enabled === "boolean" ? rawSetting.enabled : DEFAULT_MOTION_PROFILE[key].enabled,
                intensity: typeof rawSetting.intensity === "number" ? rawSetting.intensity : DEFAULT_MOTION_PROFILE[key].intensity,
                duration: typeof rawSetting.duration === "number" ? rawSetting.duration : DEFAULT_MOTION_PROFILE[key].duration,
                curve: rawSetting.curve || DEFAULT_MOTION_PROFILE[key].curve,
              };
            }
          });

          return profile;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to parse saved motion profile, using default", e);
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

  // Motion Profile State
  motionProfile: MotionProfile;
  setMotionProfile: (profile: MotionProfile) => void;
  updateMotionProfile: (patch: Partial<MotionProfile>) => void;
  updateAnimSetting: (key: AnimKey, patch: Partial<AnimSetting>) => void;
  applyPreset: (preset: MotionPreset) => void;
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
    const current = get().motionProfile || DEFAULT_MOTION_PROFILE;
    const next: MotionProfile = { ...current, ...patch, preset: patch.preset || "Custom" };
    saveMotionProfile(next);
    set({ motionProfile: next });
  },

  updateAnimSetting: (key, patch) => {
    const current = get().motionProfile || DEFAULT_MOTION_PROFILE;
    const currentSetting = current[key] || DEFAULT_ANIM_SETTING;
    const next: MotionProfile = {
      ...current,
      preset: "Custom",
      [key]: { ...currentSetting, ...patch },
    };
    saveMotionProfile(next);
    set({ motionProfile: next });
  },

  applyPreset: (preset: MotionPreset) => {
    let next: MotionProfile;

    if (preset === "Apple-like") {
      next = { ...DEFAULT_MOTION_PROFILE, preset: "Apple-like" };
    } else if (preset === "Minimal") {
      next = {
        ...DEFAULT_MOTION_PROFILE,
        preset: "Minimal",
        animationStyle: "Minimal",
        glassMode: "Minimal",
        batterySaver: true,
        intensity: 30,
        fabMorph: { enabled: false, intensity: 0, duration: 150, curve: "linear" },
        sheetSpring: { enabled: false, intensity: 0, duration: 200, curve: "linear" },
        purchaseTransition: { enabled: false, intensity: 0, duration: 150, curve: "linear" },
        listAddDelete: { enabled: false, intensity: 0, duration: 150, curve: "linear" },
        statusPill: { enabled: true, intensity: 50, duration: 250, curve: "snappy" },
        tabIndicator: { enabled: true, intensity: 50, duration: 250, curve: "snappy" },
      };
    } else if (preset === "Battery Saver") {
      next = {
        ...DEFAULT_MOTION_PROFILE,
        preset: "Battery Saver",
        animationStyle: "Reduced",
        glassMode: "Minimal",
        batterySaver: true,
        intensity: 50,
      };
    } else {
      next = { ...get().motionProfile, preset: "Custom" };
    }

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
