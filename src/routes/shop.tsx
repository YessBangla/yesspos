import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudUpload, Loader2, Minus, Plus, RefreshCw, Search, ShoppingBag, Truck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { deliveryFeeFor, useShopCart, type ShopLine } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { checkPackCart } from "@/lib/pack-size";
import { checkOrderConsistency, formatIssues } from "@/lib/order-check";
import {
  QUEUE_MAX_ATTEMPTS,
  dropQueuedOrder,
  isQueueSupported,
  listQueuedOrders,
  queueOrder,
  subscribeQueue,
  syncQueuedOrders,
  type QueuedOrder,
} from "@/lib/delivery-queue";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Online grocery & home delivery — Yess Shop" },
      {
        name: "description",
        content: "Order fresh groceries online and get home delivery, or pay in store. Rice, oil, dairy, snacks and daily essentials.",
      },
      { property: "og:title", content: "Online grocery & home delivery — Yess Shop" },
      { property: "og:description", content: "Fresh groceries delivered to your door, free above ৳1000." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

type P = {
  id: string;
  name_en: string;
  name_bn: string;
  price: number;
  pack_size: string | null;
  image_url: string | null;
  brand: string | null;
  category_id: string | null;
};

const PAGE = 24;

/** Chaldal-style delivery windows. */
const TIME_SLOTS = [
  { id: "08:00-11:00", bn: "সকাল ৮টা - ১১টা", en: "8:00 AM - 11:00 AM" },
  { id: "11:00-14:00", bn: "সকাল ১১টা - দুপুর ২টা", en: "11:00 AM - 2:00 PM" },
  { id: "14:00-17:00", bn: "দুপুর ২টা - বিকাল ৫টা", en: "2:00 PM - 5:00 PM" },
  { id: "17:00-20:00", bn: "বিকাল ৫টা - রাত ৮টা", en: "5:00 PM - 8:00 PM" },
] as const;

function nextDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** A slot is only bookable if it ends at least 1 hour from now. */
function slotAvailable(date: Date, slotId: string) {
  const [, end] = slotId.split("-");
  const [h, m] = end.split(":").map(Number);
  const endsAt = new Date(date);
  endsAt.setHours(h, m, 0, 0);
  return endsAt.getTime() - Date.now() > 60 * 60 * 1000;
}

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "name").max(60),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/, "phone"),
  address: z.string().trim().min(10, "address").max(300),
  area: z.string().trim().min(2, "area").max(80),
  note: z.string().trim().max(200),
});

function ShopPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("");
  const [limit, setLimit] = useState(PAGE);
  const [checkout, setCheckout] = useState(false);
  const [online, setOnline] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", address: "", area: "", note: "", payment: "cod" });
  const [placed, setPlaced] = useState<number | null>(null);
  const [slotDay, setSlotDay] = useState(() => nextDays(1)[0].toISOString().slice(0, 10));
  const [slotTime, setSlotTime] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [queued, setQueued] = useState<QueuedOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [placing, setPlacing] = useState(false);

  const refreshQueue = useCallback(async () => setQueued(await listQueuedOrders()), []);

  const runSync = useCallback(
    async (force = false) => {
      if (!isQueueSupported()) return;
      setSyncing(true);
      try {
        const res = await syncQueuedOrders(force);
        if (res.synced > 0)
          toast.success(
            bn
              ? `${res.synced}টি অপেক্ষমাণ অর্ডার পাঠানো হয়েছে (#${res.placed.join(", #")})`
              : `${res.synced} queued order(s) sent (#${res.placed.join(", #")})`,
          );
        if (res.failed > 0)
          toast.error(bn ? "কিছু অর্ডার পাঠানো যায়নি — আবার চেষ্টা হবে" : "Some orders failed — will retry");
      } finally {
        setSyncing(false);
        await refreshQueue();
      }
    },
    [bn, refreshQueue],
  );

  useEffect(() => {
    refreshQueue();
    const unsub = subscribeQueue(() => void refreshQueue());
    void runSync();
    const onOnline = () => void runSync(true);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void runSync(), 30_000);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [refreshQueue, runSync]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const categories = useQuery({
    queryKey: ["shop-categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name_en,name_bn").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["shop-products"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,price,pack_size,image_url,brand,category_id")
        .eq("is_active", true)
        .order("name_en")
        .limit(1000);
      if (error) throw error;
      return data as unknown as P[];
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!q ||
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.includes(query.trim()) ||
          (p.brand ?? "").toLowerCase().includes(q)),
    );
  }, [products.data, query, cat]);

  const shown = visible.slice(0, limit);
  const fee = deliveryFeeFor(cart.subtotal);
  const total = cart.subtotal + fee;

  const slotLabel = useMemo(() => {
    if (!slotTime) return "";
    const t = TIME_SLOTS.find((x) => x.id === slotTime);
    return `${slotDay} ${t ? (bn ? t.bn : t.en) : slotTime}`;
  }, [slotDay, slotTime, bn]);

  function validate() {
    const found: string[] = [];
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const codes = new Set(parsed.error.issues.map((i) => String(i.message)));
      if (codes.has("name")) found.push(bn ? "পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)" : "Enter your full name (min 2 characters)");
      if (codes.has("phone")) found.push(bn ? "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)");
      if (codes.has("address")) found.push(bn ? "সম্পূর্ণ ঠিকানা দিন — বাসা/রোড/এলাকা (কমপক্ষে ১০ অক্ষর)" : "Enter a full address — house/road/area (min 10 characters)");
      if (codes.has("area")) found.push(bn ? "এলাকা লিখুন" : "Enter your area");
      if (parsed.error.issues.some((i) => i.path[0] === "note")) found.push(bn ? "নোট সর্বোচ্চ ২০০ অক্ষর" : "Note can be at most 200 characters");
    }
    if (!slotTime) found.push(bn ? "ডেলিভারির সময় বেছে নিন" : "Choose a delivery slot");
    else if (!slotAvailable(new Date(slotDay), slotTime))
      found.push(bn ? "এই স্লটটি আর নেওয়া যাবে না, অন্যটি বেছে নিন" : "That slot has passed — pick another one");
    if (cart.lines.length === 0) found.push(bn ? "কার্ট খালি" : "Cart is empty");

    checkPackCart(
      cart.lines.map((l) => ({ name: bn ? l.name_bn : l.name_en, pack_size: l.pack_size, qty: l.qty })),
    ).forEach((i) => found.push(bn ? i.bn : i.en));

    return { ok: found.length === 0, found, parsed };
  }

  async function placeOrder() {
    const { ok, found, parsed } = validate();
    setErrors(found);
    if (!ok || !parsed.success) {
      toast.error(found[0] ?? (bn ? "তথ্য ঠিক করুন" : "Please fix the highlighted fields"));
      return;
    }

    const orderRow = {
      customer_name: parsed.data.name,
      customer_phone: parsed.data.phone,
      address: parsed.data.address,
      area: parsed.data.area,
      note: parsed.data.note || null,
      slot: slotLabel,
      payment_method: form.payment,
      subtotal: cart.subtotal,
      delivery_fee: fee,
      total,
    };
    const items = cart.lines.map((l) => ({
      product_id: l.id,
      name_snapshot: bn ? l.name_bn : l.name_en,
      unit_price: l.price,
      quantity: l.qty,
      line_total: l.price * l.qty,
    }));

    // Offline → queue with retry, nothing is lost.
    if (!navigator.onLine) {
      await queueOrder(orderRow, items);
      cart.clear();
      setCheckout(false);
      toast.success(bn ? "অফলাইন — অনলাইনে এলে অর্ডার স্বয়ংক্রিয়ভাবে যাবে" : "Offline — your order will be sent automatically when you reconnect");
      return;
    }

    setPlacing(true);
    try {
      // Backend consistency check: price, pack size and stock across all branches.
      const issues = await checkOrderConsistency(
        cart.lines.map((l) => ({
          product_id: l.id,
          name: bn ? l.name_bn : l.name_en,
          price: l.price,
          pack_size: l.pack_size,
          quantity: l.qty,
        })),
      );
      if (issues.length > 0) {
        const msgs = formatIssues(issues, bn).split("\n");
        setErrors(msgs);
        toast.error(bn ? "অর্ডার দেওয়া যাবে না — পণ্যের তথ্য মেলেনি" : "Cannot place order — product data mismatch");
        void products.refetch();
        return;
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .insert(orderRow)
        .select("id,order_no")
        .single();
      if (error) throw error;

      const { error: itemErr } = await supabase
        .from("delivery_order_items")
        .insert(items.map((i) => ({ ...i, order_id: data.id })));
      if (itemErr) throw itemErr;

      cart.clear();
      setCheckout(false);
      setErrors([]);
      setPlaced(Number(data.order_no));
    } catch (e) {
      // Network/server hiccup → queue it instead of losing the order.
      await queueOrder(orderRow, items);
      cart.clear();
      setCheckout(false);
      toast.warning(
        bn
          ? "অর্ডার পাঠানো যায়নি — সারিতে রাখা হয়েছে, স্বয়ংক্রিয়ভাবে আবার চেষ্টা হবে"
          : "Could not reach the server — order queued and will retry automatically",
      );
      console.error(e);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-lg font-bold text-primary">
            Yess Shop
          </Link>
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              maxLength={60}
              placeholder={bn ? "পণ্য খুঁজুন" : "Search products"}
              className="pl-9"
            />
          </div>
          <Link to="/track" className="text-sm text-muted-foreground underline">
            {bn ? "অর্ডার ট্র্যাক" : "Track order"}
          </Link>
          <Button variant="outline" className="shrink-0" onClick={() => setCheckout(true)}>
            <ShoppingBag className="mr-1 size-4" />
            {num(cart.count, lang)} · {money(cart.subtotal, lang)}
          </Button>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning/20 py-1 text-xs">
            <WifiOff className="size-3" />
            {bn ? "অফলাইন মোড — ব্রাউজ ও কার্ট কাজ করবে" : "Offline mode — browsing and cart still work"}
          </div>
        )}
        {queued.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 bg-primary/10 px-3 py-1.5 text-xs">
            <CloudUpload className="size-3.5 text-primary" />
            <span>
              {bn
                ? `${num(queued.length, lang)}টি অর্ডার সিঙ্কের অপেক্ষায়`
                : `${queued.length} order(s) waiting to sync`}
              {queued.some((q) => q.attempts > 0) &&
                ` · ${bn ? "পুনঃচেষ্টা" : "retry"} ${queued[0].attempts}/${QUEUE_MAX_ATTEMPTS}`}
            </span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={syncing} onClick={() => runSync(true)}>
              {syncing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCw className="mr-1 size-3" />}
              {bn ? "এখনই পাঠান" : "Sync now"}
            </Button>
            {queued.some((q) => q.attempts >= QUEUE_MAX_ATTEMPTS) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-destructive"
                onClick={() =>
                  queued
                    .filter((q) => q.attempts >= QUEUE_MAX_ATTEMPTS)
                    .forEach((q) => void dropQueuedOrder(q.id))
                }
              >
                {bn ? "ব্যর্থগুলো মুছুন" : "Discard failed"}
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4">
        <section className="mt-5 flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
          <Truck className="size-5 shrink-0 text-primary" />
          <p className="text-sm">
            {bn
              ? "৳১০০০ টাকার উপরে অর্ডারে ফ্রি হোম ডেলিভারি, নিচে ৳৬০ ডেলিভারি চার্জ।"
              : "Free home delivery above ৳1000, otherwise a flat ৳60 delivery fee."}
          </p>
        </section>

        <div className="mt-4 flex flex-wrap gap-2">
          <CatChip active={!cat} onClick={() => setCat("")} label={bn ? "সব" : "All"} />
          {(categories.data ?? []).map((c) => (
            <CatChip
              key={c.id}
              active={cat === c.id}
              onClick={() => {
                setCat(c.id);
                setLimit(PAGE);
              }}
              label={bn ? c.name_bn : c.name_en}
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              bn={bn}
              qty={cart.lines.find((l) => l.id === p.id)?.qty ?? 0}
              onAdd={() =>
                cart.add({
                  id: p.id,
                  name_en: p.name_en,
                  name_bn: p.name_bn,
                  price: Number(p.price),
                  pack_size: p.pack_size,
                  image_url: p.image_url,
                })
              }
              onSet={(q) => cart.setQty(p.id, q)}
            />
          ))}
        </div>

        {products.isLoading && <p className="py-10 text-center text-muted-foreground">…</p>}
        {shown.length < visible.length && (
          <div className="py-6 text-center">
            <Button variant="outline" onClick={() => setLimit((n) => n + PAGE * 2)}>
              {bn ? "আরও দেখুন" : "Load more"} ({num(visible.length - shown.length, lang)})
            </Button>
          </div>
        )}
      </div>

      {cart.count > 0 && !checkout && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-sm">
              {num(cart.count, lang)} {bn ? "পণ্য" : "items"} · <b>{money(total, lang)}</b>
            </span>
            <Button onClick={() => setCheckout(true)}>{bn ? "চেকআউট" : "Checkout"}</Button>
          </div>
        </div>
      )}

      {checkout && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg space-y-4 py-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{bn ? "ডেলিভারি তথ্য" : "Delivery details"}</h2>
              <Button variant="ghost" onClick={() => setCheckout(false)}>
                ✕
              </Button>
            </div>

            <div className="surface-panel divide-y divide-border">
              {cart.lines.map((l) => (
                <CartRow key={l.id} l={l} bn={bn} lang={lang} onSet={(q) => cart.setQty(l.id, q)} />
              ))}
              {cart.lines.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">{bn ? "কার্ট খালি" : "Cart is empty"}</p>
              )}
            </div>

            <div className="grid gap-3">
              <F label={bn ? "নাম" : "Name"} v={form.name} on={(v) => setForm({ ...form, name: v })} />
              <F label={bn ? "মোবাইল" : "Phone"} v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
              <F label={bn ? "এলাকা" : "Area"} v={form.area} on={(v) => setForm({ ...form, area: v })} />
              <div className="space-y-1.5">
                <Label>{bn ? "সম্পূর্ণ ঠিকানা" : "Full address"}</Label>
                <Textarea
                  value={form.address}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <F label={bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"} v={form.note} on={(v) => setForm({ ...form, note: v })} />

              <div className="space-y-2">
                <Label>{bn ? "ডেলিভারির দিন" : "Delivery day"}</Label>
                <div className="flex flex-wrap gap-2">
                  {nextDays(5).map((d) => {
                    const key = d.toISOString().slice(0, 10);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSlotDay(key);
                          if (slotTime && !slotAvailable(d, slotTime)) setSlotTime("");
                        }}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs",
                          slotDay === key ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border",
                        )}
                      >
                        {d.toLocaleDateString(bn ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </button>
                    );
                  })}
                </div>
                <Label>{bn ? "ডেলিভারির সময়" : "Delivery time"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((t) => {
                    const ok = slotAvailable(new Date(slotDay), t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!ok}
                        onClick={() => setSlotTime(t.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs",
                          !ok && "cursor-not-allowed opacity-40",
                          slotTime === t.id ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border",
                        )}
                      >
                        {bn ? t.bn : t.en}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{bn ? "পেমেন্ট" : "Payment"}</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "cod", bn: "ক্যাশ অন ডেলিভারি", en: "Cash on delivery" },
                    { id: "bkash", bn: "বিকাশ", en: "bKash" },
                    { id: "nagad", bn: "নগদ", en: "Nagad" },
                    { id: "card", bn: "কার্ড", en: "Card" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm({ ...form, payment: m.id })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        form.payment === m.id ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border",
                      )}
                    >
                      {bn ? m.bn : m.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="surface-panel space-y-1 p-4 text-sm">
              <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
              <Row label={bn ? "ডেলিভারি" : "Delivery"} value={money(fee, lang)} />
              <Row label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
            </div>

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={cart.lines.length === 0 || placing}
              onClick={placeOrder}
            >
              {placing && <Loader2 className="mr-2 size-4 animate-spin" />}
              {bn ? "অর্ডার কনফার্ম করুন" : "Place order"}
            </Button>
          </div>
        </div>
      )}

      {placed !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 backdrop-blur">
          <div className="surface-panel max-w-sm space-y-3 p-6 text-center">
            <h2 className="font-display text-xl font-bold text-primary">
              {bn ? "অর্ডার নেওয়া হয়েছে!" : "Order placed!"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {bn ? "আপনার অর্ডার নম্বর" : "Your order number"}: <b>#{placed}</b>
            </p>
            <Button className="w-full" onClick={() => setPlaced(null)}>
              {bn ? "আরও কেনাকাটা" : "Continue shopping"}
            </Button>
            <Link to="/track" className="block text-sm text-primary underline">
              {bn ? "অর্ডার ট্র্যাক করুন" : "Track this order"}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm",
        active ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ProductCard({
  p,
  bn,
  qty,
  onAdd,
  onSet,
}: {
  p: P;
  bn: boolean;
  qty: number;
  onAdd: () => void;
  onSet: (q: number) => void;
}) {
  const { lang } = useI18n();
  return (
    <div className="surface-panel flex flex-col overflow-hidden">
      {p.image_url ? (
        <img
          src={p.image_url}
          alt={bn ? p.name_bn : p.name_en}
          loading="lazy"
          decoding="async"
          width={220}
          height={160}
          className="h-32 w-full bg-muted object-cover"
        />
      ) : (
        <div className="h-32 w-full bg-muted" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium">{bn ? p.name_bn : p.name_en}</span>
        <span className="text-xs text-muted-foreground">{p.pack_size}</span>
        <span className="mt-auto font-display font-bold text-primary">{money(Number(p.price), lang)}</span>
        {qty === 0 ? (
          <Button size="sm" className="mt-1 w-full" onClick={onAdd}>
            <Plus className="mr-1 size-3.5" /> {bn ? "যোগ" : "Add"}
          </Button>
        ) : (
          <div className="mt-1 flex items-center justify-between rounded-lg border border-border">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => onSet(qty - 1)}>
              <Minus className="size-3.5" />
            </Button>
            <span className="text-sm font-semibold">{num(qty, lang)}</span>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => onSet(qty + 1)}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartRow({
  l,
  bn,
  lang,
  onSet,
}: {
  l: ShopLine;
  bn: boolean;
  lang: "bn" | "en";
  onSet: (q: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="min-w-0 flex-1 truncate text-sm">{bn ? l.name_bn : l.name_en}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="size-7" onClick={() => onSet(l.qty - 1)}>
          <Minus className="size-3" />
        </Button>
        <span className="w-6 text-center text-sm">{num(l.qty, lang)}</span>
        <Button size="icon" variant="ghost" className="size-7" onClick={() => onSet(l.qty + 1)}>
          <Plus className="size-3" />
        </Button>
      </div>
      <span className="w-20 text-right text-sm font-semibold">{money(l.price * l.qty, lang)}</span>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-bold")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={v} maxLength={120} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
