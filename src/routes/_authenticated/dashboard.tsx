import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Receipt, TrendingUp } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SheraPOS" },
      { name: "description", content: "Daily sales totals, best sellers and low-stock alerts." },
      { property: "og:title", content: "Dashboard — SheraPOS" },
      { property: "og:description", content: "Daily sales, best sellers and low stock at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, lang } = useI18n();

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);

      const [salesRes, productsRes, itemsRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id,invoice_no,total,created_at,customer_name,payment_method")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false }),
        supabase.from("products").select("id,name_en,name_bn,stock,low_stock_at,unit"),
        supabase.from("sale_items").select("name_snapshot,quantity,line_total"),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return { sales: salesRes.data, products: productsRes.data, items: itemsRes.data };
    },
  });

  const sales = stats.data?.sales ?? [];
  const products = stats.data?.products ?? [];
  const items = stats.data?.items ?? [];

  const todayKey = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === todayKey);
  const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const lowStock = products.filter((p) => p.stock <= p.low_stock_at);

  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return {
      day: d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { weekday: "short" }),
      total: sales
        .filter((s) => new Date(s.created_at).toDateString() === key)
        .reduce((sum, s) => sum + Number(s.total), 0),
    };
  });

  const top = Object.values(
    items.reduce<Record<string, { name: string; qty: number; total: number }>>((acc, it) => {
      const key = it.name_snapshot;
      acc[key] ??= { name: key, qty: 0, total: 0 };
      acc[key].qty += it.quantity;
      acc[key].total += Number(it.line_total);
      return acc;
    }, {}),
  )
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const cards = [
    { icon: TrendingUp, label: t("todaySales"), value: money(todayTotal, lang) },
    { icon: Receipt, label: t("todayOrders"), value: num(todaySales.length, lang) },
    { icon: Boxes, label: t("totalProducts"), value: num(products.length, lang) },
    { icon: AlertTriangle, label: t("lowStockItems"), value: num(lowStock.length, lang) },
  ];

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold">{t("dashboard")}</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="surface-panel p-4">
            <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <c.icon className="size-4" />
            </span>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-display text-2xl font-bold">{c.value}</p>
          </div>
        ))}
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
          <h2 className="mb-3 text-lg font-semibold">{t("topProducts")}</h2>
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
        <div className="surface-panel overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">{t("recentSales")}</h2>
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-y border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("invoice")}</th>
                <th className="px-4 py-2">{t("date")}</th>
                <th className="px-4 py-2">{t("payment")}</th>
                <th className="px-4 py-2 text-right">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 8).map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">#{num(Number(s.invoice_no), lang)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.payment_method}</td>
                  <td className="px-4 py-2 text-right font-semibold">{money(Number(s.total), lang)}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    {t("noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-3 text-lg font-semibold">{t("lowStockItems")}</h2>
          {lowStock.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
          <ul className="space-y-2">
            {lowStock.map((p) => (
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
