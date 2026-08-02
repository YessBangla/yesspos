import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
import { money, num, useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases & stock-in — Daily Bazar" },
      { name: "description", content: "Record supplier purchases and increase stock automatically." },
      { property: "og:title", content: "Purchases & stock-in — Daily Bazar" },
      { property: "og:description", content: "Record supplier purchases and stock-in." },
    ],
  }),
  component: PurchasesPage,
});

type Product = { id: string; name_en: string; name_bn: string; sku: string; cost: number; unit: string };
type Line = { product: Product; qty: number; cost: string };
type PurchaseRow = {
  id: string;
  ref_no: number;
  total: number;
  paid: number;
  purchased_on: string;
  supplier_id: string | null;
  note: string | null;
};

function PurchasesPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [paid, setPaid] = useState("0");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [returning, setReturning] = useState<PurchaseRow | null>(null);
  const [retQtys, setRetQtys] = useState<Record<string, string>>({});
  const [retReason, setRetReason] = useState("");


  const suppliers = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name_en");
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const purchases = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id,ref_no,total,paid,purchased_on,supplier_id,note")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const total = lines.reduce((s, l) => s + (Number(l.cost) || 0) * l.qty, 0);

  function addLine(id: string) {
    const p = (products.data ?? []).find((x) => x.id === id);
    if (!p) return;
    setLines((prev) =>
      prev.some((l) => l.product.id === id)
        ? prev.map((l) => (l.product.id === id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { product: p, qty: 1, cost: String(p.cost) }],
    );
    setPick("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error(t("noData"));
      const { data: userData } = await supabase.auth.getUser();
      const { data: purchase, error } = await supabase
        .from("purchases")
        .insert({
          supplier_id: supplierId || null,
          user_id: userData.user?.id ?? null,
          total,
          paid: Number(paid) || 0,
          note: note.trim().slice(0, 200) || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = lines.map((l) => ({
        purchase_id: purchase.id,
        product_id: l.product.id,
        name_snapshot: lang === "bn" ? l.product.name_bn : l.product.name_en,
        unit_cost: Number(l.cost) || 0,
        quantity: l.qty,
        line_total: (Number(l.cost) || 0) * l.qty,
      }));
      const { error: itemsError } = await supabase.from("purchase_items").insert(items);
      if (itemsError) throw itemsError;

      for (const l of lines) {
        await supabase.from("products").update({ cost: Number(l.cost) || 0 }).eq("id", l.product.id);
      }
    },
    onSuccess: () => {
      void logAudit("purchase", { entity: "purchase" });
      setOpen(false);
      setLines([]);
      setPaid("0");
      setNote("");
      setSupplierId("");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const retItems = useQuery({
    queryKey: ["purchase-items", returning?.id],
    enabled: !!returning,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("id,product_id,name_snapshot,unit_cost,quantity")
        .eq("purchase_id", returning!.id);
      if (error) throw error;
      return data;
    },
  });

  const submitReturn = useMutation({
    mutationFn: async () => {
      const rows = (retItems.data ?? [])
        .map((i) => ({ i, q: Math.min(Number(retQtys[i.id]) || 0, i.quantity) }))
        .filter((r) => r.q > 0);
      if (rows.length === 0) throw new Error(t("noData"));
      const total = rows.reduce((s, r) => s + Number(r.i.unit_cost) * r.q, 0);
      const { data: userData } = await supabase.auth.getUser();
      const { data: ret, error } = await supabase
        .from("purchase_returns")
        .insert({
          purchase_id: returning!.id,
          supplier_id: returning!.supplier_id,
          user_id: userData.user?.id ?? null,
          total,
          reason: retReason.trim().slice(0, 200) || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase.from("purchase_return_items").insert(
        rows.map((r) => ({
          return_id: ret.id,
          product_id: r.i.product_id,
          name_snapshot: r.i.name_snapshot,
          unit_cost: Number(r.i.unit_cost),
          quantity: r.q,
          line_total: Number(r.i.unit_cost) * r.q,
        })),
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      void logAudit("purchase", { entity: "purchase_return" });
      setReturning(null);
      setRetQtys({});
      setRetReason("");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(t("purchaseReturn"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  const supplierList = useMemo(
    () => (suppliers.data ?? []).filter((c) => c.type === "supplier"),
    [suppliers.data],
  );

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("purchases")}</h1>
          <p className="text-sm text-muted-foreground">{t("purchaseNote")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("addPurchase")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">{t("supplier")}</th>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3 text-right">{t("total")}</th>
              <th className="px-4 py-3 text-right">{t("paid")}</th>
              <th className="px-4 py-3 text-right">{t("due")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(purchases.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{num(Number(p.ref_no), lang)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {supplierList.find((s) => s.id === p.supplier_id)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.purchased_on}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(Number(p.total), lang)}</td>
                <td className="px-4 py-3 text-right">{money(Number(p.paid), lang)}</td>
                <td className="px-4 py-3 text-right text-destructive">
                  {money(Math.max(Number(p.total) - Number(p.paid), 0), lang)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReturning(p as PurchaseRow);
                      setRetQtys({});
                      setRetReason("");
                    }}
                  >
                    <RotateCcw className="mr-1 size-4" /> {t("returnPurchase")}
                  </Button>
                </td>
              </tr>
            ))}
            {(purchases.data ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  {purchases.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("addPurchase")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("supplier")}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("supplier")} />
                </SelectTrigger>
                <SelectContent>
                  {supplierList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "bn" ? "পণ্য যোগ করুন" : "Add product"}</Label>
              <Select value={pick} onValueChange={addLine}>
                <SelectTrigger>
                  <SelectValue placeholder={t("products")} />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {lang === "bn" ? p.name_bn : p.name_en} · {p.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("noData")}</p>}
            {lines.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {lang === "bn" ? l.product.name_bn : l.product.name_en}
                </p>
                <Input
                  className="h-8 w-24"
                  inputMode="decimal"
                  value={l.cost}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) => (x.product.id === l.product.id ? { ...x, cost: e.target.value } : x)),
                    )
                  }
                />
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    onClick={() =>
                      setLines((prev) =>
                        prev
                          .map((x) => (x.product.id === l.product.id ? { ...x, qty: x.qty - 1 } : x))
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{num(l.qty, lang)}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    onClick={() =>
                      setLines((prev) =>
                        prev.map((x) => (x.product.id === l.product.id ? { ...x, qty: x.qty + 1 } : x)),
                      )
                    }
                  >
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
                <span className="w-20 text-right text-sm font-semibold">
                  {money((Number(l.cost) || 0) * l.qty, lang)}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("paid")}</Label>
              <Input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("note")}</Label>
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-display text-lg font-bold">
              {t("total")}: <span className="text-primary">{money(total, lang)}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLines([])}>
                <Trash2 className="mr-1 size-4" /> {t("clear")}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || lines.length === 0}>
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("returnPurchase")} · #{returning ? num(Number(returning.ref_no), lang) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {retItems.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
            {(retItems.data ?? []).map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(i.unit_cost), lang)} · {t("qty")} {num(i.quantity, lang)}
                  </p>
                </div>
                <Input
                  className="h-9 w-20"
                  inputMode="numeric"
                  placeholder="0"
                  value={retQtys[i.id] ?? ""}
                  onChange={(e) => setRetQtys({ ...retQtys, [i.id]: e.target.value })}
                />
              </div>
            ))}
            {!retItems.isLoading && (retItems.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("reason")}</Label>
            <Input value={retReason} maxLength={200} onChange={(e) => setRetReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturning(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => submitReturn.mutate()} disabled={submitReturn.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
