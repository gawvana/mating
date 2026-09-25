import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatCurrency, translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";

export const StatsScreen: React.FC = () => {
  const { language } = useAppStore();
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
      <div className="page-content" style={{ paddingTop: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="page-content" style={{ paddingTop: 80 }}>
        <div className="empty-state">
          <h3>Ошибка загрузки</h3>
          <p>Не удалось получить аналитику расходов.</p>
          <button className="btn outline" style={{ marginTop: 12 }} onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const budgetUsage = stats.budget_usage_percent || 0;
  const isOverBudget = stats.budget_remaining !== null && stats.budget_remaining < 0;

  return (
    <div className="page-content" style={{ paddingTop: 70 }}>
      <h2 style={{ margin: "16px 4px 18px", fontSize: 26 }}>{t.statsTitle}</h2>

      {/* Total Spent Card */}
      <div className="stat-card">
        <div className="stat-label">{t.spentThisMonth}</div>
        <div className="stat-value">
          {formatCurrency(stats.total_spent, stats.currency_code, language)}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {stats.items_purchased_count} купленных товаров
        </div>
      </div>

      {/* Budget Card */}
      <div className="stat-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="stat-label">{t.budget}</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {stats.monthly_budget
              ? formatCurrency(stats.monthly_budget, stats.currency_code, language)
              : t.noBudgetSet}
          </div>
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
                {formatCurrency(stats.budget_remaining || 0, stats.currency_code, language)}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {/* Category Breakdown */}
      <div className="stat-card">
        <div className="stat-label" style={{ marginBottom: 12 }}>
          {t.byCategory}
        </div>

        {stats.categories.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: "12px 0" }}>
            {t.emptyStats}
          </div>
        ) : (
          stats.categories.map((cat) => (
            <div key={cat.category} className="category-stat-row">
              <div className="category-stat-info">
                <span>{cat.category}</span>
                <span>
                  {formatCurrency(cat.amount, stats.currency_code, language)} ({cat.percentage}%)
                </span>
              </div>
              <div className="stat-bar" style={{ marginTop: 4, height: 6 }}>
                <div
                  className="stat-bar-fill"
                  style={{ width: `${Math.min(100, cat.percentage)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
