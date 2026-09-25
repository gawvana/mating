import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client";
import { AddSheet } from "./components/AddSheet";
import { BottomDock } from "./components/BottomDock";
import { NavBar } from "./components/NavBar";
import { UndoToast } from "./components/UndoToast";
import { ListScreen } from "./screens/ListScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { getPendingMutations, removeMutation } from "./state/offlineQueue";
import { useAppStore } from "./state/useAppStore";
import { initTelegramApp } from "./telegram/telegram";

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeTab, setOffline, setSyncing, theme } = useAppStore();

  // Initialize Telegram Mini App environment & theme
  useEffect(() => {
    initTelegramApp();

    const storedTheme = localStorage.getItem("mating_theme");
    if (storedTheme) {
      document.documentElement.setAttribute("data-theme", storedTheme);
    } else if (window.Telegram?.WebApp?.colorScheme) {
      document.documentElement.setAttribute("data-theme", window.Telegram.WebApp.colorScheme);
    }
  }, [theme]);

  // Online / Offline listener & queue replay
  useEffect(() => {
    const handleOnline = async () => {
      setOffline(false);
      setSyncing(true);

      try {
        const pending = await getPendingMutations();
        for (const item of pending) {
          try {
            if (item.type === "create") {
              await api.createItem(item.payload);
            }
            await removeMutation(item.id);
          } catch (e) {
            console.warn("Failed to replay mutation", item.id, e);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["items"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
      } finally {
        setSyncing(false);
      }
    };

    const handleOffline = () => {
      setOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOffline, setSyncing, queryClient]);

  return (
    <>
      {/* SVG refraction filter */}
      <svg className="defs" aria-hidden="true">
        <filter id="lg" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage
            preserveAspectRatio="none"
            result="m"
            href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='x'%3E%3Cstop offset='0' stop-color='%23f00'/%3E%3Cstop offset='.16' stop-color='%23800000'/%3E%3Cstop offset='.84' stop-color='%23800000'/%3E%3Cstop offset='1' stop-color='%23000'/%3E%3C/linearGradient%3E%3ClinearGradient id='y' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%230f0'/%3E%3Cstop offset='.16' stop-color='%23008000'/%3E%3Cstop offset='.84' stop-color='%23008000'/%3E%3Cstop offset='1' stop-color='%23000'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23x)'/%3E%3Crect width='100' height='100' fill='url(%23y)' style='mix-blend-mode:screen'/%3E%3C/svg%3E"
          />
          <feDisplacementMap in="SourceGraphic" in2="m" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div id="app">
        <div className="page">
          {/* Aura decorative background blobs */}
          <div className="aur" aria-hidden="true">
            <i className="b" style={{ "--c": "var(--p)", "--k": -0.12, left: -160, top: 40 } as any} />
            <i className="b" style={{ "--c": "var(--t)", "--k": -0.2, right: -200, top: "22%" } as any} />
            <i className="b" style={{ "--c": "var(--primary)", "--k": -0.08, left: -200, top: "48%", opacity: 0.35 } as any} />
            <i className="b" style={{ "--c": "var(--t)", "--k": -0.15, right: -160, top: "74%" } as any} />
          </div>

          {/* Sticky Glass Navigation Bar */}
          <NavBar />

          {/* Active Screen View */}
          <main className="wrap">
            {activeTab === "list" && <ListScreen />}
            {activeTab === "stats" && <StatsScreen />}
            {activeTab === "settings" && <SettingsScreen />}
          </main>
        </div>
      </div>

      {/* Floating Bottom Chrome: FAB + Glass Dock */}
      <BottomDock />

      {/* Slide-up Add Sheet */}
      <AddSheet />

      {/* Soft delete Undo Toast */}
      <UndoToast />
    </>
  );
};
