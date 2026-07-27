import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/audit";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Profit & loss report — SheraPOS" },
      { name: "description", content: "See sales, purchases, expenses, returns and net profit for any date range." },
      { property: "og:title", content: "Profit & loss report — SheraPOS" },
      { property: "og:description", content: "Sales, purchases, expenses and net profit by date range." },
    ],
  }),
  component: ReportsPage,
});

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

type TabKey = "summary" | "daily" | "top" | "stock" | "due";

function ReportsPage() {
  const { t, lang } = useI18n();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(iso(monthStart));
  const [to, setTo] = useState(iso(today));
  const [tab, setTab] = useState<TabKey>("summary");

  const report = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const startIso = new Date(`${from}T00:00:00`).toISOString();
      const endIso = new Date(`${to}T23:59:59`).toISOString();

      const [salesRes, purchasesRes, expensesRes, returnsRes, purchaseReturnsRes, productsRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id,invoice_no,customer_name,total,paid,status,created_at")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase.from("purchases").select("total,paid,purchased_on").gte("purchased_on", from).lte("purchased_on", to),
        supabase.from("expenses").select("amount,spent_on").gte("spent_on", from).lte("spent_on", to),
        supabase.from("sale_returns").select("total,created_at").gte("created_at", startIso).lte("created_at", endIso),
        supabase
          .from("purchase_returns")
          .select("total,created_at")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase.from("products").select("id,name_en,name_bn,sku,stock,unit,cost,price,expiry_date"),
      ]);
      for (const r of [salesRes, purchasesRes, expensesRes, returnsRes, purchaseReturnsRes, productsRes]) {
        if (r.error) throw r.error;
      }

      const finalSales = (salesRes.data ?? []).filter((s) => s.status === "final");
      const saleIds = finalSales.map((s) => s.id);

      let cogs = 0;
      let itemRows: { product_id: string | null; name_snapshot: string; quantity: number; line_total: number }[] = [];
      if (saleIds.length > 0) {
        const { data, error } = await supabase
          .from("sale_items")
          .select("product_id,name_snapshot,quantity,line_total,products(cost)")
          .in("sale_id", saleIds);
        if (error) throw error;
        itemRows = (data ?? []) as unknown as typeof itemRows;
        cogs = (data ?? []).reduce(
          (s, r) => s + Number((r.products as { cost: number } | null)?.cost ?? 0) * Number(r.quantity),
          0,
        );
      }

      const salesTotal = finalSales.reduce((s, r) => s + Number(r.total), 0);
      const salePaid = finalSales.reduce((s, r) => s + Number(r.paid), 0);
      const purchaseTotal = (purchasesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const purchasePaid = (purchasesRes.data ?? []).reduce((s, r) => s + Number(r.paid), 0);
      const expenseTotal = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const returnTotal = (returnsRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const purchaseReturnTotal = (purchaseReturnsRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const gross = salesTotal - returnTotal - cogs;

      const byDay = new Map<string, { total: number; count: number }>();
      for (const s of finalSales) {
        const key = s.created_at.slice(0, 10);
        const cur = byDay.get(key) ?? { total: 0, count: 0 };
        cur.total += Number(s.total);
        cur.count += 1;
        byDay.set(key, cur);
      }

      const byProduct = new Map<string, { name: string; qty: number; total: number }>();
      for (const it of itemRows) {
        const cur = byProduct.get(it.name_snapshot) ?? { name: it.name_snapshot, qty: 0, total: 0 };
        cur.qty += Number(it.quantity);
        cur.total += Number(it.line_total);
        byProduct.set(it.name_snapshot, cur);
      }

      return {
        salesTotal,
        salePaid,
        purchaseTotal,
        purchasePaid,
        expenseTotal,
        returnTotal,
        purchaseReturnTotal,
        cogs,
        gross,
        net: gross - expenseTotal,
        invoices: finalSales.length,
        daily: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
        top: [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 20),
        products: productsRes.data ?? [],
        dueSales: finalSales
          .filter((s) => Number(s.total) - Number(s.paid) > 0)
          .sort((a, b) => Number(b.total) - Number(b.paid) - (Number(a.total) - Number(a.paid))),
      };
    },
  });

  const expiring = useQuery({
    queryKey: ["expiring"],
    queryFn: async () => {
      const limit = new Date();
      limit.setDate(limit.getDate() + 30);
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,stock,expiry_date")
        .not("expiry_date", "is", null)
        .lte("expiry_date", iso(limit))
        .order("expiry_date");
      if (error) throw error;
      return data;
    },
  });

  const r = report.data;
  const pname = (p: { name_en: string; name_bn: string }) => (lang === "bn" ? p.name_bn : p.name_en);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: t("summary") },
    { key: "daily", label: t("dailySales") },
    { key: "top", label: t("topProducts") },
    { key: "stock", label: t("stockReport") },
    { key: "due", label: t("dueReport") },
  ];

  function currentTable(): { headers: string[]; rows: (string | number)[][] } {
    if (!r) return { headers: [], rows: [] };
    if (tab === "daily")
      return {
        headers: [t("date"), t("invoices"), t("totalSales")],
        rows: r.daily.map(([day, v]) => [day, v.count, v.total.toFixed(2)]),
      };
    if (tab === "top")
      return {
        headers: [t("products"), t("qty"), t("total")],
        rows: r.top.map((p) => [p.name, p.qty, p.total.toFixed(2)]),
      };
    if (tab === "stock")
      return {
        headers: [t("products"), "SKU", t("stock"), t("costValue"), t("saleValue")],
        rows: r.products.map((p) => [
          pname(p),
          p.sku,
          p.stock,
          (Number(p.stock) * Number(p.cost ?? 0)).toFixed(2),
          (Number(p.stock) * Number(p.price ?? 0)).toFixed(2),
        ]),
      };
    if (tab === "due")
      return {
        headers: [t("invoice"), t("customer"), t("date"), t("total"), t("paid"), t("due")],
        rows: r.dueSales.map((s) => [
          `#${s.invoice_no}`,
          s.customer_name ?? "-",
          s.created_at.slice(0, 10),
          Number(s.total).toFixed(2),
          Number(s.paid).toFixed(2),
          (Number(s.total) - Number(s.paid)).toFixed(2),
        ]),
      };
    return {
      headers: [t("summary"), t("total")],
      rows: [
        [t("totalSales"), r.salesTotal.toFixed(2)],
        [t("totalReturns"), r.returnTotal.toFixed(2)],
        [t("cogs"), r.cogs.toFixed(2)],
        [t("totalPurchase"), r.purchaseTotal.toFixed(2)],
        [t("purchaseReturn"), r.purchaseReturnTotal.toFixed(2)],
        [t("totalExpense"), r.expenseTotal.toFixed(2)],
        [t("grossProfit"), r.gross.toFixed(2)],
        [t("netProfit"), r.net.toFixed(2)],
      ],
    };
  }

  function exportCsv() {
    const { headers, rows } = currentTable();
    downloadCsv(`report-${tab}-${from}-${to}.csv`, headers, rows);
  }

  function print() {
    const { headers, rows } = currentTable();
    const html = `
      <h2 style="margin:0 0 4px">${t("reports")} · ${tabs.find((x) => x.key === tab)?.label ?? ""}</h2>
      <p style="margin:0 0 8px;font-size:12px">${from} → ${to}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${headers.map((h) => `<th style="border-bottom:1px solid #000;text-align:left;padding:4px">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map((row) => `<tr>${row.map((c) => `<td style="border-bottom:1px solid #ddd;padding:4px">${c}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>`;
    printHtml(html, "a4");
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t("reports")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 size-4" /> {t("exportCsv")}
          </Button>
          <Button variant="outline" size="sm" onClick={print}>
            <Printer className="mr-1 size-4" /> {t("printReport")}
          </Button>
        </div>
      </div>

      <div className="surface-panel mt-4 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label>{t("from")}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("to")}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={() => report.refetch()}>
          {t("view")}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("totalSales")} value={money(r?.salesTotal ?? 0, lang)} />
        <Stat label={t("totalReturns")} value={money(r?.returnTotal ?? 0, lang)} />
        <Stat label={t("totalPurchase")} value={money(r?.purchaseTotal ?? 0, lang)} />
        <Stat label={t("purchaseReturn")} value={money(r?.purchaseReturnTotal ?? 0, lang)} />
        <Stat label={t("cogs")} value={money(r?.cogs ?? 0, lang)} />
        <Stat label={t("totalExpense")} value={money(r?.expenseTotal ?? 0, lang)} />
        <Stat label={t("grossProfit")} value={money(r?.gross ?? 0, lang)} />
        <Stat label={t("netProfit")} value={money(r?.net ?? 0, lang)} highlight />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label={t("invoices")} value={num(r?.invoices ?? 0, lang)} />
        <Stat
          label={t("avgSale")}
          value={money(r && r.invoices > 0 ? r.salesTotal / r.invoices : 0, lang)}
        />
        <Stat label={t("paid")} value={money(r?.salePaid ?? 0, lang)} />
      </div>

      <div className="surface-panel mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap gap-1 border-b border-border px-3">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === x.key ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                {currentTable().headers.map((h, i) => (
                  <th key={h} className={cn("px-4 py-3", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTable().rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((c, ci) => (
                    <td key={ci} className={cn("px-4 py-2.5", ci > 0 ? "text-right font-medium" : "font-medium")}>
                      {typeof c === "number" ? num(c, lang) : c}
                    </td>
                  ))}
                </tr>
              ))}
              {currentTable().rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    {report.isLoading ? t("loading") : t("noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg font-bold">{t("expiringSoon")}</h2>
      <div className="surface-panel mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("products")}</th>
              <th className="px-4 py-3">{t("expiry")}</th>
              <th className="px-4 py-3 text-right">{t("stock")}</th>
            </tr>
          </thead>
          <tbody>
            {(expiring.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{lang === "bn" ? p.name_bn : p.name_en}</td>
                <td className="px-4 py-3 text-destructive">{p.expiry_date}</td>
                <td className="px-4 py-3 text-right">{num(p.stock, lang)}</td>
              </tr>
            ))}
            {(expiring.data ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={highlight ? "font-display text-2xl font-bold text-primary" : "font-display text-2xl font-bold"}>
        {value}
      </p>
    </div>
  );
}
