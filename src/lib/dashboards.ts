import { useCallback, useEffect, useState } from "react";

/** Widgets an employee can switch on/off per dashboard. */
export const DASHBOARD_WIDGETS = [
  "shortcuts",
  "kpi",
  "highlights",
  "ledgers",
  "chart",
  "bestseller",
  "transactions",
  "activity",
  "lowstock",
] as const;

export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];
export type DashboardRange = "today" | "week" | "month" | "year";

export type DashboardPreset = {
  id: string;
  name: string;
  range: DashboardRange;
  widgets: DashboardWidget[];
};

const KEY_PREFIX = "sherapos.dashboards.";

function defaultPresets(): DashboardPreset[] {
  return [
    { id: "default", name: "Main", range: "month", widgets: [...DASHBOARD_WIDGETS] },
  ];
}

function load(userId: string | null): DashboardPreset[] {
  if (typeof window === "undefined") return defaultPresets();
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + (userId ?? "anon"));
    if (!raw) return defaultPresets();
    const parsed = JSON.parse(raw) as DashboardPreset[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultPresets();
    return parsed;
  } catch {
    return defaultPresets();
  }
}

/**
 * Per-employee dashboards. Each employee can keep several dashboards
 * (e.g. "Sales", "Stock") with their own range and widget selection.
 */
export function useDashboards(userId: string | null) {
  const [presets, setPresets] = useState<DashboardPreset[]>(defaultPresets);
  const [activeId, setActiveId] = useState("default");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const list = load(userId);
    setPresets(list);
    setActiveId(list[0].id);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(KEY_PREFIX + (userId ?? "anon"), JSON.stringify(presets));
  }, [presets, userId, ready]);

  const active = presets.find((p) => p.id === activeId) ?? presets[0];

  const update = useCallback(
    (patch: Partial<DashboardPreset>) =>
      setPresets((prev) => prev.map((p) => (p.id === active.id ? { ...p, ...patch } : p))),
    [active.id],
  );

  const add = useCallback((name: string) => {
    const id = `d${Date.now()}`;
    setPresets((prev) => [...prev, { id, name, range: "month", widgets: [...DASHBOARD_WIDGETS] }]);
    setActiveId(id);
  }, []);

  const remove = useCallback((id: string) => {
    setPresets((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p.id !== id);
      setActiveId(next[0].id);
      return next;
    });
  }, []);

  const toggleWidget = useCallback(
    (w: DashboardWidget) =>
      update({
        widgets: active.widgets.includes(w)
          ? active.widgets.filter((x) => x !== w)
          : [...active.widgets, w],
      }),
    [active, update],
  );

  return { presets, active, activeId: active.id, setActiveId, add, remove, update, toggleWidget };
}
