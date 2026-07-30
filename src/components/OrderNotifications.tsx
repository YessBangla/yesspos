import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Check, Copy, MessageCircle, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { copyMessage } from "@/lib/share-invoice";
import {
  markNotificationSent,
  NOTIFICATION_COLUMNS,
  sendNotification,
  type NotificationRow,
  type SendChannel,
} from "@/lib/notify-send";

export type CustomerNotification = NotificationRow;

/** Auto-generated customer notifications for one delivery order (SMS + in-app). */
export function OrderNotifications({ orderId, phone }: { orderId: string; phone?: string | null }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["order-notifications", orderId],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as NotificationRow[];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["order-notifications", orderId] });
    qc.invalidateQueries({ queryKey: ["notification-log"] });
  }

  const send = useMutation({
    mutationFn: async ({ row, channel }: { row: NotificationRow; channel: SendChannel }) =>
      sendNotification(row, channel, phone),
    onSuccess: (res) => {
      refresh();
      if (res.ok) toast.success(bn ? "পাঠানো হয়েছে" : "Sent");
      else toast.error((bn ? "পাঠানো যায়নি: " : "Send failed: ") + res.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const markSent = useMutation({
    mutationFn: async (row: NotificationRow) => markNotificationSent(row),
    onSuccess: () => {
      refresh();
      toast.success(bn ? "পাঠানো হিসেবে চিহ্নিত" : "Marked as sent");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = list.data ?? [];
  const failed = rows.filter((r) => r.send_status === "failed").length;

  return (
    <div className="rounded-lg border border-border p-2">
      <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span>
          <BellRing className="mr-1 inline size-3.5 text-primary" />
          {bn ? "গ্রাহক নোটিফিকেশন" : "Customer notifications"}
        </span>
        {failed > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
            <AlertTriangle className="mr-1 inline size-3" />
            {failed} {bn ? "ব্যর্থ" : "failed"}
          </span>
        )}
      </p>
      {list.isLoading && <p className="text-xs text-muted-foreground">…</p>}
      {!list.isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {bn ? "স্ট্যাটাস বদলালে বার্তা এখানে তৈরি হবে।" : "Messages appear here on every status change."}
        </p>
      )}
      <ul className="space-y-1.5">
        {rows.map((n) => (
          <li key={n.id} className="rounded-md bg-muted/50 p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold">{n.title}</span>
              <StatusBadge row={n} bn={bn} />
            </div>
            <p className="mt-0.5 text-muted-foreground">{n.body}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {(n.sent_at ?? n.last_attempt_at ?? n.created_at).slice(0, 16).replace("T", " ")}
              {n.send_attempts > 0 && ` · ${bn ? "চেষ্টা" : "attempts"}: ${n.send_attempts}`}
            </p>
            {n.send_status === "failed" && n.last_error && (
              <p className="mt-1 rounded bg-destructive/10 px-1.5 py-1 text-[10px] font-medium text-destructive">
                {bn ? "ব্যর্থতার কারণ" : "Failure reason"}: {n.last_error}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={send.isPending}
                onClick={() => send.mutate({ row: n, channel: "sms" })}
              >
                <Smartphone className="mr-1 size-3" /> SMS
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={send.isPending}
                onClick={() => send.mutate({ row: n, channel: "whatsapp" })}
              >
                <MessageCircle className="mr-1 size-3" /> WhatsApp
              </Button>
              {n.send_status === "failed" && (
                <Button
                  size="sm"
                  className="h-7 px-2"
                  disabled={send.isPending}
                  onClick={() => send.mutate({ row: n, channel: "sms" })}
                >
                  <RotateCcw className="mr-1 size-3" /> {bn ? "রিট্রাই" : "Retry"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={async () => {
                  const ok = await copyMessage(n.body);
                  toast[ok ? "success" : "error"](ok ? (bn ? "কপি হয়েছে" : "Copied") : bn ? "কপি হয়নি" : "Copy failed");
                }}
              >
                <Copy className="mr-1 size-3" /> {bn ? "কপি" : "Copy"}
              </Button>
              {!n.is_sent && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => markSent.mutate(n)}>
                  <Check className="mr-1 size-3" /> {bn ? "পাঠানো হয়েছে" : "Mark sent"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusBadge({ row, bn }: { row: NotificationRow; bn: boolean }) {
  if (row.send_status === "failed") {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
        {bn ? "ব্যর্থ" : "Failed"}
      </span>
    );
  }
  if (row.is_sent || row.send_status === "sent") {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
        {bn ? "পাঠানো হয়েছে" : "Sent"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
      {bn ? "অপেক্ষমাণ" : "Pending"}
    </span>
  );
}
