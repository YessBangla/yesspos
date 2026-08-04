/**
 * Live delivery tracking timeline for a placed order.
 *
 * Polls the public tracking function with the order number + phone, so the
 * customer sees pending → confirmed → packed → on the way → delivered without
 * leaving the confirmation page.
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

function label(step: string, bn: boolean) {
  const map: Record<string, [string, string]> = {
    pending: ["গৃহীত", "Order placed"],
    confirmed: ["নিশ্চিত", "Confirmed"],
    packed: ["প্যাক হয়েছে", "Packed"],
    shipped: ["পথে আছে", "On the way"],
    delivered: ["ডেলিভারড", "Delivered"],
    cancelled: ["বাতিল", "Cancelled"],
  };
  const pair = map[step] ?? [step, step];
  return bn ? pair[0] : pair[1];
}

export function OrderTimeline({ orderNo, phone }: { orderNo: number; phone: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const track = useQuery({
    queryKey: ["order-timeline", orderNo, phone],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_delivery_order", {
        _order_no: orderNo,
        _phone: phone,
      });
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

  const status = track.data?.status ?? "pending";
  const cancelled = status === "cancelled";
  const idx = FLOW.indexOf(status as (typeof FLOW)[number]);

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Truck className="size-4 text-primary" />
        {bn ? "ডেলিভারি ট্র্যাকিং" : "Delivery tracking"}
        {track.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </h2>

      {cancelled ? (
        <p className="mt-3 text-sm font-semibold text-destructive">{label("cancelled", bn)}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {FLOW.map((step, i) => {
            const done = idx >= i;
            const current = idx === i;
            return (
              <li key={step} className="flex items-start gap-3">
                {done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                )}
                <span
                  className={`text-sm ${current ? "font-bold" : done ? "font-medium" : "text-muted-foreground"}`}
                  aria-current={current ? "step" : undefined}
                >
                  {label(step, bn)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {track.data?.rider_name && (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs">
          {bn ? "রাইডার" : "Rider"}: <strong>{track.data.rider_name}</strong>
          {track.data.rider_phone ? ` · ${track.data.rider_phone}` : ""}
        </p>
      )}
    </section>
  );
}
