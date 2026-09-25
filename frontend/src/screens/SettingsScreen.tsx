import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Language, translations } from "../i18n";
import { ThemeMode, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const SettingsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    language,
    setLanguage,
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
  } = useAppStore();
  const t = translations[language];

  // Fetch current user settings
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
  });

  // Fetch items for profile card counters
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const activeCount = items.filter((i) => !i.is_purchased).length;
  const boughtCount = items.filter((i) => i.is_purchased).length;

  const [currency, setCurrency] = useState("UZS");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cacheToast, setCacheToast] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.language_code && profile.language_code !== language) {
        setLanguage(profile.language_code as Language);
      }
      setCurrency(profile.currency_code || "UZS");
      setCity(profile.city || "");
      setBudget(profile.monthly_budget ? profile.monthly_budget.toString() : "");
    }
  }, [profile]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedFields: {
      language_code?: string;
      currency_code?: string;
      city?: string | null;
      monthly_budget?: number | null;
    }) => {
      return api.updateSettings(updatedFields);
    },
    onSuccess: (data) => {
      if (hapticsEnabled) triggerHaptic("success");
      queryClient.setQueryData(["profile"], data);
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const handleLanguageChange = (lang: Language) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setLanguage(lang);
    updateSettingsMutation.mutate({ language_code: lang });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setCurrency(newCurrency);
    updateSettingsMutation.mutate({ currency_code: newCurrency });
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    if (hapticsEnabled) triggerHaptic("selection");
    setTheme(newTheme);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      city: city.trim() || null,
      monthly_budget: budget ? parseFloat(budget) : null,
    });
  };

  const handleClearCache = () => {
    if (hapticsEnabled) triggerHaptic("medium");
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    setCacheToast(true);
    setTimeout(() => setCacheToast(false), 2500);
  };

  // Telegram User Information
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const displayName = tgUser?.first_name
    ? `${tgUser.first_name} ${tgUser.last_name || ""}`.trim()
    : profile?.first_name || "Пользователь Mating";
  const username = tgUser?.username || profile?.username ? `@${tgUser?.username || profile?.username}` : null;
  const userInitial = displayName.charAt(0).toUpperCase() || "M";
  const telegramId = tgUser?.id ? String(tgUser.id) : (profile?.id ? profile.id.slice(0, 8) : "78492019");

  return (
    <div className="page-content" style={{ paddingTop: 70, paddingBottom: 100 }}>
      {/* Toast notifications */}
      {saveSuccess && (
        <div
          style={{
            background: "var(--ok-c)",
            color: "var(--on-ok-c)",
            padding: "10px 16px",
            borderRadius: "var(--r2)",
            marginBottom: 14,
            fontWeight: 600,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ✓ {t.saved}
        </div>
      )}

      {cacheToast && (
        <div
          style={{
            background: "var(--p)",
            color: "var(--on-p)",
            padding: "10px 16px",
            borderRadius: "var(--r2)",
            marginBottom: 14,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ✓ {t.cacheCleared || "Локальный кэш очищен"}
        </div>
      )}

      {/* ── PROFILE CARD (Screenshot 2 Architecture) ── */}
      <div className="profile-card">
        <div className="profile-user-row">
          <div className="profile-avatar">{userInitial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="profile-meta-name">{displayName}</div>
            <div className="profile-meta-sub">
              {username ? username : `ID: ${telegramId}`}
            </div>
          </div>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "12px",
              background: "rgba(52, 199, 89, 0.12)",
              color: "#34c759",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34c759" }} />
            Online
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat-box">
            <div className="profile-stat-num">{activeCount}</div>
            <div className="profile-stat-sub">{t.activeLabel || "активных"}</div>
          </div>
          <div className="profile-stat-box">
            <div className="profile-stat-num" style={{ color: "#34c759" }}>
              {boughtCount}
            </div>
            <div className="profile-stat-sub">{t.itemsPurchasedLabel || "купленных"}</div>
          </div>
        </div>
      </div>

      {/* ── 1. ОБЩИЕ ── */}
      <div className="settings-section-hdr">{t.secGeneral || "ОБЩИЕ"}</div>
      <div className="settings-group">
        {/* Language */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.language}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["ru", "uz", "en"] as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                className={`unit-btn ${language === l ? "on" : ""}`}
                style={{ minWidth: 42, padding: "5px 10px" }}
                onClick={() => handleLanguageChange(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.currency}</div>
          </div>
          <select
            className="input-field"
            style={{ width: 100, height: 36, padding: "4px 8px", fontSize: 14 }}
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
          >
            <option value="UZS">UZS (сум)</option>
            <option value="USD">USD ($)</option>
            <option value="RUB">RUB (₽)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>

        {/* City & Budget Form */}
        <form onSubmit={handleSavePreferences}>
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div className="settings-row-label">{t.city}</div>
            <input
              className="input-field"
              type="text"
              placeholder={t.cityPlaceholder || "Например: Ташкент"}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ height: 38 }}
            />
          </div>

          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div className="settings-row-label">
              {t.monthlyBudget} <small style={{ color: "var(--muted)" }}>({currency})</small>
            </div>
            <input
              className="input-field"
              type="number"
              min="0"
              step="any"
              placeholder={t.budgetPlaceholder || "Например: 1500000"}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              style={{ height: 38 }}
            />
          </div>

          <div style={{ padding: "10px 16px" }}>
            <button
              type="submit"
              className="btn btn-p press"
              style={{ padding: "10px", fontSize: 14 }}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? t.syncing : t.savePreferences || "Сохранить"}
            </button>
          </div>
        </form>
      </div>

      {/* ── 2. ВНЕШНИЙ ВИД ── */}
      <div className="settings-section-hdr">{t.secAppearance || "ВНЕШНИЙ ВИД"}</div>
      <div className="settings-group">
        {/* Theme mode */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.theme}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`unit-btn ${theme === "auto" ? "on" : ""}`}
              style={{ padding: "5px 10px" }}
              onClick={() => handleThemeChange("auto")}
            >
              {t.themeAuto}
            </button>
            <button
              type="button"
              className={`unit-btn ${theme === "light" ? "on" : ""}`}
              style={{ padding: "5px 10px" }}
              onClick={() => handleThemeChange("light")}
            >
              {t.themeLight}
            </button>
            <button
              type="button"
              className={`unit-btn ${theme === "dark" ? "on" : ""}`}
              style={{ padding: "5px 10px" }}
              onClick={() => handleThemeChange("dark")}
            >
              {t.themeDark}
            </button>
          </div>
        </div>

        {/* Compact Mode Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.compactMode || "Компактный режим"}</div>
            <div className="settings-row-desc">{t.compactModeDesc || "Уменьшенные карточки и отступы"}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("light");
                setCompactMode(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>

        {/* Reduced Motion Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.reducedMotion || "Уменьшение движения"}</div>
            <div className="settings-row-desc">{t.reducedMotionDesc || "Отключение пружинных анимаций"}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("light");
                setReducedMotion(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      {/* ── 3. СПИСОК ПОКУПОК ── */}
      <div className="settings-section-hdr">{t.secList || "СПИСОК ПОКУПОК"}</div>
      <div className="settings-group">
        {/* Show Purchased Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.showPurchased || "Показывать купленное"}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={showPurchased}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("light");
                setShowPurchased(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>

        {/* Confirm Delete Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.confirmDelete || "Подтверждать удаление"}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("light");
                setConfirmDelete(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>

        {/* Haptics Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.haptics || "Вибрация"}</div>
            <div className="settings-row-desc">{t.hapticsDesc || "Тактильный отклик Telegram"}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={hapticsEnabled}
              onChange={(e) => {
                if (!hapticsEnabled) triggerHaptic("light");
                setHapticsEnabled(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      {/* ── 4. AI И ПАРСИНГ ── */}
      <div className="settings-section-hdr">{t.secAI || "AI И ПАРСИНГ"}</div>
      <div className="settings-group">
        {/* AI Status */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.aiStatus || "AI модель"}</div>
            <div className="settings-row-desc">{t.aiProviderName || "Google Gemini 2.5 Flash"}</div>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              background: "rgba(52, 199, 89, 0.12)",
              color: "#34c759",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            ✓ Активно
          </div>
        </div>

        {/* Auto Category Toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.autoCategory || "Автоопределение категории"}</div>
            <div className="settings-row-desc">Автоматический выбор категории при вводе</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={autoCategory}
              onChange={(e) => {
                if (hapticsEnabled) triggerHaptic("light");
                setAutoCategory(e.target.checked);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      {/* ── 5. ДАННЫЕ ── */}
      <div className="settings-section-hdr">{t.secData || "ДАННЫЕ"}</div>
      <div className="settings-group">
        <div
          className="settings-row press"
          style={{ cursor: "pointer" }}
          onClick={handleClearCache}
        >
          <div className="settings-row-left">
            <div className="settings-row-label" style={{ color: "#ff453a" }}>
              {t.clearLocalCache || "Очистить локальный кэш"}
            </div>
            <div className="settings-row-desc">Сбросить сохранённые запросы и пересинхронизировать</div>
          </div>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "#ff453a" }}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </div>
      </div>

      {/* ── 6. О ПРИЛОЖЕНИИ ── */}
      <div className="settings-section-hdr">{t.secAbout || "О ПРИЛОЖЕНИИ"}</div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.versionLabel || "Версия"}</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            1.2.0 (Production)
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">Telegram Bot</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
            @MatingD_bot
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label">{t.privacy || "Безопасность"}</div>
            <div className="settings-row-desc">{t.privacyDesc || "HMAC-SHA256 валидация данных"}</div>
          </div>
          <div style={{ fontSize: 12, color: "#34c759", fontWeight: 700 }}>
            Защищено
          </div>
        </div>
      </div>
    </div>
  );
};
