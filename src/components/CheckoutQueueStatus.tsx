/**
 * Checkout queue status.
 *
 * Shows every order that was placed while offline (or that failed mid-flight)
 * with its current step — pending, sending, retrying, completed or failed —
 * plus a manual retry so shoppers are never left guessing.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listQueuedOrders,
  subscribeQueue,
  syncQueuedOrders,
  dropQueuedOrder,
  updatePendingPayment,
  QUEUE_MAX_ATTEMPTS,
  type QueuedOrder,
} from "@/lib/delivery-queue";
import { money, num, useI18n } from "@/lib/i18n";

type Step = "pending" | "sending" | "retrying" | "failed" | "done";

function stepOf(o: QueuedOrder): Step {
  if (o.status === "done") return "done";
  if (o.status === "sending") return "sending";
  if (o.attempts >= QUEUE_MAX_ATTEMPTS) return "failed";
  if (o.status === "failed") return "retrying";
  return o.attempts > 0 ? "retrying" : "pending";
}

export function CheckoutQueueStatus({
  compact = false,
  /** Latest payment/session values reapplied to queued orders before a retry. */
  paymentPatch,
}: {
  compact?: boolean;
  paymentPatch?: Record<string, unknown>;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [rows, setRows] = useState<QueuedOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(() => {
    void listQueuedOrders().then(setRows);
  }, []);

  useEffect(() => {
    refresh();
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const unsub = subscribeQueue(refresh);
    const on = () => {
      setOnline(true);
      void syncQueuedOrders();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  const openRows = rows.filter((r) => r.status !== "done");

  async function retryNow() {
    if (!navigator.onLine) {
      toast.error(bn ? "এখনো অফলাইন — সংযোগ ফিরলে চেষ্টা করুন" : "Still offline — try again once you reconnect");
      return;
    }
    setBusy(true);
    try {
      if (paymentPatch && Object.keys(paymentPatch).length > 0) {
        await updatePendingPayment(paymentPatch);
      }
      const res = await syncQueuedOrders(true);
      if (res.synced > 0) {
        toast.success(
          bn ? `${num(res.synced, lang)}টি অর্ডার পাঠানো হয়েছে` : `${res.synced} order(s) sent`,
        );
      } else if (res.failed > 0) {
        toast.error(bn ? "পাঠানো যায়নি — আবার চেষ্টা করুন" : "Could not send — please retry");
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }

  if (rows.length === 0) {
    if (online || compact) return null;
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <WifiOff className="size-3.5" />
        {bn ? "অফলাইন — অর্ডার সারিতে রাখা হবে" : "Offline — orders will be queued"}
      </p>
    );
  }

  return (
    <section
      aria-label={bn ? "চেকআউট সারির অবস্থা" : "Checkout queue status"}
      className="space-y-2 rounded-2xl border border-border bg-card p-3"
    >
      <header className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "চেকআউট সারি" : "Checkout queue"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-full"
          onClick={() => void retryNow()}
          disabled={busy || openRows.length === 0}
        >
          {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
          {bn ? "আবার চেষ্টা" : "Retry"}
        </Button>
      </header>

      <p aria-live="polite" className="sr-only">
        {bn
          ? `${num(openRows.length, lang)}টি অর্ডার অপেক্ষমাণ, ${num(rows.length - openRows.length, lang)}টি সম্পন্ন`
          : `${openRows.length} order(s) pending, ${rows.length - openRows.length} completed`}
      </p>

      {rows.map((o) => {
        const step = stepOf(o);
        const total = Number(o.order.total ?? 0);
        return (
          <div
            key={o.id}
            className={`rounded-xl border px-3 py-2 text-xs ${
              step === "done" ? "border-primary/40 bg-primary/10" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              {step === "done" ? (
                <CheckCircle2 className="size-3.5 text-primary" />
              ) : step === "failed" ? (
                <AlertTriangle className="size-3.5 text-destructive" />
              ) : step === "pending" ? (
                <Clock className="size-3.5 text-muted-foreground" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-amber-600" />
              )}
              <span className="font-semibold">
                {step === "done"
                  ? bn
                    ? `সম্পন্ন${o.orderNo ? ` · #${num(o.orderNo, lang)}` : ""}`
                    : `Completed${o.orderNo ? ` · #${num(o.orderNo, lang)}` : ""}`
                  : step === "failed"
                    ? bn
                      ? "ব্যর্থ"
                      : "Failed"
                    : step === "sending"
                      ? bn
                        ? "পাঠানো হচ্ছে"
                        : "Sending"
                      : step === "retrying"
                        ? bn
                          ? "পুনরায় চেষ্টা হচ্ছে"
                          : "Retrying"
                        : bn
                          ? "অপেক্ষমাণ"
                          : "Pending"}
              </span>
              <span className="ml-auto font-bold text-primary">{money(total, lang)}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {String(o.order.customer_phone ?? "")} ·{" "}
              {bn ? `${num(o.items.length, lang)}টি পণ্য` : `${o.items.length} item(s)`}
              {step === "done"
                ? ""
                : ` · ${bn ? `চেষ্টা ${num(o.attempts, lang)}/${num(QUEUE_MAX_ATTEMPTS, lang)}` : `attempt ${o.attempts}/${QUEUE_MAX_ATTEMPTS}`}`}
            </p>
            {o.lastError && step === "failed" && (
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-destructive">{o.lastError}</span>
                <button
                  type="button"
                  onClick={() => void dropQueuedOrder(o.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 font-medium hover:bg-muted"
                >
                  <Trash2 className="size-3" />
                  {bn ? "বাদ দিন" : "Discard"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
