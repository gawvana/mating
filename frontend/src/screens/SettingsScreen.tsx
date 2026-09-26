import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { AnimationStyle, GlassMode, HapticMode, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

const ANIM_LABELS: Record<string, string> = {
  fabMorph: "FAB Morph + → ×",
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

type AnimKey = keyof typeof ANIM_LABELS;

const ANIM_KEYS: AnimKey[] = [
  "fabMorph", "sheetSpring", "purchaseTransition", "animatedTotal",
  "animatedBudget", "tabIndicator", "checkboxSpring", "swipeResistance",
  "longPressMenu", "editMorph", "statusPill", "headerMotion",
  "keyboardSheet", "listAddDelete", "hapticFeedback",
];

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
    applyMinimalPreset,
    resetMotionProfile,
  } = useAppStore();

  const t = translations[language];
  const [animListOpen, setAnimListOpen] = useState(false);

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

  const handleLanguageChange = (lang: "ru" | "uz" | "en") => {
    if (hapticsEnabled) triggerHaptic("selection");
    setLanguage(lang);
  };

  const handleCurrencyChange = (curr: "UZS" | "RUB" | "USD") => {
    if (hapticsEnabled) triggerHaptic("selection");
    setCurrency(curr);
  };

  const handleAnimStyleChange = (style: AnimationStyle) => {
    if (hapticsEnabled) triggerHaptic("selection");
    updateMotionProfile({ animationStyle: style });
    // Apply side effects
    if (style === "Minimal") {
      applyMinimalPreset();
    } else if (style === "Reduced") {
      updateMotionProfile({
        animationStyle: style,
        glassMode: "Reduced",
        batterySaver: false,
      });
    }
  };

  const handleGlassModeChange = (mode: GlassMode) => {
    if (hapticsEnabled) triggerHaptic("selection");
    updateMotionProfile({ glassMode: mode });
  };

  const handleHapticModeChange = (mode: HapticMode) => {
    if (hapticsEnabled) triggerHaptic("selection");
    updateMotionProfile({ hapticMode: mode });
    setHapticsEnabled(mode !== "Off");
  };

  const handleBatterySaver = (enabled: boolean) => {
    if (hapticsEnabled) triggerHaptic("selection");
    if (enabled) {
      applyMinimalPreset();
    } else {
      resetMotionProfile();
    }
  };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* ── ОБЩИЕ ── */}
      <div className="settings-group-title">{t.secGeneral}</div>
      <div className="settings-group">
        {/* Язык */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.language}</div>
            <div className="settings-row-desc">Язык интерфейса приложения</div>
          </div>
          <div className="seg" style={{ width: 140, margin: 0, "--seg-cols": 3, "--seg-idx": language === "ru" ? 0 : language === "uz" ? 1 : 2 } as React.CSSProperties}>
            <i aria-hidden="true" />
            <button className={language === "ru" ? "on" : ""} onClick={() => handleLanguageChange("ru")}>RU</button>
            <button className={language === "uz" ? "on" : ""} onClick={() => handleLanguageChange("uz")}>UZ</button>
            <button className={language === "en" ? "on" : ""} onClick={() => handleLanguageChange("en")}>EN</button>
          </div>
        </div>

        {/* Валюта */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.currency}</div>
            <div className="settings-row-desc">Основная валюта для подсчётов</div>
          </div>
          <div className="seg" style={{ width: 150, margin: 0, "--seg-cols": 3, "--seg-idx": currency === "UZS" ? 0 : currency === "RUB" ? 1 : 2 } as React.CSSProperties}>
            <i aria-hidden="true" />
            <button className={currency === "UZS" ? "on" : ""} onClick={() => handleCurrencyChange("UZS")}>UZS</button>
            <button className={currency === "RUB" ? "on" : ""} onClick={() => handleCurrencyChange("RUB")}>RUB</button>
            <button className={currency === "USD" ? "on" : ""} onClick={() => handleCurrencyChange("USD")}>USD</button>
          </div>
        </div>
      </div>

      {/* ── СПИСОК ПОКУПОК ── */}
      <div className="settings-group-title">{t.secList}</div>
      <div className="settings-group">
        {/* Показывать купленные */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.showPurchased}</div>
            <div className="settings-row-desc">Отображать блок купленных позиций внизу</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={showPurchased}
            onClick={() => { if (hapticsEnabled) triggerHaptic("selection"); setShowPurchased(!showPurchased); }}>
            <i />
          </button>
        </div>

        {/* Компактный режим */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.compactMode}</div>
            <div className="settings-row-desc">Уменьшенные отступы для большего числа товаров</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={compactMode}
            onClick={() => { if (hapticsEnabled) triggerHaptic("selection"); setCompactMode(!compactMode); }}>
            <i />
          </button>
        </div>

        {/* Подтверждение удаления */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.confirmDelete}</div>
            <div className="settings-row-desc">Спрашивать подтверждение перед удалением</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={confirmDelete}
            onClick={() => { if (hapticsEnabled) triggerHaptic("selection"); setConfirmDelete(!confirmDelete); }}>
            <i />
          </button>
        </div>
      </div>

      {/* ── ВНЕШНИЙ ВИД ── */}
      <div className="settings-group-title">{t.secAppearance}</div>
      <div className="settings-group">
        {/* Тема */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.theme}</div>
            <div className="settings-row-desc">Оформление приложения</div>
          </div>
          <div className="seg" style={{ width: 170, margin: 0, "--seg-cols": 3, "--seg-idx": theme === "auto" ? 0 : theme === "light" ? 1 : 2 } as React.CSSProperties}>
            <i aria-hidden="true" />
            <button className={theme === "auto" ? "on" : ""} onClick={() => handleThemeChange("auto")}>Авто</button>
            <button className={theme === "light" ? "on" : ""} onClick={() => handleThemeChange("light")}>Светлая</button>
            <button className={theme === "dark" ? "on" : ""} onClick={() => handleThemeChange("dark")}>Тёмная</button>
          </div>
        </div>

        {/* Уменьшение движения */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.reducedMotion}</div>
            <div className="settings-row-desc">Отключить фоновые эффекты и декоративные анимации</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={reducedMotion}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setReducedMotion(!reducedMotion);
            }}>
            <i />
          </button>
        </div>

        {/* Вибрация */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.haptics}</div>
            <div className="settings-row-desc">Тактильный отклик при нажатии кнопок</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={hapticsEnabled}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setHapticsEnabled(!hapticsEnabled);
            }}>
            <i />
          </button>
        </div>
      </div>

      {/* ── MOTION (Анимации) ── */}
      <div className="settings-group-title">Motion</div>
      <div className="settings-group">
        {/* Animation Style */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Animation Style</div>
            <div className="settings-row-desc">Общий стиль анимаций</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile.animationStyle}
            onChange={(e) => handleAnimStyleChange(e.target.value as AnimationStyle)}
            aria-label="Animation Style"
          >
            <option value="Minimal">Minimal</option>
            <option value="Reduced">Reduced</option>
            <option value="Normal">Normal</option>
            <option value="Expressive">Expressive</option>
          </select>
        </div>

        {/* Intensity slider */}
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="settings-row-label">Intensity</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
              {motionProfile.fabMorph.intensity}%
            </span>
          </div>
          <input
            type="range"
            className="motion-slider"
            min={0}
            max={100}
            step={5}
            value={motionProfile.fabMorph.intensity}
            onChange={(e) => {
              const val = Number(e.target.value);
              // Apply intensity to all animations at once
              ANIM_KEYS.forEach(key => {
                updateAnimSetting(key as Parameters<typeof updateAnimSetting>[0], { intensity: val });
              });
            }}
            aria-label="Motion Intensity"
          />
        </div>

        {/* Haptics mode */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Haptics</div>
            <div className="settings-row-desc">Уровень тактильного отклика</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile.hapticMode}
            onChange={(e) => handleHapticModeChange(e.target.value as HapticMode)}
            aria-label="Haptic Mode"
          >
            <option value="Off">Off</option>
            <option value="Light">Light</option>
            <option value="Normal">Normal</option>
          </select>
        </div>

        {/* Glass Effects */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Glass Effects</div>
            <div className="settings-row-desc">Качество эффектов матового стекла</div>
          </div>
          <select
            className="motion-select"
            value={motionProfile.glassMode}
            onChange={(e) => handleGlassModeChange(e.target.value as GlassMode)}
            aria-label="Glass Mode"
          >
            <option value="Full">Full</option>
            <option value="Adaptive">Adaptive</option>
            <option value="Reduced">Reduced</option>
            <option value="Minimal">Minimal</option>
          </select>
        </div>

        {/* Reduce Motion */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Reduce Motion</div>
            <div className="settings-row-desc">Отключить декоративные анимации</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={reducedMotion}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setReducedMotion(!reducedMotion);
            }}>
            <i />
          </button>
        </div>

        {/* Battery Saver */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Battery Saver</div>
            <div className="settings-row-desc">Упростить все эффекты для слабых устройств</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={motionProfile.batterySaver}
            onClick={() => handleBatterySaver(!motionProfile.batterySaver)}>
            <i />
          </button>
        </div>

        {/* 15 Animation Toggles — collapsible */}
        <div>
          <button
            className={`anim-list-header ${animListOpen ? "open" : ""}`}
            onClick={() => setAnimListOpen(v => !v)}
            type="button"
            aria-expanded={animListOpen}
          >
            <span>Настройки анимаций ({ANIM_KEYS.length})</span>
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          <div className={`anim-list-body ${animListOpen ? "open" : ""}`}>
            {ANIM_KEYS.map((key) => {
              const setting = motionProfile[key as keyof typeof motionProfile] as { enabled: boolean; intensity: number };
              const label = ANIM_LABELS[key];
              return (
                <div key={key} className="settings-row">
                  <div className="settings-row-label" style={{ fontSize: 13 }}>{label}</div>
                  <button
                    type="button"
                    className="sw"
                    role="switch"
                    aria-checked={setting?.enabled ?? true}
                    aria-label={label}
                    style={{ transform: "scale(.85)", transformOrigin: "right center" }}
                    onClick={() => {
                      if (hapticsEnabled) triggerHaptic("selection");
                      updateAnimSetting(key as Parameters<typeof updateAnimSetting>[0], { enabled: !setting?.enabled });
                    }}
                  >
                    <i />
                  </button>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 10, padding: "12px 0" }}>
              <button
                type="button"
                className="btn outline press"
                style={{ height: 36, fontSize: 13 }}
                onClick={() => {
                  resetMotionProfile();
                  if (hapticsEnabled) triggerHaptic("medium");
                }}
              >
                Сбросить всё
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI И ПАРСИНГ ── */}
      <div className="settings-group-title">{t.secAI}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.autoCategory}</div>
            <div className="settings-row-desc">Автоматическое определение категории при вводе</div>
          </div>
          <button type="button" className="sw" role="switch" aria-checked={autoCategory}
            onClick={() => { if (hapticsEnabled) triggerHaptic("selection"); setAutoCategory(!autoCategory); }}>
            <i />
          </button>
        </div>
      </div>

      {/* ── ДАННЫЕ ── */}
      <div className="settings-group-title">{t.secData}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Состояние сети</div>
            <div className="settings-row-desc">{isOffline ? "Автономный режим (офлайн)" : "Подключено к серверу"}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: isOffline ? "var(--warn)" : "var(--ok)" }}>
            {isOffline ? "Офлайн" : "Онлайн"}
          </span>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Купленные позиции</div>
            <div className="settings-row-desc">Удалить все отмеченные товары</div>
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
      </div>

      {/* ── О ПРИЛОЖЕНИИ ── */}
      <div className="settings-group-title">{t.secAbout}</div>
      <div className="settings-group">
        <div className="settings-row">
          <span className="settings-row-label">Версия приложения</span>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>3.0 (Liquid Glass)</span>
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
