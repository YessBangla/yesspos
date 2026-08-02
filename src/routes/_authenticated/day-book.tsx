import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { downloadCsv } from "@/lib/audit";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/day-book")({
  head: () => ({
    meta: [
      { title: "Day book — Bazar Bari" },
      { name: "description", content: "See every sale, purchase, payment, expense and account movement of a single day." },
      { property: "og:title", content: "Day book — Bazar Bari" },
      { property: "og:description", content: "All money in and out for a single day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayBookPage,
});

const today = () => new Date().toISOString().slice(0, 10);

type Row = { source: string; particulars: string; inAmt: number; outAmt: number };

function DayBookPage() {
  const { t, lang } = useI18n();
  const [date, setDate] = useState(today());

  const data = useQuery({
    queryKey: ["day-book", date],
    queryFn: async () => {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;
      const [sales, purchases, payments, expenses, accTxns] = await Promise.all([
        supabase.from("sales").select("invoice_no,total,paid,created_at").gte("created_at", start).lte("created_at", end),
        supabase.from("purchases").select("ref_no,total,paid,purchased_on").eq("purchased_on", date),
        supabase.from("payments").select("amount,direction,method,paid_on").eq("paid_on", date),
        supabase.from("expenses").select("title,amount,spent_on").eq("spent_on", date),
        supabase.from("account_transactions").select("type,amount,note,txn_date").eq("txn_date", date),
      ]);
      return {
        sales: sales.data ?? [],
        purchases: purchases.data ?? [],
        payments: payments.data ?? [],
        expenses: expenses.data ?? [],
        accTxns: accTxns.data ?? [],
      };
    },
  });

  const rows: Row[] = useMemo(() => {
    const d = data.data;
    if (!d) return [];
    const out: Row[] = [];
    for (const s of d.sales)
      out.push({ source: t("sales"), particulars: `#${s.invoice_no}`, inAmt: Number(s.paid), outAmt: 0 });
    for (const p of d.purchases)
      out.push({ source: t("purchases"), particulars: `#${p.ref_no}`, inAmt: 0, outAmt: Number(p.paid) });
    for (const p of d.payments)
      out.push({
        source: t("paymentsLedger"),
        particulars: p.method,
        inAmt: p.direction === "in" ? Number(p.amount) : 0,
        outAmt: p.direction === "out" ? Number(p.amount) : 0,
      });
    for (const e of d.expenses) out.push({ source: t("expenses"), particulars: e.title, inAmt: 0, outAmt: Number(e.amount) });
    for (const a of d.accTxns)
      out.push({
        source: t("accounts"),
        particulars: `${a.type} ${a.note ?? ""}`.trim(),
        inAmt: a.type === "deposit" ? Number(a.amount) : 0,
        outAmt: a.type === "withdraw" ? Number(a.amount) : 0,
      });
    return out;
  }, [data.data, t]);

  const totalIn = rows.reduce((s, r) => s + r.inAmt, 0);
  const totalOut = rows.reduce((s, r) => s + r.outAmt, 0);

  const print = () => {
    const body = rows
      .map(
        (r) =>
          `<tr><td>${r.source}</td><td>${r.particulars}</td><td style="text-align:right">${r.inAmt || ""}</td><td style="text-align:right">${r.outAmt || ""}</td></tr>`,
      )
      .join("");
    printHtml(
      `<h2 style="margin:0 0 8px">${t("dayBook")} · ${date}</h2>
       <table style="width:100%;border-collapse:collapse" border="1" cellpadding="4">
         <thead><tr><th>${t("source")}</th><th>${t("particulars")}</th><th>${t("moneyIn")}</th><th>${t("moneyOut")}</th></tr></thead>
         <tbody>${body}</tbody>
         <tfoot><tr><th colspan="2">${t("total")}</th><th style="text-align:right">${totalIn}</th><th style="text-align:right">${totalOut}</th></tr></tfoot>
       </table>`,
      "a4",
    );
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("dayBook")}</h1>
          <p className="text-sm text-muted-foreground">{t("dayBookHint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>{t("date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `day-book-${date}.csv`,
                [t("source"), t("particulars"), t("moneyIn"), t("moneyOut")],
                rows.map((r) => [r.source, r.particulars, r.inAmt, r.outAmt]),
              )
            }
          >
            <Download className="mr-1 size-4" /> CSV
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("moneyIn")}</p>
          <p className="mt-1 font-display text-xl font-bold text-primary">{money(totalIn, lang)}</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("moneyOut")}</p>
          <p className="mt-1 font-display text-xl font-bold text-destructive">{money(totalOut, lang)}</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("balanceCol")}</p>
          <p className="mt-1 font-display text-xl font-bold">{money(totalIn - totalOut, lang)}</p>
        </div>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("source")}</th>
              <th className="px-4 py-3">{t("particulars")}</th>
              <th className="px-4 py-3 text-right">{t("moneyIn")}</th>
              <th className="px-4 py-3 text-right">{t("moneyOut")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{r.source}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.particulars}</td>
                <td className="px-4 py-3 text-right text-primary">{r.inAmt ? money(r.inAmt, lang) : "—"}</td>
                <td className="px-4 py-3 text-right text-destructive">{r.outAmt ? money(r.outAmt, lang) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                  {data.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
