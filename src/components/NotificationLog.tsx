import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, MessageCircle, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { downloadCsv } from "@/lib/audit";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_COLUMNS,
  sendNotification,
  type NotificationRow,
  type SendChannel,
} from "@/lib/notify-send";
import { StatusBadge } from "@/components/OrderNotifications";

type Tab = "failed" | "pending" | "sent" | "all";

/** Notification log: every generated customer message with retry for failures. */
export function NotificationLog() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("failed");

  const list = useQuery({
    queryKey: ["notification-log"],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notifications")
        .select(NOTIFICATION_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as NotificationRow[];
    },
  });

  const send = useMutation({
    mutationFn: async ({ row, channel }: { row: NotificationRow; channel: SendChannel }) =>
      sendNotification(row, channel),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["notification-log"] });
      qc.invalidateQueries({ queryKey: ["order-notifications"] });
      if (res.ok) toast.success(bn ? "পাঠানো হয়েছে" : "Sent");
      else toast.error((bn ? "আবারও ব্যর্থ: " : "Retry failed: ") + res.error);
    },
  });

  const rows = list.data ?? [];
  const counts = useMemo(
    () => ({
      failed: rows.filter((r) => r.send_status === "failed").length,
      pending: rows.filter((r) => r.send_status === "pending" && !r.is_sent).length,
      sent: rows.filter((r) => r.is_sent || r.send_status === "sent").length,
      all: rows.length,
    }),
    [rows],
  );

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        tab === "all"
          ? true
          : tab === "failed"
            ? r.send_status === "failed"
            : tab === "pending"
              ? r.send_status === "pending" && !r.is_sent
              : r.is_sent || r.send_status === "sent",
      ),
    [rows, tab],
  );

  const TABS: { id: Tab; bn: string; en: string }[] = [
    { id: "failed", bn: "ব্যর্থ", en: "Failed" },
    { id: "pending", bn: "অপেক্ষমাণ", en: "Pending" },
    { id: "sent", bn: "পাঠানো", en: "Sent" },
    { id: "all", bn: "সব", en: "All" },
  ];

  function exportLog() {
    if (visible.length === 0) return toast.error(bn ? "কিছু নেই" : "Nothing to export");
    downloadCsv(
      `notification-log-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Order No",
        "Created",
        "Phone",
        "Channel",
        "Title",
        "Message",
        "Status",
        "Attempts",
        "Last attempt",
        "Error",
      ],
      visible.map((r) => [
        r.order_no ?? "",
        r.created_at.slice(0, 16).replace("T", " "),
        r.customer_phone ?? "",
        r.channel,
        r.title,
        r.body,
        r.send_status,
        r.send_attempts,
        r.last_attempt_at?.slice(0, 16).replace("T", " ") ?? "",
        r.last_error ?? "",
      ]),
    );
    toast.success(bn ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded");
  }

  return (
    <div className="surface-panel mt-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          <AlertTriangle className="mr-1 inline size-4 text-primary" />
          {bn ? "নোটিফিকেশন লগ ও রিট্রাই" : "Notification log & retry"}
        </p>
        <Button size="sm" variant="outline" onClick={exportLog}>
          <Download className="mr-1 size-4" /> CSV
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              tab === t.id
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {bn ? t.bn : t.en} ({counts[t.id]})
          </button>
        ))}
      </div>

      <ul className="mt-2 space-y-1.5">
        {list.isLoading && <li className="text-xs text-muted-foreground">…</li>}
        {!list.isLoading && visible.length === 0 && (
          <li className="text-xs text-muted-foreground">
            {bn ? "কোনো বার্তা নেই" : "No messages"}
          </li>
        )}
        {visible.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold">
                #{r.order_no ?? "—"} · {r.title}
              </span>
              <StatusBadge row={r} bn={bn} />
            </div>
            <p className="mt-0.5 text-muted-foreground">{r.body}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {r.customer_phone ?? "—"} ·{" "}
              {(r.last_attempt_at ?? r.created_at).slice(0, 16).replace("T", " ")} ·{" "}
              {bn ? "চেষ্টা" : "attempts"}: {r.send_attempts}
            </p>
            {r.last_error && r.send_status === "failed" && (
              <p className="mt-1 rounded bg-destructive/10 px-1.5 py-1 text-[10px] font-medium text-destructive">
                {r.last_error}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                size="sm"
                className="h-7 px-2"
                disabled={send.isPending}
                onClick={() => send.mutate({ row: r, channel: "sms" })}
              >
                <RotateCcw className="mr-1 size-3" />
                <Smartphone className="mr-1 size-3" /> {bn ? "রিট্রাই SMS" : "Retry SMS"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={send.isPending}
                onClick={() => send.mutate({ row: r, channel: "whatsapp" })}
              >
                <MessageCircle className="mr-1 size-3" />{" "}
                {bn ? "রিট্রাই WhatsApp" : "Retry WhatsApp"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
