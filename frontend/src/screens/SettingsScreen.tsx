import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

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
  } = useAppStore();

  const t = translations[language];

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
            <button className={language === "ru" ? "on" : ""} onClick={() => handleLanguageChange("ru")}>
              RU
            </button>
            <button className={language === "uz" ? "on" : ""} onClick={() => handleLanguageChange("uz")}>
              UZ
            </button>
            <button className={language === "en" ? "on" : ""} onClick={() => handleLanguageChange("en")}>
              EN
            </button>
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
            <button className={currency === "UZS" ? "on" : ""} onClick={() => handleCurrencyChange("UZS")}>
              UZS
            </button>
            <button className={currency === "RUB" ? "on" : ""} onClick={() => handleCurrencyChange("RUB")}>
              RUB
            </button>
            <button className={currency === "USD" ? "on" : ""} onClick={() => handleCurrencyChange("USD")}>
              USD
            </button>
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

        {/* Компактный режим */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.compactMode}</div>
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
              document.documentElement.classList.toggle("compact-mode", !compactMode);
            }}
          >
            <i />
          </button>
        </div>

        {/* Подтверждение удаления */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.confirmDelete}</div>
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
            <button className={theme === "auto" ? "on" : ""} onClick={() => handleThemeChange("auto")}>
              Авто
            </button>
            <button className={theme === "light" ? "on" : ""} onClick={() => handleThemeChange("light")}>
              Светлая
            </button>
            <button className={theme === "dark" ? "on" : ""} onClick={() => handleThemeChange("dark")}>
              Тёмная
            </button>
          </div>
        </div>

        {/* Уменьшение движения */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.reducedMotion}</div>
            <div className="settings-row-desc">Отключить фоновые эффекты и декоративные анимации</div>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => {
              if (hapticsEnabled) triggerHaptic("selection");
              setReducedMotion(!reducedMotion);
              document.documentElement.classList.toggle("perf-minimal", !reducedMotion);
            }}
          >
            <i />
          </button>
        </div>

        {/* Вибрация */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.haptics}</div>
            <div className="settings-row-desc">Тактильный отклик при нажатии кнопок и переключателей</div>
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

      {/* ── AI И ПАРСИНГ ── */}
      <div className="settings-group-title">{t.secAI}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t.autoCategory}</div>
            <div className="settings-row-desc">Автоматическое определение категории при вводе</div>
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
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>2.0 (Material 3 + Liquid Glass)</span>
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
