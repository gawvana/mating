import { create } from "zustand";
import { Language, normalizeLanguage } from "../i18n";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";

export type ScreenTab = "list" | "ai" | "history" | "stats" | "settings";

function getInitialTab(): ScreenTab {
  if (typeof window !== "undefined") {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("ai")) return "ai";
    if (path.includes("history")) return "history";
    if (path.includes("stats")) return "stats";
    if (path.includes("settings")) return "settings";
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("ai")) return "ai";
    if (hash.includes("history")) return "history";
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

export type SmartSortMode = "default" | "category" | "bought" | "price" | "name" | "recent" | "custom";
export type CornerRadiusPreset = "sharp" | "standard" | "soft" | "round" | "custom";
export type GlassPreset = "crystal" | "frosted" | "deep" | "tinted" | "ultra-clear" | "custom";
export type AIConfirmationLevel = "always" | "destructive_only" | "silent";
export type AISuggestionFrequency = "high" | "normal" | "low" | "off";
export type AIPersonality = "concise" | "friendly" | "analytical";

export interface LiquidGlassConfig {
  intensity: number;
  blur: number;
  transparency: number;
  saturation: number;
  borderOpacity: number;
  specular: number;
  shadowDepth: number;
  noise: boolean;
  preset: GlassPreset;
}

export interface SourceRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface UndoToastData {
  id: string;
  name: string;
  timestamp?: number;
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

  // Category ordering
  categoryOrder: string[];
  setCategoryOrder: (order: string[]) => void;

  // Search state
  searchQuery: string;
  isSearchOpen: boolean;
  setSearchQuery: (query: string) => void;
  setIsSearchOpen: (open: boolean) => void;

  // Quick Add State (Mobile fast flow)
  isQuickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  toggleQuickAdd: () => void;

  // Personalization & Appearance
  accentColor: string;
  customAccentHex: string;
  setAccentColor: (color: string) => void;
  setCustomAccentHex: (hex: string) => void;
  cornerRadiusPreset: CornerRadiusPreset;
  cornerRadiusCustom: number;
  setCornerRadiusPreset: (preset: CornerRadiusPreset) => void;
  setCornerRadiusCustom: (px: number) => void;
  masterMotion: boolean;
  setMasterMotion: (enabled: boolean) => void;

  // Liquid Glass Customizer
  liquidGlass: LiquidGlassConfig;
  updateLiquidGlass: (patch: Partial<LiquidGlassConfig>) => void;
  applyGlassPreset: (preset: GlassPreset) => void;

  // AI Settings
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  priceInference: boolean;
  setPriceInference: (enabled: boolean) => void;
  quantityInference: boolean;
  setQuantityInference: (enabled: boolean) => void;
  confirmationLevel: AIConfirmationLevel;
  setConfirmationLevel: (lvl: AIConfirmationLevel) => void;
  suggestionFrequency: AISuggestionFrequency;
  setSuggestionFrequency: (freq: AISuggestionFrequency) => void;
  aiLanguage: "auto" | "ru" | "uz" | "en";
  setAiLanguage: (lang: "auto" | "ru" | "uz" | "en") => void;
  aiPersonality: AIPersonality;
  setAiPersonality: (personality: AIPersonality) => void;

  // Smart Sort State
  smartSortMode: SmartSortMode;
  setSmartSortMode: (mode: SmartSortMode) => void;
  customItemOrder: string[];
  setCustomItemOrder: (order: string[]) => void;
  reorderCustomItems: (fromIndex: number, toIndex: number) => void;

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
  editingItem: ShoppingItem | null;
  editSourceRect: SourceRect | null;
  openSheet: (mode?: SheetMode, initialText?: string) => void;
  openEditSheet: (item: ShoppingItem, sourceRect?: SourceRect | null) => void;
  closeSheet: () => void;
  setSheetMode: (mode: SheetMode) => void;

  undoToast: UndoToastData | null;
  undoToasts: UndoToastData[];
  showUndoToast: (id: string, name: string) => void;
  dismissUndoToast: (id: string) => void;
  clearUndoToast: () => void;

  isOffline: boolean;
  isSyncing: boolean;
  hasSyncError: boolean;
  setOffline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setSyncError: (hasError: boolean) => void;
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

const _initCategoryOrder: string[] = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mating_cat_order");
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
})();

