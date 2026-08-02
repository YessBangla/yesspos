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

/* ---------------------------------------------------------------------------
 * Export / import — lets a user save their palette + accessibility contrast
 * settings to a .json file and restore them on another browser or later date.
 * ------------------------------------------------------------------------- */

export const THEME_FILE_VERSION = 1;

export type DashboardThemeFile = {
  app: "sokoler-bazar";
  kind: "dashboard-theme";
  version: number;
  exportedAt: string;
  settings: DashboardThemeState;
};

export function buildThemeFile(state: DashboardThemeState): DashboardThemeFile {
  return {
    app: "sokoler-bazar",
    kind: "dashboard-theme",
    version: THEME_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      theme: state.theme,
      mode: state.mode,
      glass: state.glass,
      contrast: state.contrast,
    },
  };
}

/** Triggers a browser download of the current theme settings. */
export function downloadThemeFile(state: DashboardThemeState) {
  const blob = new Blob([JSON.stringify(buildThemeFile(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bazar-bari-dashboard-theme-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const THEME_IDS = DASHBOARD_THEMES.map((t) => t.id) as string[];

/** Validates an uploaded theme file and returns the settings it contains. */
export function parseThemeFile(text: string): { ok: true; settings: DashboardThemeState } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  const file = raw as Partial<DashboardThemeFile>;
  const s = file?.settings as Partial<DashboardThemeState> | undefined;
  if (!s || typeof s !== "object") return { ok: false, error: "invalid-file" };
  if (s.theme && !THEME_IDS.includes(s.theme)) return { ok: false, error: "unknown-palette" };
  if (s.mode && !["light", "dark", "system"].includes(s.mode)) return { ok: false, error: "unknown-mode" };
  if (s.contrast && !["normal", "high"].includes(s.contrast)) return { ok: false, error: "unknown-contrast" };
  return {
    ok: true,
    settings: {
      theme: (s.theme as DashboardThemeId) ?? DEFAULTS.theme,
      mode: (s.mode as DashboardMode) ?? DEFAULTS.mode,
      glass: typeof s.glass === "boolean" ? s.glass : DEFAULTS.glass,
      contrast: (s.contrast as DashboardContrast) ?? DEFAULTS.contrast,
    },
  };
}
