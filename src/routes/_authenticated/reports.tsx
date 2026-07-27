import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";

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

function ReportsPage() {
  const { t, lang } = useI18n();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(iso(monthStart));
  const [to, setTo] = useState(iso(today));

  const report = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const startIso = new Date(`${from}T00:00:00`).toISOString();
      const endIso = new Date(`${to}T23:59:59`).toISOString();

      const [salesRes, purchasesRes, expensesRes, returnsRes] = await Promise.all([
        supabase.from("sales").select("id,total,status,created_at").gte("created_at", startIso).lte("created_at", endIso),
        supabase.from("purchases").select("total,purchased_on").gte("purchased_on", from).lte("purchased_on", to),
        supabase.from("expenses").select("amount,spent_on").gte("spent_on", from).lte("spent_on", to),
        supabase.from("sale_returns").select("total,created_at").gte("created_at", startIso).lte("created_at", endIso),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (returnsRes.error) throw returnsRes.error;

      const finalSales = (salesRes.data ?? []).filter((s) => s.status === "final");
      const saleIds = finalSales.map((s) => s.id);

      let cogs = 0;
      if (saleIds.length > 0) {
        const { data: itemRows, error } = await supabase
          .from("sale_items")
          .select("product_id,quantity,products(cost)")
          .in("sale_id", saleIds);
        if (error) throw error;
        cogs = (itemRows ?? []).reduce(
          (s, r) => s + Number((r.products as { cost: number } | null)?.cost ?? 0) * Number(r.quantity),
          0,
        );
      }

      const salesTotal = finalSales.reduce((s, r) => s + Number(r.total), 0);
      const purchaseTotal = (purchasesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const expenseTotal = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const returnTotal = (returnsRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const gross = salesTotal - returnTotal - cogs;

      return {
        salesTotal,
        purchaseTotal,
        expenseTotal,
        returnTotal,
        gross,
        net: gross - expenseTotal,
        invoices: finalSales.length,
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

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold">{t("reports")}</h1>

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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label={t("totalSales")} value={money(r?.salesTotal ?? 0, lang)} />
        <Stat label={t("totalReturns")} value={money(r?.returnTotal ?? 0, lang)} />
        <Stat label={t("totalPurchase")} value={money(r?.purchaseTotal ?? 0, lang)} />
        <Stat label={t("totalExpense")} value={money(r?.expenseTotal ?? 0, lang)} />
        <Stat label={t("grossProfit")} value={money(r?.gross ?? 0, lang)} />
        <Stat label={t("netProfit")} value={money(r?.net ?? 0, lang)} highlight />
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
