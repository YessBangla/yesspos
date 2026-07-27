import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  HandCoins,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Trophy,
  Truck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SheraPOS" },
      { name: "description", content: "Daily sales totals, dues, profit, cash flow and low-stock alerts." },
      { property: "og:title", content: "Dashboard — SheraPOS" },
      { property: "og:description", content: "Sales, dues, profit, cash flow and stock at a glance." },
    ],
  }),
  component: DashboardPage,
});

type RangeKey = "today" | "week" | "month" | "year";

function rangeStart(key: RangeKey) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (key === "week") d.setDate(d.getDate() - 6);
  if (key === "month") d.setDate(1);
  if (key === "year") {
    d.setMonth(0);
    d.setDate(1);
  }
  return d;
}

function DashboardPage() {
  const { t, lang } = useI18n();
  const me = useMyRole();
  const [range, setRange] = useState<RangeKey>("month");
  const [tab, setTab] = useState<"sale" | "purchase" | "payment">("sale");

  const from = rangeStart(range);
  const fromIso = from.toISOString();
  const fromDate = fromIso.slice(0, 10);

  const stats = useQuery({
    queryKey: ["dashboard", range],
    queryFn: async () => {
      const [salesRes, productsRes, itemsRes, purchasesRes, returnsRes, expensesRes, contactsRes, paymentsRes] =
        await Promise.all([
          supabase
            .from("sales")
            .select("id,invoice_no,total,paid,status,created_at,customer_name,payment_method")
            .gte("created_at", fromIso)
            .order("created_at", { ascending: false }),
          supabase.from("products").select("id,name_en,name_bn,stock,low_stock_at,unit,cost"),
          supabase.from("sale_items").select("sale_id,product_id,name_snapshot,quantity,line_total"),
          supabase
            .from("purchases")
            .select("id,ref_no,total,paid,purchased_on,created_at")
            .gte("purchased_on", fromDate)
            .order("purchased_on", { ascending: false }),
          supabase.from("sale_returns").select("id,total,created_at").gte("created_at", fromIso),
          supabase.from("expenses").select("amount,spent_on,payment_method").gte("spent_on", fromDate),
          supabase.from("contacts").select("id,type"),
          supabase
            .from("payments")
            .select("id,amount,direction,method,paid_on,note")
            .gte("paid_on", fromDate)
            .order("paid_on", { ascending: false }),
        ]);

      for (const r of [salesRes, productsRes, itemsRes, purchasesRes, returnsRes, expensesRes, contactsRes, paymentsRes]) {
        if (r.error) throw r.error;
      }

      return {
        sales: salesRes.data ?? [],
        products: productsRes.data ?? [],
        items: itemsRes.data ?? [],
        purchases: purchasesRes.data ?? [],
        returns: returnsRes.data ?? [],
        expenses: expensesRes.data ?? [],
        contacts: contactsRes.data ?? [],
        payments: paymentsRes.data ?? [],
      };
    },
  });

  const d = stats.data;
  const sales = d?.sales ?? [];
  const products = d?.products ?? [];
  const items = d?.items ?? [];
  const purchases = d?.purchases ?? [];
  const returns = d?.returns ?? [];
  const expenses = d?.expenses ?? [];
  const contacts = d?.contacts ?? [];
  const payments = d?.payments ?? [];

  const finalSales = sales.filter((s) => s.status === "final");
  const saleTotal = finalSales.reduce((s, r) => s + Number(r.total), 0);
  const salePaid = finalSales.reduce((s, r) => s + Number(r.paid), 0);
  const saleDue = Math.max(saleTotal - salePaid, 0);
  const returnTotal = returns.reduce((s, r) => s + Number(r.total), 0);
  const purchaseTotal = purchases.reduce((s, r) => s + Number(r.total), 0);
  const purchasePaid = purchases.reduce((s, r) => s + Number(r.paid), 0);
  const purchaseDue = Math.max(purchaseTotal - purchasePaid, 0);
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const dueReceived = payments.filter((p) => p.direction === "in").reduce((s, p) => s + Number(p.amount), 0);
  const paidOut = payments.filter((p) => p.direction === "out").reduce((s, p) => s + Number(p.amount), 0);

  const costById = new Map(products.map((p) => [p.id, Number(p.cost ?? 0)]));
  const finalIds = new Set(finalSales.map((s) => s.id));
  const rangeItems = items.filter((it) => finalIds.has(it.sale_id as string));
  const cogs = rangeItems.reduce(
    (s, it) => s + Number(costById.get(it.product_id as string) ?? 0) * Number(it.quantity),
    0,
  );
  const profit = saleTotal - returnTotal - cogs - expenseTotal;

  const customers = contacts.filter((c) => c.type === "customer").length;
  const suppliers = contacts.filter((c) => c.type === "supplier").length;
  const stockValue = products.reduce((s, p) => s + Number(p.stock) * Number(p.cost ?? 0), 0);
  const lowStock = products.filter((p) => p.stock <= p.low_stock_at);

  const cashIn = salePaid + dueReceived;
  const cashOut = purchasePaid + paidOut + expenseTotal;

  const cards = [
    { icon: Users, label: t("totalCustomer"), value: num(customers, lang), tone: "text-chart-1" },
    { icon: Truck, label: t("totalSupplier"), value: num(suppliers, lang), tone: "text-chart-2" },
    { icon: TrendingUp, label: t("totalSales"), value: money(saleTotal, lang), tone: "text-primary" },
    { icon: RotateCcw, label: t("saleReturn"), value: money(returnTotal, lang), tone: "text-destructive" },
    { icon: ShoppingCart, label: t("totalPurchase"), value: money(purchaseTotal, lang), tone: "text-chart-3" },
    { icon: Receipt, label: t("todayOrders"), value: num(finalSales.length, lang), tone: "text-chart-4" },
    { icon: Banknote, label: t("paid"), value: money(salePaid, lang), tone: "text-chart-2" },
    { icon: HandCoins, label: t("totalDueAmount"), value: money(saleDue, lang), tone: "text-destructive" },
    { icon: ArrowDownLeft, label: t("totalReceived"), value: money(dueReceived, lang), tone: "text-chart-1" },
    { icon: ArrowUpRight, label: t("totalPurchasePaid"), value: money(purchasePaid, lang), tone: "text-chart-3" },
    { icon: AlertTriangle, label: t("totalPurchaseDue"), value: money(purchaseDue, lang), tone: "text-destructive" },
    { icon: Wallet, label: t("totalExpense"), value: money(expenseTotal, lang), tone: "text-chart-5" },
  ];

  const chart = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const key = day.toDateString();
    return {
      day: day.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { weekday: "short" }),
      total: sales
        .filter((s) => new Date(s.created_at).toDateString() === key)
        .reduce((sum, s) => sum + Number(s.total), 0),
    };
  });

  const top = Object.values(
    rangeItems.reduce<Record<string, { name: string; qty: number; total: number }>>((acc, it) => {
      const key = it.name_snapshot;
      acc[key] ??= { name: key, qty: 0, total: 0 };
      acc[key].qty += it.quantity;
      acc[key].total += Number(it.line_total);
      return acc;
    }, {}),
  )
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "today", label: t("rangeToday") },
    { key: "week", label: t("rangeWeek") },
    { key: "month", label: t("rangeMonth") },
    { key: "year", label: t("rangeYear") },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          {t("welcome")}{" "}
          <span className="text-primary">{me.data?.username ?? ""}</span>
        </h1>
        <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="surface-panel p-3">
            <span className={cn("mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary", c.tone)}>
              <c.icon className="size-4" />
            </span>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-display text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-panel p-4 text-center">
          <Trophy className="mx-auto size-7 text-primary" />
          <p className="mt-1 text-sm font-semibold">{t("profit")}</p>
          <p className="font-display text-2xl font-bold text-primary">{money(profit, lang)}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <Boxes className="mx-auto size-7 text-chart-2" />
          <p className="mt-1 text-sm font-semibold">{t("stockValue")}</p>
          <p className="font-display text-2xl font-bold">{money(stockValue, lang)}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <Boxes className="mx-auto size-7 text-chart-4" />
          <p className="mt-1 text-sm font-semibold">{t("totalProducts")}</p>
          <p className="font-display text-2xl font-bold">{num(products.length, lang)}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <AlertTriangle className="mx-auto size-7 text-destructive" />
          <p className="mt-1 text-sm font-semibold">{t("lowStockItems")}</p>
          <p className="font-display text-2xl font-bold">{num(lowStock.length, lang)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LedgerCard
          title={t("assets")}
          rows={[
            [t("receivableDue"), money(saleDue, lang)],
            [t("stockValue"), money(stockValue, lang)],
          ]}
        />
        <LedgerCard
          title={t("liabilities")}
          rows={[
            [t("supplierDue"), money(purchaseDue, lang)],
            [t("totalExpense"), money(expenseTotal, lang)],
          ]}
        />
        <LedgerCard
          title={t("cashInOut")}
          rows={[
            [t("cashIn"), money(cashIn, lang)],
            [t("cashOut"), money(cashOut, lang)],
            [t("netCash"), money(cashIn - cashOut, lang)],
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-panel p-4 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{t("last7days")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    color: "var(--card-foreground)",
                  }}
                />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-3 text-lg font-semibold">{t("bestSeller")}</h2>
          {top.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
          <ul className="space-y-2">
            {top.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-muted-foreground">
                  {num(p.qty, lang)} · {money(p.total, lang)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-lg font-semibold">{t("recentTransactions")}</h2>
          </div>
          <div className="flex gap-1 border-b border-border px-3">
            {([
              ["sale", t("sales")],
              ["purchase", t("purchases")],
              ["payment", t("paymentsLedger")],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                  tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <tbody>
                {tab === "sale" &&
                  sales.slice(0, 6).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">#{num(Number(s.invoice_no), lang)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.payment_method}</td>
                      <td className="px-4 py-2 text-right font-semibold">{money(Number(s.total), lang)}</td>
                    </tr>
                  ))}
                {tab === "purchase" &&
                  purchases.slice(0, 6).map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">#{num(Number(p.ref_no), lang)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.purchased_on}</td>
                      <td className="px-4 py-2 text-right font-semibold">{money(Number(p.total), lang)}</td>
                    </tr>
                  ))}
                {tab === "payment" &&
                  payments.slice(0, 6).map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{p.direction === "in" ? "▲" : "▼"} {p.method}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.paid_on}</td>
                      <td className="px-4 py-2 text-right font-semibold">{money(Number(p.amount), lang)}</td>
                    </tr>
                  ))}
                {((tab === "sale" && sales.length === 0) ||
                  (tab === "purchase" && purchases.length === 0) ||
                  (tab === "payment" && payments.length === 0)) && (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-3 text-lg font-semibold">{t("lowStockItems")}</h2>
          {lowStock.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
          <ul className="space-y-2">
            {lowStock.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{lang === "bn" ? p.name_bn : p.name_en}</span>
                <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                  {num(p.stock, lang)} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LedgerCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="surface-panel overflow-hidden p-0">
      <h2 className="border-b border-border px-4 py-3 text-lg font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-muted-foreground">{k}</td>
              <td className="px-4 py-2.5 text-right font-semibold">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
