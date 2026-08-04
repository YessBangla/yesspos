/**
 * Touch-friendly cart drawer shared by the storefront header and menu bar.
 *
 * Shows every line with large +/- controls, the area-based delivery charge and
 * a checkout button. Rendered as a right-side sheet on desktop and a
 * full-height panel on mobile.
 */
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DeliveryAreaPicker } from "@/components/DeliveryAreaPicker";
import { useDeliveryArea } from "@/lib/delivery-area";
import { deliveryFeeFor, useShopCart } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";

export function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When omitted the checkout button links to the homepage checkout flow. */
  onCheckout?: () => void;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();
  const { area } = useDeliveryArea();
  const fee = deliveryFeeFor(cart.subtotal, area.fee);
  const total = cart.subtotal + fee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[92vw] max-w-md flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBasket className="size-4 text-primary" />
            {bn ? "আপনার কার্ট" : "Your cart"}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {num(cart.count, lang)}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {cart.lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3">
              {l.image_url ? (
                <img
                  src={l.image_url}
                  alt=""
                  loading="lazy"
                  className="size-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="size-14 shrink-0 rounded-xl bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{bn ? l.name_bn : l.name_en}</p>
                <p className="text-xs text-muted-foreground">
                  {l.pack_size ? `${l.pack_size} · ` : ""}
                  {money(l.price, lang)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={bn ? "কমান" : "Decrease"}
                    onClick={() => cart.setQty(l.id, l.qty - 1)}
                    className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted"
                  >
                    {l.qty <= 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                  </button>
                  <span className="min-w-6 text-center text-sm font-bold">
                    {num(l.qty, lang)}
                  </span>
                  <button
                    type="button"
                    aria-label={bn ? "বাড়ান" : "Increase"}
                    onClick={() => cart.setQty(l.id, l.qty + 1)}
                    className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted"
                  >
                    <Plus className="size-4" />
                  </button>
                  <span className="ml-auto text-sm font-bold text-primary">
                    {money(l.price * l.qty, lang)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {cart.lines.length === 0 && (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <ShoppingBasket className="size-5" />
              </span>
              <p className="mt-3 text-sm text-muted-foreground">
                {bn ? "কার্ট খালি — পণ্য যোগ করুন" : "Cart is empty — add some products"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{bn ? "ডেলিভারি এরিয়া" : "Delivery area"}</span>
            <DeliveryAreaPicker className="h-9" />
          </div>
          <Line label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
          <Line
            label={`${bn ? "ডেলিভারি" : "Delivery"} · ${bn ? area.eta_bn : area.eta_en}`}
            value={fee === 0 ? (bn ? "ফ্রি" : "Free") : money(fee, lang)}
          />
          <Line label={bn ? "সর্বমোট" : "Total"} value={money(total, lang)} bold />
          {cart.subtotal > 0 && cart.subtotal < 1000 && (
            <p className="rounded-xl bg-accent/25 px-3 py-2 text-xs font-medium text-accent-foreground">
              {bn
                ? `আর ${money(1000 - cart.subtotal, lang)} কিনলে ডেলিভারি ফ্রি`
                : `Add ${money(1000 - cart.subtotal, lang)} more for free delivery`}
            </p>
          )}
          {onCheckout ? (
            <Button
              size="lg"
              className="w-full rounded-full font-semibold"
              disabled={cart.lines.length === 0}
              onClick={() => {
                onOpenChange(false);
                onCheckout();
              }}
            >
              {bn ? "চেকআউট" : "Checkout"}
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="w-full rounded-full font-semibold"
              disabled={cart.lines.length === 0}
            >
              <Link to="/" search={{ checkout: true }} onClick={() => onOpenChange(false)}>
                {bn ? "চেকআউট" : "Checkout"}
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
