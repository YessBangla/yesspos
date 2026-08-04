import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookmarkPlus,
  CalendarDays,
  Minus,
  Plus,
  PiggyBank,
  RotateCcw,
  Search,
  ShoppingBasket,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StorefrontHeader } from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { useShopCart } from "@/lib/shop-cart";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Family grocery budget planner — Bazar Bari" },
      {
        name: "description",
        content:
          "Plan your daily, weekly or monthly grocery list within a fixed budget with live prices, and send the whole plan to your cart.",
      },
      { property: "og:title", content: "Family grocery budget planner — Bazar Bari" },
      {
        property: "og:description",
        content: "Build a daily, weekly or monthly grocery list that stays inside your budget.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/budget` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/budget` }],
  }),
  component: BudgetPage,
});

type Period = "daily" | "weekly" | "monthly";

type PlanLine = {
  id: string;
  name_en: string;
  name_bn: string;
  price: number;
  pack_size: string | null;
  image_url: string | null;
  qty: number;
};

type Plan = { period: Period; budget: number; lines: PlanLine[] };

const KEY = "bazar-budget-v1";
const DEFAULTS: Record<Period, number> = { daily: 500, weekly: 3000, monthly: 12000 };
/** How many times a daily plan repeats inside the chosen period. */
const MULTIPLIER: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };

function readPlan(): Plan {
  if (typeof window === "undefined") return { period: "weekly", budget: DEFAULTS.weekly, lines: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { period: "weekly", budget: DEFAULTS.weekly, lines: [] };
    const p = JSON.parse(raw) as Plan;
    return {
      period: p.period ?? "weekly",
      budget: Number(p.budget) || DEFAULTS[p.period ?? "weekly"],
      lines: Array.isArray(p.lines) ? p.lines : [],
    };
  } catch {
    return { period: "weekly", budget: DEFAULTS.weekly, lines: [] };
  }
}

function BudgetPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();

  const [plan, setPlan] = useState<Plan>({ period: "weekly", budget: DEFAULTS.weekly, lines: [] });
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => setPlan(readPlan()), []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan));
    } catch {
      /* storage blocked — plan stays in memory */
    }
  }, [plan]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const products = useQuery({
    queryKey: ["budget-products", debounced],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name_en,name_bn,price,pack_size,image_url,stock")
        .eq("is_active", true)
        .order("name_en")
        .limit(40);
      if (debounced) q = q.or(`name_en.ilike.%${debounced}%,name_bn.ilike.%${debounced}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const spent = useMemo(
    () => plan.lines.reduce((s, l) => s + l.price * l.qty, 0),
    [plan.lines],
  );
  const left = plan.budget - spent;
  const pct = plan.budget > 0 ? Math.min(100, Math.round((spent / plan.budget) * 100)) : 0;
  const perDay = spent / MULTIPLIER[plan.period];

  function setQty(id: string, qty: number) {
    setPlan((p) => ({
      ...p,
      lines: p.lines
        .map((l) => (l.id === id ? { ...l, qty: Math.max(0, Math.min(99, qty)) } : l))
        .filter((l) => l.qty > 0),
    }));
  }

  function addProduct(p: {
    id: string;
    name_en: string;
    name_bn: string;
    price: number;
    pack_size: string | null;
    image_url: string | null;
  }) {
    const price = Number(p.price ?? 0);
    setPlan((prev) => {
      const found = prev.lines.find((l) => l.id === p.id);
      const lines = found
        ? prev.lines.map((l) => (l.id === p.id ? { ...l, qty: Math.min(99, l.qty + 1) } : l))
        : [...prev.lines, { ...p, price, qty: 1 }];
      const nextSpent = lines.reduce((s, l) => s + l.price * l.qty, 0);
      if (nextSpent > prev.budget) {
        toast.warning(
          bn
            ? `বাজেট ছাড়িয়ে যাচ্ছে — ${money(nextSpent - prev.budget, lang)} বেশি`
            : `Over budget by ${money(nextSpent - prev.budget, lang)}`,
        );
      }
      return { ...prev, lines };
    });
  }

  function sendToCart() {
    if (plan.lines.length === 0) return;
    for (const l of plan.lines) {
      cart.add(
        {
          id: l.id,
          name_en: l.name_en,
          name_bn: l.name_bn,
          price: l.price,
          pack_size: l.pack_size,
          image_url: l.image_url,
        },
        l.qty,
      );
    }
    toast.success(
      bn ? "বাজেট তালিকা কার্টে যোগ হয়েছে" : "Budget list added to your cart",
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="rounded-3xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
          <PiggyBank className="size-4" />
          {bn ? "পরিবারের বাজেট পরিকল্পনা" : "Family budget planner"}
        </p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">
          {bn
            ? "বাজেটের মধ্যে প্রতিদিনের বাজারের তালিকা"
            : "Daily grocery list that stays inside your budget"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bn
            ? "দৈনিক, সাপ্তাহিক বা মাসিক বাজেট দিন — মূল্যসহ তালিকা তৈরি করুন এবং এক ক্লিকে কার্টে পাঠান।"
            : "Set a daily, weekly or monthly budget, build the list with live prices and send it to the cart in one click."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
          <div
            role="tablist"
            aria-label={bn ? "বাজেটের সময়কাল" : "Budget period"}
            className="flex gap-1 rounded-full border border-border bg-muted/40 p-1"
          >
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={plan.period === p}
                type="button"
                onClick={() => setPlan((prev) => ({ ...prev, period: p, budget: DEFAULTS[p] }))}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
                  plan.period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background"
                }`}
              >
                {p === "daily"
                  ? bn
                    ? "দৈনিক"
                    : "Daily"
                  : p === "weekly"
                    ? bn
                      ? "সাপ্তাহিক"
                      : "Weekly"
                    : bn
                      ? "মাসিক"
                      : "Monthly"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">{bn ? "বাজেট (৳)" : "Budget (৳)"}</Label>
            <Input
              id="budget-amount"
              inputMode="numeric"
              value={String(plan.budget)}
              onChange={(e) =>
                setPlan((prev) => ({ ...prev, budget: Math.max(0, Number(e.target.value) || 0) }))
              }
              className="h-12 max-w-xs text-base"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-muted/40 p-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">
              {bn ? "খরচ" : "Planned"}: {money(spent, lang)} / {money(plan.budget, lang)}
            </span>
            <span className={left < 0 ? "font-bold text-destructive" : "font-bold text-primary"}>
              {left < 0
                ? bn
                  ? `বাজেট ছাড়িয়েছে ${money(-left, lang)}`
                  : `Over budget by ${money(-left, lang)}`
                : bn
                  ? `বাকি ${money(left, lang)}`
                  : `${money(left, lang)} left`}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full rounded-full transition-all ${left < 0 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {bn
              ? `গড়ে দৈনিক ${money(perDay, lang)} — ${num(plan.lines.length, lang)}টি পণ্য`
              : `About ${money(perDay, lang)} per day · ${plan.lines.length} item(s)`}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Product picker */}
        <section aria-label={bn ? "পণ্য যোগ করুন" : "Add products"}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={bn ? "পণ্য খুঁজুন…" : "Search products…"}
              aria-label={bn ? "পণ্য খুঁজুন" : "Search products"}
              className="h-12 rounded-full pl-9 text-base"
            />
          </div>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(products.data ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    loading="lazy"
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="size-12 shrink-0 rounded-xl bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{bn ? p.name_bn : p.name_en}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.pack_size ? `${p.pack_size} · ` : ""}
                    {money(Number(p.price ?? 0), lang)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 shrink-0 rounded-full"
                  onClick={() => addProduct(p)}
                  aria-label={`${bn ? "তালিকায় যোগ করুন" : "Add to plan"}: ${bn ? p.name_bn : p.name_en}`}
                >
                  <Plus className="size-4" />
                </Button>
              </li>
            ))}
            {products.isLoading && (
              <li className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
                {bn ? "লোড হচ্ছে…" : "Loading…"}
              </li>
            )}
            {!products.isLoading && (products.data ?? []).length === 0 && (
              <li className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
                {bn ? "কোনো পণ্য পাওয়া যায়নি" : "No products found"}
              </li>
            )}
          </ul>
        </section>

        {/* Plan */}
        <section
          aria-label={bn ? "আপনার বাজেট তালিকা" : "Your budget list"}
          className="rounded-3xl border border-border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Wallet className="size-4 text-primary" />
            {bn ? "আপনার তালিকা" : "Your list"}
          </h2>

          <ul className="mt-2 divide-y divide-border">
            {plan.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{bn ? l.name_bn : l.name_en}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(l.price, lang)} × {num(l.qty, lang)} ={" "}
                    <span className="font-semibold text-foreground">
                      {money(l.price * l.qty, lang)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={bn ? "কমান" : "Decrease"}
                  onClick={() => setQty(l.id, l.qty - 1)}
                  className="grid size-11 place-items-center rounded-full border border-border hover:bg-muted"
                >
                  {l.qty <= 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label={bn ? "বাড়ান" : "Increase"}
                  onClick={() => setQty(l.id, l.qty + 1)}
                  className="grid size-11 place-items-center rounded-full border border-border hover:bg-muted"
                >
                  <Plus className="size-4" />
                </button>
              </li>
            ))}
            {plan.lines.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                {bn
                  ? "পাশ থেকে পণ্য যোগ করে তালিকা শুরু করুন"
                  : "Add products from the list to start planning"}
              </li>
            )}
          </ul>

          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Button
              size="lg"
              className="w-full rounded-full font-semibold"
              disabled={plan.lines.length === 0}
              onClick={sendToCart}
            >
              <ShoppingBasket className="mr-1 size-4" />
              {bn ? "কার্টে পাঠান" : "Send to cart"} · {money(spent, lang)}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              disabled={plan.lines.length === 0}
              onClick={() => setPlan((p) => ({ ...p, lines: [] }))}
            >
              {bn ? "তালিকা মুছুন" : "Clear list"}
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-full">
              <Link to="/">{bn ? "দোকানে ফিরে যান" : "Back to shop"}</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
