import React from "react";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

export const BottomDock: React.FC = () => {
  const { activeTab, setActiveTab, language, openSheet } = useAppStore();
  const t = translations[language];

  const tabIndex = activeTab === "list" ? 0 : activeTab === "stats" ? 1 : 2;

  const handleTabClick = (tab: "list" | "stats" | "settings") => {
    triggerHaptic("selection");
    setActiveTab(tab);
  };

  const handleFabClick = () => {
    triggerHaptic("medium");
    openSheet("quick");
  };

  return (
    <div className="chrome" id="chrome">
      <button
        className={`fab press ${activeTab !== "list" ? "hidden" : ""}`}
        id="fab"
        onClick={handleFabClick}
        aria-label={t.addTitle}
        title={t.addTitle}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <nav
        className="dock glass"
        id="dock"
        aria-label="Навигация"
        style={{ "--tab-idx": tabIndex } as React.CSSProperties}
      >
        <i className="lens" aria-hidden="true"></i>

        <button
          className={`tab ${activeTab === "list" ? "on" : ""}`}
          onClick={() => handleTabClick("list")}
          aria-label={t.tabList}
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
          </svg>
          <span>{t.tabList}</span>
        </button>

        <button
          className={`tab ${activeTab === "stats" ? "on" : ""}`}
          onClick={() => handleTabClick("stats")}
          aria-label={t.tabStats}
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>{t.tabStats}</span>
        </button>

        <button
          className={`tab ${activeTab === "settings" ? "on" : ""}`}
          onClick={() => handleTabClick("settings")}
          aria-label={t.tabSettings}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>{t.tabSettings}</span>
        </button>
      </nav>
    </div>
  );
};
