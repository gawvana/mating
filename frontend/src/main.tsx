import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/design-system.css";

// ── Handle chunk loading errors during dynamic deployments safely ──
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    console.warn("Vite preload error detected:", event);
    const RELOAD_KEY = "mating_preload_reload_ts";
    const lastReload = parseInt(sessionStorage.getItem(RELOAD_KEY) || "0", 10);
    const now = Date.now();

    // Prevent infinite reload loops: at most 1 reload per 10 seconds
    if (now - lastReload > 10000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      console.info("Reloading fresh version after chunk loading error...");
      window.location.reload();
    } else {
      console.error("Vite preload error persisted after reload. Suppressing reload loop.");
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById("root");

if (rootElement) {
  // Mark app as booted so static HTML failsafe timeout does not trigger
  if (typeof window !== "undefined") {
    (window as any).__mating_mounted = true;
  }
  const preloader = document.getElementById("mating-preloader");
  if (preloader) {
    preloader.remove();
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Fatal: #root element not found in document");
}
