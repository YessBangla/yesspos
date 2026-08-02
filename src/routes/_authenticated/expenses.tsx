import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Daily Bazar" },
      { name: "description", content: "Track shop expenses by category and keep profit figures accurate." },
      { property: "og:title", content: "Expenses — Daily Bazar" },
      { property: "og:description", content: "Track shop expenses by category." },
    ],
  }),
  component: ExpensesPage,
});

const emptyForm = { title: "", amount: "0", category_id: "", payment_method: "cash", note: "", spent_on: "" };

const schema = z.object({
  title: z.string().trim().min(1).max(80),
  amount: z.number().min(0).max(10_000_000),
  note: z.string().trim().max(200),
});

function ExpensesPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const cats = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const rows = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,title,amount,category_id,payment_method,note,spent_on")
        .order("spent_on", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, amount: Number(form.amount) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").insert({
        title: parsed.data.title,
        amount: parsed.data.amount,
        note: parsed.data.note || null,
        category_id: form.category_id || null,
        payment_method: form.payment_method,
        user_id: userData.user?.id ?? null,
        ...(form.spent_on ? { spent_on: form.spent_on } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void logAudit("expense", { entity: "expense" });
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const total = (rows.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("expenses")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("totalExpense")}: {money(total, lang)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("addExpense")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("title")}</th>
              <th className="px-4 py-3">{t("category")}</th>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("payment")}</th>
              <th className="px-4 py-3 text-right">{t("amount")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((r) => {
              const c = cats.data?.find((x) => x.id === r.category_id);
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c ? (lang === "bn" ? c.name_bn : c.name_en) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.spent_on}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.payment_method}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(Number(r.amount), lang)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {(rows.data ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  {rows.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addExpense")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("title")}</Label>
              <Input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
              <Label>{t("category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("category")} />
                </SelectTrigger>
                <SelectContent>
                  {(cats.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {lang === "bn" ? c.name_bn : c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("note")}</Label>
              <Input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
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
