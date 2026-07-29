import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudOff, Cloud, RefreshCw, Store, Truck, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { countPendingSales, subscribePending, syncPendingSales } from "@/lib/offline-queue";
import { listQueuedOrders, subscribeQueue, syncQueuedOrders, QUEUE_MAX_ATTEMPTS } from "@/lib/delivery-queue";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function ChannelStatusPanel({ branchId }: { branchId?: string | null }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingSales, setPendingSales] = useState(0);
  const [queuedOrders, setQueuedOrders] = useState<{ count: number; blocked: number; lastError: string | null }>({
    count: 0,
    blocked: 0,
    lastError: null,
  });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [sales, orders] = await Promise.all([countPendingSales(), listQueuedOrders()]);
      if (!alive) return;
      setPendingSales(sales);
      setQueuedOrders({
        count: orders.length,
        blocked: orders.filter((o) => o.attempts >= QUEUE_MAX_ATTEMPTS).length,
        lastError: orders.find((o) => o.lastError)?.lastError ?? null,
      });
    };
    void refresh();
    const offA = subscribePending(refresh);
    const offB = subscribeQueue(refresh);
    const timer = window.setInterval(refresh, 20000);
    return () => {
      alive = false;
      offA();
      offB();
      window.clearInterval(timer);
    };
  }, []);

  const today = useQuery({
    queryKey: ["channel-today", branchId ?? "all"],
    refetchInterval: 60000,
    queryFn: async () => {
      const from = startOfToday();
      let posQ = supabase.from("sales").select("total,status").gte("created_at", from);
      if (branchId) posQ = posQ.eq("branch_id", branchId);
      let webQ = supabase.from("delivery_orders").select("total,status").gte("created_at", from);
      if (branchId) webQ = webQ.eq("branch_id", branchId);

      const [pos, web] = await Promise.all([posQ, webQ]);
      if (pos.error) throw pos.error;
      if (web.error) throw web.error;

      const posRows = (pos.data ?? []).filter((s) => s.status === "final");
      const webRows = web.data ?? [];
      return {
        posCount: posRows.length,
        posTotal: posRows.reduce((s, r) => s + Number(r.total), 0),
        webCount: webRows.length,
        webTotal: webRows.reduce((s, r) => s + Number(r.total), 0),
        webPending: webRows.filter((r) => ["pending", "confirmed", "packing", "dispatched"].includes(r.status)).length,
        webDone: webRows.filter((r) => r.status === "delivered").length,
        webCancelled: webRows.filter((r) => r.status === "cancelled").length,
      };
    },
  });

  const d = today.data;
  const totalPending = pendingSales + queuedOrders.count;

  const runSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([syncPendingSales(), syncQueuedOrders(true)]);
      await today.refetch();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="surface-panel p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {bn ? "অনলাইন ও অফলাইন অবস্থা" : "Online & offline status"}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              online ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
            )}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? (bn ? "অনলাইন" : "Online") : bn ? "অফলাইন" : "Offline"}
          </span>
          <Button size="sm" variant="outline" disabled={!online || syncing || totalPending === 0} onClick={runSync}>
            <RefreshCw className={cn("mr-1 size-4", syncing && "animate-spin")} />
            {bn ? "সিংক" : "Sync"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Store className="size-4" />
          </span>
          <p className="text-xs text-muted-foreground">{bn ? "আজ দোকানে (POS) বিক্রি" : "In-store (POS) today"}</p>
          <p className="font-display text-lg font-bold">{money(d?.posTotal ?? 0, lang)}</p>
          <p className="text-xs text-muted-foreground">
            {num(d?.posCount ?? 0, lang)} {bn ? "টি ইনভয়েস" : "invoices"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Truck className="size-4" />
          </span>
          <p className="text-xs text-muted-foreground">{bn ? "আজ অনলাইন ডেলিভারি" : "Online delivery today"}</p>
          <p className="font-display text-lg font-bold">{money(d?.webTotal ?? 0, lang)}</p>
          <p className="text-xs text-muted-foreground">
            {num(d?.webCount ?? 0, lang)} {bn ? "টি অর্ডার" : "orders"} · {bn ? "চলমান" : "active"}{" "}
            {num(d?.webPending ?? 0, lang)} · {bn ? "সম্পন্ন" : "done"} {num(d?.webDone ?? 0, lang)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <span
            className={cn(
              "mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary",
              totalPending ? "text-destructive" : "text-primary",
            )}
          >
            {totalPending ? <CloudOff className="size-4" /> : <Cloud className="size-4" />}
          </span>
          <p className="text-xs text-muted-foreground">{bn ? "অফলাইন কিউ (সিংক বাকি)" : "Offline queue (to sync)"}</p>
          <p className="font-display text-lg font-bold">{num(totalPending, lang)}</p>
          <p className="text-xs text-muted-foreground">
            {bn ? "POS বিক্রি" : "POS sales"} {num(pendingSales, lang)} · {bn ? "ডেলিভারি অর্ডার" : "delivery orders"}{" "}
            {num(queuedOrders.count, lang)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <RefreshCw className="size-4" />
          </span>
          <p className="text-xs text-muted-foreground">{bn ? "সিংক স্বাস্থ্য" : "Sync health"}</p>
          <p className="font-display text-lg font-bold">
            {queuedOrders.blocked
              ? `${num(queuedOrders.blocked, lang)} ${bn ? "আটকে আছে" : "blocked"}`
              : totalPending
                ? bn
                  ? "অপেক্ষমাণ"
                  : "Pending"
                : bn
                  ? "সব সিংক হয়েছে"
                  : "All synced"}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {queuedOrders.lastError ?? (online ? (bn ? "সংযোগ স্বাভাবিক" : "Connection healthy") : bn ? "অফলাইনে বিক্রি চালু থাকবে" : "Selling continues offline")}
          </p>
        </div>
      </div>
    </div>
  );
}
