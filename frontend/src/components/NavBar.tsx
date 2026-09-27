import React from "react";
import { IconMoon, IconSun } from "./Icons";
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
            <IconSun size={20} />
          ) : (
            <IconMoon size={20} />
          )}
        </button>
      </div>
    </header>
  );
};
