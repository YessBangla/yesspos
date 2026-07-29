import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Clock,
  CloudUpload,
  Loader2,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Home,
  ShoppingBasket,

  Truck,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { useSiteContent } from "@/lib/site-content";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { deliveryFeeFor, useShopCart, type ShopLine } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { checkPackCart } from "@/lib/pack-size";
import { useCustomerSession, normalizePhone } from "@/lib/customer-auth";
import { CustomerAccountMenu } from "@/components/CustomerAccountMenu";
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

const SITE = "https://yesspos.lovable.app";

/** Deep-linkable portal state: ?q=rice&cat=<id>&checkout=1 */
const searchSchema = z.object({
  q: z.string().trim().max(60).optional(),
  cat: z.string().trim().max(64).optional(),
  checkout: z.boolean().optional(),
});

export const Route = createFileRoute("/homedelivery")({
  validateSearch: (input: Record<string, unknown>) => {
    const truthy = input.checkout === true || input.checkout === 1 || input.checkout === "1" || input.checkout === "true";
    const parsed = searchSchema.safeParse({
      q: typeof input.q === "string" && input.q.trim() ? input.q : undefined,
      cat: typeof input.cat === "string" && input.cat.trim() ? input.cat : undefined,
      checkout: truthy ? true : undefined,
    });
    return parsed.success ? parsed.data : {};
  },

  head: () => ({
    meta: [
      { title: "Online grocery & home delivery — Sokoler Bazar" },
      {
        name: "description",
        content: "Order fresh groceries online and get home delivery, or pay in store. Rice, oil, dairy, snacks and daily essentials.",
      },
      { property: "og:title", content: "Online grocery & home delivery — Sokoler Bazar" },
      { property: "og:description", content: "Fresh groceries delivered to your door, free above ৳1000." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/homedelivery` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/homedelivery` }],
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
  const { text: sc } = useSiteContent();
  const cart = useShopCart();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const [cat, setCat] = useState<string>(search.cat ?? "");
  const [limit, setLimit] = useState(PAGE);
  const [checkout, setCheckout] = useState(!!search.checkout);
  const [cartOpen, setCartOpen] = useState(false);

  const [online, setOnline] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", address: "", area: "", note: "", payment: "cod" });
  const [placed, setPlaced] = useState<number | null>(null);
  const [slotDay, setSlotDay] = useState(() => nextDays(1)[0].toISOString().slice(0, 10));
  const [slotTime, setSlotTime] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [queued, setQueued] = useState<QueuedOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const { user, isCustomer, name: accName, phone: accPhone } = useCustomerSession();
  const [prefilled, setPrefilled] = useState(false);

  const savedAddresses = useQuery({
    queryKey: ["shop-addresses", user?.id],
    enabled: !!user && isCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id,label,full_name,phone,address,area,note,is_default")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Signed-in shoppers get their default address pre-filled at checkout.
  useEffect(() => {
    if (prefilled || !user || !isCustomer) return;
    const a = savedAddresses.data?.[0];
    setForm((f) => ({
      ...f,
      name: a?.full_name || accName || f.name,
      phone: a?.phone || normalizePhone(accPhone) || f.phone,
      address: a?.address || f.address,
      area: a?.area || f.area,
      note: a?.note || f.note,
    }));
    if (savedAddresses.data) setPrefilled(true);
  }, [user, isCustomer, accName, accPhone, savedAddresses.data, prefilled]);

  // Keep search / category / checkout shareable and reload-safe in the URL.
  useEffect(() => {
    const q = query.trim() || undefined;
    const c = cat || undefined;
    const ck = checkout;
    if (search.q === q && search.cat === c && (search.checkout ?? false) === ck) return;
    void navigate({ search: { q, cat: c, checkout: ck || undefined }, replace: true });
  }, [query, cat, checkout, navigate, search.q, search.cat, search.checkout]);

  // Back/forward navigation should move the portal too.
  useEffect(() => {
    setQuery(search.q ?? "");
    setCat(search.cat ?? "");
    setCheckout(!!search.checkout);
  }, [search.q, search.cat, search.checkout]);



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
      user_id: user && isCustomer ? user.id : null,
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

      // Remember the address for signed-in shoppers (first one becomes default).
      if (user && isCustomer) {
        const dup = (savedAddresses.data ?? []).some(
          (a) => a.address === parsed.data.address && a.area === parsed.data.area,
        );
        if (!dup) {
          await supabase.from("customer_addresses").insert({
            user_id: user.id,
            label: (savedAddresses.data ?? []).length === 0 ? "Home" : parsed.data.area.slice(0, 20),
            full_name: parsed.data.name,
            phone: parsed.data.phone,
            address: parsed.data.address,
            area: parsed.data.area,
            note: parsed.data.note || null,
            is_default: (savedAddresses.data ?? []).length === 0,
          });
          void savedAddresses.refetch();
        }
      }

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

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return (products.data ?? [])
      .filter((p) => p.name_en.toLowerCase().includes(q) || p.name_bn.includes(query.trim()))
      .slice(0, 6);
  }, [products.data, query]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    (products.data ?? []).forEach((p) => {
      if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    });
    return m;
  }, [products.data]);

  const addToCart = (p: P) =>
    cart.add({
      id: p.id,
      name_en: p.name_en,
      name_bn: p.name_bn,
      price: Number(p.price),
      pack_size: p.pack_size,
      image_url: p.image_url,
    });

  return (
    <main className="min-h-screen bg-muted/30 pb-28 lg:pb-10">
      {/* ---- Top utility bar ---- */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Truck className="size-3.5" />
            {bn ? "ঢাকায় ১ ঘণ্টায় ডেলিভারি · ৳১০০০+ অর্ডারে ফ্রি" : "1-hour delivery in Dhaka · Free above ৳1000"}
          </span>
          <span className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1 font-semibold hover:underline">
              <Home className="size-3.5" />
              {bn ? "মূল ওয়েবসাইট" : "Main site"}
            </Link>

            <a href="tel:16710" className="flex items-center gap-1 hover:underline">
              <Phone className="size-3.5" /> 16710
            </a>
            <Link to="/track" className="hover:underline">
              {bn ? "অর্ডার ট্র্যাক" : "Track order"}
            </Link>
            <Link to="/my-account" search={{ tab: "orders" }} className="hover:underline">
              {bn ? "আমার অ্যাকাউন্ট" : "My account"}
            </Link>
            <Link to="/auth" className="hidden hover:underline sm:inline">
              {bn ? "স্টাফ লগইন" : "Staff login"}
            </Link>
          </span>
        </div>
      </div>

      {/* ---- Header ---- */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="gradient-brand grid size-9 place-items-center rounded-xl text-primary-foreground">
              <ShoppingBasket className="size-5" />
            </span>
            <span className="hidden font-display text-lg font-bold text-primary sm:block">{sc("brand.name", "Sokoler Bazar")}</span>
          </Link>

          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              maxLength={60}
              placeholder={bn ? "চাল, তেল, ডিম… খুঁজুন" : "Search rice, oil, eggs…"}
              className="h-11 rounded-full pl-9"
            />
            {suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      addToCart(sug);
                      setQuery("");
                      toast.success(bn ? "কার্টে যোগ হয়েছে" : "Added to cart");
                    }}
                  >
                    {sug.image_url ? (
                      <img src={sug.image_url} alt="" loading="lazy" className="size-8 rounded object-cover" />
                    ) : (
                      <span className="size-8 rounded bg-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{bn ? sug.name_bn : sug.name_en}</span>
                    <span className="text-xs font-semibold text-primary">{money(Number(sug.price), lang)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <TextSizeToggle />
            <CustomerAccountMenu />
          </div>

          <Button className="h-11 shrink-0 rounded-full" onClick={() => setCheckout(true)}>
            <ShoppingBag className="mr-1 size-4" />
            <span className="hidden sm:inline">{num(cart.count, lang)} · </span>
            {money(cart.subtotal, lang)}
          </Button>
        </div>

        {/* ---- Portal menu ---- */}
        <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-2 pb-2 text-sm">
          <Link
            to="/"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 font-medium hover:bg-muted"
          >
            <Home className="size-4 text-primary" />
            {bn ? "মূল হোম পেজ" : "Main home page"}
          </Link>

          <button
            type="button"
            className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-muted"
            onClick={() => {
              setCat("");
              setQuery("");
              setLimit(PAGE);
            }}
          >
            {bn ? "সব পণ্য" : "All products"}
          </button>
          {(categories.data ?? []).slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-muted",
                cat === c.id && "bg-primary/10 font-semibold text-primary",
              )}
              onClick={() => {
                setCat(c.id);
                setLimit(PAGE);
              }}
            >
              {bn ? c.name_bn : c.name_en}
            </button>
          ))}
          <Link to="/track" className="ml-auto whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-muted">
            {bn ? "অর্ডার ট্র্যাক" : "Track order"}
          </Link>
          <Link
            to="/my-account"
            search={{ tab: "orders" }}
            className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-muted sm:hidden"
          >
            {bn ? "অ্যাকাউন্ট" : "Account"}
          </Link>
        </nav>

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
              {bn ? `${num(queued.length, lang)}টি অর্ডার সিঙ্কের অপেক্ষায়` : `${queued.length} order(s) waiting to sync`}
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
                  queued.filter((q) => q.attempts >= QUEUE_MAX_ATTEMPTS).forEach((q) => void dropQueuedOrder(q.id))
                }
              >
                {bn ? "ব্যর্থগুলো মুছুন" : "Discard failed"}
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl gap-5 px-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_310px]">
        {/* ---- Category sidebar ---- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 mt-5 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {bn ? "ক্যাটাগরি" : "Categories"}
            </p>
            <SideCat active={!cat} onClick={() => setCat("")} label={bn ? "সব পণ্য" : "All products"} count={products.data?.length ?? 0} />
            {(categories.data ?? []).map((c) => (
              <SideCat
                key={c.id}
                active={cat === c.id}
                onClick={() => {
                  setCat(c.id);
                  setLimit(PAGE);
                }}
                label={bn ? c.name_bn : c.name_en}
                count={catCounts.get(c.id) ?? 0}
              />
            ))}
          </div>
        </aside>

        {/* ---- Main column ---- */}
        <div>
          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="gradient-brand col-span-full rounded-2xl p-5 text-primary-foreground sm:col-span-2">
              <p className="text-xs opacity-80">{bn ? "অনলাইন সুপারশপ" : "Online supershop"}</p>
              <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">
                {sc("shop.hero_title", bn ? "বাজার এখন দরজায়, ১ ঘণ্টায় ডেলিভারি" : "Your daily bazar, delivered in 1 hour")}
              </h1>
              <p className="mt-1 text-sm opacity-90">
                {sc("shop.hero_subtitle", bn ? "৳১০০০+ অর্ডারে ফ্রি ডেলিভারি · ক্যাশ অন ডেলিভারি" : "Free delivery above ৳1000 · Cash on delivery")}
              </p>
            </div>
            <div className="grid gap-3">
              <Perk icon={Clock} title={bn ? "সময় বেছে নিন" : "Pick your slot"} sub={bn ? "সকাল ৮টা - রাত ৮টা" : "8 AM – 8 PM"} />
              <Perk icon={BadgePercent} title={bn ? "মেম্বার পয়েন্ট" : "Member points"} sub={bn ? "১০ টাকায় ১ পয়েন্ট" : "1 point per ৳10"} />
            </div>
          </section>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
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

          <div className="mt-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">
              {cat
                ? (bn
                    ? categories.data?.find((c) => c.id === cat)?.name_bn
                    : categories.data?.find((c) => c.id === cat)?.name_en) ?? ""
                : bn
                  ? "সব পণ্য"
                  : "All products"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {num(visible.length, lang)} {bn ? "পণ্য" : "items"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                bn={bn}
                qty={cart.lines.find((l) => l.id === p.id)?.qty ?? 0}
                onAdd={() => addToCart(p)}
                onSet={(q) => cart.setQty(p.id, q)}
              />
            ))}
          </div>

          {products.isLoading && <p className="py-10 text-center text-muted-foreground">…</p>}
          {!products.isLoading && visible.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {bn ? "কোনো পণ্য পাওয়া যায়নি" : "No products found"}
            </p>
          )}
          {shown.length < visible.length && (
            <div className="py-6 text-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE * 2)}>
                {bn ? "আরও দেখুন" : "Load more"} ({num(visible.length - shown.length, lang)})
              </Button>
            </div>
          )}
        </div>

        {/* ---- Desktop cart rail ---- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 mt-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display font-bold">{bn ? "আপনার কার্ট" : "Your cart"}</span>
              <span className="text-xs text-muted-foreground">
                {num(cart.count, lang)} {bn ? "পণ্য" : "items"}
              </span>
            </div>
            <div className="max-h-[45vh] divide-y divide-border overflow-y-auto">
              {cart.lines.map((l) => (
                <CartRow key={l.id} l={l} bn={bn} lang={lang} onSet={(q) => cart.setQty(l.id, q)} />
              ))}
              {cart.lines.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {bn ? "কার্ট খালি — পণ্য যোগ করুন" : "Cart is empty — add some products"}
                </p>
              )}
            </div>
            <div className="space-y-1 border-t border-border p-4 text-sm">
              <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
              <Row label={bn ? "ডেলিভারি" : "Delivery"} value={money(fee, lang)} />
              <Row label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
              {cart.subtotal > 0 && cart.subtotal < 1000 && (
                <p className="pt-1 text-xs text-primary">
                  {bn
                    ? `আর ${money(1000 - cart.subtotal, lang)} কিনলে ডেলিভারি ফ্রি`
                    : `Add ${money(1000 - cart.subtotal, lang)} more for free delivery`}
                </p>
              )}
              <Button className="mt-2 w-full" disabled={cart.lines.length === 0} onClick={() => setCheckout(true)}>
                {bn ? "চেকআউট" : "Checkout"}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-12 border-t border-border bg-card pb-24 lg:pb-0">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-display text-base font-bold text-primary">{sc("brand.name", "Sokoler Bazar")}</p>
            <p className="mt-1 text-muted-foreground">
              {bn
                ? "সুপারশপের সব পণ্য অনলাইনে — অর্ডার করুন, ঘরে বসে বুঝে নিন।"
                : "Every supershop aisle online — order now, receive at home."}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{bn ? "সেবা" : "Service"}</p>
            <Link to="/track" className="block text-muted-foreground hover:text-foreground">
              {bn ? "অর্ডার ট্র্যাক" : "Track order"}
            </Link>
            <a href="tel:16710" className="block text-muted-foreground hover:text-foreground">
              {bn ? "কল করুন ১৬৭১০" : "Call 16710"}
            </a>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{bn ? "তথ্য" : "Information"}</p>
            <Link to="/privacy" className="block text-muted-foreground hover:text-foreground">
              {bn ? "প্রাইভেসি পলিসি" : "Privacy policy"}
            </Link>
            <Link to="/terms" className="block text-muted-foreground hover:text-foreground">
              {bn ? "শর্তাবলি" : "Terms of service"}
            </Link>
          </div>
        </div>
      </footer>

      {cart.count > 0 && !checkout && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3 lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <ShoppingBasket className="size-5 shrink-0 text-primary" />
              <span className="truncate">
                {num(cart.count, lang)} {bn ? "পণ্য" : "items"} · <b>{money(total, lang)}</b>
                <span className="block text-xs text-primary">{bn ? "কার্ট দেখুন / পরিমাণ বদলান" : "View cart / edit qty"}</span>
              </span>
            </button>
            <Button variant="outline" onClick={() => setCartOpen(true)}>
              {bn ? "কার্ট" : "Cart"}
            </Button>
            <Button onClick={() => setCheckout(true)}>{bn ? "চেকআউট" : "Checkout"}</Button>
          </div>
        </div>
      )}

      {cartOpen && !checkout && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-foreground/40 lg:hidden" onClick={() => setCartOpen(false)}>
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <span className="font-display font-bold">{bn ? "আপনার কার্ট" : "Your cart"}</span>
              <Button variant="ghost" size="sm" onClick={() => setCartOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="divide-y divide-border">
              {cart.lines.map((l) => (
                <CartRow key={l.id} l={l} bn={bn} lang={lang} onSet={(q) => cart.setQty(l.id, q)} />
              ))}
              {cart.lines.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">{bn ? "কার্ট খালি" : "Cart is empty"}</p>
              )}
            </div>
            <div className="space-y-1 border-t border-border p-4 text-sm">
              <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
              <Row label={bn ? "ডেলিভারি" : "Delivery"} value={money(fee, lang)} />
              <Row label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
              <Button
                className="mt-2 w-full"
                disabled={cart.lines.length === 0}
                onClick={() => {
                  setCartOpen(false);
                  setCheckout(true);
                }}
              >
                {bn ? "চেকআউট" : "Checkout"}
              </Button>
            </div>
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

            {user && isCustomer ? (
              (savedAddresses.data ?? []).length > 0 && (
                <div className="space-y-2">
                  <Label>{bn ? "সংরক্ষিত ঠিকানা" : "Saved addresses"}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(savedAddresses.data ?? []).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="rounded-xl border border-border px-3 py-2 text-left text-xs hover:border-primary"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            name: a.full_name,
                            phone: a.phone,
                            address: a.address,
                            area: a.area,
                            note: a.note ?? "",
                          }))
                        }
                      >
                        <span className="font-semibold">{a.label}</span>
                        <span className="block text-muted-foreground">{a.area}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border p-3 text-sm">
                <span className="text-muted-foreground">
                  {bn ? "লগইন করলে ঠিকানা ও অর্ডার সংরক্ষিত থাকবে" : "Sign in to save addresses and track orders"}
                </span>
                <CustomerAccountMenu compact />
              </div>
            )}

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
        <Button size="icon" variant="ghost" className="size-9 sm:size-7" onClick={() => onSet(l.qty - 1)}>
          <Minus className="size-3" />
        </Button>
        <span className="w-6 text-center text-sm">{num(l.qty, lang)}</span>
        <Button size="icon" variant="ghost" className="size-9 sm:size-7" onClick={() => onSet(l.qty + 1)}>
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

function SideCat({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm",
        active ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-[11px]">{count}</span>
    </button>
  );
}

function Perk({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Icon className="size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
