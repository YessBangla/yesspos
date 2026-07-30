import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Check,
  CheckSquare,
  ClipboardList,
  Download,
  History,
  Phone,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/lib/active-branch";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadCsv, logAudit } from "@/lib/audit";
import { DeliveryTrackingQr } from "@/components/DeliveryTrackingQr";
import { OrderNotifications } from "@/components/OrderNotifications";
import { RiderSchedule } from "@/components/RiderSchedule";
import { FeedbackSla } from "@/components/FeedbackSla";
import { NotificationLog } from "@/components/NotificationLog";
import { ProofOfDelivery } from "@/components/ProofOfDelivery";
import { OrderFeedback } from "@/components/OrderFeedback";
import { dispatchNotifications } from "@/lib/notify-dispatch.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/delivery-orders")({
  head: () => ({
    meta: [
      { title: "Home delivery orders — Sokoler Bazar" },
      {
        name: "description",
        content: "Manage online grocery orders, delivery status and convert them into sales.",
      },
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

type OrderEvent = {
  id: string;
  order_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  actor_name: string | null;
  created_at: string;
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

function statusText(s: string | null, bn: boolean) {
  if (!s) return bn ? "—" : "—";
  return bn ? (STATUS_LABEL[s]?.bn ?? s) : (STATUS_LABEL[s]?.en ?? s);
}

function DeliveryOrdersPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const branch = useActiveBranch();
  const [filter, setFilter] = useState<string>("open");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [area, setArea] = useState("");
  const [riderFilter, setRiderFilter] = useState("");
  const [openTimeline, setOpenTimeline] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("confirmed");

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
        .order("name");
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        phone: string;
        vehicle: string;
        is_active: boolean;
      }[];
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

  const events = useQuery({
    queryKey: ["delivery-order-events", openTimeline],
    enabled: !!openTimeline,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_order_events")
        .select("id,order_id,event_type,from_value,to_value,actor_name,created_at")
        .eq("order_id", openTimeline!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as OrderEvent[];
    },
  });

  const assignRider = useMutation({
    mutationFn: async ({ id, riderId }: { id: string; riderId: string | null }) => {
      const { error } = await supabase
        .from("delivery_orders")
        .update({ rider_id: riderId })
        .eq("id", id);
      if (error) throw error;
      await logAudit("delivery_order", {
        entity: "delivery_orders",
        entityId: id,
        details: `rider:${riderId ?? "none"}`,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["delivery-order-events"] });
      toast.success(
        v.riderId
          ? bn
            ? "রাইডার নির্ধারণ হয়েছে"
            : "Rider assigned"
          : bn
            ? "রাইডার সরানো হয়েছে"
            : "Rider removed",
      );
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

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders.data ?? []) if (o.area?.trim()) set.add(o.area.trim());
    return [...set].sort();
  }, [orders.data]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return (orders.data ?? []).filter((o) => {
      const statusOk =
        filter === "all"
          ? true
          : filter === "open"
            ? !["delivered", "cancelled"].includes(o.status)
            : o.status === filter;
      const ts = new Date(o.created_at).getTime();
      const dateOk = (fromTs === null || ts >= fromTs) && (toTs === null || ts <= toTs);
      const areaOk = !area || (o.area?.trim() ?? "") === area;
      const riderOk =
        !riderFilter || (riderFilter === "none" ? !o.rider_id : o.rider_id === riderFilter);
      const hay =
        `${o.order_no} ${o.customer_name} ${o.customer_phone} ${o.area ?? ""} ${o.address}`.toLowerCase();
      return statusOk && dateOk && areaOk && riderOk && (!needle || hay.includes(needle));
    });
  }, [orders.data, filter, q, from, to, area, riderFilter]);

  /** Checkout → delivery order reconciliation over the currently filtered rows. */
  const summary = useMemo(() => {
    const rows = visible;
    const withItems = rows.filter((o) => (byOrder.get(o.id)?.length ?? 0) > 0).length;
    const missingItems = rows.length - withItems;
    const cancelled = rows.filter((o) => o.status === "cancelled").length;
    const delivered = rows.filter((o) => o.status === "delivered").length;
    const converted = rows.filter((o) => o.sale_id).length;
    const unassigned = rows.filter(
      (o) => !o.rider_id && !["delivered", "cancelled"].includes(o.status),
    ).length;
    const value = rows
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0);
    const itemsCount = rows.reduce(
      (s, o) => s + (byOrder.get(o.id) ?? []).reduce((n, l) => n + l.quantity, 0),
      0,
    );
    return {
      total: rows.length,
      withItems,
      missingItems,
      cancelled,
      delivered,
      converted,
      unassigned,
      value,
      itemsCount,
    };
  }, [visible, byOrder]);

  // Auto-deliver queued customer notifications through the configured SMS gateway.
  const dispatch = useServerFn(dispatchNotifications);
  const autoSend = async () => {
    try {
      const res = await dispatch({ data: undefined });
      if (res.sent > 0) {
        toast.success(
          bn ? `${res.sent} টি এসএমএস পাঠানো হয়েছে` : `${res.sent} SMS notification(s) sent`,
        );
      }
      qc.invalidateQueries({ queryKey: ["order-notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-log"] });
    } catch (e) {
      console.error("[notifications] auto-send failed", e);
    }
  };

  // Background sweep so notifications go out even without a manual action.
  useQuery({
    queryKey: ["notification-autosend"],
    refetchInterval: 60_000,
    queryFn: async () => {
      await autoSend();
      return Date.now();
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("delivery_orders").update({ status }).eq("id", id);
      if (error) throw error;
      await logAudit("delivery_order", {
        entity: "delivery_orders",
        entityId: id,
        details: status,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["delivery-order-events"] });
      qc.invalidateQueries({ queryKey: ["order-notifications"] });
      void autoSend();
      toast.success(
        bn
          ? "আপডেট হয়েছে · গ্রাহককে জানানো হচ্ছে"
          : "Updated · customer is being notified",
      );
    },


    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulkStatusUpdate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from("delivery_orders").update({ status }).in("id", ids);
      if (error) throw error;
      await logAudit("delivery_order", {
        entity: "delivery_orders",
        details: `bulk ${status} × ${ids.length}`,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["delivery-order-events"] });
      qc.invalidateQueries({ queryKey: ["order-notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-log"] });
      setSelected([]);
      void autoSend();

      toast.success(
        bn ? `${v.ids.length} টি অর্ডার আপডেট হয়েছে` : `${v.ids.length} order(s) updated`,
      );
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

  const summaryCards = [
    { label: bn ? "মোট অর্ডার" : "Orders", value: num(summary.total, lang) },
    {
      label: bn ? "সফল এন্ট্রি (আইটেমসহ)" : "Complete entries",
      value: num(summary.withItems, lang),
    },
    { label: bn ? "আইটেম ছাড়া" : "Missing items", value: num(summary.missingItems, lang) },
    { label: bn ? "মোট পণ্য" : "Item units", value: num(summary.itemsCount, lang) },
    { label: bn ? "ডেলিভার্ড" : "Delivered", value: num(summary.delivered, lang) },
    {
      label: bn ? "বিক্রয়ে রূপান্তরিত" : "Converted to sale",
      value: num(summary.converted, lang),
    },
    { label: bn ? "রাইডার ছাড়া" : "Unassigned", value: num(summary.unassigned, lang) },
    { label: bn ? "বাতিল" : "Cancelled", value: num(summary.cancelled, lang) },
    { label: bn ? "মোট মূল্য" : "Order value", value: money(summary.value, lang) },
  ];

  function resetFilters() {
    setFilter("open");
    setQ("");
    setFrom("");
    setTo("");
    setArea("");
    setRiderFilter("");
  }

  async function exportTimelineCsv(o: Order) {
    const { data, error } = await supabase
      .from("delivery_order_events")
      .select("id,order_id,event_type,from_value,to_value,actor_name,created_at")
      .eq("order_id", o.id)
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    const rows = (data as unknown as OrderEvent[]) ?? [];
    if (rows.length === 0) return toast.error(bn ? "কোনো ইতিহাস নেই" : "No history yet");
    downloadCsv(
      `order-${o.order_no}-timeline.csv`,
      ["Order No", "Time", "Event", "Before", "After", "Changed by"],
      rows.map((ev) => [
        o.order_no,
        ev.created_at.slice(0, 19).replace("T", " "),
        ev.event_type,
        ev.event_type === "status" && ev.from_value
          ? statusText(ev.from_value, false)
          : (ev.from_value ?? ""),
        ev.event_type === "status" && ev.to_value
          ? statusText(ev.to_value, false)
          : (ev.to_value ?? ""),
        ev.actor_name ?? "system",
      ]),
    );
    toast.success(bn ? "টাইমলাইন CSV ডাউনলোড হয়েছে" : "Timeline CSV downloaded");
  }

  function exportCsv() {
    if (visible.length === 0) {
      toast.error(bn ? "রপ্তানি করার মতো অর্ডার নেই" : "No orders to export");
      return;
    }
    const riderName = (id: string | null) =>
      (riders.data ?? []).find((r) => r.id === id)?.name ?? "";
    const riderPhone = (id: string | null) =>
      (riders.data ?? []).find((r) => r.id === id)?.phone ?? "";
    downloadCsv(
      `delivery-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Order No",
        "Date",
        "Customer",
        "Phone",
        "Area",
        "Address",
        "Slot",
        "Status",
        "Payment",
        "Items",
        "Subtotal",
        "Delivery Fee",
        "Total",
        "Rider",
        "Rider Phone",
        "Converted To Sale",
      ],
      visible.map((o) => {
        const lines = byOrder.get(o.id) ?? [];
        return [
          o.order_no,
          o.created_at.slice(0, 16).replace("T", " "),
          o.customer_name,
          o.customer_phone,
          o.area ?? "",
          o.address,
          o.slot ?? "",
          statusText(o.status, false),
          o.payment_method,
          lines.reduce((s, l) => s + l.quantity, 0),
          Number(o.subtotal).toFixed(2),
          Number(o.delivery_fee).toFixed(2),
          Number(o.total).toFixed(2),
          riderName(o.rider_id),
          riderPhone(o.rider_id),
          o.sale_id ? "yes" : "no",
        ];
      }),
    );
    void logAudit("delivery_order", {
      entity: "delivery_orders",
      details: `csv export ${visible.length}`,
    });
    toast.success(bn ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded");
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          <Truck className="mr-2 inline size-6 text-primary" />
          {bn ? "হোম ডেলিভারি অর্ডার" : "Home delivery orders"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={40}
            placeholder={bn ? "অর্ডার/নাম/ফোন/ঠিকানা" : "Order, name, phone or address"}
            className="w-64"
          />
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1 size-4" />
            {bn ? "CSV ডাউনলোড" : "Export CSV"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["open", ...FLOW, "cancelled", "all"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              filter === s
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {s === "open"
              ? bn
                ? "চলমান"
                : "Open"
              : s === "all"
                ? bn
                  ? "সব"
                  : "All"
                : statusText(s, bn)}
          </button>
        ))}
      </div>

      <div className="surface-panel mt-3 flex flex-wrap items-end gap-3 p-3">
        <label className="text-xs text-muted-foreground">
          {bn ? "শুরুর তারিখ" : "From"}
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 h-9 w-40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {bn ? "শেষ তারিখ" : "To"}
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 h-9 w-40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {bn ? "এলাকা" : "Area"}
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="mt-1 h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{bn ? "সব এলাকা" : "All areas"}</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {bn ? "রাইডার" : "Rider"}
          <select
            value={riderFilter}
            onChange={(e) => setRiderFilter(e.target.value)}
            className="mt-1 h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{bn ? "সব রাইডার" : "All riders"}</option>
            <option value="none">{bn ? "নির্ধারিত নয়" : "Unassigned"}</option>
            {(riders.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          {bn ? "ফিল্টার মুছুন" : "Clear filters"}
        </Button>
      </div>

      <div className="surface-panel mt-3 p-3">
        <p className="mb-2 text-sm font-semibold">
          <ClipboardList className="mr-1 inline size-4 text-primary" />
          {bn ? "চেকআউট → অর্ডার সামারি রিপোর্ট" : "Checkout → order summary report"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((c) => (
            <div key={c.label} className="rounded-lg border border-border p-2">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-display text-lg font-bold">{c.value}</p>
            </div>
          ))}
        </div>
        {summary.missingItems > 0 && (
          <p className="mt-2 text-xs font-medium text-destructive">
            {bn
              ? `${num(summary.missingItems, lang)} টি অর্ডারে চেকআউটের পণ্য তালিকা জমা হয়নি — যাচাই করুন।`
              : `${summary.missingItems} order(s) arrived without checkout items — please review.`}
          </p>
        )}
      </div>

      <RiderSchedule
        orders={orders.data ?? []}
        riders={riders.data ?? []}
        statusText={statusText}
      />

      <div className="mt-4">
        <FeedbackSla />
      </div>

      <NotificationLog />

      <div className="surface-panel mt-4 flex flex-wrap items-center gap-2 p-3">
        <p className="text-sm font-semibold">
          <CheckSquare className="mr-1 inline size-4 text-primary" />
          {bn ? "একসাথে স্ট্যাটাস আপডেট" : "Bulk status update"}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelected(visible.map((o) => o.id))}
          disabled={visible.length === 0}
        >
          {bn ? "সব নির্বাচন" : "Select all"} ({num(visible.length, lang)})
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelected([])}
          disabled={selected.length === 0}
        >
          {bn ? "নির্বাচন মুছুন" : "Clear"}
        </Button>
        <select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {[...FLOW, "cancelled"].map((s) => (
            <option key={s} value={s}>
              {statusText(s, bn)}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={selected.length === 0 || bulkStatusUpdate.isPending}
          onClick={() => bulkStatusUpdate.mutate({ ids: selected, status: bulkStatus })}
        >
          {bn ? "নির্বাচিত আপডেট করুন" : "Update selected"} ({num(selected.length, lang)})
        </Button>
        <span className="text-xs text-muted-foreground">
          {bn
            ? "নির্বাচিত প্রতিটি অর্ডারে গ্রাহক নোটিফিকেশন তৈরি হবে।"
            : "A customer notification is generated for each selected order."}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orders.isLoading && <p className="text-muted-foreground">…</p>}
        {visible.map((o) => {
          const lines = byOrder.get(o.id) ?? [];
          const next = FLOW[FLOW.indexOf(o.status as (typeof FLOW)[number]) + 1];
          const rider = (riders.data ?? []).find((r) => r.id === o.rider_id);
          return (
            <div key={o.id} className="surface-panel space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[hsl(var(--primary))]"
                    checked={selected.includes(o.id)}
                    onChange={(e) =>
                      setSelected((cur) =>
                        e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id),
                      )
                    }
                    aria-label={bn ? "অর্ডার নির্বাচন" : "Select order"}
                  />
                  <span className="font-display font-bold">#{num(o.order_no, lang)}</span>
                </label>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {statusText(o.status, bn)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.created_at.slice(0, 16).replace("T", " ")}
                </span>
              </div>

              <div className="text-sm">
                <p className="font-medium">{o.customer_name}</p>
                <a
                  href={`tel:${o.customer_phone}`}
                  className="flex items-center gap-1 text-muted-foreground"
                >
                  <Phone className="size-3" /> {o.customer_phone}
                </a>
                <p className="text-muted-foreground">
                  {o.area ? `${o.area}, ` : ""}
                  {o.address}
                </p>
                {o.slot && (
                  <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {bn ? "স্লট" : "Slot"}: {o.slot}
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
                {lines.length === 0 && (
                  <li className="text-destructive">
                    {bn ? "কোনো পণ্য জমা হয়নি" : "No items recorded"}
                  </li>
                )}
              </ul>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {bn ? "ডেলিভারি" : "Delivery"} {money(Number(o.delivery_fee), lang)} ·{" "}
                  {o.payment_method.toUpperCase()}
                </span>
                <span className="font-bold">{money(Number(o.total), lang)}</span>
              </div>

              <div className="rounded-lg border border-border p-2">
                <p className="mb-1 text-xs font-semibold">
                  <Bike className="mr-1 inline size-3.5 text-primary" />
                  {rider
                    ? bn
                      ? "রাইডার পরিবর্তন"
                      : "Re-assign rider"
                    : bn
                      ? "রাইডার নির্ধারণ"
                      : "Assign rider"}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={o.rider_id ?? ""}
                    onChange={(e) =>
                      assignRider.mutate({ id: o.id, riderId: e.target.value || null })
                    }
                    disabled={assignRider.isPending}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">{bn ? "নির্ধারিত নয়" : "Unassigned"}</option>
                    {(riders.data ?? []).map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={!r.is_active && r.id !== o.rider_id}
                      >
                        {r.name}
                        {r.is_active ? "" : bn ? " (নিষ্ক্রিয়)" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                  {o.rider_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => assignRider.mutate({ id: o.id, riderId: null })}
                      disabled={assignRider.isPending}
                    >
                      {bn ? "সরান" : "Remove"}
                    </Button>
                  )}
                </div>
                {rider && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <a
                      href={`tel:${rider.phone}`}
                      className="inline-flex items-center gap-1 font-semibold text-primary"
                    >
                      <Phone className="size-3" /> {rider.phone}
                    </a>
                    <span>· {rider.vehicle}</span>
                  </p>
                )}
              </div>

              <OrderNotifications orderId={o.id} phone={o.customer_phone} />

              <ProofOfDelivery orderId={o.id} orderNo={o.order_no} />

              <OrderFeedback orderId={o.id} />

              <div className="flex flex-wrap gap-2">
                {next && o.status !== "cancelled" && (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: o.id, status: next })}>
                    <Bike className="mr-1 size-4" />
                    {statusText(next, bn)}
                  </Button>
                )}
                {!o.sale_id && o.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toSale.mutate(o)}
                    disabled={toSale.isPending}
                  >
                    <Check className="mr-1 size-4" /> {bn ? "বিক্রয়ে রূপান্তর" : "Convert to sale"}
                  </Button>
                )}
                <DeliveryTrackingQr orderNo={o.order_no} phone={o.customer_phone} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenTimeline((cur) => (cur === o.id ? null : o.id))}
                >
                  <History className="mr-1 size-4" />
                  {bn ? "টাইমলাইন" : "Timeline"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void exportTimelineCsv(o)}>
                  <Download className="mr-1 size-4" />
                  {bn ? "টাইমলাইন CSV" : "Timeline CSV"}
                </Button>
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

              {openTimeline === o.id && (
                <ol className="space-y-1 rounded-lg border border-border p-2 text-xs">
                  {events.isLoading && <li className="text-muted-foreground">…</li>}
                  {(events.data ?? []).map((ev) => {
                    const isRider = ev.event_type === "rider";
                    const none = bn ? "নির্ধারিত নয়" : "Unassigned";
                    const before = isRider
                      ? (ev.from_value ?? none)
                      : ev.from_value
                        ? statusText(ev.from_value, bn)
                        : null;
                    const after = isRider ? (ev.to_value ?? none) : statusText(ev.to_value, bn);
                    return (
                      <li key={ev.id} className="border-b border-border/60 pb-1 last:border-0">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-primary">
                            {ev.event_type === "created"
                              ? bn
                                ? "অর্ডার তৈরি"
                                : "Order placed"
                              : isRider
                                ? bn
                                  ? "রাইডার"
                                  : "Rider"
                                : bn
                                  ? "স্ট্যাটাস"
                                  : "Status"}
                          </span>
                          <span className="text-muted-foreground">
                            · {ev.created_at.slice(0, 16).replace("T", " ")} ·{" "}
                            {ev.actor_name ?? (bn ? "সিস্টেম" : "system")}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {before !== null && (
                            <>
                              <span className="rounded-md bg-muted px-1.5 py-0.5">
                                <span className="text-muted-foreground">
                                  {bn ? "আগে" : "Before"}:{" "}
                                </span>
                                {before}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                            <span className="font-normal text-muted-foreground">
                              {bn ? "পরে" : "After"}:{" "}
                            </span>
                            {after}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {!events.isLoading && (events.data ?? []).length === 0 && (
                    <li className="text-muted-foreground">
                      {bn ? "কোনো ইতিহাস নেই" : "No history yet"}
                    </li>
                  )}
                </ol>
              )}
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
