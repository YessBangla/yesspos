import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bike,
  Clock,
  MapPin,
  Megaphone,
  PackageCheck,
  ShoppingBag,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/commerce")({
  head: () => ({
    meta: [
      { title: "E-commerce control tower — SokolerBazar" },
      {
        name: "description",
        content: "Live home-delivery KPIs: orders, fulfilment funnel, rider load, delivery zones and promotions.",
      },
      { property: "og:title", content: "E-commerce control tower — SokolerBazar" },
      { property: "og:description", content: "Monitor online grocery orders, riders, zones and campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommercePage,
});

type Order = {
  id: string;
  order_no: number;
  status: string;
  total: number;
  delivery_fee: number;
  payment_method: string;
  area: string | null;
  rider_id: string | null;
  created_at: string;
  customer_phone: string;
};

type Item = { order_id: string; name_snapshot: string; quantity: number; line_total: number };

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;
const LABEL: Record<string, { bn: string; en: string }> = {
  pending: { bn: "নতুন", en: "Pending" },
  confirmed: { bn: "কনফার্মড", en: "Confirmed" },
  packed: { bn: "প্যাকড", en: "Packed" },
  shipped: { bn: "রাস্তায়", en: "Out for delivery" },
  delivered: { bn: "ডেলিভার্ড", en: "Delivered" },
  cancelled: { bn: "বাতিল", en: "Cancelled" },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function CommercePage() {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const orders = useQuery({
    queryKey: ["commerce-orders"],
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("id,order_no,status,total,delivery_fee,payment_method,area,rider_id,created_at,customer_phone")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const items = useQuery({
    queryKey: ["commerce-items"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_order_items")
        .select("order_id,name_snapshot,quantity,line_total")
        .limit(4000);
      if (error) throw error;
      return data as unknown as Item[];
    },
  });

  const riders = useQuery({
    queryKey: ["riders"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_riders").select("id,name,is_active");
      if (error) throw error;
      return data as { id: string; name: string; is_active: boolean }[];
    },
  });

  const zones = useQuery({
    queryKey: ["delivery-zones"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("id,name_en,name_bn,delivery_fee,is_active")
        .order("sort_order");
      if (error) throw error;
      return data as { id: string; name_en: string; name_bn: string; delivery_fee: number; is_active: boolean }[];
    },
  });

  const reviews = useQuery({
    queryKey: ["reviews-pending-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("product_reviews")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const promos = useQuery({
    queryKey: ["promos-active-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("promotions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const stats = useMemo(() => {
    const all = orders.data ?? [];
    const t0 = startOfToday().getTime();
    const today = all.filter((o) => new Date(o.created_at).getTime() >= t0);
    const done = today.filter((o) => o.status !== "cancelled");
    const revenue = done.reduce((s, o) => s + Number(o.total), 0);
    const open = all.filter((o) => !["delivered", "cancelled"].includes(o.status));
    const unassigned = open.filter((o) => !o.rider_id);
    const cod = today.filter((o) => o.payment_method === "cod").reduce((s, o) => s + Number(o.total), 0);
    const cancelled = today.filter((o) => o.status === "cancelled").length;
    const phones = new Set(all.map((o) => o.customer_phone));
    const repeat = all.length - phones.size;
    return {
      todayCount: today.length,
      revenue,
      aov: done.length ? revenue / done.length : 0,
      open: open.length,
      unassigned: unassigned.length,
      cod,
      cancelled,
      repeat,
      total: all.length,
    };
  }, [orders.data]);

  const funnel = useMemo(() => {
    const all = orders.data ?? [];
    return FLOW.map((s) => ({ key: s, count: all.filter((o) => o.status === s).length }));
  }, [orders.data]);

  const areaRows = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of orders.data ?? []) {
      const key = o.area?.trim() || (bn ? "অজানা" : "Unknown");
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(o.total);
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [orders.data, bn]);

  const riderLoad = useMemo(() => {
    const open = (orders.data ?? []).filter((o) => !["delivered", "cancelled"].includes(o.status));
    return (riders.data ?? []).map((r) => ({
      ...r,
      load: open.filter((o) => o.rider_id === r.id).length,
    }));
  }, [orders.data, riders.data]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    for (const it of items.data ?? []) {
      const cur = map.get(it.name_snapshot) ?? { qty: 0, total: 0 };
      cur.qty += it.quantity;
      cur.total += Number(it.line_total);
      map.set(it.name_snapshot, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  }, [items.data]);

  const cards = [
    { label: bn ? "আজকের অর্ডার" : "Orders today", value: num(stats.todayCount, lang), icon: ShoppingBag },
    { label: bn ? "আজকের বিক্রি" : "Revenue today", value: money(stats.revenue, lang), icon: TrendingUp },
    { label: bn ? "গড় অর্ডার মূল্য" : "Avg order value", value: money(stats.aov, lang), icon: Wallet },
    { label: bn ? "চলমান অর্ডার" : "Open orders", value: num(stats.open, lang), icon: Clock },
    { label: bn ? "রাইডার ছাড়া" : "Unassigned", value: num(stats.unassigned, lang), icon: Bike },
    { label: bn ? "ক্যাশ অন ডেলিভারি" : "COD today", value: money(stats.cod, lang), icon: Truck },
    { label: bn ? "বাতিল (আজ)" : "Cancelled today", value: num(stats.cancelled, lang), icon: PackageCheck },
    { label: bn ? "রিভিউ অনুমোদন বাকি" : "Reviews pending", value: num(reviews.data ?? 0, lang), icon: Star },
  ];

  const links = [
    { to: "/delivery-orders", label: bn ? "অর্ডার ম্যানেজ" : "Manage orders", icon: Truck },
    { to: "/riders", label: bn ? "রাইডার" : "Riders", icon: Bike },
    { to: "/delivery-zones", label: bn ? "ডেলিভারি এলাকা" : "Delivery zones", icon: MapPin },
    { to: "/promotions", label: bn ? "প্রোমোশন" : "Promotions", icon: Megaphone },
    { to: "/reviews", label: bn ? "রিভিউ" : "Reviews", icon: Star },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          <ShoppingBag className="mr-2 inline size-6 text-primary" />
          {bn ? "ই-কমার্স কন্ট্রোল টাওয়ার" : "E-commerce control tower"}
        </h1>
        <span className="text-xs text-muted-foreground">
          {bn ? "মোট অনলাইন অর্ডার" : "Total online orders"}: {num(stats.total, lang)} ·{" "}
          {bn ? "সক্রিয় ক্যাম্পেইন" : "Active campaigns"}: {num(promos.data ?? 0, lang)}
        </span>
      </div>

      <div className="surface-panel flex flex-wrap gap-2 p-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <l.icon className="size-4 text-primary" />
            {l.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="surface-panel p-3">
            <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <c.icon className="size-4" />
            </span>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-display text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="surface-panel p-4">
        <p className="mb-3 text-sm font-semibold">{bn ? "ফুলফিলমেন্ট পাইপলাইন" : "Fulfilment pipeline"}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {funnel.map((f, i) => (
            <div
              key={f.key}
              className={cn(
                "rounded-xl border p-3 text-center",
                f.count > 0 ? "border-primary/40 bg-primary/5" : "border-border",
              )}
            >
              <p className="text-xs text-muted-foreground">
                {i + 1}. {bn ? LABEL[f.key].bn : LABEL[f.key].en}
              </p>
              <p className="font-display text-xl font-bold">{num(f.count, lang)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="surface-panel p-4">
          <p className="mb-2 text-sm font-semibold">
            <MapPin className="mr-1 inline size-4 text-primary" />
            {bn ? "এলাকাভিত্তিক অর্ডার" : "Orders by area"}
          </p>
          <ul className="space-y-1 text-sm">
            {areaRows.map(([area, v]) => (
              <li key={area} className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                <span className="truncate">{area}</span>
                <span className="text-muted-foreground">
                  {num(v.count, lang)} · {money(v.total, lang)}
                </span>
              </li>
            ))}
            {areaRows.length === 0 && <li className="text-muted-foreground">{bn ? "তথ্য নেই" : "No data"}</li>}
          </ul>
        </div>

        <div className="surface-panel p-4">
          <p className="mb-2 text-sm font-semibold">
            <Bike className="mr-1 inline size-4 text-primary" />
            {bn ? "রাইডার লোড" : "Rider load"}
          </p>
          <ul className="space-y-1 text-sm">
            {riderLoad.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                <span className={cn("truncate", !r.is_active && "text-muted-foreground line-through")}>{r.name}</span>
                <span className="font-semibold">{num(r.load, lang)}</span>
              </li>
            ))}
            {riderLoad.length === 0 && (
              <li className="text-muted-foreground">{bn ? "কোনো রাইডার নেই" : "No riders yet"}</li>
            )}
          </ul>
        </div>

        <div className="surface-panel p-4">
          <p className="mb-2 text-sm font-semibold">
            <ShoppingBag className="mr-1 inline size-4 text-primary" />
            {bn ? "অনলাইনে বেশি বিক্রিত পণ্য" : "Top online products"}
          </p>
          <ul className="space-y-1 text-sm">
            {topProducts.map(([name, v]) => (
              <li key={name} className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                <span className="truncate">{name}</span>
                <span className="text-muted-foreground">
                  {num(v.qty, lang)} · {money(v.total, lang)}
                </span>
              </li>
            ))}
            {topProducts.length === 0 && <li className="text-muted-foreground">{bn ? "তথ্য নেই" : "No data"}</li>}
          </ul>
        </div>

        <div className="surface-panel p-4">
          <p className="mb-2 text-sm font-semibold">
            <MapPin className="mr-1 inline size-4 text-primary" />
            {bn ? "ডেলিভারি জোন ও চার্জ" : "Delivery zones & fees"}
          </p>
          <ul className="space-y-1 text-sm">
            {(zones.data ?? []).map((z) => (
              <li key={z.id} className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                <span className={cn("truncate", !z.is_active && "text-muted-foreground line-through")}>
                  {bn ? z.name_bn : z.name_en}
                </span>
                <span className="text-muted-foreground">{money(Number(z.delivery_fee), lang)}</span>
              </li>
            ))}
            {(zones.data ?? []).length === 0 && (
              <li className="text-muted-foreground">{bn ? "জোন যোগ করুন" : "Add zones"}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
