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
  useAppStore,
} from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

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
