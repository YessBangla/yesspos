import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Check, Phone, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/lib/active-branch";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/delivery-orders")({
  head: () => ({
    meta: [
      { title: "Home delivery orders — Sokoler Bazar" },
      { name: "description", content: "Manage online grocery orders, delivery status and convert them into sales." },
      { property: "og:title", content: "Home delivery orders — Sokoler Bazar" },
      { property: "og:description", content: "Track and fulfil online home delivery orders." },
    ],
  }),
  component: DeliveryOrdersPage,
});

type Order = {
  id: string;
  order_no: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  area: string | null;
  note: string | null;
  slot: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  sale_id: string | null;
  branch_id: string | null;
  rider_id: string | null;
  created_at: string;
};

type Item = {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

const STATUS_LABEL: Record<string, { bn: string; en: string }> = {
  pending: { bn: "নতুন", en: "Pending" },
  confirmed: { bn: "কনফার্মড", en: "Confirmed" },
  packed: { bn: "প্যাকড", en: "Packed" },
  shipped: { bn: "রাস্তায়", en: "Out for delivery" },
  delivered: { bn: "ডেলিভার্ড", en: "Delivered" },
  cancelled: { bn: "বাতিল", en: "Cancelled" },
};

function DeliveryOrdersPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const branch = useActiveBranch();
  const [filter, setFilter] = useState<string>("open");
  const [q, setQ] = useState("");

  const orders = useQuery({
    queryKey: ["delivery-orders"],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const riders = useQuery({
    queryKey: ["riders"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_riders")
        .select("id,name,phone,vehicle,is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; phone: string; vehicle: string; is_active: boolean }[];
    },
  });


  const items = useQuery({
    queryKey: ["delivery-order-items"],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_order_items").select("*").limit(3000);
      if (error) throw error;
      return data as unknown as Item[];
    },
  });

  const assignRider = useMutation({
    mutationFn: async ({ id, riderId }: { id: string; riderId: string | null }) => {
      const { error } = await supabase.from("delivery_orders").update({ rider_id: riderId }).eq("id", id);
      if (error) throw error;
      await logAudit("delivery_order", { entity: "delivery_orders", entityId: id, details: `rider:${riderId ?? "none"}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast.success(bn ? "রাইডার নির্ধারণ হয়েছে" : "Rider assigned");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  const byOrder = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items.data ?? []) {
      const list = map.get(it.order_id) ?? [];
      list.push(it);
      map.set(it.order_id, list);
    }
    return map;
  }, [items.data]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (orders.data ?? []).filter((o) => {
      const statusOk =
        filter === "all"
          ? true
          : filter === "open"
            ? !["delivered", "cancelled"].includes(o.status)
            : o.status === filter;
      const hay = `${o.order_no} ${o.customer_name} ${o.customer_phone} ${o.area ?? ""}`.toLowerCase();
      return statusOk && (!needle || hay.includes(needle));
    });
  }, [orders.data, filter, q]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("delivery_orders").update({ status }).eq("id", id);
      if (error) throw error;
      await logAudit("delivery_order", { entity: "delivery_orders", entityId: id, details: status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast.success(bn ? "আপডেট হয়েছে" : "Updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toSale = useMutation({
    mutationFn: async (order: Order) => {
      const lines = byOrder.get(order.id) ?? [];
      if (lines.length === 0) throw new Error("No items");
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          subtotal: Number(order.subtotal),
          discount: 0,
          tax: 0,
          total: Number(order.total),
          paid: order.payment_method === "cod" ? 0 : Number(order.total),
          payment_method: order.payment_method === "cod" ? "cash" : order.payment_method,
          status: "final",
          branch_id: order.branch_id ?? branch.branchId ?? null,
          note: `Delivery order #${order.order_no}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemErr } = await supabase.from("sale_items").insert(
        lines.map((l) => ({
          sale_id: sale.id,
          product_id: l.product_id,
          name_snapshot: l.name_snapshot,
          unit_price: Number(l.unit_price),
          quantity: l.quantity,
          line_total: Number(l.line_total),
        })),
      );
      if (itemErr) throw itemErr;
      const { error: linkErr } = await supabase
        .from("delivery_orders")
        .update({ sale_id: sale.id, status: "delivered" })
        .eq("id", order.id);
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["branch-stock"] });
      toast.success(bn ? "বিক্রয়ে রূপান্তর হয়েছে" : "Converted to sale");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          <Truck className="mr-2 inline size-6 text-primary" />
          {bn ? "হোম ডেলিভারি অর্ডার" : "Home delivery orders"}
        </h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={40}
          placeholder={bn ? "অর্ডার/নাম/ফোন" : "Order, name or phone"}
          className="w-56"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["open", ...FLOW, "cancelled", "all"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              filter === s ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground",
            )}
          >
            {s === "open" ? (bn ? "চলমান" : "Open") : s === "all" ? (bn ? "সব" : "All") : bn ? STATUS_LABEL[s].bn : STATUS_LABEL[s].en}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orders.isLoading && <p className="text-muted-foreground">…</p>}
        {visible.map((o) => {
          const lines = byOrder.get(o.id) ?? [];
          const next = FLOW[FLOW.indexOf(o.status as (typeof FLOW)[number]) + 1];
          return (
            <div key={o.id} className="surface-panel space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-bold">#{num(o.order_no, lang)}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {bn ? STATUS_LABEL[o.status]?.bn : STATUS_LABEL[o.status]?.en}
                </span>
                <span className="text-xs text-muted-foreground">{o.created_at.slice(0, 16).replace("T", " ")}</span>
              </div>

              <div className="text-sm">
                <p className="font-medium">{o.customer_name}</p>
                <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="size-3" /> {o.customer_phone}
                </a>
                <p className="text-muted-foreground">
                  {o.area ? `${o.area}, ` : ""}
                  {o.address}
                </p>
                {o.slot && (
                  <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {lang === "bn" ? "স্লট" : "Slot"}: {o.slot}
                  </p>
                )}
                {o.note && <p className="text-xs italic text-muted-foreground">{o.note}</p>}
              </div>

              <ul className="rounded-lg bg-muted/50 p-2 text-xs">
                {lines.map((l) => (
                  <li key={l.id} className="flex justify-between">
                    <span className="truncate">
                      {l.name_snapshot} × {num(l.quantity, lang)}
                    </span>
                    <span>{money(Number(l.line_total), lang)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {bn ? "ডেলিভারি" : "Delivery"} {money(Number(o.delivery_fee), lang)} ·{" "}
                  {o.payment_method.toUpperCase()}
                </span>
                <span className="font-bold">{money(Number(o.total), lang)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{bn ? "রাইডার" : "Rider"}</span>
                <select
                  value={o.rider_id ?? ""}
                  onChange={(e) => assignRider.mutate({ id: o.id, riderId: e.target.value || null })}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">{bn ? "নির্ধারিত নয়" : "Unassigned"}</option>
                  {(riders.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                const rider = (riders.data ?? []).find((r) => r.id === o.rider_id);
                if (!rider) return null;
                return (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <a href={`tel:${rider.phone}`} className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Phone className="size-3" /> {rider.phone}
                    </a>
                    <span>· {rider.vehicle}</span>
                  </p>
                );
              })()}


              <div className="flex flex-wrap gap-2">
                {next && o.status !== "cancelled" && (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: o.id, status: next })}>
                    <Bike className="mr-1 size-4" />
                    {bn ? STATUS_LABEL[next].bn : STATUS_LABEL[next].en}
                  </Button>
                )}
                {!o.sale_id && o.status !== "cancelled" && (
                  <Button size="sm" variant="outline" onClick={() => toSale.mutate(o)} disabled={toSale.isPending}>
                    <Check className="mr-1 size-4" /> {bn ? "বিক্রয়ে রূপান্তর" : "Convert to sale"}
                  </Button>
                )}
                {!["delivered", "cancelled"].includes(o.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setStatus.mutate({ id: o.id, status: "cancelled" })}
                  >
                    <X className="mr-1 size-4" /> {bn ? "বাতিল" : "Cancel"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!orders.isLoading && visible.length === 0 && (
          <p className="text-muted-foreground">{bn ? "কোনো অর্ডার নেই" : "No orders"}</p>
        )}
      </div>
    </div>
  );
}
