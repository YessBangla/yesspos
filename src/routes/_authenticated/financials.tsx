import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/financials")({
  head: () => ({
    meta: [
      { title: "Financial statements — Sokoler Bazar" },
      { name: "description", content: "Trial balance, profit & loss and balance sheet generated from your shop transactions." },
      { property: "og:title", content: "Financial statements — Sokoler Bazar" },
      { property: "og:description", content: "Trial balance, profit & loss and balance sheet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancialsPage,
});

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

function FinancialsPage() {
  const { t, lang } = useI18n();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const q = useQuery({
    queryKey: ["financials", from, to],
    queryFn: async () => {
      const start = `${from}T00:00:00`;
      const end = `${to}T23:59:59`;
      const [sales, saleItems, saleReturns, purchaseReturns, purchases, expenses, contacts, products, accounts, txns, lines] = await Promise.all([
        supabase.from("sales").select("total,paid,created_at").gte("created_at", start).lte("created_at", end),
        supabase.from("sale_items").select("quantity,product_id,line_total,sale_id"),
        supabase.from("sale_returns").select("total,created_at").gte("created_at", start).lte("created_at", end),
        supabase.from("purchase_returns").select("total,created_at").gte("created_at", start).lte("created_at", end),
        supabase.from("purchases").select("total,paid,purchased_on").gte("purchased_on", from).lte("purchased_on", to),
        supabase.from("expenses").select("amount,spent_on").gte("spent_on", from).lte("spent_on", to),
        supabase.from("contacts").select("type,opening_balance"),
        supabase.from("products").select("stock,cost"),
        supabase.from("accounts").select("name,opening_balance,type"),
        supabase.from("account_transactions").select("type,amount,account_id,to_account_id"),
        supabase
          .from("journal_lines")
          .select("debit,credit,ledger_accounts(code,name_en,name_bn,class)"),
      ]);
      return {
        sales: sales.data ?? [],
        saleItems: saleItems.data ?? [],
        saleReturns: saleReturns.data ?? [],
        purchaseReturns: purchaseReturns.data ?? [],
        purchases: purchases.data ?? [],
        expenses: expenses.data ?? [],
        contacts: contacts.data ?? [],
        products: products.data ?? [],
        accounts: accounts.data ?? [],
        txns: txns.data ?? [],
        lines: lines.data ?? [],
      };
    },
  });


  const f = useMemo(() => {
    const d = q.data;
    const sum = <T,>(arr: T[], pick: (x: T) => number) => arr.reduce((s, x) => s + pick(x), 0);
    if (!d)
      return {
        revenue: 0, returns: 0, purchaseReturns: 0, purchaseCost: 0, expense: 0, netProfit: 0,
        stockValue: 0, receivable: 0, payable: 0, cash: 0, trial: [] as { name: string; debit: number; credit: number }[],
      };
    const revenue = sum(d.sales, (s) => Number(s.total));
    const returns = sum(d.saleReturns, (s) => Number(s.total));
    const purchaseReturns = sum(d.purchaseReturns, (p) => Number(p.total));
    const purchaseCost = sum(d.purchases, (p) => Number(p.total));
    const expense = sum(d.expenses, (e) => Number(e.amount));
    const stockValue = sum(d.products, (p) => Number(p.stock) * Number(p.cost));
    const receivable = sum(d.sales, (s) => Number(s.total) - Number(s.paid));
    const payable = sum(d.purchases, (p) => Number(p.total) - Number(p.paid));
    // Cash on hand = opening balances plus the net effect of every account movement
    // (transfers net to zero across the two sides, so only deposits/withdrawals shift the total).
    const txnNet = sum(d.txns, (x) =>
      x.type === "deposit" ? Number(x.amount) : x.type === "withdraw" ? -Number(x.amount) : 0,
    );
    const cash = sum(d.accounts, (a) => Number(a.opening_balance)) + txnNet;
    const netProfit = revenue - returns - (purchaseCost - purchaseReturns) - expense;


    const map = new Map<string, { name: string; debit: number; credit: number }>();
    for (const l of d.lines) {
      const h = (l as unknown as { ledger_accounts: { code: string; name_en: string; name_bn: string } | null }).ledger_accounts;
      const key = h ? h.code : "—";
      const name = h ? `${h.code} · ${lang === "bn" ? h.name_bn : h.name_en}` : "—";
      const cur = map.get(key) ?? { name, debit: 0, credit: 0 };
      cur.debit += Number(l.debit);
      cur.credit += Number(l.credit);
      map.set(key, cur);
    }
    return { revenue, returns, purchaseReturns, purchaseCost, expense, netProfit, stockValue, receivable, payable, cash, trial: [...map.values()] };
  }, [q.data, lang]);

  const totalAssets = f.stockValue + f.receivable + f.cash;
  const totalLiab = f.payable;

  const print = () => printHtml(document.getElementById("fin-print")?.innerHTML ?? "", "a4");

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("financials")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("trialBalance")} · {t("profitLoss")} · {t("balanceSheet")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={print}>
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
        </div>
      </div>

      <div id="fin-print">
        <Tabs defaultValue="trial" className="mt-4">
          <TabsList>
            <TabsTrigger value="trial">{t("trialBalance")}</TabsTrigger>
            <TabsTrigger value="pl">{t("profitLoss")}</TabsTrigger>
            <TabsTrigger value="bs">{t("balanceSheet")}</TabsTrigger>
          </TabsList>

          <TabsContent value="trial">
            <div className="surface-panel overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("headName")}</th>
                    <th className="px-4 py-3 text-right">{t("debit")}</th>
                    <th className="px-4 py-3 text-right">{t("credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {f.trial.map((r) => (
                    <tr key={r.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-right">{money(r.debit, lang)}</td>
                      <td className="px-4 py-3 text-right">{money(r.credit, lang)}</td>
                    </tr>
                  ))}
                  {f.trial.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                        {t("noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t border-border font-semibold">
                  <tr>
                    <td className="px-4 py-3">{t("total")}</td>
                    <td className="px-4 py-3 text-right">{money(f.trial.reduce((s, r) => s + r.debit, 0), lang)}</td>
                    <td className="px-4 py-3 text-right">{money(f.trial.reduce((s, r) => s + r.credit, 0), lang)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="pl">
            <div className="surface-panel divide-y divide-border">
              {[
                [t("sales"), f.revenue],
                [t("saleReturns"), -f.returns],
                [t("purchases"), -f.purchaseCost],
                [t("expenses"), -f.expense],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{label as string}</span>
                  <span className={(val as number) < 0 ? "text-destructive" : ""}>{money(val as number, lang)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 font-display text-lg font-bold">
                <span>{t("netProfitLabel")}</span>
                <span className={f.netProfit < 0 ? "text-destructive" : "text-primary"}>{money(f.netProfit, lang)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bs">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="surface-panel divide-y divide-border">
                <p className="px-4 py-3 font-semibold">{t("totalAssets")}</p>
                {[
                  [t("currentBal"), f.cash],
                  [t("stockValue"), f.stockValue],
                  [t("receivable"), f.receivable],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{l as string}</span>
                    <span>{money(v as number, lang)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 font-bold">
                  <span>{t("total")}</span>
                  <span>{money(totalAssets, lang)}</span>
                </div>
              </div>
              <div className="surface-panel divide-y divide-border">
                <p className="px-4 py-3 font-semibold">{t("totalLiabilities")}</p>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{t("payable")}</span>
                  <span>{money(f.payable, lang)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{t("equity")}</span>
                  <span>{money(totalAssets - totalLiab, lang)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 font-bold">
                  <span>{t("total")}</span>
                  <span>{money(totalAssets, lang)}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
