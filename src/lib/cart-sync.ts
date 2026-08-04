/**
 * Cross-device cart sync.
 *
 * Guests keep the localStorage-only cart. When a customer signs in, the local
 * cart is merged with the cart saved on their account (highest quantity per
 * product wins), the merged result is written back to both sides, and every
 * later local change is pushed to `public.user_carts` with a short debounce.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CART_EVENT,
  readCart,
  writeCart,
  type ShopLine,
} from "@/lib/shop-cart";

function mergeCarts(local: ShopLine[], remote: ShopLine[]): ShopLine[] {
  const map = new Map<string, ShopLine>();
  for (const l of remote) map.set(l.id, { ...l });
  for (const l of local) {
    const found = map.get(l.id);
    map.set(l.id, found ? { ...l, qty: Math.max(found.qty, l.qty) } : { ...l });
  }
  return [...map.values()].filter((l) => l.qty > 0);
}

async function fetchRemoteCart(userId: string): Promise<ShopLine[]> {
  const { data, error } = await supabase
    .from("user_carts")
    .select("lines")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return [];
  return Array.isArray(data.lines) ? (data.lines as unknown as ShopLine[]) : [];
}

async function pushRemoteCart(userId: string, lines: ShopLine[]) {
  await supabase
    .from("user_carts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({ user_id: userId, lines: lines as any, updated_at: new Date().toISOString() });
}

/**
 * Mounted once at the app root. Keeps the signed-in customer's cart saved to
 * their account; a no-op for guests.
 */
export function useCartAccountSync() {
  const userId = useRef<string | null>(null);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function adopt(id: string | null) {
      userId.current = id;
      ready.current = false;
      if (!id) return;
      try {
        const remote = await fetchRemoteCart(id);
        if (cancelled || userId.current !== id) return;
        const merged = mergeCarts(readCart(), remote);
        writeCart(merged);
        await pushRemoteCart(id, merged);
      } catch {
        /* offline or blocked — local cart still works */
      } finally {
        if (!cancelled && userId.current === id) ready.current = true;
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void adopt(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        userId.current = null;
        ready.current = false;
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void adopt(session?.user.id ?? null);
      }
    });

    const push = () => {
      if (!userId.current || !ready.current) return;
      if (timer.current) clearTimeout(timer.current);
      const id = userId.current;
      const snapshot = readCart();
      timer.current = setTimeout(() => {
        void pushRemoteCart(id, snapshot).catch(() => undefined);
      }, 800);
    };

    window.addEventListener(CART_EVENT, push);
    window.addEventListener("storage", push);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener(CART_EVENT, push);
      window.removeEventListener("storage", push);
    };
  }, []);
}

export function CartAccountSync() {
  useCartAccountSync();
  return null;
}
