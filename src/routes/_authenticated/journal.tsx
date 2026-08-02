import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal vouchers — Daily Bazar" },
      { name: "description", content: "Record manual double-entry debit and credit vouchers for your shop accounts." },
      { property: "og:title", content: "Journal vouchers — Daily Bazar" },
      { property: "og:description", content: "Manual double-entry debit and credit vouchers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JournalPage,
});

type LineForm = { ledger_account_id: string; account_id: string; debit: string; credit: string; note: string };

const emptyLine: LineForm = { ledger_account_id: "", account_id: "", debit: "0", credit: "0", note: "" };

function JournalPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }, { ...emptyLine }]);

  const heads = useQuery({
    queryKey: ["ledger-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_accounts").select("id,code,name_en,name_bn,class").order("code");
      if (error) throw error;
      return data;
    },
  });

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const entries = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id,voucher_no,entry_date,narration,reference,journal_lines(id,debit,credit,note,ledger_account_id,account_id)")
        .order("entry_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const headName = (id: string | null) => {
    const h = heads.data?.find((x) => x.id === id);
    return h ? `${h.code} · ${lang === "bn" ? h.name_bn : h.name_en}` : "—";
  };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const reset = () => {
    setLines([{ ...emptyLine }, { ...emptyLine }]);
    setNarration("");
    setReference("");
    setEntryDate("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const usable = lines.filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
      if (usable.length < 2) throw new Error(t("notBalanced"));
      if (Math.abs(totalDebit - totalCredit) > 0.009 || totalDebit <= 0) throw new Error(t("notBalanced"));
      const { data: userData } = await supabase.auth.getUser();
      const { data: entry, error } = await supabase
        .from("journal_entries")
        .insert({
          narration: narration || null,
          reference: reference || null,
          user_id: userData.user?.id ?? null,
          ...(entryDate ? { entry_date: entryDate } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: lineErr } = await supabase.from("journal_lines").insert(
        usable.map((l) => ({
          entry_id: entry.id,
          ledger_account_id: l.ledger_account_id || null,
          account_id: l.account_id || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          note: l.note || null,
        })),
      );
      if (lineErr) throw lineErr;
    },
    onSuccess: () => {
      void logAudit("journal_entry", { entity: "journal_entry" });
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal-entries"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("journal")}</h1>
          <p className="text-sm text-muted-foreground">{t("journalHint")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("addVoucher")}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {(entries.data ?? []).map((e) => {
          const dr = (e.journal_lines ?? []).reduce((s, l) => s + Number(l.debit), 0);
          return (
            <div key={e.id} className="surface-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    #{e.voucher_no} · {e.entry_date}
                  </p>
                  <p className="text-sm text-muted-foreground">{e.narration ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold">{money(dr, lang)}</span>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remove.mutate(e.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1">{t("headName")}</th>
                    <th className="py-1 text-right">{t("debit")}</th>
                    <th className="py-1 text-right">{t("credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(e.journal_lines ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-1">{headName(l.ledger_account_id)}</td>
                      <td className="py-1 text-right">{Number(l.debit) ? money(Number(l.debit), lang) : "—"}</td>
                      <td className="py-1 text-right">{Number(l.credit) ? money(Number(l.credit), lang) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {(entries.data ?? []).length === 0 && (
          <p className="surface-panel p-6 text-sm text-muted-foreground">{entries.isLoading ? t("loading") : t("noData")}</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("addVoucher")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("reference")}</Label>
              <Input value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("narration")}</Label>
              <Input value={narration} maxLength={200} onChange={(e) => setNarration(e.target.value)} />
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Select
                    value={l.ledger_account_id}
                    onValueChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, ledger_account_id: v } : x)))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("headName")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(heads.data ?? []).map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.code} · {lang === "bn" ? h.name_bn : h.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Select
                    value={l.account_id}
                    onValueChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, account_id: v } : x)))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("accounts")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="sm:col-span-2"
                  inputMode="decimal"
                  placeholder={t("debit")}
                  value={l.debit}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, debit: e.target.value } : x)))}
                />
                <Input
                  className="sm:col-span-2"
                  inputMode="decimal"
                  placeholder={t("credit")}
                  value={l.credit}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, credit: e.target.value } : x)))}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { ...emptyLine }])}>
              <Plus className="mr-1 size-4" /> {t("addLine")}
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span>
              {t("totalDebit")}: <b>{money(totalDebit, lang)}</b>
            </span>
            <span>
              {t("totalCredit")}: <b>{money(totalCredit, lang)}</b>
            </span>
            <span className={Math.abs(totalDebit - totalCredit) < 0.009 ? "text-primary" : "text-destructive"}>
              {Math.abs(totalDebit - totalCredit) < 0.009 ? "✓" : t("notBalanced")}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
