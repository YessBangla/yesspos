/**
 * Header delivery-area chip.
 *
 * Tapping the chip opens a touch-friendly zone picker; choosing a zone updates
 * the base delivery charge and ETA used by the cart drawer and checkout.
 */
import { useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DELIVERY_AREAS, useDeliveryArea } from "@/lib/delivery-area";
import { money, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DeliveryAreaPicker({ className }: { className?: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { area, setArea } = useDeliveryArea();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={bn ? "ডেলিভারি এরিয়া বদলান" : "Change delivery area"}
        className={cn(
          "flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary",
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
          <DialogTitle>{bn ? "ডেলিভারি এরিয়া বেছে নিন" : "Choose delivery area"}</DialogTitle>
          <DialogDescription>
            {bn
              ? "এরিয়া অনুযায়ী ডেলিভারি চার্জ ও আনুমানিক সময় নির্ধারিত হবে। ৳১০০০+ অর্ডারে ডেলিভারি ফ্রি।"
              : "The charge and estimated time depend on your area. Delivery is free above ৳1000."}
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 max-h-[55vh] overflow-y-auto px-2">
          {DELIVERY_AREAS.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setArea(a);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition-colors hover:bg-muted",
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
      </DialogContent>
    </Dialog>
  );
}
