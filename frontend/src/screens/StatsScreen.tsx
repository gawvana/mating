import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";

export const StatsScreen: React.FC = () => {
  const { language, currency } = useAppStore();
  const t = translations[language];

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getMonthlyStats(),
  });

  if (isLoading) {
    return (
      <div style={{ paddingTop: 40, textAlign: "center", color: "var(--muted)" }}>
        Загрузка статистики...
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div style={{ paddingTop: 8 }}>
        <div className="settings-group" style={{ textAlign: "center", padding: "32px 16px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{t.errorLoadingTitle}</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t.errorLoadingStats}</p>
          <button
            type="button"
            className="btn outline"
            style={{ width: "auto", margin: "14px auto 0", padding: "0 20px", height: 38 }}
            onClick={() => refetch()}
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const budgetUsage = stats.budget_usage_percent || 0;
  const isOverBudget = stats.budget_remaining !== null && stats.budget_remaining < 0;

  return (
    <div style={{ paddingTop: 8 }}>
      {/* ── ОБЗОР РАСХОДОВ ── */}
      <div className="settings-group-title">{t.statsTitle}</div>
      <div className="settings-group" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
          {t.spentThisMonth}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, color: "var(--on)" }}>
          {formatCurrency(stats.total_spent, stats.currency_code || currency, language)}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, fontWeight: 500 }}>
          {stats.items_purchased_count} {t.itemsPurchasedLabel}
        </div>
      </div>

      {/* ── БЮДЖЕТ ── */}
      <div className="settings-group-title">{t.budget}</div>
      <div className="settings-group" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>{t.budget}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--on)" }}>
            {stats.monthly_budget
              ? formatCurrency(stats.monthly_budget, stats.currency_code || currency, language)
              : t.noBudgetSet}
          </span>
        </div>

        {stats.monthly_budget ? (
          <>
            <div className="stat-bar">
              <div
                className={`stat-bar-fill ${
                  isOverBudget ? "err" : budgetUsage > 80 ? "warn" : ""
                }`}
                style={{ width: `${Math.min(100, budgetUsage)}%` }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginTop: 8,
                color: isOverBudget ? "var(--err)" : "var(--muted)",
                fontWeight: 600,
              }}
            >
              <span>{t.remaining}</span>
              <span>
                {formatCurrency(stats.budget_remaining || 0, stats.currency_code || currency, language)}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {/* ── ПО КАТЕГОРИЯМ ── */}
      {stats.categories && stats.categories.length > 0 && (
        <>
          <div className="settings-group-title">{t.byCategory}</div>
          <div className="settings-group" style={{ padding: "6px 14px" }}>
            {stats.categories.map((cat, idx) => (
              <div
                key={cat.category}
                style={{
                  padding: "12px 4px",
                  borderBottom: idx < stats.categories.length - 1 ? "1px solid var(--outline)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--on)" }}>
                    {cat.category}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--on)" }}>
                    {formatCurrency(cat.amount, stats.currency_code || currency, language)}
                  </span>
                </div>
                <div className="stat-bar" style={{ height: 6, marginTop: 8 }}>
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