export const GLASS_PRESETS: Record<GlassPreset, Omit<LiquidGlassConfig, "preset">> = {
  crystal: { intensity: 100, blur: 24, transparency: 85, saturation: 110, borderOpacity: 70, specular: 80, shadowDepth: 25, noise: false },
  frosted: { intensity: 90, blur: 28, transparency: 60, saturation: 90, borderOpacity: 55, specular: 50, shadowDepth: 35, noise: true },
  deep: { intensity: 100, blur: 20, transparency: 40, saturation: 120, borderOpacity: 80, specular: 70, shadowDepth: 50, noise: false },
  tinted: { intensity: 95, blur: 22, transparency: 65, saturation: 140, borderOpacity: 60, specular: 65, shadowDepth: 30, noise: false },
  "ultra-clear": { intensity: 80, blur: 14, transparency: 92, saturation: 100, borderOpacity: 40, specular: 90, shadowDepth: 15, noise: false },
  custom: { intensity: 100, blur: 22, transparency: 65, saturation: 110, borderOpacity: 70, specular: 60, shadowDepth: 30, noise: false },
};

export const DEFAULT_GLASS_CONFIG: LiquidGlassConfig = {
  ...GLASS_PRESETS.crystal,
  preset: "crystal",
};

export const CORNER_RADIUS_MAP: Record<CornerRadiusPreset, number> = {
  sharp: 8,
  standard: 16,
  soft: 22,
  round: 28,
  custom: 16,
};

const _initAccent = (typeof localStorage !== "undefined" ? localStorage.getItem("mating_accent") : null) || "#4F5DFF";
const _initCustomAccent = (typeof localStorage !== "undefined" ? localStorage.getItem("mating_custom_accent") : null) || "#4F5DFF";
const _initCornerPreset = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_corner_preset") : null) as CornerRadiusPreset) || "standard";
const _initCornerCustom = Number(typeof localStorage !== "undefined" ? localStorage.getItem("mating_corner_custom") : 16) || 16;
const _initMasterMotion = typeof localStorage !== "undefined" ? localStorage.getItem("mating_master_motion") !== "false" : true;

const _initGlassConfig: LiquidGlassConfig = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mating_liquid_glass");
      if (raw) return { ...DEFAULT_GLASS_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_GLASS_CONFIG };
})();

const _initAiEnabled = typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_enabled") !== "false" : true;
const _initPriceInf = typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_price_inf") !== "false" : true;
const _initQtyInf = typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_qty_inf") !== "false" : true;
const _initAiConfirm = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_confirm") : null) as AIConfirmationLevel) || "destructive_only";
const _initAiSuggest = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_suggest") : null) as AISuggestionFrequency) || "normal";
const _initAiLang = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_lang") : null) as "auto" | "ru" | "uz" | "en") || "auto";
const _initAiPersonality = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_ai_personality") : null) as AIPersonality) || "concise";

const _initSortMode = ((typeof localStorage !== "undefined" ? localStorage.getItem("mating_sort_mode") : null) as SmartSortMode) || "default";
const _initCustomItemOrder: string[] = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mating_custom_order");
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
})();

export function applyThemeStyles(
  accent: string,
  radius: number,
  glass: LiquidGlassConfig,
  masterMotion: boolean
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--p", `color-mix(in srgb, ${accent} 22%, #FBF8FF)`);
  root.style.setProperty("--on-p", accent);

  root.style.setProperty("--r1", `${Math.max(4, Math.round(radius * 0.75))}px`);
  root.style.setProperty("--r2", `${radius}px`);
  root.style.setProperty("--r3", `${Math.round(radius * 1.35)}px`);
  root.style.setProperty("--r4", `${Math.round(radius * 1.7)}px`);
  root.style.setProperty("--r5", `${Math.round(radius * 2.1)}px`);

  const t = Math.max(0, Math.min(100, glass.transparency)) / 100;
  root.style.setProperty("--blur", `${glass.blur}px`);
  root.style.setProperty("--glass", `rgba(255,255,255, ${Math.min(0.85, 0.12 + t * 0.35).toFixed(2)})`);
  root.style.setProperty("--glass2", `rgba(255,255,255, ${Math.min(0.95, 0.35 + t * 0.45).toFixed(2)})`);
  root.style.setProperty("--edge", `rgba(255,255,255, ${(glass.borderOpacity / 100 * 0.85).toFixed(2)})`);
  root.style.setProperty("--sh", `rgba(40,44,110, ${(glass.shadowDepth / 100 * 0.35).toFixed(2)})`);

  if (!masterMotion) {
    root.classList.add("reduced-motion");
  } else {
    const isReduced = typeof localStorage !== "undefined" && localStorage.getItem("mating_reduced_motion") === "true";
    if (!isReduced) root.classList.remove("reduced-motion");
  }
}

