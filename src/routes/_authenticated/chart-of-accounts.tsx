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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/chart-of-accounts")({
  head: () => ({
    meta: [
      { title: "Chart of accounts — SheraPOS" },
      { name: "description", content: "Maintain asset, liability, income, expense and equity heads for your shop accounting." },
      { property: "og:title", content: "Chart of accounts — SheraPOS" },
      { property: "og:description", content: "Asset, liability, income, expense and equity heads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChartOfAccountsPage,
});

const CLASSES = ["asset", "liability", "income", "expense", "equity"] as const;

const empty = { code: "", name_en: "", name_bn: "", class: "expense" };

const schema = z.object({
  code: z.string().trim().min(1).max(20),
  name_en: z.string().trim().min(1).max(80),
  name_bn: z.string().trim().min(1).max(80),
});

function ChartOfAccountsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const classLabel = (c: string) =>
    c === "asset" ? t("asset") : c === "liability" ? t("liability") : c === "income" ? t("income") : c === "equity" ? t("equity") : t("expenseClass");

  const rows = useQuery({
    queryKey: ["ledger-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_accounts").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("ledger_accounts").insert({ ...parsed.data, class: form.class });
      if (error) throw error;
    },
    onSuccess: () => {
      void logAudit("ledger_account", { entity: "ledger_account" });
      setOpen(false);
      setForm({ ...empty });
      qc.invalidateQueries({ queryKey: ["ledger-accounts"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ledger_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger-accounts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("chartOfAccounts")}</h1>
          <p className="text-sm text-muted-foreground">{t("chartHint")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("add")}
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {CLASSES.map((c) => (
          <div key={c} className="surface-panel p-4">
            <h2 className="font-semibold">{classLabel(c)}</h2>
            <div className="mt-2 divide-y divide-border">
              {(rows.data ?? [])
                .filter((r) => r.class === c)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="text-muted-foreground">{r.code}</span> · {lang === "bn" ? r.name_bn : r.name_en}
                    </span>
                    <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remove.mutate(r.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              {(rows.data ?? []).filter((r) => r.class === c).length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">{t("noData")}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chartOfAccounts")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("code")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accClass")}</Label>
              <Select value={form.class} onValueChange={(v) => setForm({ ...form, class: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {classLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("headName")} (EN)</Label>
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("headName")} (বাংলা)</Label>
              <Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
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
