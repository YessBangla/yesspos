import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments & due — SheraPOS" },
      { name: "description", content: "Collect customer dues, pay suppliers and track every balance in one ledger." },
      { property: "og:title", content: "Payments & due — SheraPOS" },
      { property: "og:description", content: "Customer dues, supplier payments and balances." },
    ],
  }),
  component: PaymentsPage,
});

const emptyForm = {
  contact_id: "",
  direction: "in",
  amount: "0",
  method: "cash",
  note: "",
  paid_on: "",
};

const schema = z.object({
  contact_id: z.string().uuid("Select a customer or supplier"),
  amount: z.number().positive().max(10_000_000),
  note: z.string().trim().max(200),
});

function PaymentsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name,type,opening_balance").order("name");
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,contact_id,direction,amount,method,note,paid_on")
        .order("paid_on", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const sales = useQuery({
    queryKey: ["sales-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("contact_id,total,paid").limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const purchases = useQuery({
    queryKey: ["purchase-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("supplier_id,total,paid").limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const balances = useMemo(() => {
    const map = new Map<string, { name: string; type: string; balance: number }>();
    for (const c of contacts.data ?? []) {
      map.set(c.id, { name: c.name, type: c.type, balance: Number(c.opening_balance ?? 0) });
    }
    for (const s of sales.data ?? []) {
      if (!s.contact_id) continue;
      const row = map.get(s.contact_id);
      if (row) row.balance += Number(s.total) - Number(s.paid);
    }
    for (const p of purchases.data ?? []) {
      if (!p.supplier_id) continue;
      const row = map.get(p.supplier_id);
      if (row) row.balance -= Number(p.total) - Number(p.paid);
    }
    for (const pay of payments.data ?? []) {
      if (!pay.contact_id) continue;
      const row = map.get(pay.contact_id);
      if (row) row.balance += pay.direction === "in" ? -Number(pay.amount) : Number(pay.amount);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .filter((r) => Math.abs(r.balance) > 0.009)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [contacts.data, sales.data, purchases.data, payments.data]);

  const totalIn = (payments.data ?? [])
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (payments.data ?? [])
    .filter((p) => p.direction === "out")
    .reduce((s, p) => s + Number(p.amount), 0);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, amount: Number(form.amount) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        contact_id: parsed.data.contact_id,
        direction: form.direction,
        amount: parsed.data.amount,
        method: form.method,
        note: parsed.data.note || null,
        user_id: userData.user?.id ?? null,
        ...(form.paid_on ? { paid_on: form.paid_on } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void logAudit("payment", { entity: "payment" });
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const contactName = (id: string | null) => contacts.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("paymentsLedger")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("totalReceived")}: {money(totalIn, lang)} · {t("totalPaidOut")}: {money(totalOut, lang)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("addPayment")}
        </Button>
      </div>

      <div className="surface-panel mt-4 p-4">
        <h2 className="font-semibold">{t("balances")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {balances.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
          {balances.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="truncate text-sm font-medium">{b.name}</span>
              <span className={b.balance >= 0 ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-destructive"}>
                {b.balance >= 0 ? t("receivable") : t("payable")} {money(Math.abs(b.balance), lang)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("party")}</th>
              <th className="px-3 py-2">{t("type")}</th>
              <th className="px-3 py-2">{t("payment")}</th>
              <th className="px-3 py-2 text-right">{t("amount")}</th>
              <th className="px-3 py-2 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(payments.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">{p.paid_on}</td>
                <td className="px-3 py-2">{contactName(p.contact_id)}</td>
                <td className="px-3 py-2">{p.direction === "in" ? t("moneyIn") : t("moneyOut")}</td>
                <td className="px-3 py-2">{p.method}</td>
                <td className="px-3 py-2 text-right font-medium">{money(Number(p.amount), lang)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addPayment")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>{t("party")}</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("party")} />
                </SelectTrigger>
                <SelectContent>
                  {(contacts.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.type === "supplier" ? t("suppliers") : t("customers")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("type")}</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{t("moneyIn")}</SelectItem>
                    <SelectItem value="out">{t("moneyOut")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("amount")}</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("payment")}</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="card">{t("card")}</SelectItem>
                    <SelectItem value="mobile">{t("mobile")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("date")}</Label>
                <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("note")}</Label>
              <Input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
