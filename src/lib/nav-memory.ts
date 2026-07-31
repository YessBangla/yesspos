/**
 * Remembers the sidebar state (expanded groups, last selected menu item and
 * scroll offset) so a page refresh/reload restores the menu exactly as it was.
 */
const KEY = "sokoler.nav.memory";

export type NavMemory = {
  /** Last selected menu item key: `${to}|${label}` */
  item: string | null;
  /** Full path (with search) of the last selected item. */
  href: string | null;
  /** Expanded state of each sidebar group. */
  open: Record<string, boolean>;
  /** Sidebar scroll offset in px. */
  scroll: number;
  /** Sidebar collapsed (icon-only) state. */
  collapsed: boolean;
};

export const NAV_MEMORY_DEFAULTS: NavMemory = {
  item: null,
  href: null,
  open: {},
  scroll: 0,
  collapsed: false,
};

export function readNavMemory(): NavMemory {
  if (typeof window === "undefined") return NAV_MEMORY_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return NAV_MEMORY_DEFAULTS;
    return { ...NAV_MEMORY_DEFAULTS, ...(JSON.parse(raw) as Partial<NavMemory>) };
  } catch {
    return NAV_MEMORY_DEFAULTS;
  }
}

export function writeNavMemory(patch: Partial<NavMemory>) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readNavMemory(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
