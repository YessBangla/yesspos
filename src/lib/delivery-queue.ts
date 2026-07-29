/**
 * Offline delivery order queue.
 *
 * Online-shop checkouts placed while the browser is offline (or that fail
 * mid-flight) are stored in IndexedDB with the full payload, then replayed
 * with retry/backoff as soon as the connection returns. Nothing is lost and
 * the shopper always sees the queue status.
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "yesspos-delivery";
const STORE = "pending-orders";
const VERSION = 1;
const MAX_ATTEMPTS = 6;

export type QueuedItem = {
  product_id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type QueuedOrder = {
  id: string;
  createdAt: string;
  order: Record<string, unknown>;
  items: QueuedItem[];
  attempts: number;
  nextTryAt: string;
  lastError: string | null;
};

export function isQueueSupported() {
  return typeof indexedDB !== "undefined";
}

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

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
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

export async function queueOrder(order: Record<string, unknown>, items: QueuedItem[]) {
  const entry: QueuedOrder = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    order,
    items,
    attempts: 0,
    nextTryAt: new Date().toISOString(),
    lastError: null,
  };
  await tx("readwrite", (s) => s.add(entry));
  notify();
  return entry;
}

export async function listQueuedOrders(): Promise<QueuedOrder[]> {
  if (!isQueueSupported()) return [];
  try {
    const rows = await tx<QueuedOrder[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedOrder[]>);
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

async function put(entry: QueuedOrder) {
  await tx("readwrite", (s) => s.put(entry));
}

async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function dropQueuedOrder(id: string) {
  await remove(id);
  notify();
}

export type SyncResult = { synced: number; failed: number; placed: number[]; blocked: number };

let running = false;

/** Replays every queued order with backoff. Safe to call repeatedly. */
export async function syncQueuedOrders(force = false): Promise<SyncResult> {
  const empty: SyncResult = { synced: 0, failed: 0, placed: [], blocked: 0 };
  if (!isQueueSupported() || running) return empty;
  if (typeof navigator !== "undefined" && !navigator.onLine) return empty;

  running = true;
  const result: SyncResult = { synced: 0, failed: 0, placed: [], blocked: 0 };
  try {
    const pending = await listQueuedOrders();
    const now = Date.now();

    for (const entry of pending) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        result.blocked += 1;
        continue;
      }
      if (!force && new Date(entry.nextTryAt).getTime() > now) continue;

      try {
        const { data, error } = await supabase
          .from("delivery_orders")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(entry.order as any)
          .select("id,order_no")
          .single();
        if (error) throw error;

        const items = entry.items.map((i) => ({ ...i, order_id: data.id }));
        const { error: itemErr } = await supabase.from("delivery_order_items").insert(items);
        if (itemErr) throw itemErr;

        await remove(entry.id);
        result.synced += 1;
        result.placed.push(Number(data.order_no));
      } catch (e) {
        const attempts = entry.attempts + 1;
        await put({
          ...entry,
          attempts,
          // exponential backoff: 5s, 10s, 20s … capped at 5 minutes
          nextTryAt: new Date(Date.now() + Math.min(5000 * 2 ** (attempts - 1), 300_000)).toISOString(),
          lastError: e instanceof Error ? e.message : "Sync failed",
        });
        result.failed += 1;
      }
    }
  } finally {
    running = false;
  }

  notify();
  return result;
}

// --- tiny subscription so UI badges stay live ---
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS;
