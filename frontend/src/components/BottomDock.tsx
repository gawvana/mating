import React, { useCallback, useRef } from "react";
import { translations } from "../i18n";
import { ScreenTab, useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";

const TABS: ScreenTab[] = ["list", "stats", "settings"];

export const BottomDock: React.FC = () => {
  const { activeTab, setActiveTab, language, openSheet, closeSheet, isSheetOpen, hapticsEnabled } = useAppStore();
  const t = translations[language];

  const dockRef = useRef<HTMLElement>(null);
  const isDragging = useRef(false);
  const lastIndex = useRef(-1);

  const tabIndex = activeTab === "list" ? 0 : activeTab === "stats" ? 1 : 2;

  // Exact pick() logic from index.html
  const at = useCallback((clientX: number): number => {
    const el = dockRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const pad = 6;
    const n = 3;
    const raw = Math.floor((clientX - r.left - pad) / ((r.width - 2 * pad) / n));
    return Math.max(0, Math.min(n - 1, raw));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    const el = dockRef.current;
    if (el) {
      el.classList.add("lift");
      el.setPointerCapture(e.pointerId);
    }
    const idx = at(e.clientX);
    lastIndex.current = idx;
    if (el) {
      el.style.setProperty("--i", String(idx));
      el.style.setProperty("--tab-idx", String(idx));
    }
    if (hapticsEnabled) triggerHaptic("selection");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging.current) return;
    const idx = at(e.clientX);
    if (idx !== lastIndex.current) {
      lastIndex.current = idx;
      const el = dockRef.current;
      if (el) {
        el.style.setProperty("--i", String(idx));
        el.style.setProperty("--tab-idx", String(idx));
      }
      if (hapticsEnabled) triggerHaptic("selection");
    }
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = dockRef.current;
    if (el) {
      el.classList.remove("lift");
    }
    const finalIdx = lastIndex.current;
    if (finalIdx >= 0 && finalIdx < TABS.length) {
      if (isSheetOpen) closeSheet();
      setActiveTab(TABS[finalIdx]);
    }
  };

  const handlePointerCancel = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = dockRef.current;
    if (el) {
      el.classList.remove("lift");
      el.style.setProperty("--i", String(tabIndex));
      el.style.setProperty("--tab-idx", String(tabIndex));
    }
  };

  const handleTabClick = (tab: ScreenTab) => {
    if (hapticsEnabled) triggerHaptic("selection");
    if (isSheetOpen) closeSheet();
    setActiveTab(tab);
  };

  const handleFabClick = () => {
    if (isSheetOpen) {
      if (hapticsEnabled) triggerHaptic("selection");
      closeSheet();
    } else {
      if (hapticsEnabled) triggerHaptic("medium");
      openSheet("quick");
    }
  };

  return (
    <div className="chrome" id="chrome">
      {/* FAB — only visible on list tab, morphs + ↔ × with spring transition */}
      {activeTab === "list" && (
        <button
          className="fab press"
          id="fab"
          data-open={isSheetOpen ? "true" : "false"}
          onClick={handleFabClick}
          aria-label={isSheetOpen ? "Закрыть" : t.addTitle}
          title={isSheetOpen ? "Закрыть" : t.addTitle}
        >
          {/* Plus icon */}
          <svg viewBox="0 0 24 24" className="fab-icon-plus" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {/* Close icon */}
          <svg viewBox="0 0 24 24" className="fab-icon-close" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Navigation Dock with Apple-like pick() drag selection & lens highlight */}
      <nav
        className="dock glass"
        id="dock"
        ref={dockRef}
        aria-label="Навигация"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          "--i": tabIndex,
          "--tab-idx": tabIndex,
        } as React.CSSProperties}
      >
        <i className="lens" aria-hidden="true" />

        <button
          className={`tab ${activeTab === "list" ? "on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabClick("list");
          }}
          aria-label={t.tabList}
          aria-current={activeTab === "list" ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24">
            <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
            <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          <span>{t.tabList}</span>
        </button>

        <button
          className={`tab ${activeTab === "stats" ? "on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabClick("stats");
          }}
          aria-label={t.tabStats}
          aria-current={activeTab === "stats" ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>{t.tabStats}</span>
        </button>

        <button
          className={`tab ${activeTab === "settings" ? "on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabClick("settings");
          }}
          aria-label={t.tabSettings}
          aria-current={activeTab === "settings" ? "page" : undefined}
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
