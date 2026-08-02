import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { downloadCsv } from "@/lib/audit";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/party-statement")({
  head: () => ({
    meta: [
      { title: "Party statement — Daily Bazar" },
      { name: "description", content: "Full running ledger of sales, purchases and payments for any customer or supplier." },
      { property: "og:title", content: "Party statement — Daily Bazar" },
      { property: "og:description", content: "Running ledger for any customer or supplier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartyStatementPage,
});

function PartyStatementPage() {
  const { t, lang } = useI18n();
  const [contactId, setContactId] = useState("");

  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name,type,opening_balance").order("name");
      if (error) throw error;
      return data;
    },
  });

  const contact = contacts.data?.find((c) => c.id === contactId);

  const ledger = useQuery({
    queryKey: ["party-statement", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const [sales, purchases, payments] = await Promise.all([
        supabase.from("sales").select("invoice_no,total,paid,created_at").eq("contact_id", contactId),
        supabase.from("purchases").select("ref_no,total,paid,purchased_on").eq("supplier_id", contactId),
        supabase.from("payments").select("amount,direction,method,paid_on").eq("contact_id", contactId),
      ]);
      return { sales: sales.data ?? [], purchases: purchases.data ?? [], payments: payments.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    const d = ledger.data;
    if (!d) return [] as { date: string; particulars: string; debit: number; credit: number }[];
    const out: { date: string; particulars: string; debit: number; credit: number }[] = [];
    for (const s of d.sales)
      out.push({ date: s.created_at.slice(0, 10), particulars: `${t("sales")} #${s.invoice_no}`, debit: Number(s.total), credit: Number(s.paid) });
    for (const p of d.purchases)
      out.push({ date: p.purchased_on, particulars: `${t("purchases")} #${p.ref_no}`, debit: Number(p.paid), credit: Number(p.total) });
    for (const p of d.payments)
      out.push({
        date: p.paid_on,
        particulars: `${t("payment")} · ${p.method}`,
        debit: p.direction === "out" ? Number(p.amount) : 0,
        credit: p.direction === "in" ? Number(p.amount) : 0,
      });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [ledger.data, t]);

  const opening = Number(contact?.opening_balance ?? 0);
  let running = opening;
  const withBalance = rows.map((r) => {
    running += r.debit - r.credit;
    return { ...r, balance: running };
  });

  const print = () => {
    const body = withBalance
      .map(
        (r) =>
          `<tr><td>${r.date}</td><td>${r.particulars}</td><td style="text-align:right">${r.debit || ""}</td><td style="text-align:right">${r.credit || ""}</td><td style="text-align:right">${r.balance.toFixed(2)}</td></tr>`,
      )
      .join("");
    printHtml(
      `<h2 style="margin:0 0 8px">${t("partyStatement")} — ${contact?.name ?? ""}</h2>
       <table style="width:100%;border-collapse:collapse" border="1" cellpadding="4">
         <thead><tr><th>${t("date")}</th><th>${t("particulars")}</th><th>${t("debit")}</th><th>${t("credit")}</th><th>${t("balanceCol")}</th></tr></thead>
         <tbody>${body}</tbody>
       </table>
       <p><b>${t("closingBalance")}: ${running.toFixed(2)}</b></p>`,
      "a4",
    );
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("partyStatement")}</h1>
          <p className="text-sm text-muted-foreground">{t("partyStatementHint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>{t("contacts")}</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t("selectCustomer")} />
              </SelectTrigger>
              <SelectContent>
                {(contacts.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!contactId}
            onClick={() =>
              downloadCsv(
                `party-statement-${contact?.name ?? "party"}.csv`,
                [t("date"), t("particulars"), t("debit"), t("credit"), t("balanceCol")],
                withBalance.map((r) => [r.date, r.particulars, r.debit, r.credit, r.balance]),
              )
            }
          >
            <Download className="mr-1 size-4" /> CSV
          </Button>
          <Button variant="outline" disabled={!contactId} onClick={print}>
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
        </div>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("particulars")}</th>
              <th className="px-4 py-3 text-right">{t("debit")}</th>
              <th className="px-4 py-3 text-right">{t("credit")}</th>
              <th className="px-4 py-3 text-right">{t("balanceCol")}</th>
            </tr>
          </thead>
          <tbody>
            {contactId && (
              <tr className="border-b border-border text-muted-foreground">
                <td className="px-4 py-3" colSpan={4}>
                  {t("openingBal")}
                </td>
                <td className="px-4 py-3 text-right">{money(opening, lang)}</td>
              </tr>
            )}
            {withBalance.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3">{r.particulars}</td>
                <td className="px-4 py-3 text-right">{r.debit ? money(r.debit, lang) : "—"}</td>
                <td className="px-4 py-3 text-right">{r.credit ? money(r.credit, lang) : "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{money(r.balance, lang)}</td>
              </tr>
            ))}
            {(!contactId || withBalance.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-border font-semibold">
            <tr>
              <td className="px-4 py-3" colSpan={4}>
                {t("closingBalance")}
              </td>
              <td className="px-4 py-3 text-right">{money(running, lang)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
