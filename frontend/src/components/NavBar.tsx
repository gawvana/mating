import React from "react";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { isTelegramWebApp, triggerHaptic } from "../telegram/telegram";
import { StatusPill } from "./StatusPill";

export const NavBar: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const language = useAppStore((s) => s.language);
  const isOffline = useAppStore((s) => s.isOffline);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const hasSyncError = useAppStore((s) => s.hasSyncError);

  const t = translations[language];
  const inTelegram = isTelegramWebApp();

  const toggleTheme = () => {
    triggerHaptic("selection");
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  return (
    <header className="nav glass">
      <div className="nav-brand">
        <b>{t.appTitle}</b>
        <StatusPill isSyncing={isSyncing} isOffline={isOffline} hasError={hasSyncError} />
        {!inTelegram && (
          <a
            href="https://t.me/MatingD_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="badge-guest"
            title="Открыть в Telegram"
          >
            @MatingD_bot
          </a>
        )}
      </div>

      <div className="nav-actions">
        <button
          className="ib press"
          onClick={toggleTheme}
          aria-label={t.theme}
          title={t.theme}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
