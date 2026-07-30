import { LangToggle } from "@/components/LangToggle";
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

/** Sort options for the storefront grid. */
export const SORTS = ["relevance", "price_asc", "price_desc", "name_asc", "name_desc"] as const;
export type SortKey = (typeof SORTS)[number];

/** Human-readable slug used for SEO-friendly category URLs. */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function titleCase(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Deep-linkable portal state: ?q=rice&cat=<id>&c=fresh-fruits&sort=price_asc&checkout=1 */
const searchSchema = z.object({
  q: z.string().trim().max(60).optional(),
  cat: z.string().trim().max(64).optional(),
  c: z.string().trim().max(64).optional(),
  sort: z.enum(SORTS).optional(),
  checkout: z.boolean().optional(),
});

export const Route = createFileRoute("/homedelivery")({
  validateSearch: (input: Record<string, unknown>) => {
    const truthy =
      input.checkout === true ||
      input.checkout === 1 ||
      input.checkout === "1" ||
      input.checkout === "true";
    const parsed = searchSchema.safeParse({
      q: typeof input.q === "string" && input.q.trim() ? input.q : undefined,
      cat: typeof input.cat === "string" && input.cat.trim() ? input.cat : undefined,
      c: typeof input.c === "string" && input.c.trim() ? slugify(input.c) : undefined,
      sort: typeof input.sort === "string" ? (input.sort as SortKey) : undefined,
      checkout: truthy ? true : undefined,
    });
    return parsed.success ? parsed.data : {};
  },

  // Per-category / per-search SEO: unique title, description, OG tags and canonical.
  head: ({ match }) => {
    const s = (match.search ?? {}) as z.infer<typeof searchSchema>;
    const catName = s.c ? titleCase(s.c) : "";
    const query = s.q?.trim() ?? "";

    const title = catName
      ? `${catName} online in Dhaka — home delivery | Sokoler Bazar`
      : query
        ? `"${query}" grocery search — Sokoler Bazar`
        : "Online grocery & home delivery — Sokoler Bazar";

    const description = catName
      ? `Buy ${catName.toLowerCase()} online at Sokoler Bazar. Fresh stock, transparent prices, 1-hour home delivery in Dhaka and free delivery above ৳1000.`
      : query
        ? `Grocery search results for "${query}" at Sokoler Bazar — order online with fast home delivery in Dhaka.`
        : "Order fresh groceries online and get home delivery, or pay in store. Rice, oil, dairy, snacks and daily essentials.";

    const params = new URLSearchParams();
    if (s.c) params.set("c", s.c);
    if (s.cat) params.set("cat", s.cat);
    const canonical = `${SITE}/homedelivery${params.size ? `?${params.toString()}` : ""}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },

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
  const [sort, setSort] = useState<SortKey>(search.sort ?? "relevance");
  const [limit, setLimit] = useState(PAGE);
  const [checkout, setCheckout] = useState(!!search.checkout);
  const [step, setStep] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugIdx, setSugIdx] = useState(-1);

  const [online, setOnline] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    note: "",
    payment: "cod",
  });
  const [placed, setPlaced] = useState<number | null>(null);
  const [slotDay, setSlotDay] = useState(() => nextDays(1)[0].toISOString().slice(0, 10));
  const [slotTime, setSlotTime] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [placedInfo, setPlacedInfo] = useState<{ phone: string; slot: string; total: number } | null>(
    null,
  );
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

  // Back/forward navigation should move the portal too.
  useEffect(() => {
    setQuery(search.q ?? "");
    setCat(search.cat ?? "");
    setSort(search.sort ?? "relevance");
    setCheckout(!!search.checkout);
  }, [search.q, search.cat, search.sort, search.checkout]);


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
          toast.error(
            bn ? "কিছু অর্ডার পাঠানো যায়নি — আবার চেষ্টা হবে" : "Some orders failed — will retry",
          );
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
      const { data, error } = await supabase
        .from("categories")
        .select("id,name_en,name_bn")
        .order("name_en");
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

  const activeCat = useMemo(
    () => (categories.data ?? []).find((c) => c.id === cat) ?? null,
    [categories.data, cat],
  );

  // Keep search / category / sort / checkout shareable and reload-safe in the URL.
  useEffect(() => {
    const q = query.trim() || undefined;
    const c = cat || undefined;
    const slug = activeCat ? slugify(activeCat.name_en) : undefined;
    const so = sort === "relevance" ? undefined : sort;
    const ck = checkout;
    if (
      search.q === q &&
      search.cat === c &&
      search.c === slug &&
      search.sort === so &&
      (search.checkout ?? false) === ck
    )
      return;
    void navigate({
      search: { q, cat: c, c: slug, sort: so, checkout: ck || undefined },
      replace: true,
    });
  }, [
    query,
    cat,
    sort,
    checkout,
    activeCat,
    navigate,
    search.q,
    search.cat,
    search.c,
    search.sort,
    search.checkout,
  ]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (products.data ?? []).filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!q ||
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.includes(query.trim()) ||
          (p.brand ?? "").toLowerCase().includes(q)),
    );
    const nameOf = (p: P) => (bn ? p.name_bn : p.name_en);
    switch (sort) {
      case "price_asc":
        return [...list].sort((a, b) => Number(a.price) - Number(b.price));
      case "price_desc":
        return [...list].sort((a, b) => Number(b.price) - Number(a.price));
      case "name_asc":
        return [...list].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      case "name_desc":
        return [...list].sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
      default:
        return list;
    }
  }, [products.data, query, cat, sort, bn]);

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
    const fields: Record<string, string> = {};
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const codes = new Set(parsed.error.issues.map((i) => String(i.message)));
      if (codes.has("name"))
        fields.name = bn
          ? "পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)"
          : "Enter your full name (min 2 characters)";
      if (codes.has("phone"))
        fields.phone = bn
          ? "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)"
          : "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)";
      if (codes.has("address"))
        fields.address = bn
          ? "সম্পূর্ণ ঠিকানা দিন — বাসা/রোড/এলাকা (কমপক্ষে ১০ অক্ষর)"
          : "Enter a full address — house/road/area (min 10 characters)";
      if (codes.has("area")) fields.area = bn ? "এলাকা লিখুন" : "Enter your area";
      if (parsed.error.issues.some((i) => i.path[0] === "note"))
        fields.note = bn ? "নোট সর্বোচ্চ ২০০ অক্ষর" : "Note can be at most 200 characters";
    }
    if (!slotTime) fields.slot = bn ? "ডেলিভারির সময় বেছে নিন" : "Choose a delivery slot";
    else if (!slotAvailable(new Date(slotDay), slotTime))
      fields.slot = bn
        ? "এই স্লটটি আর নেওয়া যাবে না, অন্যটি বেছে নিন"
        : "That slot has passed — pick another one";

    Object.values(fields).forEach((m) => found.push(m));
    if (cart.lines.length === 0) found.push(bn ? "কার্ট খালি" : "Cart is empty");

    checkPackCart(
      cart.lines.map((l) => ({
        name: bn ? l.name_bn : l.name_en,
        pack_size: l.pack_size,
        qty: l.qty,
      })),
    ).forEach((i) => found.push(bn ? i.bn : i.en));

    return { ok: found.length === 0, found, fields, parsed };
  }

  /** Per-step gate so shoppers cannot advance with invalid data. */
  function stepErrors(index: number) {
    const { fields } = validate();
    if (index === 0)
      return [fields.name, fields.phone, fields.area, fields.address, fields.note].filter(
        Boolean,
      ) as string[];
    if (index === 1) return [fields.slot].filter(Boolean) as string[];
    return [];
  }


  async function placeOrder() {
    const { ok, found, fields, parsed } = validate();
    setErrors(found);
    setFieldErrs(fields);
    if (!ok || !parsed.success) {
      if (fields.name || fields.phone || fields.area || fields.address) setStep(0);
      else if (fields.slot) setStep(1);
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
      toast.success(
        bn
          ? "অফলাইন — অনলাইনে এলে অর্ডার স্বয়ংক্রিয়ভাবে যাবে"
          : "Offline — your order will be sent automatically when you reconnect",
      );
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
        toast.error(
          bn
            ? "অর্ডার দেওয়া যাবে না — পণ্যের তথ্য মেলেনি"
            : "Cannot place order — product data mismatch",
        );
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
            label:
              (savedAddresses.data ?? []).length === 0 ? "Home" : parsed.data.area.slice(0, 20),
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

      setPlacedInfo({ phone: parsed.data.phone, slot: slotLabel, total });
      cart.clear();
      setCheckout(false);
      setStep(0);
      setErrors([]);
      setFieldErrs({});
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

  const pickSuggestion = (p: P) => {
    addToCart(p);
    setQuery("");
    setSugOpen(false);
    setSugIdx(-1);
    toast.success(bn ? "কার্টে যোগ হয়েছে" : "Added to cart");
  };

  return (
    <main className="storefront min-h-screen bg-background pb-28 lg:pb-10">
      {/* ---- Top utility bar ---- */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Truck className="size-3.5" />
            {bn
              ? "ঢাকায় ১ ঘণ্টায় ডেলিভারি · ৳১০০০+ অর্ডারে ফ্রি"
              : "1-hour delivery in Dhaka · Free above ৳1000"}
          </span>
          <span className="flex items-center gap-3">
            <LangToggle className="bg-card" />
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
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="gradient-brand grid size-11 place-items-center rounded-2xl text-primary-foreground shadow-sm">
              <ShoppingBasket className="size-5" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-lg font-extrabold text-primary">
                {sc("brand.name", "Sokoler Bazar")}
              </span>
              <span className="block text-[11px] font-medium text-muted-foreground">
                {bn ? "অনলাইন সুপারশপ" : "Online supershop"}
              </span>
            </span>
          </Link>

          <div className="relative min-w-[160px] flex-1">
            <label htmlFor="shop-search" className="sr-only">
              {bn ? "পণ্য খুঁজুন" : "Search products"}
            </label>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="shop-search"
              type="search"
              role="combobox"
              aria-expanded={sugOpen && suggestions.length > 0}
              aria-controls="shop-search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                sugIdx >= 0 && suggestions[sugIdx] ? `sug-${suggestions[sugIdx].id}` : undefined
              }
              aria-describedby="shop-search-hint"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
                setSugOpen(true);
                setSugIdx(-1);
              }}
              onFocus={() => setSugOpen(true)}
              onBlur={() => window.setTimeout(() => setSugOpen(false), 120)}
              onKeyDown={(e) => {
                if (!suggestions.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSugOpen(true);
                  setSugIdx((i) => (i + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSugIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                } else if (e.key === "Enter" && sugIdx >= 0) {
                  e.preventDefault();
                  pickSuggestion(suggestions[sugIdx]);
                } else if (e.key === "Escape") {
                  setSugOpen(false);
                  setSugIdx(-1);
                }
              }}
              maxLength={60}
              placeholder={bn ? "চাল, তেল, ডিম… খুঁজুন" : "Search rice, oil, eggs…"}
              className="h-12 rounded-full border-transparent bg-muted pl-10 text-base shadow-none focus-visible:bg-card"
            />
            <span id="shop-search-hint" className="sr-only">
              {bn
                ? "লিখুন, তারপর তীর চিহ্ন দিয়ে সাজেশন বেছে নিন এবং এন্টার চাপুন"
                : "Type to search, use arrow keys to browse suggestions and press Enter to add"}
            </span>
            <p aria-live="polite" className="sr-only">
              {`${visible.length} ${bn ? "পণ্য পাওয়া গেছে" : "products found"}`}
            </p>

            {sugOpen && suggestions.length > 0 && (
              <ul
                id="shop-search-suggestions"
                role="listbox"
                aria-label={bn ? "পণ্যের সাজেশন" : "Product suggestions"}
                className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
              >
                {suggestions.map((sug, i) => (
                  <li key={sug.id} role="none">
                    <button
                      id={`sug-${sug.id}`}
                      role="option"
                      aria-selected={i === sugIdx}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        i === sugIdx && "bg-muted",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(sug)}
                    >
                      {sug.image_url ? (
                        <img
                          src={sug.image_url}
                          alt=""
                          loading="lazy"
                          className="size-8 rounded object-cover"
                        />
                      ) : (
                        <span className="size-8 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {bn ? sug.name_bn : sug.name_en}
                      </span>
                      <span className="text-xs font-semibold text-primary">
                        {money(Number(sug.price), lang)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <CustomerAccountMenu />
          </div>

          <Button
            className="h-12 shrink-0 rounded-full px-5 font-semibold"
            onClick={() => setCheckout(true)}
          >
            <ShoppingBag className="mr-1.5 size-4" />
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
          <Link
            to="/track"
            className="ml-auto whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-muted"
          >
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
            {bn
              ? "অফলাইন মোড — ব্রাউজ ও কার্ট কাজ করবে"
              : "Offline mode — browsing and cart still work"}
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
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={syncing}
              onClick={() => runSync(true)}
            >
              {syncing ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
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

      <div className="mx-auto max-w-7xl gap-6 px-4 lg:grid lg:grid-cols-[236px_minmax(0,1fr)_330px]">
        {/* ---- Category sidebar ---- */}
        <aside className="hidden lg:block">
          <div className="shop-card sticky top-28 mt-6 max-h-[calc(100vh-9rem)] overflow-y-auto p-3">

            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {bn ? "ক্যাটাগরি" : "Categories"}
            </p>
            <SideCat
              active={!cat}
              onClick={() => setCat("")}
              label={bn ? "সব পণ্য" : "All products"}
              count={products.data?.length ?? 0}
            />
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
          <section className="mt-6 grid gap-4 lg:grid-cols-6">
            <div className="gradient-brand relative col-span-full flex flex-col justify-between overflow-hidden rounded-[2rem] p-6 text-primary-foreground sm:p-8 lg:col-span-4">
              <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary-foreground/10" />
              <span className="pointer-events-none absolute -bottom-24 right-10 size-48 rounded-full bg-primary-foreground/5" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <Truck className="size-3.5" />
                  {bn ? "অনলাইন সুপারশপ" : "Online supershop"}
                </span>
                <h1 className="mt-4 max-w-lg font-display text-3xl font-extrabold leading-[1.1] sm:text-[2.6rem]">
                  {sc(
                    "shop.hero_title",
                    bn
                      ? "বাজার এখন দরজায়, ১ ঘণ্টায় ডেলিভারি"
                      : "Your daily bazar, delivered in 1 hour",
                  )}
                </h1>
                <p className="mt-3 max-w-md text-sm opacity-90 sm:text-base">
                  {sc(
                    "shop.hero_subtitle",
                    bn
                      ? "৳১০০০+ অর্ডারে ফ্রি ডেলিভারি · ক্যাশ অন ডেলিভারি"
                      : "Free delivery above ৳1000 · Cash on delivery",
                  )}
                </p>
              </div>
              <div className="relative mt-6 flex flex-wrap gap-2">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full font-semibold"
                  onClick={() => {
                    setCat("");
                    setQuery("");
                    setLimit(PAGE);
                  }}
                >
                  {bn ? "কেনাকাটা শুরু করুন" : "Start shopping"}
                </Button>
                <Link
                  to="/track"
                  className="inline-flex items-center rounded-full border border-primary-foreground/40 px-5 text-sm font-semibold transition-colors hover:bg-primary-foreground/10"
                >
                  {bn ? "অর্ডার ট্র্যাক" : "Track order"}
                </Link>
              </div>
            </div>

            <div className="col-span-full grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
              <div className="flex flex-col justify-between rounded-[2rem] bg-accent p-6 text-accent-foreground">
                <BadgePercent className="size-6" />
                <p className="mt-4 font-display text-2xl font-extrabold leading-none">
                  {bn ? "১০ টাকায় ১ পয়েন্ট" : "1 point per ৳10"}
                </p>
                <p className="mt-1.5 text-sm opacity-80">
                  {bn
                    ? "১০০০ পয়েন্ট হলেই ছাড় শুরু — মেম্বার হোন ফ্রি।"
                    : "Discounts unlock at 1000 points — membership is free."}
                </p>
              </div>
              <div className="shop-card flex flex-col justify-between p-6">
                <Clock className="size-6 text-primary" />
                <p className="mt-4 font-display text-2xl font-extrabold leading-none">
                  {bn ? "সকাল ৮টা – রাত ৮টা" : "8 AM – 8 PM"}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {bn
                    ? "নিজের সুবিধামতো ডেলিভারি স্লট বেছে নিন।"
                    : "Choose the delivery window that suits you."}
                </p>
              </div>
            </div>

            <div className="col-span-full grid gap-3 sm:grid-cols-3">
              <Perk
                icon={Truck}
                title={bn ? "ফ্রি ডেলিভারি" : "Free delivery"}
                sub={bn ? "৳১০০০+ অর্ডারে" : "On orders above ৳1000"}
              />
              <Perk
                icon={ShoppingBasket}
                title={bn ? "তাজা ও যাচাইকৃত" : "Fresh & checked"}
                sub={bn ? "প্রতিটি পণ্য হাতে বাছাই" : "Every item hand-picked"}
              />
              <Perk
                icon={Phone}
                title={bn ? "২৪/৭ সাপোর্ট" : "24/7 support"}
                sub={bn ? "কল করুন ১৬৭১০" : "Call 16710"}
              />
            </div>
          </section>

          <nav
            aria-label={bn ? "ক্যাটাগরি ফিল্টার" : "Category filters"}
            className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
          >
            <CatChip
              active={!cat}
              onClick={() => setCat("")}
              label={bn ? "সব" : "All"}
            />
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
          </nav>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {bn ? "আজকের বাজার" : "Today's aisle"}
              </p>
              <h2 className="font-display text-2xl font-extrabold">
                {activeCat
                  ? (bn ? activeCat.name_bn : activeCat.name_en)
                  : query.trim()
                    ? `“${query.trim()}”`
                    : bn
                      ? "সব পণ্য"
                      : "All products"}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {num(visible.length, lang)} {bn ? "পণ্য" : "items"}
              </span>

              <label htmlFor="shop-category" className="sr-only">
                {bn ? "ক্যাটাগরি" : "Category"}
              </label>
              <select
                id="shop-category"
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setLimit(PAGE);
                }}
                className="h-9 rounded-full border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <option value="">{bn ? "সব ক্যাটাগরি" : "All categories"}</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {bn ? c.name_bn : c.name_en}
                  </option>
                ))}
              </select>

              <label htmlFor="shop-sort" className="sr-only">
                {bn ? "সাজান" : "Sort products"}
              </label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortKey);
                  setLimit(PAGE);
                }}
                className="h-9 rounded-full border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="relevance">{bn ? "ডিফল্ট" : "Recommended"}</option>
                <option value="price_asc">{bn ? "দাম: কম → বেশি" : "Price: low to high"}</option>
                <option value="price_desc">{bn ? "দাম: বেশি → কম" : "Price: high to low"}</option>
                <option value="name_asc">{bn ? "নাম: ক → হ" : "Name: A to Z"}</option>
                <option value="name_desc">{bn ? "নাম: হ → ক" : "Name: Z to A"}</option>
              </select>

              {(cat || query.trim() || sort !== "relevance") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  onClick={() => {
                    setCat("");
                    setQuery("");
                    setSort("relevance");
                    setLimit(PAGE);
                  }}
                >
                  {bn ? "ফিল্টার মুছুন" : "Clear filters"}
                </Button>
              )}
            </div>
          </div>

          <ul
            aria-label={bn ? "পণ্যের তালিকা" : "Product list"}
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4"
          >
            {shown.map((p) => (
              <li key={p.id} className="contents">
                <ProductCard
                  p={p}
                  bn={bn}
                  qty={cart.lines.find((l) => l.id === p.id)?.qty ?? 0}
                  onAdd={() => addToCart(p)}
                  onSet={(q) => cart.setQty(p.id, q)}
                />
              </li>
            ))}
          </ul>


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
          <div className="shop-card sticky top-28 mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-display text-base font-extrabold">
                {bn ? "আপনার কার্ট" : "Your basket"}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                {num(cart.count, lang)} {bn ? "পণ্য" : "items"}
              </span>
            </div>
            <div className="max-h-[42vh] divide-y divide-border overflow-y-auto">
              {cart.lines.map((l) => (
                <CartRow key={l.id} l={l} bn={bn} lang={lang} onSet={(q) => cart.setQty(l.id, q)} />
              ))}
              {cart.lines.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <ShoppingBasket className="size-5" />
                  </span>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {bn ? "কার্ট খালি — পণ্য যোগ করুন" : "Cart is empty — add some products"}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-1.5 border-t border-border bg-muted/40 p-5 text-sm">
              <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
              <Row label={bn ? "ডেলিভারি" : "Delivery"} value={money(fee, lang)} />
              <Row label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
              {cart.subtotal > 0 && cart.subtotal < 1000 && (
                <p className="rounded-xl bg-accent/25 px-3 py-2 text-xs font-medium text-accent-foreground">
                  {bn
                    ? `আর ${money(1000 - cart.subtotal, lang)} কিনলে ডেলিভারি ফ্রি`
                    : `Add ${money(1000 - cart.subtotal, lang)} more for free delivery`}
                </p>
              )}
              <Button
                size="lg"
                className="mt-2 w-full rounded-full font-semibold"
                disabled={cart.lines.length === 0}
                onClick={() => setCheckout(true)}
              >
                {bn ? "চেকআউট" : "Checkout"}
              </Button>
            </div>
          </div>
        </aside>

      </div>

      <footer className="mt-12 border-t border-border bg-card pb-24 lg:pb-0">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-display text-base font-bold text-primary">
              {sc("brand.name", "Sokoler Bazar")}
            </p>
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
                <span className="block text-xs text-primary">
                  {bn ? "কার্ট দেখুন / পরিমাণ বদলান" : "View cart / edit qty"}
                </span>
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
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-foreground/40 lg:hidden"
          onClick={() => setCartOpen(false)}
        >
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
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {bn ? "কার্ট খালি" : "Cart is empty"}
                </p>
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={bn ? "চেকআউট" : "Checkout"}
          className="fixed inset-0 z-40 overflow-y-auto bg-background/95 p-4 backdrop-blur"
          onKeyDown={(e) => {
            if (e.key === "Escape") setCheckout(false);
          }}
        >
          <div className="mx-auto max-w-lg space-y-4 py-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">
                {bn ? "চেকআউট" : "Checkout"}
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  {bn ? "ধাপ" : "Step"} {num(step + 1, lang)}/৩{""}
                </span>
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <LangToggle className="bg-card" />
                <Button variant="outline" size="sm" onClick={() => setCheckout(false)}>
                  {bn ? "আরও পণ্য ক্রয় করুন" : "Buy more products"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={bn ? "চেকআউট বন্ধ করুন" : "Close checkout"}
                  onClick={() => setCheckout(false)}
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* ---- Step indicator ---- */}
            <ol className="flex items-center gap-2" aria-label={bn ? "চেকআউট ধাপ" : "Checkout steps"}>
              {STEPS.map((s, i) => (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    aria-current={step === i ? "step" : undefined}
                    onClick={() => {
                      if (i <= step) setStep(i);
                    }}
                    disabled={i > step}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      step === i
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : i < step
                          ? "border-primary/40 text-primary"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                        i <= step
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {i < step ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className="truncate">{bn ? s.bn : s.en}</span>
                  </button>
                </li>
              ))}
            </ol>

            {/* ---- Step 1: address ---- */}
            {step === 0 && (
              <div className="space-y-4">
                {user && isCustomer ? (
                  (savedAddresses.data ?? []).length > 0 && (
                    <div className="space-y-2">
                      <Label id="saved-addr-label">
                        {bn ? "সংরক্ষিত ঠিকানা" : "Saved addresses"}
                      </Label>
                      <div className="flex flex-wrap gap-2" aria-labelledby="saved-addr-label">
                        {(savedAddresses.data ?? []).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="min-h-11 rounded-xl border border-border px-3 py-2 text-left text-xs hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      {bn
                        ? "লগইন করলে ঠিকানা ও অর্ডার সংরক্ষিত থাকবে"
                        : "Sign in to save addresses and track orders"}
                    </span>
                    <CustomerAccountMenu compact />
                  </div>
                )}

                <div className="grid gap-3">
                  <F
                    id="co-name"
                    label={bn ? "নাম" : "Name"}
                    v={form.name}
                    err={fieldErrs.name}
                    autoComplete="name"
                    on={(v) => setForm({ ...form, name: v })}
                  />
                  <F
                    id="co-phone"
                    label={bn ? "মোবাইল" : "Phone"}
                    v={form.phone}
                    err={fieldErrs.phone}
                    inputMode="tel"
                    autoComplete="tel"
                    hint={bn ? "উদাহরণ: 01712345678" : "Example: 01712345678"}
                    on={(v) => setForm({ ...form, phone: v })}
                  />
                  <F
                    id="co-area"
                    label={bn ? "এলাকা" : "Area"}
                    v={form.area}
                    err={fieldErrs.area}
                    autoComplete="address-level2"
                    on={(v) => setForm({ ...form, area: v })}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="co-address">{bn ? "সম্পূর্ণ ঠিকানা" : "Full address"}</Label>
                    <Textarea
                      id="co-address"
                      value={form.address}
                      maxLength={300}
                      autoComplete="street-address"
                      aria-invalid={!!fieldErrs.address}
                      aria-describedby={fieldErrs.address ? "co-address-err" : undefined}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                    {fieldErrs.address && (
                      <p id="co-address-err" role="alert" className="text-xs text-destructive">
                        {fieldErrs.address}
                      </p>
                    )}
                  </div>
                  <F
                    id="co-note"
                    label={bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
                    v={form.note}
                    err={fieldErrs.note}
                    on={(v) => setForm({ ...form, note: v })}
                  />
                </div>
              </div>
            )}

            {/* ---- Step 2: slot + payment ---- */}
            {step === 1 && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label id="day-label">{bn ? "ডেলিভারির দিন" : "Delivery day"}</Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="day-label">
                    {nextDays(5).map((d) => {
                      const key = d.toISOString().slice(0, 10);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={slotDay === key}
                          onClick={() => {
                            setSlotDay(key);
                            if (slotTime && !slotAvailable(d, slotTime)) setSlotTime("");
                          }}
                          className={cn(
                            "min-h-11 rounded-xl border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            slotDay === key
                              ? "border-primary bg-primary/10 font-semibold text-primary"
                              : "border-border",
                          )}
                        >
                          {d.toLocaleDateString(bn ? "bn-BD" : "en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </button>
                      );
                    })}
                  </div>
                  <Label id="time-label">{bn ? "ডেলিভারির সময়" : "Delivery time"}</Label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="time-label">
                    {TIME_SLOTS.map((t) => {
                      const ok = slotAvailable(new Date(slotDay), t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={!ok}
                          aria-pressed={slotTime === t.id}
                          onClick={() => setSlotTime(t.id)}
                          className={cn(
                            "min-h-11 rounded-xl border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            !ok && "cursor-not-allowed opacity-40",
                            slotTime === t.id
                              ? "border-primary bg-primary/10 font-semibold text-primary"
                              : "border-border",
                          )}
                        >
                          {bn ? t.bn : t.en}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrs.slot && (
                    <p role="alert" className="text-xs text-destructive">
                      {fieldErrs.slot}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label id="pay-label">{bn ? "পেমেন্ট" : "Payment"}</Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="pay-label">
                    {[
                      { id: "cod", bn: "ক্যাশ অন ডেলিভারি", en: "Cash on delivery" },
                      { id: "bkash", bn: "বিকাশ", en: "bKash" },
                      { id: "nagad", bn: "নগদ", en: "Nagad" },
                      { id: "card", bn: "কার্ড", en: "Card" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={form.payment === m.id}
                        onClick={() => setForm({ ...form, payment: m.id })}
                        className={cn(
                          "min-h-11 rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          form.payment === m.id
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border",
                        )}
                      >
                        {bn ? m.bn : m.en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---- Step 3: review ---- */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="surface-panel divide-y divide-border">
                  {cart.lines.map((l) => (
                    <CartRow
                      key={l.id}
                      l={l}
                      bn={bn}
                      lang={lang}
                      onSet={(q) => cart.setQty(l.id, q)}
                    />
                  ))}
                  {cart.lines.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">
                      {bn ? "কার্ট খালি" : "Cart is empty"}
                    </p>
                  )}
                </div>

                <div className="surface-panel space-y-1 p-4 text-sm">
                  <Row label={bn ? "নাম" : "Name"} value={form.name || "—"} />
                  <Row label={bn ? "মোবাইল" : "Phone"} value={form.phone || "—"} />
                  <Row label={bn ? "ঠিকানা" : "Address"} value={form.address || "—"} />
                  <Row label={bn ? "স্লট" : "Slot"} value={slotLabel || "—"} />
                  <Row label={bn ? "পেমেন্ট" : "Payment"} value={form.payment.toUpperCase()} />
                </div>

                <div className="surface-panel space-y-2 p-4">
                  <p className="text-sm font-semibold">
                    {bn ? "অর্ডারের পরের ধাপগুলো" : "What happens next"}
                  </p>
                  <StatusPreview bn={bn} />
                </div>
              </div>
            )}

            <div className="surface-panel space-y-1 p-4 text-sm">
              <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
              <Row label={bn ? "ডেলিভারি" : "Delivery"} value={money(fee, lang)} />
              <Row label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
            </div>

            {errors.length > 0 && (
              <ul
                role="alert"
                className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
              >
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setStep((s) => s - 1)}
                >
                  {bn ? "পিছনে" : "Back"}
                </Button>
              )}
              {step < 2 ? (
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={cart.lines.length === 0}
                  onClick={() => {
                    const errs = stepErrors(step);
                    const { fields } = validate();
                    setFieldErrs(fields);
                    setErrors(errs);
                    if (errs.length) {
                      toast.error(errs[0]);
                      return;
                    }
                    setErrors([]);
                    setStep((s) => s + 1);
                  }}
                >
                  {bn ? "পরবর্তী ধাপ" : "Continue"}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={cart.lines.length === 0 || placing}
                  onClick={placeOrder}
                >
                  {placing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                  {bn ? "অর্ডার কনফার্ম করুন" : "Place order"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {placed !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={bn ? "অর্ডার নিশ্চিত" : "Order confirmation"}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/95 p-6 backdrop-blur"
        >
          <div className="surface-panel w-full max-w-sm space-y-4 p-6">
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-display text-xl font-bold text-primary">
                {bn ? "অর্ডার নেওয়া হয়েছে!" : "Order placed!"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {bn ? "আপনার অর্ডার নম্বর" : "Your order number"}: <b>#{placed}</b>
              </p>
              {placedInfo?.slot && (
                <p className="text-xs text-muted-foreground">
                  {bn ? "ডেলিভারি স্লট" : "Delivery slot"}: {placedInfo.slot}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-sm font-semibold">
                {bn ? "অর্ডার স্ট্যাটাস" : "Order status"}
              </p>
              <StatusPreview bn={bn} />
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setPlaced(null);
                setCheckout(false);
              }}
            >
              {bn ? "আরও কেনাকাটা" : "Continue shopping"}
            </Button>
            <a
              href={`/track?order=${placed}&phone=${encodeURIComponent(placedInfo?.phone ?? "")}`}
              className="block text-center text-sm text-primary underline"
            >
              {bn ? "লাইভ ট্র্যাকিং দেখুন" : "Track this order live"}
            </a>
          </div>
        </div>
      )}

    </main>
  );
}

function CatChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground",
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
    <div className="shop-card shop-tile group flex flex-col p-2.5">
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={bn ? p.name_bn : p.name_en}
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="aspect-square w-full" />
        )}
        {p.pack_size && (
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground backdrop-blur">
            {p.pack_size}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-1.5 pb-1 pt-3">
        <span className="line-clamp-2 text-sm font-semibold leading-snug">
          {bn ? p.name_bn : p.name_en}
        </span>
        {p.brand && (
          <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {p.brand}
          </span>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="font-display text-lg font-extrabold leading-none text-primary">
            {money(Number(p.price), lang)}
          </span>
          {qty === 0 ? (
            <Button
              size="icon"
              className="size-11 shrink-0 rounded-full"
              aria-label={`${bn ? "কার্টে যোগ করুন" : "Add to cart"}: ${bn ? p.name_bn : p.name_en}`}
              onClick={onAdd}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <div
              role="group"
              aria-label={`${bn ? "পরিমাণ" : "Quantity"}: ${bn ? p.name_bn : p.name_en}`}
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary p-0.5 text-primary-foreground"
            >
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${bn ? "পরিমাণ কমান" : "Decrease quantity"}: ${bn ? p.name_bn : p.name_en}`}
                className="size-9 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                onClick={() => onSet(qty - 1)}
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span aria-live="polite" className="min-w-5 text-center text-sm font-bold">
                {num(qty, lang)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${bn ? "পরিমাণ বাড়ান" : "Increase quantity"}: ${bn ? p.name_bn : p.name_en}`}
                className="size-9 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                onClick={() => onSet(qty + 1)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}

        </div>
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
    <div className="flex items-center gap-3 px-4 py-3">
      {l.image_url ? (
        <img
          src={l.image_url}
          alt=""
          loading="lazy"
          className="size-11 shrink-0 rounded-xl bg-muted object-cover"
        />
      ) : (
        <span className="size-11 shrink-0 rounded-xl bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm font-medium">{bn ? l.name_bn : l.name_en}</span>
        <span className="text-xs text-muted-foreground">{money(l.price * l.qty, lang)}</span>
      </div>
      <div
        role="group"
        aria-label={`${bn ? "পরিমাণ" : "Quantity"}: ${bn ? l.name_bn : l.name_en}`}
        className="flex shrink-0 items-center gap-0.5 rounded-full border border-border"
      >
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${bn ? "পরিমাণ কমান" : "Decrease quantity"}: ${bn ? l.name_bn : l.name_en}`}
          className="size-9 rounded-full"
          onClick={() => onSet(l.qty - 1)}
        >
          <Minus className="size-3" aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="w-5 text-center text-sm font-semibold">
          {num(l.qty, lang)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${bn ? "পরিমাণ বাড়ান" : "Increase quantity"}: ${bn ? l.name_bn : l.name_en}`}
          className="size-9 rounded-full"
          onClick={() => onSet(l.qty + 1)}
        >
          <Plus className="size-3" aria-hidden="true" />
        </Button>
      </div>

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

function SideCat({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary font-semibold text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >

      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          active ? "bg-primary-foreground/20" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Perk({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="shop-card flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );

}
