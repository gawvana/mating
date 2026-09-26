import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { api } from "../api/client";
import { translations } from "../i18n";
import {
  AnimKey,
  ANIM_KEYS,
  AnimationStyle,
  GlassMode,
  MotionPreset,
  SpringCurve,
  GlassPreset,
  AIConfirmationLevel,
  AISuggestionFrequency,
  AIPersonality,
  useAppStore,
} from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

const ACCENT_PALETTE = [
  { name: "Indigo", hex: "#4F5DFF" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Crimson", hex: "#F43F5E" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Violet", hex: "#8B5CF6" },
];

function getContrastWarning(hexColor: string): string | null {
  try {
    const clean = hexColor.replace("#", "");
    if (clean.length !== 6) return null;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const ratioAgainstWhite = (1.0 + 0.05) / (lum + 0.05);
    const ratioAgainstBlack = (lum + 0.05) / (0.0 + 0.05);
    if (ratioAgainstWhite < 2.5 && ratioAgainstBlack < 2.5) {
      return "Низкий контраст (WCAG AA < 3.0)";
    }
    return null;
  } catch {
    return null;
  }
}

const ANIM_LABELS: Record<AnimKey, string> = {
  fabMorph: "FAB Morph + ↔ ×",
  sheetSpring: "Bottom Sheet Spring",
  purchaseTransition: "Анимация покупки",
  animatedTotal: "Анимированная сумма",
  animatedBudget: "Анимированный бюджет",
  tabIndicator: "Tab Indicator",
  checkboxSpring: "Checkbox Spring",
  swipeResistance: "Свайп-действия",
  longPressMenu: "Long-press меню",
  editMorph: "Edit Morph Transition",
  statusPill: "Status Pill",
  headerMotion: "Compact Header при скролле",
  keyboardSheet: "Sheet / Keyboard Motion",
  listAddDelete: "List Add / Delete Animation",
  hapticFeedback: "Haptic Feedback",
};

export const SettingsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    language,
    setLanguage,
    currency,
    setCurrency,
    theme,
    setTheme,
    compactMode,
    setCompactMode,
    reducedMotion,
    setReducedMotion,
    hapticsEnabled,
    setHapticsEnabled,
    showPurchased,
    setShowPurchased,
    confirmDelete,
    setConfirmDelete,
    autoCategory,
    setAutoCategory,
    isOffline,
    motionProfile,
    updateMotionProfile,
    updateAnimSetting,
    applyPreset,
    resetMotionProfile,
    accentColor,
    setAccentColor,
    customAccentHex,
    setCustomAccentHex,
    cornerRadiusPreset,
    setCornerRadiusPreset,
    cornerRadiusCustom,
    setCornerRadiusCustom,
    masterMotion,
    setMasterMotion,
    liquidGlass,
    updateLiquidGlass,
    applyGlassPreset,
    aiEnabled,
    setAiEnabled,
    priceInference,
    setPriceInference,
    quantityInference,
    setQuantityInference,
    confirmationLevel,
    setConfirmationLevel,
    suggestionFrequency,
    setSuggestionFrequency,
    aiLanguage,
    setAiLanguage,
    aiPersonality,
    setAiPersonality,
  } = useAppStore(
    useShallow((state) => ({
      language: state.language,
      setLanguage: state.setLanguage,
      currency: state.currency,
      setCurrency: state.setCurrency,
      theme: state.theme,
      setTheme: state.setTheme,
      compactMode: state.compactMode,
      setCompactMode: state.setCompactMode,
      reducedMotion: state.reducedMotion,
      setReducedMotion: state.setReducedMotion,
      hapticsEnabled: state.hapticsEnabled,
      setHapticsEnabled: state.setHapticsEnabled,
      showPurchased: state.showPurchased,
      setShowPurchased: state.setShowPurchased,
      confirmDelete: state.confirmDelete,
      setConfirmDelete: state.setConfirmDelete,
      autoCategory: state.autoCategory,
      setAutoCategory: state.setAutoCategory,
      isOffline: state.isOffline,
      motionProfile: state.motionProfile,
      updateMotionProfile: state.updateMotionProfile,
      updateAnimSetting: state.updateAnimSetting,
      applyPreset: state.applyPreset,
      resetMotionProfile: state.resetMotionProfile,
      accentColor: state.accentColor,
      setAccentColor: state.setAccentColor,
      customAccentHex: state.customAccentHex,
      setCustomAccentHex: state.setCustomAccentHex,
      cornerRadiusPreset: state.cornerRadiusPreset,
      setCornerRadiusPreset: state.setCornerRadiusPreset,
      cornerRadiusCustom: state.cornerRadiusCustom,
      setCornerRadiusCustom: state.setCornerRadiusCustom,
      masterMotion: state.masterMotion,
      setMasterMotion: state.setMasterMotion,
      liquidGlass: state.liquidGlass,
      updateLiquidGlass: state.updateLiquidGlass,
      applyGlassPreset: state.applyGlassPreset,
      aiEnabled: state.aiEnabled,
      setAiEnabled: state.setAiEnabled,
      priceInference: state.priceInference,
      setPriceInference: state.setPriceInference,
      quantityInference: state.quantityInference,
      setQuantityInference: state.setQuantityInference,
      confirmationLevel: state.confirmationLevel,
      setConfirmationLevel: state.setConfirmationLevel,
      suggestionFrequency: state.suggestionFrequency,
      setSuggestionFrequency: state.setSuggestionFrequency,
      aiLanguage: state.aiLanguage,
      setAiLanguage: state.setAiLanguage,
      aiPersonality: state.aiPersonality,
      setAiPersonality: state.setAiPersonality,
    }))
  );

  const t = translations[language] || translations.ru;
  const [animListOpen, setAnimListOpen] = useState(false);
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);

  const clearPurchasedMutation = useMutation({
    mutationFn: () => api.clearPurchased(),
    onSuccess: () => {
      if (hapticsEnabled) triggerHaptic("heavy");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      alert("Купленные товары успешно очищены");
    },
  });

  const handleThemeChange = (newTheme: "auto" | "light" | "dark") => {
    if (hapticsEnabled) triggerHaptic("selection");
    setTheme(newTheme);
    if (newTheme === "auto") {
      document.documentElement.removeAttribute("data-theme");
      if (window.Telegram?.WebApp?.colorScheme) {
        document.documentElement.setAttribute("data-theme", window.Telegram.WebApp.colorScheme);
      }
    } else {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  };

  const handlePresetChange = (preset: MotionPreset) => {
    if (hapticsEnabled) triggerHaptic("selection");
    applyPreset(preset);
  };

  const handleLivePreview = (key: AnimKey) => {
    if (hapticsEnabled) triggerHaptic("medium");
    setActivePreviewKey(key);
    setTimeout(() => setActivePreviewKey(null), 800);
  };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* ── ОБЩИЕ ── */}
      <div className="settings-group-title">{t.secGeneral || "ОБЩИЕ"}</div>
      <div className="settings-group">
        {/* Язык */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.language || "Язык интерфейса"}</div>
            <div className="settings-row-desc">Язык интерфейса приложения</div>
          </div>
          <div
            className="seg"
            style={
              {
                width: 140,
                margin: 0,
                "--seg-cols": 3,
                "--seg-idx": language === "ru" ? 0 : language === "uz" ? 1 : 2,
                "--k": language === "ru" ? 0 : language === "uz" ? 1 : 2,
              } as React.CSSProperties
            }
          >
            <i aria-hidden="true" />
            <button
              type="button"
              className={language === "ru" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setLanguage("ru");
              }}
            >
              RU
            </button>
            <button
              type="button"
              className={language === "uz" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setLanguage("uz");
              }}
            >
              UZ
            </button>
            <button
              type="button"
              className={language === "en" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setLanguage("en");
              }}
            >
              EN
            </button>
          </div>
        </div>

        {/* Валюта */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.currency || "Основная валюта"}</div>
            <div className="settings-row-desc">Основная валюта для подсчётов</div>
          </div>
          <div
            className="seg"
            style={
              {
                width: 150,
                margin: 0,
                "--seg-cols": 3,
                "--seg-idx": currency === "UZS" ? 0 : currency === "RUB" ? 1 : 2,
                "--k": currency === "UZS" ? 0 : currency === "RUB" ? 1 : 2,
              } as React.CSSProperties
            }
          >
            <i aria-hidden="true" />
            <button
              type="button"
              className={currency === "UZS" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCurrency("UZS");
              }}
            >
              UZS
            </button>
            <button
              type="button"
              className={currency === "RUB" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCurrency("RUB");
              }}
            >
              RUB
            </button>
            <button
              type="button"
              className={currency === "USD" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCurrency("USD");
              }}
            >
              USD
            </button>
          </div>
        </div>
      </div>

      {/* ── СПИСОК ПОКУПОК ── */}
      <div className="settings-group-title">{t.secList || "СПИСОК ПОКУПОК"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.showPurchased || "Показывать купленные"}</div>
            <div className="settings-row-desc">Отображать блок купленных позиций внизу</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={showPurchased}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setShowPurchased(!showPurchased);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.compactMode || "Компактный режим"}</div>
            <div className="settings-row-desc">Уменьшенные отступы для большего числа товаров</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={compactMode}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setCompactMode(!compactMode);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.confirmDelete || "Подтверждать удаление"}</div>
            <div className="settings-row-desc">Спрашивать подтверждение перед удалением</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={confirmDelete}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setConfirmDelete(!confirmDelete);
            }}
          >
            <i />
          </button>
        </div>
      </div>

      {/* ── ВНЕШНИЙ ВИД ── */}
      <div className="settings-group-title">{t.secAppearance || "ВНЕШНИЙ ВИД"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.theme || "Тема оформления"}</div>
            <div className="settings-row-desc">Оформление приложения</div>
          </div>
          <div
            className="seg"
            style={
              {
                width: 170,
                margin: 0,
                "--seg-cols": 3,
                "--seg-idx": theme === "auto" ? 0 : theme === "light" ? 1 : 2,
                "--k": theme === "auto" ? 0 : theme === "light" ? 1 : 2,
              } as React.CSSProperties
            }
          >
            <i aria-hidden="true" />
            <button
              type="button"
              className={theme === "auto" ? "on" : ""}
              onClick={() => handleThemeChange("auto")}
            >
              Авто
            </button>
            <button
              type="button"
              className={theme === "light" ? "on" : ""}
              onClick={() => handleThemeChange("light")}
            >
              Светлая
            </button>
            <button
              type="button"
              className={theme === "dark" ? "on" : ""}
              onClick={() => handleThemeChange("dark")}
            >
              Тёмная
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Мастер-переключатель анимаций</div>
            <div className="settings-row-desc">Мгновенное отключение всей системы движения</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={masterMotion}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setMasterMotion(!masterMotion);
            }}
          >
            <i />
          </button>
        </div>

        {/* Accent Color */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="settings-row-label">Акцентный цвет</div>
              <div className="settings-row-desc">Основной цвет кнопок, чекбоксов и индикаторов</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="accent-preview-dot" style={{ background: accentColor }} />
              <input
                type="text"
                className="accent-hex-input"
                value={customAccentHex}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomAccentHex(val);
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    setAccentColor(val);
                  }
                }}
                placeholder="#4F5DFF"
              />
            </div>
          </div>

          <div className="accent-palette-row">
            {ACCENT_PALETTE.map((pal) => (
              <button
                key={pal.hex}
                type="button"
                className={`accent-circle ${accentColor.toLowerCase() === pal.hex.toLowerCase() ? "selected" : ""}`}
                style={{ backgroundColor: pal.hex }}
                onClick={() => {
                  if (hapticsEnabled) triggerHaptic("selection");
                  setAccentColor(pal.hex);
                  setCustomAccentHex(pal.hex);
                }}
                title={pal.name}
              />
            ))}
          </div>

          {getContrastWarning(accentColor) && (
            <div className="contrast-warning">
              ⚠️ {getContrastWarning(accentColor)}
            </div>
          )}
        </div>

        {/* Corner Radius */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="settings-row-label">Скругление углов</div>
              <div className="settings-row-desc">Форма карточек, кнопок и полей ввода</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
              {cornerRadiusPreset === "custom" ? `${cornerRadiusCustom}px` : cornerRadiusPreset}
            </span>
          </div>

          <div className="seg" style={{ width: "100%", margin: 0, "--seg-cols": 5 } as React.CSSProperties}>
            <button
              type="button"
              className={cornerRadiusPreset === "sharp" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCornerRadiusPreset("sharp");
              }}
            >
              Sharp (8)
            </button>
            <button
              type="button"
              className={cornerRadiusPreset === "standard" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCornerRadiusPreset("standard");
              }}
            >
              Std (16)
            </button>
            <button
              type="button"
              className={cornerRadiusPreset === "soft" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCornerRadiusPreset("soft");
              }}
            >
              Soft (22)
            </button>
            <button
              type="button"
              className={cornerRadiusPreset === "round" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCornerRadiusPreset("round");
              }}
            >
              Round (28)
            </button>
            <button
              type="button"
              className={cornerRadiusPreset === "custom" ? "on" : ""}
              onClick={() => {
                if (hapticsEnabled) triggerHaptic("selection");
                setCornerRadiusPreset("custom");
              }}
            >
              Custom
            </button>
          </div>

          {cornerRadiusPreset === "custom" && (
            <input
              type="range"
              className="motion-slider"
              min={6}
              max={36}
              value={cornerRadiusCustom}
              onChange={(e) => setCornerRadiusCustom(Number(e.target.value))}
            />
          )}
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.reducedMotion || "Уменьшение движения"}</div>
            <div className="settings-row-desc">Отключить фоновые эффекты и анимации</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setReducedMotion(!reducedMotion);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.haptics || "Вибрация"}</div>
            <div className="settings-row-desc">Тактильный отклик при нажатии кнопок</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={hapticsEnabled}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setHapticsEnabled(!hapticsEnabled);
            }}
          >
            <i />
          </button>
        </div>
      </div>

      {/* ── LIQUID GLASS CUSTOMIZER ── */}
      <div className="settings-group-title">LIQUID GLASS &amp; МАТЕРИАЛЫ</div>
      <div className="settings-group">
        {/* Live Micro-Preview Card */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", padding: "12px 14px" }}>
          <div className="liquid-glass-micro-preview glass">
            <div className="micro-preview-glow" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="micro-tag">Glass Token Preview</span>
              <span className="micro-preset-pill">{liquidGlass.preset}</span>
            </div>
            <div className="micro-preview-title">Apple-like Liquid Glass</div>
            <p className="micro-preview-sub">Динамическое оптическое преломление и глубина</p>
            <div className="micro-preview-actions">
              <button className="btn primary" style={{ height: 32, fontSize: 12, padding: "0 14px" }}>
                Primary
              </button>
              <button className="btn outline" style={{ height: 32, fontSize: 12, padding: "0 14px" }}>
                Subtle
              </button>
            </div>
          </div>
        </div>

        {/* Glass Presets */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Пресеты стекла</div>
            <div className="settings-row-desc">Готовые текстурные профили</div>
          </div>
          <select
            className="motion-select"
            value={liquidGlass.preset}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              applyGlassPreset(e.target.value as GlassPreset);
            }}
          >
            <option value="crystal">Crystal (По умолчанию)</option>
            <option value="frosted">Frosted (Матовый)</option>
            <option value="deep">Deep (Глубокий)</option>
            <option value="tinted">Tinted (Тонированный)</option>
            <option value="ultra-clear">Ultra-Clear (Ультра-чистый)</option>
            <option value="custom">Custom (Пользовательский)</option>
          </select>
        </div>

        {/* Blur slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Размытие (Blur)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.blur}px</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={36}
            value={liquidGlass.blur}
            onChange={(e) => updateLiquidGlass({ blur: Number(e.target.value) })}
          />
        </div>

        {/* Transparency slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Прозрачность (Transparency)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.transparency}%</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={10}
            max={95}
            value={liquidGlass.transparency}
            onChange={(e) => updateLiquidGlass({ transparency: Number(e.target.value) })}
          />
        </div>

        {/* Saturation slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Насыщенность (Saturation)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.saturation}%</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={50}
            max={200}
            value={liquidGlass.saturation}
            onChange={(e) => updateLiquidGlass({ saturation: Number(e.target.value) })}
          />
        </div>

        {/* Border Opacity slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Четкость границ (Border Edge)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.borderOpacity}%</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={100}
            value={liquidGlass.borderOpacity}
            onChange={(e) => updateLiquidGlass({ borderOpacity: Number(e.target.value) })}
          />
        </div>

        {/* Specular Highlight slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Блик (Specular Highlight)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.specular}%</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={100}
            value={liquidGlass.specular}
            onChange={(e) => updateLiquidGlass({ specular: Number(e.target.value) })}
          />
        </div>

        {/* Shadow Depth slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="settings-row-label">Глубина тени (Shadow Depth)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{liquidGlass.shadowDepth}%</span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={100}
            value={liquidGlass.shadowDepth}
            onChange={(e) => updateLiquidGlass({ shadowDepth: Number(e.target.value) })}
          />
        </div>

        {/* Noise switch */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Микро-шум (Noise Texture)</div>
            <div className="settings-row-desc">Тактильная фактура стекла</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={liquidGlass.noise}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              updateLiquidGlass({ noise: !liquidGlass.noise });
            }}
          >
            <i />
          </button>
        </div>
      </div>

      {/* ── MOTION (Анимации и физика) ── */}
      <div className="settings-group-title">Motion &amp; Interaction</div>
      <div className="settings-group">
        {/* Preset Selector */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Пресеты профиля</div>
            <div className="settings-row-desc">Готовые наборы настроек движения</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile?.preset || "Apple-like"}
            onChange={(e) => handlePresetChange(e.target.value as MotionPreset)}
            aria-label="Пресет профиля"
          >
            <option value="Apple-like">Apple-like</option>
            <option value="Minimal">Minimal</option>
            <option value="Battery Saver">Battery Saver</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {/* Animation Style */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Стиль анимаций</div>
            <div className="settings-row-desc">Характер отклика интерфейса</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile?.animationStyle || "Normal"}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              updateMotionProfile({ animationStyle: e.target.value as AnimationStyle });
            }}
            aria-label="Стиль анимаций"
          >
            <option value="Minimal">Minimal</option>
            <option value="Reduced">Reduced</option>
            <option value="Normal">Normal</option>
            <option value="Expressive">Expressive</option>
          </select>
        </div>

        {/* Global Intensity Slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="settings-row-label">Интенсивность движения</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
              {motionProfile?.intensity ?? 100}%
            </span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={100}
            step={5}
            value={motionProfile?.intensity ?? 100}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateMotionProfile({ intensity: val });
              ANIM_KEYS.forEach((key) => {
                updateAnimSetting(key, { intensity: val });
              });
            }}
            aria-label="Интенсивность движения"
          />
        </div>

        {/* Glass Mode */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Эффекты стекла (Glass)</div>
            <div className="settings-row-desc">Уровень размытия и преломления</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile?.glassMode || "Adaptive"}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              updateMotionProfile({ glassMode: e.target.value as GlassMode });
            }}
            aria-label="Режим стекла"
          >
            <option value="Full">Full (макс. качество)</option>
            <option value="Adaptive">Adaptive (авто)</option>
            <option value="Reduced">Reduced (легкое)</option>
            <option value="Minimal">Minimal (сплошное)</option>
          </select>
        </div>

        {/* Battery Saver */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Энергосбережение</div>
            <div className="settings-row-desc">Отключение размытия и тяжелых переходов</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={motionProfile?.batterySaver ?? false}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              const next = !(motionProfile?.batterySaver ?? false);
              if (next) {
                applyPreset("Battery Saver");
              } else {
                applyPreset("Apple-like");
              }
            }}
          >
            <i />
          </button>
        </div>

        {/* 15 Animation Toggles with Advanced Tuning (§31 & §35) */}
        <div>
          <button
            className={`anim-list-header ${animListOpen ? "open" : ""}`}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setAnimListOpen((v) => !v);
            }}
            type="button"
            aria-expanded={animListOpen}
          >
            <span>Настройки 15 анимаций (детально)</span>
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          <div className={`anim-list-body ${animListOpen ? "open" : ""}`}>
            {ANIM_KEYS.map((key) => {
              const setting = motionProfile?.[key] || {
                enabled: true,
                intensity: 100,
                duration: 450,
                curve: "snappy" as SpringCurve,
              };
              const label = ANIM_LABELS[key];
              const isPreviewing = activePreviewKey === key;

              return (
                <div
                  key={key}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--outline)",
                    transition: "transform .3s var(--spring)",
                    transform: isPreviewing ? "scale(1.02) translateX(4px)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="settings-row-label" style={{ fontSize: 14 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {setting.duration}ms • {setting.curve} • {setting.intensity}%
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sw"
                      role="switch"
                      aria-checked={setting.enabled}
                      aria-label={label}
                      style={{ transform: "scale(.82)", transformOrigin: "right center" }}
                      onClick={() => {
                        if (hapticsEnabled) triggerHaptic("selection");
                        updateAnimSetting(key, { enabled: !setting.enabled });
                      }}
                    >
                      <i />
                    </button>
                  </div>

                  {/* Sub-controls: Duration, Curve, Live Preview */}
                  {setting.enabled && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)", width: 50 }}>Длит.:</span>
                        <input
                          type="range"
                          className="motion-slider"
                          min={100}
                          max={600}
                          step={25}
                          value={setting.duration}
                          onChange={(e) => updateAnimSetting(key, { duration: Number(e.target.value) })}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 700, width: 44, textAlign: "right" }}>
                          {setting.duration}ms
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Кривая:</span>
                          <select
                            className="motion-select"
                            style={{ padding: "3px 20px 3px 8px", fontSize: 11 }}
                            value={setting.curve}
                            onChange={(e) => updateAnimSetting(key, { curve: e.target.value as SpringCurve })}
                          >
                            <option value="snappy">Snappy (пружина)</option>
                            <option value="balanced">Balanced</option>
                            <option value="soft">Soft</option>
                            <option value="linear">Linear</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          className="btn outline press"
                          style={{ height: 26, padding: "0 10px", fontSize: 11, width: "auto" }}
                          onClick={() => handleLivePreview(key)}
                        >
                          ▶ Тест
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 10, padding: "14px 0" }}>
              <button
                type="button"
                className="btn outline press"
                style={{ height: 38, fontSize: 13 }}
                onClick={() => {
                  resetMotionProfile();
                  if (hapticsEnabled) triggerHaptic("medium");
                }}
              >
                Сбросить всё на дефолт
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI И ПАРСИНГ ── */}
      <div className="settings-group-title">{t.secAI || "AI И ПАРСИНГ"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">AI Помощник включен</div>
            <div className="settings-row-desc">Включение вкладки AI и контекстных подсказок</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={aiEnabled}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setAiEnabled(!aiEnabled);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Правило цен без единиц (Bare Number)</div>
            <div className="settings-row-desc">«bodring 10» → 10,000 сум (число без ед. = цена в тысячах)</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={priceInference}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setPriceInference(!priceInference);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Распознавание количества с единицами</div>
            <div className="settings-row-desc">«pomidor 2kg» → 2 кг, «10 dona» → 10 шт</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={quantityInference}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setQuantityInference(!quantityInference);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.autoCategory || "Автоопределение категории"}</div>
            <div className="settings-row-desc">Определение категории при вводе названия</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={autoCategory}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setAutoCategory(!autoCategory);
            }}
          >
            <i />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Уровень подтверждения</div>
            <div className="settings-row-desc">Когда показывать карточку предварительного просмотра</div>
          </div>
          <select
            className="motion-select"
            value={confirmationLevel}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              setConfirmationLevel(e.target.value as AIConfirmationLevel);
            }}
          >
            <option value="always">Всегда подтверждать</option>
            <option value="destructive_only">Только опасные (удаление/очистка)</option>
            <option value="silent">Тихий режим (без подтверждения)</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Стиль общения (Personality)</div>
            <div className="settings-row-desc">Тон ответов AI ассистента</div>
          </div>
          <select
            className="motion-select"
            value={aiPersonality}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              setAiPersonality(e.target.value as AIPersonality);
            }}
          >
            <option value="concise">Лаконичный (кратко и по делу)</option>
            <option value="friendly">Дружелюбный (подсказки и эмодзи)</option>
            <option value="analytical">Аналитический (с фокусом на цены и выгоду)</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Частота подсказок</div>
            <div className="settings-row-desc">Насколько часто предлагать похожие товары</div>
          </div>
          <select
            className="motion-select"
            value={suggestionFrequency}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              setSuggestionFrequency(e.target.value as AISuggestionFrequency);
            }}
          >
            <option value="high">Часто (при каждом наборе)</option>
            <option value="normal">Умеренно</option>
            <option value="low">Редко</option>
            <option value="off">Выключено</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Язык обработки AI</div>
            <div className="settings-row-desc">Основной язык распознавания команд и рецептов</div>
          </div>
          <select
            className="motion-select"
            value={aiLanguage}
            onChange={(e) => {
              if (hapticsEnabled) triggerHaptic("selection");
              setAiLanguage(e.target.value as "auto" | "ru" | "uz" | "en");
            }}
          >
            <option value="auto">Авто (по языку интерфейса)</option>
            <option value="ru">Русский (RU)</option>
            <option value="uz">O'zbekcha (UZ)</option>
            <option value="en">English (EN)</option>
          </select>
        </div>
      </div>

      {/* ── ДАННЫЕ И СЕРВЕР ── */}
      <div className="settings-group-title">{t.secData || "ДАННЫЕ"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Состояние сети</div>
            <div className="settings-row-desc">
              {isOffline ? "Автономный режим (офлайн)" : "Подключено к серверу"}
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: isOffline ? "var(--warn)" : "var(--ok)" }}>
            {isOffline ? "Офлайн" : "Онлайн"}
          </span>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Очистить купленные</div>
            <div className="settings-row-desc">Удалить все купленные товары из базы</div>
          </div>
          <button
            type="button"
            className="btn outline press"
            style={{ width: "auto", height: 34, padding: "0 14px", fontSize: 13 }}
            onClick={() => {
              if (window.confirm("Удалить все купленные товары?")) {
                clearPurchasedMutation.mutate();
              }
            }}
          >
            Очистить
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Кэш настроек UI</div>
            <div className="settings-row-desc">Сбросить сохраненные параметры профиля движения</div>
          </div>
          <button
            type="button"
            className="btn outline press"
            style={{ width: "auto", height: 34, padding: "0 14px", fontSize: 13 }}
            onClick={() => {
              localStorage.removeItem("mating_motion_profile");
              resetMotionProfile();
              if (hapticsEnabled) triggerHaptic("medium");
              alert("Кэш настроек UI сброшен");
            }}
          >
            Сброс
          </button>
        </div>
      </div>

      {/* ── О ПРИЛОЖЕНИИ ── */}
      <div className="settings-group-title">{t.secAbout || "О ПРИЛОЖЕНИИ"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <span className="settings-row-label">Версия интерфейса</span>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            3.0 (Liquid Glass Edition)
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Telegram Бот</span>
          <a
            href="https://t.me/MatingD_bot"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}
          >
            @MatingD_bot ↗
          </a>
        </div>
      </div>
    </div>
  );
};
