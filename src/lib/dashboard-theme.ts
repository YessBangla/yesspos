import { useCallback, useEffect, useState } from "react";

/** Colour palettes available for the dashboard skin (scoped to /dashboard). */
export const DASHBOARD_THEMES = [
  {
    id: "sky",
    name: { bn: "স্কাই ব্লু", en: "Sky blue" },
    swatch: ["#dbeafe", "#bfdbfe", "#60a5fa", "#3b5bdb"],
  },
  {
    id: "lavender",
    name: { bn: "ল্যাভেন্ডার", en: "Lavender" },
    swatch: ["#ede9fe", "#ddd6fe", "#a78bfa", "#6d3fd4"],
  },
  {
    id: "mint",
    name: { bn: "মিন্ট", en: "Mint" },
    swatch: ["#d9f5ec", "#b6ead7", "#4fc9a1", "#0f9370"],
  },
  {
    id: "sunset",
    name: { bn: "সানসেট", en: "Sunset" },
    swatch: ["#ffeadb", "#ffd3b6", "#ff9d6c", "#e2622f"],
  },
  {
    id: "slate",
    name: { bn: "স্লেট", en: "Slate" },
    swatch: ["#e9eef3", "#cfd8e3", "#8ea1b7", "#3f5876"],
  },
] as const;

export type DashboardThemeId = (typeof DASHBOARD_THEMES)[number]["id"];
export type DashboardMode = "light" | "dark" | "system";

export type DashboardContrast = "normal" | "high";

export type DashboardThemeState = {
  theme: DashboardThemeId;
  mode: DashboardMode;
  glass: boolean;
  /** Accessibility: "high" boosts menu/text/icon contrast (esp. in dark mode). */
  contrast: DashboardContrast;
};

const KEY = "sherapos.dashboard.theme";
const DEFAULTS: DashboardThemeState = { theme: "sky", mode: "system", glass: true, contrast: "normal" };
const EVENT = "sokoler:dashboard-theme";

function read(): DashboardThemeState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DashboardThemeState>) };
  } catch {
    return DEFAULTS;
  }
}

/** Resolves "system" against the global `.dark` class on <html>. */
export function resolveMode(mode: DashboardMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Persisted dashboard theme settings. Saved per browser so an employee can
 * keep their own colour + light/dark preference for the dashboard only.
 */
export function useDashboardTheme() {
  const [state, setState] = useState<DashboardThemeState>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
    // Keep every mounted consumer (shell chrome + dashboard page) in sync.
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((patch: Partial<DashboardThemeState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(EVENT));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* ignore */
    }
    setState(DEFAULTS);
  }, []);

  return { ...state, ready, save, reset, resolved: resolveMode(state.mode) };
}

/** Attributes to spread on the `.dashboard-skin` wrapper. */
export function dashboardThemeAttrs(
  theme: DashboardThemeId,
  mode: DashboardMode,
  glass: boolean,
  contrast: DashboardContrast = "normal",
) {
  return {
    "data-dash-theme": theme,
    "data-dash-mode": resolveMode(mode),
    "data-dash-glass": glass ? "on" : "off",
    "data-dash-contrast": contrast,
  } as const;
}
