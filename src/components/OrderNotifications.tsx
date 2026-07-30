import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Copy, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { copyMessage, shareOnSms, shareOnWhatsApp } from "@/lib/share-invoice";

export type CustomerNotification = {
  id: string;
  order_id: string | null;
  order_no: number | null;
  customer_phone: string | null;
  channel: string;
  title: string;
  body: string;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
};

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
        .select("id,order_id,order_no,customer_phone,channel,title,body,is_sent,sent_at,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CustomerNotification[];
    },
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_notifications")
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-notifications", orderId] });
      qc.invalidateQueries({ queryKey: ["pending-notifications"] });
      toast.success(bn ? "পাঠানো হিসেবে চিহ্নিত" : "Marked as sent");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = list.data ?? [];

  return (
    <div className="rounded-lg border border-border p-2">
      <p className="mb-1 text-xs font-semibold">
        <BellRing className="mr-1 inline size-3.5 text-primary" />
        {bn ? "গ্রাহক নোটিফিকেশন" : "Customer notifications"}
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
              <span
                className={
                  n.is_sent
                    ? "rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary"
                    : "rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive"
                }
              >
                {n.is_sent ? (bn ? "পাঠানো হয়েছে" : "Sent") : bn ? "অপেক্ষমাণ" : "Pending"}
              </span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{n.body}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {(n.sent_at ?? n.created_at).slice(0, 16).replace("T", " ")}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => {
                  if (!phone) return toast.error(bn ? "ফোন নম্বর নেই" : "No phone number");
                  shareOnSms(phone, n.body);
                  markSent.mutate(n.id);
                }}
              >
                <Smartphone className="mr-1 size-3" /> SMS
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => {
                  shareOnWhatsApp(phone ?? "", n.body);
                  markSent.mutate(n.id);
                }}
              >
                <MessageCircle className="mr-1 size-3" /> WhatsApp
              </Button>
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
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => markSent.mutate(n.id)}>
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
