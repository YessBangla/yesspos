import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";
import { useActiveBranch } from "@/lib/active-branch";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/stock-count")({
  head: () => ({
    meta: [
      { title: "Stock count — SokolerBazar" },
      { name: "description", content: "Count physical stock per branch and reconcile differences in one click." },
      { property: "og:title", content: "Stock count — SokolerBazar" },
      { property: "og:description", content: "Physical stock counting and reconciliation for every branch." },
    ],
  }),
  component: StockCountPage,
});

type Line = { product_id: string; name: string; system_qty: number; counted_qty: string };

function StockCountPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { branchId } = useActiveBranch();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState("");

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

  const stock = useQuery({
    queryKey: ["branch-stock", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id,stock")
        .eq("branch_id", branchId as string);
      if (error) throw error;
      return new Map<string, number>((data ?? []).map((r) => [r.product_id, Number(r.stock ?? 0)]));
    },
  });

  const counts = useQuery({
    queryKey: ["stock-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_counts")
        .select("id,count_date,note,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  function addLine(productId: string) {
    const p = products.data?.find((x) => x.id === productId);
    if (!p || lines.some((l) => l.product_id === productId)) return;
    const sys = stock.data?.get(productId) ?? Number(p.stock ?? 0);
    setLines((ls) => [
      ...ls,
      { product_id: p.id, name: lang === "bn" ? p.name_bn : p.name_en, system_qty: sys, counted_qty: String(sys) },
    ]);
    setPicker("");
  }

  const save = useMutation({
    mutationFn: async (apply: boolean) => {
      if (lines.length === 0) throw new Error(t("noItems"));
      const { data: userData } = await supabase.auth.getUser();
      const { data: head, error } = await supabase
        .from("stock_counts")
        .insert({
          branch_id: branchId,
          note: note || null,
          status: apply ? "completed" : "draft",
          user_id: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = lines.map((l) => ({
        count_id: head.id,
        product_id: l.product_id,
        name_snapshot: l.name,
        system_qty: l.system_qty,
        counted_qty: Number(l.counted_qty) || 0,
      }));
      const { error: itemErr } = await supabase.from("stock_count_items").insert(items);
      if (itemErr) throw itemErr;

      if (apply) {
        const adjustments = lines
          .map((l) => ({ ...l, diff: (Number(l.counted_qty) || 0) - l.system_qty }))
          .filter((l) => l.diff !== 0)
          .map((l) => ({
            product_id: l.product_id,
            branch_id: branchId,
            type: l.diff > 0 ? "add" : "remove",
            quantity: Math.abs(l.diff),
            reason: `Stock count${note ? ` — ${note}` : ""}`,
            user_id: userData.user?.id ?? null,
          }));
        if (adjustments.length > 0) {
          const { error: adjErr } = await supabase.from("stock_adjustments").insert(adjustments);
          if (adjErr) throw adjErr;
        }
      }
      return apply;
    },
    onSuccess: (applied) => {
      void logAudit("stock_adjust", { entity: "stock_count" });
      setOpen(false);
      setLines([]);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-min"] });
      toast.success(applied ? t("countApplied") : t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("stockCount")}</h1>
          <p className="text-sm text-muted-foreground">{t("stockCountHint")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("newCount")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("note")}</th>
              <th className="px-3 py-2">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {(counts.data ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  {t("noData")}
                </td>
              </tr>
            )}
            {(counts.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2">{c.count_date}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.note ?? ""}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.status === "completed"
                        ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {c.status === "completed" ? t("countCompleted") : t("draft")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("newCount")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>{t("note")}</Label>
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("selectProduct")}</Label>
              <Select value={picker} onValueChange={addLine}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {lang === "bn" ? p.name_bn : p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-2 py-2">{t("products")}</th>
                    <th className="px-2 py-2 text-right">{t("systemQty")}</th>
                    <th className="px-2 py-2 text-right">{t("countedQty")}</th>
                    <th className="px-2 py-2 text-right">{t("difference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-5 text-center text-muted-foreground">
                        {t("noItems")}
                      </td>
                    </tr>
                  )}
                  {lines.map((l, i) => {
                    const diff = (Number(l.counted_qty) || 0) - l.system_qty;
                    return (
                      <tr key={l.product_id} className="border-t border-border">
                        <td className="px-2 py-1.5">{l.name}</td>
                        <td className="px-2 py-1.5 text-right">{num(l.system_qty, lang)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Input
                            className="ml-auto h-8 w-24 text-right"
                            inputMode="numeric"
                            value={l.counted_qty}
                            onChange={(e) =>
                              setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, counted_qty: e.target.value } : x)))
                            }
                          />
                        </td>
                        <td
                          className={
                            diff === 0
                              ? "px-2 py-1.5 text-right text-muted-foreground"
                              : diff > 0
                                ? "px-2 py-1.5 text-right font-semibold text-success"
                                : "px-2 py-1.5 text-right font-semibold text-destructive"
                          }
                        >
                          {diff > 0 ? "+" : ""}
                          {num(diff, lang)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate(false)}>
                <Save className="mr-1 size-4" /> {t("save")}
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
                <Check className="mr-1 size-4" /> {t("applyDifference")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
