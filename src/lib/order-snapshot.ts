/**
 * Last-order snapshot.
 *
 * The confirmation page needs the exact totals, discount breakdown, delivery
 * slot and payment method that were used at checkout — including for orders
 * that were queued while offline and therefore have no order number yet.
 */
export type OrderSnapshotLine = {
  name: string;
  qty: number;
  price: number;
  line_total: number;
};

export type OrderSnapshot = {
  orderNo: number | null;
  queueId: string | null;
  name: string;
  phone: string;
  address: string;
  area: string;
  slot: string;
  paymentMethod: string;
  paymentLabel: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  lines: OrderSnapshotLine[];
  createdAt: string;
};

const KEY = "last-order-v1";

export function saveOrderSnapshot(s: OrderSnapshot) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — the confirmation page falls back to tracking */
  }
}

export function readOrderSnapshot(): OrderSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OrderSnapshot) : null;
  } catch {
    return null;
  }
}
