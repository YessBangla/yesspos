import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { useActiveBranch } from "@/lib/active-branch";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({
    meta: [
      { title: "Purchase orders — SheraPOS" },
      { name: "description", content: "Raise supplier purchase orders and receive goods straight into branch stock." },
      { property: "og:title", content: "Purchase orders — SheraPOS" },
      { property: "og:description", content: "Supplier ordering and goods receiving for every branch." },
    ],
  }),
  component: PurchaseOrdersPage,
});

type Line = { product_id: string; name: string; unit_cost: string; quantity: string };

function PurchaseOrdersPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { branchId } = useActiveBranch();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState("");
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const products = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku,cost")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const suppliers = useQuery({
    queryKey: ["contacts", "supplier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name")
        .eq("type", "supplier")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,po_no,supplier_id,branch_id,order_date,expected_date,status,total,note")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const detail = useQuery({
    queryKey: ["purchase-order-items", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("id,product_id,name_snapshot,unit_cost,quantity,received_qty")
        .eq("order_id", detailId as string);
      if (error) throw error;
      return data;
    },
  });

  function addLine(productId: string) {
    const p = products.data?.find((x) => x.id === productId);
    if (!p || lines.some((l) => l.product_id === productId)) return;
    setLines((ls) => [
      ...ls,
      {
        product_id: p.id,
        name: lang === "bn" ? p.name_bn : p.name_en,
        unit_cost: String(p.cost ?? 0),
        quantity: "1",
      },
    ]);
    setPicker("");
  }

  const total = lines.reduce((s, l) => s + (Number(l.unit_cost) || 0) * (Number(l.quantity) || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error(t("noItems"));
      const { data: userData } = await supabase.auth.getUser();
      const { data: head, error } = await supabase
        .from("purchase_orders")
        .insert({
          branch_id: branchId,
          supplier_id: supplier || null,
          expected_date: expected || null,
          note: note || null,
          total,
          user_id: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemErr } = await supabase.from("purchase_order_items").insert(
        lines.map((l) => ({
          order_id: head.id,
          product_id: l.product_id,
          name_snapshot: l.name,
          unit_cost: Number(l.unit_cost) || 0,
          quantity: Number(l.quantity) || 0,
          line_total: (Number(l.unit_cost) || 0) * (Number(l.quantity) || 0),
        })),
      );
      if (itemErr) throw itemErr;
    },
    onSuccess: () => {
      void logAudit("purchase", { entity: "purchase_order" });
      setOpen(false);
      setLines([]);
      setSupplier("");
      setExpected("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  /** Receiving turns the ordered quantities into a real purchase, so stock rises. */
  const receive = useMutation({
    mutationFn: async () => {
      const order = orders.data?.find((o) => o.id === detailId);
      const items = detail.data ?? [];
      if (!order || items.length === 0) throw new Error(t("noItems"));

      const receiving = items
        .map((it) => ({
          it,
          qty: Math.max(0, Math.min(Number(receiveQty[it.id] ?? 0) || 0, it.quantity - it.received_qty)),
        }))
        .filter((r) => r.qty > 0);
      if (receiving.length === 0) throw new Error(t("noItems"));

      const { data: userData } = await supabase.auth.getUser();
      const purchaseTotal = receiving.reduce((s, r) => s + Number(r.it.unit_cost) * r.qty, 0);

      const { data: purchase, error } = await supabase
        .from("purchases")
        .insert({
          branch_id: order.branch_id ?? branchId,
          supplier_id: order.supplier_id,
          total: purchaseTotal,
          paid: 0,
          note: `PO #${order.po_no}`,
          user_id: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: piErr } = await supabase.from("purchase_items").insert(
        receiving.map((r) => ({
          purchase_id: purchase.id,
          product_id: r.it.product_id,
          name_snapshot: r.it.name_snapshot,
          unit_cost: Number(r.it.unit_cost),
          quantity: r.qty,
          line_total: Number(r.it.unit_cost) * r.qty,
        })),
      );
      if (piErr) throw piErr;

      for (const r of receiving) {
        const { error: upErr } = await supabase
          .from("purchase_order_items")
          .update({ received_qty: r.it.received_qty + r.qty })
          .eq("id", r.it.id);
        if (upErr) throw upErr;
      }

      const allDone = items.every((it) => {
        const extra = receiving.find((r) => r.it.id === it.id)?.qty ?? 0;
        return it.received_qty + extra >= it.quantity;
      });
      await supabase
        .from("purchase_orders")
        .update({ status: allDone ? "received" : "partial" })
        .eq("id", order.id);
    },
    onSuccess: () => {
      void logAudit("purchase", { entity: "purchase_order_receive" });
      setDetailId(null);
      setReceiveQty({});
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusLabel = (s: string) =>
    s === "received" ? t("statusReceived") : s === "partial" ? t("statusPartial") : s === "cancelled" ? t("statusCancelled") : t("statusOpen");

  const supplierName = (id: string | null) => suppliers.data?.find((s) => s.id === id)?.name ?? "—";
  const current = orders.data?.find((o) => o.id === detailId) ?? null;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("purchaseOrders")}</h1>
          <p className="text-sm text-muted-foreground">{t("poHint")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> {t("newPO")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("poNo")}</th>
              <th className="px-3 py-2">{t("supplier")}</th>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("expectedDate")}</th>
              <th className="px-3 py-2 text-right">{t("total")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {t("noData")}
                </td>
              </tr>
            )}
            {(orders.data ?? []).map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">#{num(o.po_no, lang)}</td>
                <td className="px-3 py-2">{supplierName(o.supplier_id)}</td>
                <td className="px-3 py-2">{o.order_date}</td>
                <td className="px-3 py-2">{o.expected_date ?? "—"}</td>
                <td className="px-3 py-2 text-right">{money(Number(o.total), lang)}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{statusLabel(o.status)}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailId(o.id);
                      setReceiveQty({});
                    }}
                  >
                    <PackageCheck className="mr-1 size-4" /> {t("view")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("newPO")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("supplier")}</Label>
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("supplier")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("expectedDate")}</Label>
                <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </div>
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

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-2 py-2">{t("products")}</th>
                    <th className="px-2 py-2 text-right">{t("cost")}</th>
                    <th className="px-2 py-2 text-right">{t("quantity")}</th>
                    <th className="px-2 py-2" />
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
                  {lines.map((l, i) => (
                    <tr key={l.product_id} className="border-t border-border">
                      <td className="px-2 py-1.5">{l.name}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          className="ml-auto h-8 w-24 text-right"
                          inputMode="decimal"
                          value={l.unit_cost}
                          onChange={(e) =>
                            setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, unit_cost: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Input
                          className="ml-auto h-8 w-20 text-right"
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) =>
                            setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, quantity: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setLines((ls) => ls.filter((_, xi) => xi !== i))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <Label>{t("note")}</Label>
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-bold">
                {t("total")}: {money(total, lang)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {t("save")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("poNo")} #{current ? num(current.po_no, lang) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-2 py-2">{t("products")}</th>
                    <th className="px-2 py-2 text-right">{t("ordered")}</th>
                    <th className="px-2 py-2 text-right">{t("receivedQty")}</th>
                    <th className="px-2 py-2 text-right">{t("receiveGoods")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.data ?? []).map((it) => {
                    const remaining = it.quantity - it.received_qty;
                    return (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-2 py-1.5">{it.name_snapshot}</td>
                        <td className="px-2 py-1.5 text-right">{num(it.quantity, lang)}</td>
                        <td className="px-2 py-1.5 text-right">{num(it.received_qty, lang)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Input
                            className="ml-auto h-8 w-24 text-right"
                            inputMode="numeric"
                            disabled={remaining <= 0}
                            placeholder={String(remaining)}
                            value={receiveQty[it.id] ?? ""}
                            onChange={(e) => setReceiveQty((s) => ({ ...s, [it.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const next: Record<string, string> = {};
                  (detail.data ?? []).forEach((it) => {
                    const rem = it.quantity - it.received_qty;
                    if (rem > 0) next[it.id] = String(rem);
                  });
                  setReceiveQty(next);
                }}
              >
                {t("all")}
              </Button>
              <Button onClick={() => receive.mutate()} disabled={receive.isPending}>
                <PackageCheck className="mr-1 size-4" /> {t("receiveGoods")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
