import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Language, translations } from "../i18n";
import { ThemeMode, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const SettingsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { language, setLanguage, theme, setTheme } = useAppStore();
  const t = translations[language];

  // Fetch current user settings
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
  });

  const [currency, setCurrency] = useState("UZS");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      triggerHaptic("success");
      queryClient.setQueryData(["profile"], data);
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const handleLanguageChange = (lang: Language) => {
    triggerHaptic("selection");
    setLanguage(lang);
    updateSettingsMutation.mutate({ language_code: lang });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    triggerHaptic("selection");
    setCurrency(newCurrency);
    updateSettingsMutation.mutate({ currency_code: newCurrency });
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    triggerHaptic("selection");
    setTheme(newTheme);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      city: city.trim() || null,
      monthly_budget: budget ? parseFloat(budget) : null,
    });
  };

  return (
    <div className="page-content" style={{ paddingTop: 70 }}>
      <h2 className="screen-title">{t.settingsTitle}</h2>

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
          }}
        >
          {t.saved}
        </div>
      )}

      {/* Language */}
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-label">
            <span>{t.language}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ru", "uz", "en"] as Language[]).map((l) => (
              <button
                key={l}
                className={`chip press ${language === l ? "summary-chip accent" : "summary-chip"}`}
                onClick={() => handleLanguageChange(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Currency */}
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-label">
            <span>{t.currency}</span>
          </div>
          <select
            className="input-field"
            style={{ width: 120, height: 40 }}
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
          >
            <option value="UZS">UZS</option>
            <option value="USD">USD</option>
            <option value="RUB">RUB</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {/* Theme */}
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-label">
            <span>{t.theme}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`chip press ${theme === "auto" ? "summary-chip accent" : "summary-chip"}`}
              onClick={() => handleThemeChange("auto")}
            >
              {t.themeAuto}
            </button>
            <button
              className={`chip press ${theme === "light" ? "summary-chip accent" : "summary-chip"}`}
              onClick={() => handleThemeChange("light")}
            >
              {t.themeLight}
            </button>
            <button
              className={`chip press ${theme === "dark" ? "summary-chip accent" : "summary-chip"}`}
              onClick={() => handleThemeChange("dark")}
            >
              {t.themeDark}
            </button>
          </div>
        </div>
      </div>

      {/* Budget & City Form */}
      <form onSubmit={handleSavePreferences}>
        <div className="settings-group">
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div className="settings-label">
              <span>{t.monthlyBudget}</span>
              <small>{currency}</small>
            </div>
            <input
              className="input-field"
              type="number"
              min="0"
              step="any"
              placeholder={t.budgetPlaceholder}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div className="settings-label">
              <span>{t.city}</span>
            </div>
            <input
              className="input-field"
              type="text"
              placeholder={t.cityPlaceholder}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn"
          disabled={updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? t.syncing : t.savePreferences}
        </button>
      </form>
    </div>
  );
};
