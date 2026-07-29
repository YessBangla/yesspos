/**
 * Persistence for the POS multi-sale tabs.
 *
 * Sale tabs live in component state, so navigating to another menu unmounts
 * the POS screen and would throw away every open sale. We mirror the tabs and
 * their cart snapshots into sessionStorage so the seller comes back to exactly
 * the same set of ongoing sales (per browser tab, cleared when the tab closes).
 */
const KEY = "yesspos-pos-tabs";

export type PosTabsState<S> = {
  tabs: { id: string; name: string }[];
  activeTab: string;
  stash: Record<string, S>;
};

export function loadPosTabs<S>(): PosTabsState<S> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosTabsState<S>;
    if (!parsed?.tabs?.length || !parsed.activeTab) return null;
    if (!parsed.tabs.some((t) => t.id === parsed.activeTab)) return null;
    return { ...parsed, stash: parsed.stash ?? {} };
  } catch {
    return null;
  }
}

export function savePosTabs<S>(state: PosTabsState<S>) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — tabs simply won't survive navigation */
  }
}

export function clearPosTabs() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
