import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { dayKey, nextDays, slotLabel, slotStates, useSlotAvailability } from "@/lib/slots";

type Order = {
  id: string;
  order_no: number;
  status: string;
  slot: string | null;
  customer_phone: string | null;
};

/** Orders can only be changed before the rider leaves. */
export function canChangeOrder(status: string) {
  return !["delivered", "cancelled", "shipped"].includes(status);
}

function reasonText(code: string, bn: boolean) {
  const map: Record<string, [string, string]> = {
    not_found: ["Order not found", "অর্ডার পাওয়া যায়নি"],
    forbidden: ["This order is not yours", "এই অর্ডারটি আপনার নয়"],
    too_late: ["Too late to change this order", "এই অর্ডার আর পরিবর্তন করা যাবে না"],
    on_the_way: ["The rider is already on the way", "রাইডার ইতিমধ্যে রওনা দিয়েছেন"],
    full: ["That slot just filled up", "স্লটটি এইমাত্র পূর্ণ হয়ে গেছে"],
    closed: ["That slot is closed", "স্লটটি বন্ধ"],
    past: ["Choose a future date", "ভবিষ্যতের তারিখ বেছে নিন"],
  };
  const pair = map[code] ?? [code, code];
  return bn ? pair[1] : pair[0];
}

/** Customer self-service: cancel an order or move it to another delivery window. */
export function OrderActions({ order }: { order: Order }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [openResched, setOpenResched] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [day, setDay] = useState(() => dayKey(nextDays(1)[0]));
  const [slotId, setSlotId] = useState("");

  const avail = useSlotAvailability(day, openResched);
  const slots = useMemo(() => slotStates(day, avail.data), [day, avail.data]);
  const chosen = slots.find((s) => s.slot.id === slotId);
  const alternatives = useMemo(() => slots.filter((s) => s.bookable).slice(0, 3), [slots]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-orders-page"] });
    qc.invalidateQueries({ queryKey: ["slot-availability"] });
  };

  const cancel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("customer_cancel_order", {
        _order_id: order.id,
        _phone: order.customer_phone ?? "",
        _reason: reason.trim() || undefined,
      });
      if (error) throw error;
      if (data !== "ok") throw new Error(reasonText(String(data), bn));
      return data;
    },
    onSuccess: () => {
      setOpenCancel(false);
      setReason("");
      refresh();
      toast.success(bn ? "অর্ডার বাতিল হয়েছে" : "Order cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error(bn ? "একটি স্লট বেছে নিন" : "Pick a delivery slot");
      const { data, error } = await supabase.rpc("customer_reschedule_order", {
        _order_id: order.id,
        _phone: order.customer_phone ?? "",
        _slot_date: day,
        _slot_id: slotId,
        _slot_label: slotLabel(day, slotId, bn),
      });
      if (error) throw error;
      if (data !== "ok") throw new Error(reasonText(String(data), bn));
      return data;
    },
    onSuccess: () => {
      setOpenResched(false);
      refresh();
      toast.success(bn ? "নতুন সময় নির্ধারিত হয়েছে" : "Delivery rescheduled");
    },
    onError: (e: Error) => {
      void avail.refetch();
      toast.error(e.message);
    },
  });

  if (!canChangeOrder(order.status)) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpenResched(true)}>
        <CalendarClock className="mr-1 size-4" />
        {bn ? "সময় পরিবর্তন" : "Reschedule"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={() => setOpenCancel(true)}
      >
        <XCircle className="mr-1 size-4" />
        {bn ? "বাতিল করুন" : "Cancel"}
      </Button>

      {/* Reschedule */}
      <Dialog open={openResched} onOpenChange={setOpenResched}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bn ? "ডেলিভারির সময় পরিবর্তন" : "Change delivery time"} · #{num(order.order_no, lang)}
            </DialogTitle>
            <DialogDescription>
              {bn
                ? "লাইভ অ্যাভেইলেবিলিটি অনুযায়ী নতুন তারিখ ও স্লট বেছে নিন।"
                : "Pick a new date and slot — availability is checked live."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {nextDays(5).map((d) => {
                const key = dayKey(d);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={day === key}
                    onClick={() => {
                      setDay(key);
                      setSlotId("");
                    }}
                    className={cn(
                      "min-h-10 rounded-xl border px-3 py-2 text-xs",
                      day === key
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border",
                    )}
                  >
                    {d.toLocaleDateString(bn ? "bn-BD" : "en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {slots.map((st) => (
                <button
                  key={st.slot.id}
                  type="button"
                  disabled={!st.bookable}
                  aria-pressed={slotId === st.slot.id}
                  onClick={() => setSlotId(st.slot.id)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 py-2 text-left text-xs",
                    !st.bookable && "cursor-not-allowed opacity-40",
                    slotId === st.slot.id
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border",
                  )}
                >
                  <span className="block">{bn ? st.slot.bn : st.slot.en}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                    {st.passed
                      ? bn
                        ? "সময় পার"
                        : "Passed"
                      : st.available <= 0
                        ? bn
                          ? "পূর্ণ"
                          : "Full"
                        : bn
                          ? `${num(st.available, lang)} টি বাকি`
                          : `${st.available} left`}
                  </span>
                </button>
              ))}
            </div>

            {avail.isFetching && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {bn ? "অ্যাভেইলেবিলিটি যাচাই হচ্ছে…" : "Checking availability…"}
              </p>
            )}

            {chosen && !chosen.bookable && alternatives.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="font-semibold">
                  {bn ? "বিকল্প স্লট:" : "Alternative slots:"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternatives.map((a) => (
                    <button
                      key={a.slot.id}
                      type="button"
                      onClick={() => setSlotId(a.slot.id)}
                      className="rounded-lg border border-border bg-background px-2 py-1"
                    >
                      {bn ? a.slot.bn : a.slot.en}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenResched(false)}>
              {bn ? "ফিরে যান" : "Back"}
            </Button>
            <Button onClick={() => reschedule.mutate()} disabled={reschedule.isPending || !slotId}>
              {bn ? "সময় নিশ্চিত করুন" : "Confirm new time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bn ? "অর্ডার বাতিল" : "Cancel order"} · #{num(order.order_no, lang)}
            </DialogTitle>
            <DialogDescription>
              {bn
                ? "রাইডার রওনা দেওয়ার আগ পর্যন্ত বাতিল করা যাবে।"
                : "You can cancel until the rider leaves with your order."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={bn ? "কারণ (ঐচ্ছিক)" : "Reason (optional)"}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCancel(false)}>
              {bn ? "না, থাক" : "Keep order"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              {bn ? "হ্যাঁ, বাতিল করুন" : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
