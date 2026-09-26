import React, { useEffect, useRef } from "react";
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
import { initTelegramApp, setupTelegramBackButton } from "./telegram/telegram";

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab, setOffline, setSyncing } = useAppStore();
  const appRef = useRef<HTMLDivElement>(null);
  const aurRef = useRef<HTMLDivElement>(null);
  const scrollLastY = useRef(0);
  const scrollTick = useRef(false);

  // ── Browser back/forward & Telegram BackButton navigation ────────────────
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("stats")) setActiveTab("stats");
      else if (path.includes("settings")) setActiveTab("settings");
      else setActiveTab("list");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveTab]);

  useEffect(() => {
    return setupTelegramBackButton(() => setActiveTab("list"), activeTab !== "list");
  }, [activeTab, setActiveTab]);

  // ── One-time initialization ──────────────────────────────────────────────
  useEffect(() => {
    // 1. Telegram Mini App environment
    initTelegramApp();

    // 2. Hardware Capability Detection (60 FPS on low-end, full shaders on high-end)
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData || false;

    document.documentElement.classList.remove("perf-minimal", "perf-reduced", "perf-full");
    if (cores <= 2 || memory <= 2 || saveData) {
      document.documentElement.classList.add("perf-minimal");
    } else if (cores <= 4 || memory <= 4) {
      document.documentElement.classList.add("perf-reduced");
    } else {
      document.documentElement.classList.add("perf-full");
    }

    // 3. Apply persisted theme without flash
    const stored = localStorage.getItem("mating_theme");
    if (stored && stored !== "auto") {
      document.documentElement.setAttribute("data-theme", stored);
    } else if (stored === "auto" || !stored) {
      document.documentElement.removeAttribute("data-theme");
      // Follow Telegram color scheme if available
      if (window.Telegram?.WebApp?.colorScheme) {
        document.documentElement.setAttribute("data-theme", window.Telegram.WebApp.colorScheme);
      }
    }

    // 4. Enable Chromium refraction enhancement (only on capable devices)
    const isChromium = /Chrom(e|ium)\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
    if (isChromium && cores > 2 && memory > 2) {
      document.documentElement.classList.add("refract");
    }

    // 5. Pointer tracking for glass specular (--ang) and hover glow (--mx, --my)
    //    CRITICAL: Only attach on devices with a fine pointer (mouse/trackpad).
    //    Touch screens should never run pointer tracking to preserve 60 FPS mobile scrolls.
    let cleanupPointer: (() => void) | undefined;
    if (window.matchMedia("(pointer: fine)").matches) {
      const handlePointerMove = (e: PointerEvent) => {
        const ang = 135 + (e.clientX / innerWidth - 0.5) * 70 + (e.clientY / innerHeight - 0.5) * 40;
        document.documentElement.style.setProperty("--ang", `${ang}deg`);

        const glassEl = (e.target as Element)?.closest?.(".glass") as HTMLElement | null;
        if (glassEl) {
          const r = glassEl.getBoundingClientRect();
          glassEl.style.setProperty("--mx", `${e.clientX - r.left}px`);
          glassEl.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
      };
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      cleanupPointer = () => document.removeEventListener("pointermove", handlePointerMove);
    }

    return () => {
      if (cleanupPointer) cleanupPointer();
    };
  }, []);

  // ── Scroll spy: compact nav + aura parallax ──────────────────────────────
  // ONE rAF per scroll event — zero setState per scroll tick
  useEffect(() => {
    const appEl = appRef.current;
    const aurEl = aurRef.current;
    if (!appEl) return;

    const handleScroll = () => {
      if (scrollTick.current) return;
      scrollTick.current = true;
      requestAnimationFrame(() => {
        scrollTick.current = false;
        const y = appEl.scrollTop;
        const d = y - scrollLastY.current;

        // Compact nav on scroll
        appEl.classList.toggle("sc", y > 30);

        // Parallax aura blobs via CSS var (no React state)
        if (aurEl) aurEl.style.setProperty("--sy", String(y));

        scrollLastY.current = y;
        // Suppress unused warning
        void d;
      });
    };

    appEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => appEl.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Online / Offline listener & queue replay ─────────────────────────────
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

    const handleOffline = () => setOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOffline, setSyncing, queryClient]);

  return (
    <>
      {/* SVG refraction filter (Chromium only, activated via html.refract class) */}
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

      <div id="app" ref={appRef}>
        <div className="page">
          {/* Aura decorative background blobs — CSS animation only, no RAF */}
          <div className="aur" aria-hidden="true" ref={aurRef}>
            <i className="b" style={{ "--c": "var(--p)", "--k": -0.12, left: -160, top: 40 } as React.CSSProperties} />
            <i className="b" style={{ "--c": "var(--t)", "--k": -0.2, right: -200, top: "22%" } as React.CSSProperties} />
            <i className="b" style={{ "--c": "var(--primary)", "--k": -0.08, left: -200, top: "48%", opacity: 0.35 } as React.CSSProperties} />
            <i className="b" style={{ "--c": "var(--t)", "--k": -0.15, right: -160, top: "74%" } as React.CSSProperties} />
          </div>

          {/* Sticky Glass Navigation Bar */}
          <NavBar />

          {/* Active Screen */}
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
