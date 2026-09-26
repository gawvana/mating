import React, { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client";
import { AddSheet } from "./components/AddSheet";
import { BottomDock } from "./components/BottomDock";
import { NavBar } from "./components/NavBar";
import { UndoToast } from "./components/UndoToast";
import { ListScreen } from "./screens/ListScreen";
import { flushOfflineQueue } from "./state/offlineQueue";
import { DEFAULT_MOTION_PROFILE, useAppStore } from "./state/useAppStore";
import { initTelegramApp, setupTelegramBackButton } from "./telegram/telegram";

const StatsScreen = React.lazy(() =>
  import("./screens/StatsScreen").then((m) => ({ default: m.StatsScreen }))
);
const SettingsScreen = React.lazy(() =>
  import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen }))
);

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setOffline = useAppStore((s) => s.setOffline);
  const setSyncing = useAppStore((s) => s.setSyncing);
  const setSyncError = useAppStore((s) => s.setSyncError);
  const motionProfile = useAppStore((s) => s.motionProfile);

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

  // ── Motion Profile → CSS Custom Properties & Class Synchronization ────────
  useEffect(() => {
    const root = document.documentElement;
    const p = motionProfile || DEFAULT_MOTION_PROFILE;

    // Per-animation CSS vars
    root.style.setProperty("--anim-fab-morph", p.fabMorph?.enabled ? "1" : "0");
    root.style.setProperty("--anim-sheet-spring", p.sheetSpring?.enabled ? "1" : "0");
    root.style.setProperty("--anim-purchase", p.purchaseTransition?.enabled ? "1" : "0");
    root.style.setProperty("--anim-total", p.animatedTotal?.enabled ? "1" : "0");
    root.style.setProperty("--anim-budget", p.animatedBudget?.enabled ? "1" : "0");
    root.style.setProperty("--anim-tab-indicator", p.tabIndicator?.enabled ? "1" : "0");
    root.style.setProperty("--anim-checkbox", p.checkboxSpring?.enabled ? "1" : "0");
    root.style.setProperty("--anim-swipe", p.swipeResistance?.enabled ? "1" : "0");
    root.style.setProperty("--anim-longpress", p.longPressMenu?.enabled ? "1" : "0");
    root.style.setProperty("--anim-edit-morph", p.editMorph?.enabled ? "1" : "0");
    root.style.setProperty("--anim-status-pill", p.statusPill?.enabled ? "1" : "0");
    root.style.setProperty("--anim-header-motion", p.headerMotion?.enabled ? "1" : "0");
    root.style.setProperty("--anim-keyboard-sheet", p.keyboardSheet?.enabled ? "1" : "0");
    root.style.setProperty("--anim-list-add-delete", p.listAddDelete?.enabled ? "1" : "0");
    root.style.setProperty(
      "--anim-haptic",
      String(p.hapticFeedback?.enabled ? (p.hapticMode === "Light" ? "1" : "2") : "0")
    );

    // Spring curves
    const curveMap: Record<string, string> = {
      snappy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      balanced: "cubic-bezier(0.25, 1, 0.5, 1)",
      soft: "cubic-bezier(0.16, 1, 0.3, 1)",
      linear: "linear",
    };
    root.style.setProperty("--curve-fab", curveMap[p.fabMorph?.curve || "snappy"] || curveMap.snappy);
    root.style.setProperty("--curve-sheet", curveMap[p.sheetSpring?.curve || "snappy"] || curveMap.snappy);
    root.style.setProperty("--curve-purchase", curveMap[p.purchaseTransition?.curve || "snappy"] || curveMap.snappy);
    root.style.setProperty("--curve-tab", curveMap[p.tabIndicator?.curve || "snappy"] || curveMap.snappy);
    root.style.setProperty("--curve-list", curveMap[p.listAddDelete?.curve || "snappy"] || curveMap.snappy);

    // Duration variables
    root.style.setProperty("--dur-fab", `${p.fabMorph?.duration || 450}ms`);
    root.style.setProperty("--dur-sheet", `${p.sheetSpring?.duration || 600}ms`);
    root.style.setProperty("--dur-purchase", `${p.purchaseTransition?.duration || 400}ms`);
    root.style.setProperty("--dur-total", `${p.animatedTotal?.duration || 400}ms`);
    root.style.setProperty("--dur-budget", `${p.animatedBudget?.duration || 700}ms`);
    root.style.setProperty("--dur-tab", `${p.tabIndicator?.duration || 650}ms`);
    root.style.setProperty("--dur-checkbox", `${p.checkboxSpring?.duration || 350}ms`);
    root.style.setProperty("--dur-swipe", `${p.swipeResistance?.duration || 450}ms`);
    root.style.setProperty("--dur-longpress", `${p.longPressMenu?.duration || 250}ms`);
    root.style.setProperty("--dur-edit-morph", `${p.editMorph?.duration || 400}ms`);
    root.style.setProperty("--dur-status-pill", `${p.statusPill?.duration || 400}ms`);
    root.style.setProperty("--dur-header", `${p.headerMotion?.duration || 600}ms`);
    root.style.setProperty("--dur-keyboard", `${p.keyboardSheet?.duration || 350}ms`);
    root.style.setProperty("--dur-list", `${p.listAddDelete?.duration || 350}ms`);
    root.style.setProperty("--motion-intensity", String(p.intensity ?? 100));

    // Glass tier classes
    root.classList.remove("glass-full", "glass-adaptive", "glass-reduced", "glass-minimal");
    const glassMode = p.glassMode?.toLowerCase() || "adaptive";
    root.classList.add(`glass-${glassMode}`);

    // Battery saver logic
    if (p.batterySaver) {
      root.classList.add("perf-minimal");
    } else {
      const cores = navigator.hardwareConcurrency || 4;
      const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
      if (cores > 2 && memory > 2) {
        root.classList.remove("perf-minimal");
      }
    }

    // Animation style dataset
    root.dataset.motionStyle = p.animationStyle?.toLowerCase() || "normal";

    if (p.animationStyle === "Minimal" || p.batterySaver) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }
  }, [motionProfile]);

  // ── One-time initialization ──────────────────────────────────────────────
  useEffect(() => {
    initTelegramApp();

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

    const stored = localStorage.getItem("mating_theme");
    if (stored && stored !== "auto") {
      document.documentElement.setAttribute("data-theme", stored);
    } else if (stored === "auto" || !stored) {
      document.documentElement.removeAttribute("data-theme");
      if (window.Telegram?.WebApp?.colorScheme) {
        document.documentElement.setAttribute("data-theme", window.Telegram.WebApp.colorScheme);
      }
    }

    const isChromium = /Chrom(e|ium)\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
    if (isChromium && cores > 2 && memory > 2) {
      document.documentElement.classList.add("refract");
    }

    let cleanupPointer: (() => void) | undefined;
    if (window.matchMedia("(pointer: fine)").matches) {
      let pointerFrame: number | null = null;
      let lastClientX = 0;
      let lastClientY = 0;
      let lastTarget: Element | null = null;

      const handlePointerMove = (e: PointerEvent) => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        lastTarget = e.target as Element;

        if (pointerFrame === null) {
          pointerFrame = requestAnimationFrame(() => {
            pointerFrame = null;
            const ang = 135 + (lastClientX / window.innerWidth - 0.5) * 70 + (lastClientY / window.innerHeight - 0.5) * 40;
            document.documentElement.style.setProperty("--ang", `${ang}deg`);

            const glassEl = lastTarget?.closest?.(".glass") as HTMLElement | null;
            if (glassEl) {
              const r = glassEl.getBoundingClientRect();
              glassEl.style.setProperty("--mx", `${lastClientX - r.left}px`);
              glassEl.style.setProperty("--my", `${lastClientY - r.top}px`);
            }
          });
        }
      };
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      cleanupPointer = () => {
        if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
        document.removeEventListener("pointermove", handlePointerMove);
      };
    }

    const compact = localStorage.getItem("mating_compact") === "true";
    if (compact) document.documentElement.classList.add("compact-mode");

    const reducedMot = localStorage.getItem("mating_reduced_motion") === "true";
    if (reducedMot) document.documentElement.classList.add("reduced-motion");

    return () => {
      if (cleanupPointer) cleanupPointer();
    };
  }, []);

  // ── Scroll spy: compact nav + aura parallax (rAF throttled, no React setState) ──
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

        // Parallax aura blobs via CSS var
        if (aurEl) aurEl.style.setProperty("--sy", String(y));

        // Hide/show bottom dock on scroll direction
        const chrome = document.getElementById("chrome");
        if (chrome && Math.abs(d) > 8) {
          chrome.classList.toggle("min", d > 0 && y > 120);
        }

        scrollLastY.current = y;
      });
    };

    appEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => appEl.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Online / Offline listener & robust queue replay ─────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      setOffline(false);
      setSyncing(true);
      try {
        const result = await flushOfflineQueue(api);
        setSyncError(result.hasFailures);
        if (result.processedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["items"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
        }
      } catch (err) {
        console.warn("Queue replay error:", err);
        setSyncError(true);
      } finally {
        setSyncing(false);
      }
    };

    const handleOffline = () => setOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Replay pending mutations immediately on mount if online
    if (typeof navigator !== "undefined" && navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOffline, setSyncing, setSyncError, queryClient]);

  return (
    <>
      {/* SVG refraction filter for Chromium */}
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
          {/* Parallax Aura blobs */}
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
            <React.Suspense fallback={<div className="skeleton" style={{ height: 120, margin: "20px 0", borderRadius: "var(--r3)" }} />}>
              {activeTab === "stats" && <StatsScreen />}
              {activeTab === "settings" && <SettingsScreen />}
            </React.Suspense>
          </main>
        </div>
      </div>

      {/* Floating Bottom Chrome: FAB + Glass Dock with drag pick() and lens */}
      <BottomDock />

      {/* Slide-up Add Sheet with real-time iOS presentation */}
      <AddSheet />

      {/* Soft delete Undo Toast */}
      <UndoToast />
    </>
  );
};
