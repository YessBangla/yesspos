import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/stock-adjustments")({
  head: () => ({
    meta: [
      { title: "Stock adjustment — SheraPOS" },
      { name: "description", content: "Correct stock counts and record damaged goods with a full history." },
      { property: "og:title", content: "Stock adjustment — SheraPOS" },
      { property: "og:description", content: "Correct stock counts and record damaged goods." },
    ],
  }),
  component: StockAdjustPage,
});

const emptyForm = { product_id: "", type: "add", quantity: "1", reason: "", adjusted_on: "" };

const schema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().max(200),
});

function StockAdjustPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const products = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku,stock")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const rows = useQuery({
    queryKey: ["stock-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_adjustments")
        .select("id,product_id,type,quantity,reason,adjusted_on")
        .order("adjusted_on", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, quantity: Number(form.quantity) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_adjustments").insert({
        product_id: parsed.data.product_id,
        type: form.type,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason || null,
        user_id: userData.user?.id ?? null,
        ...(form.adjusted_on ? { adjusted_on: form.adjusted_on } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["products-min"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const label = (id: string | null) => {
    const p = products.data?.find((x) => x.id === id);
    if (!p) return "—";
    return lang === "bn" ? p.name_bn : p.name_en;
  };

  const typeLabel = (v: string) => (v === "add" ? t("adjustAdd") : v === "damage" ? t("adjustDamage") : t("adjustRemove"));

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t("stockAdjust")}</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("addAdjust")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("products")}</th>
              <th className="px-3 py-2">{t("type")}</th>
              <th className="px-3 py-2 text-right">{t("quantity")}</th>
              <th className="px-3 py-2">{t("reason")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("noData")}
                </td>
              </tr>
            )}
            {(rows.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.adjusted_on}</td>
                <td className="px-3 py-2">{label(r.product_id)}</td>
                <td className="px-3 py-2">{typeLabel(r.type)}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {r.type === "add" ? "+" : "−"}
                  {num(r.quantity, lang)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addAdjust")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>{t("selectProduct")}</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(lang === "bn" ? p.name_bn : p.name_en) + ` · ${t("stock")} ${p.stock}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">{t("adjustAdd")}</SelectItem>
                    <SelectItem value="remove">{t("adjustRemove")}</SelectItem>
                    <SelectItem value="damage">{t("adjustDamage")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("quantity")}</Label>
                <Input
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={form.adjusted_on}
                onChange={(e) => setForm({ ...form, adjusted_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("reason")}</Label>
              <Input value={form.reason} maxLength={200} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
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
