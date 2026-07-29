/**
 * Offline sale queue.
 *
 * When the network is down the POS still takes the sale: the whole payload is
 * stored in IndexedDB and replayed against the backend as soon as the browser
 * is online again. Stock, ledgers and reports stay untouched until the replay
 * succeeds, so nothing is double-counted.
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "yesspos-offline";
const STORE = "pending-sales";
const VERSION = 1;

export type PendingSaleItem = {
  product_id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type PendingSale = {
  id: string;
  createdAt: string;
  sale: Record<string, unknown>;
  items: PendingSaleItem[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function isOfflineSupported() {
  return typeof indexedDB !== "undefined";
}

export async function queueSale(sale: Record<string, unknown>, items: PendingSaleItem[]) {
  const entry: PendingSale = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sale,
    items,
  };
  await tx("readwrite", (s) => s.add(entry));
  notify();
  return entry;
}

export async function listPendingSales(): Promise<PendingSale[]> {
  if (!isOfflineSupported()) return [];
  try {
    const rows = await tx<PendingSale[]>("readonly", (s) => s.getAll() as IDBRequest<PendingSale[]>);
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export async function countPendingSales() {
  return (await listPendingSales()).length;
}

async function removePending(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

/** Replays every queued sale. Returns how many synced and how many failed. */
export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  if (!isOfflineSupported() || (typeof navigator !== "undefined" && !navigator.onLine))
    return { synced: 0, failed: 0 };

  const pending = await listPendingSales();
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const { data: sale, error } = await supabase
        .from("sales")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(entry.sale as any)
        .select("id")
        .single();
      if (error) throw error;

      const items = entry.items.map((i) => ({ ...i, sale_id: sale.id }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      await removePending(entry.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  if (synced) notify();
  return { synced, failed };
}

// --- tiny subscription so the header badge can react ---
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
