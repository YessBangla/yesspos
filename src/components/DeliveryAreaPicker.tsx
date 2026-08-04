/**
 * Header delivery-area chip.
 *
 * Tapping the chip opens a touch-friendly zone picker. Choosing a zone shows a
 * confirmation step with the new delivery charge, ETA and the recalculated
 * cart total; confirming applies it everywhere in real time.
 */
import { useState } from "react";
import { Check, ChevronDown, Clock, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DELIVERY_AREAS, useDeliveryArea, type DeliveryArea } from "@/lib/delivery-area";
import { deliveryFeeFor, useShopCart } from "@/lib/shop-cart";
import { money, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DeliveryAreaPicker({ className }: { className?: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { area, setArea } = useDeliveryArea();
  const cart = useShopCart();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DeliveryArea | null>(null);

  const currentFee = deliveryFeeFor(cart.subtotal, area.fee);
  const nextFee = pending ? deliveryFeeFor(cart.subtotal, pending.fee) : currentFee;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPending(null);
      }}
    >
      <DialogTrigger
        aria-label={bn ? "ডেলিভারি এরিয়া বদলান" : "Change delivery area"}
        className={cn(
          "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
      >
        <MapPin className="size-3.5 text-primary" />
        <span className="hidden sm:inline">{bn ? "ডেলিভারি:" : "Deliver to:"}</span>
        <span className="max-w-28 truncate font-semibold text-foreground">
          {bn ? area.bn : area.en}
        </span>
        <ChevronDown className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pending
              ? bn
                ? "এরিয়া নিশ্চিত করুন"
                : "Confirm delivery area"
              : bn
                ? "ডেলিভারি এরিয়া বেছে নিন"
                : "Choose delivery area"}
          </DialogTitle>
          <DialogDescription>
            {bn
              ? "এরিয়া অনুযায়ী ডেলিভারি চার্জ ও আনুমানিক সময় নির্ধারিত হবে। ৳১০০০+ অর্ডারে ডেলিভারি ফ্রি।"
              : "The charge and estimated time depend on your area. Delivery is free above ৳1000."}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="flex items-center gap-2 text-base font-bold">
                <MapPin className="size-4 text-primary" />
                {bn ? pending.bn : pending.en}
              </p>
              <p className="mt-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="size-3.5" />
                  {bn ? "ডেলিভারি চার্জ" : "Delivery charge"}
                </span>
                <span className="font-semibold">
                  {nextFee === 0 ? (bn ? "ফ্রি" : "Free") : money(nextFee, lang)}
                  {nextFee !== currentFee && cart.subtotal > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">
                      {currentFee === 0 ? (bn ? "ফ্রি" : "Free") : money(currentFee, lang)}
                    </span>
                  )}
                </span>
              </p>
              <p className="mt-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  {bn ? "আনুমানিক সময়" : "Estimated time"}
                </span>
                <span className="font-semibold">{bn ? pending.eta_bn : pending.eta_en}</span>
              </p>
              {cart.subtotal > 0 && (
                <p className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-base">
                  <span className="font-medium">{bn ? "নতুন কার্ট টোটাল" : "New cart total"}</span>
                  <span className="font-display font-extrabold text-primary">
                    {money(cart.subtotal + nextFee, lang)}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 rounded-full"
                onClick={() => setPending(null)}
              >
                {bn ? "ফিরে যান" : "Back"}
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full font-semibold"
                onClick={() => {
                  setArea(pending);
                  setPending(null);
                  setOpen(false);
                }}
              >
                {bn ? "নিশ্চিত করুন" : "Confirm"}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="-mx-2 max-h-[55vh] overflow-y-auto px-2">
            {DELIVERY_AREAS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setPending(a)}
                  aria-current={a.id === area.id ? "true" : undefined}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    a.id === area.id && "bg-primary/10",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{bn ? a.bn : a.en}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {bn ? a.eta_bn : a.eta_en}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
                    {money(a.fee, lang)}
                    {a.id === area.id && <Check className="size-4" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