// Apply immediately to <html> before React mounts
if (typeof document !== "undefined") {
  if (_initTheme === "auto" || !_initTheme) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", _initTheme);
  }
  if (_initCompact) document.documentElement.classList.add("compact-mode");
  if (_initMotion || !_initMasterMotion) document.documentElement.classList.add("reduced-motion");

  const initialRadius = _initCornerPreset === "custom" ? _initCornerCustom : CORNER_RADIUS_MAP[_initCornerPreset] || 16;
  applyThemeStyles(_initAccent, initialRadius, _initGlassConfig, _initMasterMotion);
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
      if (current !== target) {
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

  categoryOrder: _initCategoryOrder,
  setCategoryOrder: (order) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("mating_cat_order", JSON.stringify(order));
      }
    } catch {}
    set({ categoryOrder: order });
  },

  searchQuery: "",
  isSearchOpen: false,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),

  // ── QUICK ADD FLOW ──
  isQuickAddOpen: false,
  openQuickAdd: () => {
    if (get().hapticsEnabled) triggerHaptic("light");
    set({ isQuickAddOpen: true });
  },
  closeQuickAdd: () => set({ isQuickAddOpen: false }),
  toggleQuickAdd: () => {
    const next = !get().isQuickAddOpen;
    if (next && get().hapticsEnabled) triggerHaptic("light");
    set({ isQuickAddOpen: next });
  },

  // ── PERSONALIZATION & LIQUID GLASS ──
  accentColor: _initAccent,
  customAccentHex: _initCustomAccent,
  setAccentColor: (accentColor) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_accent", accentColor);
    const r = get().cornerRadiusPreset === "custom" ? get().cornerRadiusCustom : CORNER_RADIUS_MAP[get().cornerRadiusPreset] || 16;
    applyThemeStyles(accentColor, r, get().liquidGlass, get().masterMotion);
    set({ accentColor });
  },
  setCustomAccentHex: (customAccentHex) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_custom_accent", customAccentHex);
    set({ customAccentHex });
  },
  cornerRadiusPreset: _initCornerPreset,
  cornerRadiusCustom: _initCornerCustom,
  setCornerRadiusPreset: (cornerRadiusPreset) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_corner_preset", cornerRadiusPreset);
    const r = cornerRadiusPreset === "custom" ? get().cornerRadiusCustom : CORNER_RADIUS_MAP[cornerRadiusPreset] || 16;
    applyThemeStyles(get().accentColor, r, get().liquidGlass, get().masterMotion);
    set({ cornerRadiusPreset });
  },
  setCornerRadiusCustom: (px) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_corner_custom", String(px));
    applyThemeStyles(get().accentColor, px, get().liquidGlass, get().masterMotion);
    set({ cornerRadiusCustom: px, cornerRadiusPreset: "custom" });
  },
  masterMotion: _initMasterMotion,
  setMasterMotion: (masterMotion) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_master_motion", String(masterMotion));
    const r = get().cornerRadiusPreset === "custom" ? get().cornerRadiusCustom : CORNER_RADIUS_MAP[get().cornerRadiusPreset] || 16;
    applyThemeStyles(get().accentColor, r, get().liquidGlass, masterMotion);
    set({ masterMotion });
  },
  liquidGlass: _initGlassConfig,
  updateLiquidGlass: (patch) => {
    const current = get().liquidGlass;
    const next: LiquidGlassConfig = { ...current, ...patch, preset: patch.preset || "custom" };
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_liquid_glass", JSON.stringify(next));
    const r = get().cornerRadiusPreset === "custom" ? get().cornerRadiusCustom : CORNER_RADIUS_MAP[get().cornerRadiusPreset] || 16;
    applyThemeStyles(get().accentColor, r, next, get().masterMotion);
    set({ liquidGlass: next });
  },
  applyGlassPreset: (preset) => {
    const config = GLASS_PRESETS[preset] || GLASS_PRESETS.crystal;
    const next: LiquidGlassConfig = { ...config, preset };
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_liquid_glass", JSON.stringify(next));
    const r = get().cornerRadiusPreset === "custom" ? get().cornerRadiusCustom : CORNER_RADIUS_MAP[get().cornerRadiusPreset] || 16;
    applyThemeStyles(get().accentColor, r, next, get().masterMotion);
    set({ liquidGlass: next });
  },

  // ── AI SETTINGS ──
  aiEnabled: _initAiEnabled,
  setAiEnabled: (aiEnabled) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_enabled", String(aiEnabled));
    set({ aiEnabled });
  },
  priceInference: _initPriceInf,
  setPriceInference: (priceInference) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_price_inf", String(priceInference));
    set({ priceInference });
  },
  quantityInference: _initQtyInf,
  setQuantityInference: (quantityInference) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_qty_inf", String(quantityInference));
    set({ quantityInference });
  },
  confirmationLevel: _initAiConfirm,
  setConfirmationLevel: (confirmationLevel) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_confirm", confirmationLevel);
    set({ confirmationLevel });
  },
  suggestionFrequency: _initAiSuggest,
  setSuggestionFrequency: (suggestionFrequency) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_suggest", suggestionFrequency);
    set({ suggestionFrequency });
  },
  aiLanguage: _initAiLang,
  setAiLanguage: (aiLanguage) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_lang", aiLanguage);
    set({ aiLanguage });
  },
  aiPersonality: _initAiPersonality,
  setAiPersonality: (aiPersonality) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_ai_personality", aiPersonality);
    set({ aiPersonality });
  },

  // ── SMART SORT & REORDER ──
  smartSortMode: _initSortMode,
  setSmartSortMode: (smartSortMode) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_sort_mode", smartSortMode);
    set({ smartSortMode });
  },
  customItemOrder: _initCustomItemOrder,
  setCustomItemOrder: (order) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_custom_order", JSON.stringify(order));
    set({ customItemOrder: order });
  },
  reorderCustomItems: (fromIndex, toIndex) => {
    const list = [...get().customItemOrder];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    if (typeof localStorage !== "undefined") localStorage.setItem("mating_custom_order", JSON.stringify(list));
    set({ customItemOrder: list });
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
  editingItem: null,
  editSourceRect: null,
  openSheet: (mode = "quick", initialText = "") => {
    if (get().hapticsEnabled) triggerHaptic("medium");
    document.body.classList.add("open");
    set({ isSheetOpen: true, sheetMode: mode, sheetInitialText: initialText, editingItem: null, editSourceRect: null });
  },
  openEditSheet: (item: ShoppingItem, sourceRect = null) => {
    if (get().hapticsEnabled) triggerHaptic("medium");
    document.body.classList.add("open");
    set({
      isSheetOpen: true,
      sheetMode: "quick",
      editingItem: item,
      editSourceRect: sourceRect,
      sheetInitialText: "",
    });
  },
  closeSheet: () => {
    document.body.classList.remove("open");
    set({ isSheetOpen: false, sheetInitialText: "", editingItem: null, editSourceRect: null });
  },
  setSheetMode: (sheetMode) => {
    set({ sheetMode });
  },

  undoToast: null,
  undoToasts: [],
  showUndoToast: (id, name) => {
    const item = { id, name, timestamp: Date.now() };
    set((state) => ({
      undoToast: item,
      undoToasts: [...state.undoToasts.filter((t) => t.id !== id).slice(-2), item],
    }));
  },
  dismissUndoToast: (id) => {
    set((state) => {
      const filtered = state.undoToasts.filter((t) => t.id !== id);
      return {
        undoToasts: filtered,
        undoToast: filtered.length > 0 ? filtered[filtered.length - 1] : null,
      };
    });
  },
  clearUndoToast: () => set({ undoToast: null, undoToasts: [] }),

  isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  isSyncing: false,
  hasSyncError: false,
  setOffline: (isOffline) => set({ isOffline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setSyncError: (hasSyncError) => set({ hasSyncError }),
}));

export function getEffectiveDuration(key: AnimKey): number {
  const store = useAppStore.getState();
  if (!store.masterMotion) return 0;
  const p = store.motionProfile;
  if (!p || p.batterySaver || p.animationStyle === "Minimal") return 0;
  const s = p[key];
  if (!s || !s.enabled) return 0;
  return Math.round(s.duration * ((p.intensity ?? 100) / 100));
}

if (typeof window !== "undefined") {
  (window as any).__MATING_STORE__ = useAppStore;
  (window as any).__MATING_MOUNTED__ = true;
}
