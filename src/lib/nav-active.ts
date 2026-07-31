/**
 * Route → menu item matching for the sidebar.
 *
 * Deep links such as `/products/123/edit` must keep the `/products` menu item
 * highlighted, while `/product-audit` must NOT match `/products`. Matching is
 * therefore segment aware, and when several items match the longest (most
 * specific) path wins. Items that carry search params (e.g. `?filter=returns`)
 * only win when those params are present in the current URL.
 */

export type MatchableItem = {
  to: string;
  label: string;
  search?: Record<string, string>;
};

export function navItemKey(item: MatchableItem) {
  return `${item.to}|${item.label}`;
}

/** True when `pathname` is `to` or a nested route under it. */
export function isPathMatch(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  const base = to.endsWith("/") ? to.slice(0, -1) : to;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function searchMatches(item: MatchableItem, searchStr: string) {
  if (!item.search) return true;
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  return Object.entries(item.search).every(([k, v]) => params.get(k) === v);
}

/**
 * Returns the key of the menu item that should be highlighted for the current
 * location, or null when nothing matches.
 */
export function activeNavKey(items: MatchableItem[], pathname: string, searchStr = ""): string | null {
  let best: { key: string; score: number } | null = null;

  for (const item of items) {
    if (!isPathMatch(pathname, item.to)) continue;
    if (!searchMatches(item, searchStr)) continue;

    // Longer path = more specific. A matching search param breaks ties in
    // favour of the filtered variant (e.g. /sales?filter=returns).
    const score = item.to.length * 10 + (item.search ? 5 : 0);
    if (!best || score > best.score) best = { key: navItemKey(item), score };
  }

  return best?.key ?? null;
}
