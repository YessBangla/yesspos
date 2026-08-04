/** Offline-friendly storefront cart, persisted in localStorage. */
import { useCallback, useEffect, useState } from "react";

export type ShopLine = {
  id: string;
  name_en: string;
  name_bn: string;
  price: number;
  pack_size: string | null;
  image_url: string | null;
  qty: number;
  /** Last known sellable stock; used to cap quantities in the cart. */
  stock?: number | null;
};

const KEY = "shop-cart-v1";
const EVENT = "shop-cart-change";

/** Broadcast whenever the cart changes — listened to by badges and sync. */
export const CART_EVENT = EVENT;

/** Hard cap per line when a product has no stock information. */
export const MAX_PER_LINE = 20;

export function readCart(): ShopLine[] {
  return read();
}

/** Overwrite the whole cart (used by cross-device sync). */
export function writeCart(lines: ShopLine[]) {
  write(lines);
}

function read(): ShopLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ShopLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: ShopLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage full or blocked — cart stays in memory */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useShopCart() {
  const [lines, setLines] = useState<ShopLine[]>([]);

  // Hydrate from localStorage after mount and keep every mounted cart view
  // (header badge, drawer, product page) in sync across tabs and components.
  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: ShopLine[]) => {
    setLines(next);
    write(next);
  }, []);


  const add = useCallback(
    (p: Omit<ShopLine, "qty">, qty = 1) => {
      const current = read();
      const found = current.find((l) => l.id === p.id);
      const next = found
        ? current.map((l) =>
            l.id === p.id ? { ...l, ...p, qty: clampQty(l.qty + qty, p.stock) } : l,
          )
        : [...current, { ...p, qty: clampQty(qty, p.stock) }];
      update(next);
    },
    [update],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      const next = read()
        .map((l) => (l.id === id ? { ...l, qty: clampQty(qty, l.stock) } : l))
        .filter((l) => l.qty > 0);
      update(next);
    },
    [update],
  );

  const clear = useCallback(() => update([]), [update]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  return { lines, add, setQty, clear, subtotal, count };
}

/**
 * Refresh the stored stock for each line from live data and trim any line that
 * now exceeds what is sellable. Returns the products that had to be reduced or
 * removed so the UI can tell the shopper.
 */
export function applyStockLimits(stockById: Record<string, number>) {
  const current = read();
  const adjusted: { line: ShopLine; from: number; to: number }[] = [];
  const next: ShopLine[] = [];
  for (const l of current) {
    const stock = stockById[l.id];
    if (stock === undefined) {
      next.push(l);
      continue;
    }
    const qty = clampQty(l.qty, stock);
    if (qty !== l.qty) adjusted.push({ line: l, from: l.qty, to: qty });
    if (qty > 0) next.push({ ...l, stock, qty });
  }
  if (JSON.stringify(next) !== JSON.stringify(current)) write(next);
  return adjusted;
}

/** Clamp a requested quantity to the sellable stock (or the global cap). */
export function clampQty(qty: number, stock?: number | null) {
  const limit = typeof stock === "number" && stock >= 0 ? Math.min(stock, 999) : MAX_PER_LINE;
  return Math.max(0, Math.min(Math.round(qty), limit));
}

/** Free delivery above ৳1000, otherwise the selected area's base fee. */
export function deliveryFeeFor(subtotal: number, baseFee = 60) {
  if (subtotal <= 0) return 0;
  return subtotal >= 1000 ? 0 : baseFee;
}
