/**
 * Touch-friendly cart drawer shared by the storefront header and menu bar.
 *
 * Step 1 shows every line with large +/- controls, live stock limits, a promo
 * code field, the area-based delivery charge, a delivery date/time window
 * picker and a checkout button. Step 2 is an in-drawer express checkout with
 * the full pricing calculation. Orders placed while offline are queued and the
 * queue status (pending / retrying / failed) is shown with a retry button.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DeliveryAreaPicker } from "@/components/DeliveryAreaPicker";
import { DeliverySlotPicker, type SlotChoice } from "@/components/DeliverySlotPicker";
import { CheckoutQueueStatus } from "@/components/CheckoutQueueStatus";
import { useDeliveryArea } from "@/lib/delivery-area";
import { applyStockLimits, clampQty, deliveryFeeFor, useShopCart } from "@/lib/shop-cart";
import { queueOrder, updatePendingPayment } from "@/lib/delivery-queue";
import { CHECKOUT_PAYMENTS, paymentLabel, type CheckoutPaymentId } from "@/lib/checkout-payment";
import { saveOrderSnapshot } from "@/lib/order-snapshot";

import { applyCoupon } from "@/lib/coupon";
import { slotLabel, slotText } from "@/lib/slots";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";

const formSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/),
  address: z.string().trim().min(8).max(300),
  note: z.string().trim().max(200).optional(),
});

export function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided the checkout button hands off to the host page's flow. */
  onCheckout?: () => void;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();
  const { area } = useDeliveryArea();

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [slot, setSlot] = useState<SlotChoice>(null);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [payment, setPayment] = useState<CheckoutPaymentId>("cod");
  /** Polite screen-reader announcements for every cart/checkout change. */
  const [announce, setAnnounce] = useState("");
  const navigate = useNavigate();



  const ids = cart.lines.map((l) => l.id).sort().join(",");

  // --- live stock for the products in the cart ---
  const stock = useQuery({
    queryKey: ["cart-stock", ids],
    enabled: open && ids.length > 0,
    staleTime: 15_000,
    refetchInterval: open ? 60_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,stock,is_active")
        .in("id", ids.split(","));
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const p of data ?? []) map[p.id] = p.is_active === false ? 0 : Number(p.stock ?? 0);
      return map;
    },
  });

  useEffect(() => {
    if (!stock.data) return;
    const adjusted = applyStockLimits(stock.data);
    if (adjusted.length === 0) return;
    const first = adjusted[0];
    const name = bn ? first.line.name_bn : first.line.name_en;
    const msg =
      first.to === 0
        ? bn
          ? `"${name}" এখন স্টকে নেই — কার্ট থেকে সরানো হয়েছে`
          : `"${name}" is out of stock and was removed`
        : bn
          ? `"${name}" শুধু ${num(first.to, lang)}টি পাওয়া যাচ্ছে`
          : `Only ${first.to} of "${name}" available`;
    toast.warning(msg);
    setAnnounce(msg);
  }, [stock.data, bn, lang]);

  const stockFor = (id: string) => stock.data?.[id];

  // --- pricing ---
  const fee = deliveryFeeFor(cart.subtotal, area.fee);
  const discount = useMemo(
    () => (coupon ? Math.min(coupon.discount, cart.subtotal) : 0),
    [coupon, cart.subtotal],
  );
  const total = Math.max(0, cart.subtotal - discount) + fee;

  // Announce every recalculated total so keyboard/screen-reader users follow along.
  useEffect(() => {
    if (!open || cart.lines.length === 0) return;
    setAnnounce(
      bn
        ? `সর্বমোট হালনাগাদ: ${money(total, lang)}, ${num(cart.count, lang)}টি পণ্য`
        : `Total updated: ${money(total, lang)} for ${cart.count} item(s)`,
    );
  }, [total, cart.count, open, bn, lang, cart.lines.length]);

  // Announce the delivery window whenever it changes.
  useEffect(() => {
    if (!slot?.slotId) return;
    setAnnounce(
      bn
        ? `ডেলিভারি সময় নির্বাচিত: ${slotLabel(slot.day, slot.slotId, true)}`
        : `Delivery slot selected: ${slotLabel(slot.day, slot.slotId, false)}`,
    );
  }, [slot, bn]);

  // Re-validate a live coupon whenever the cart value changes.
  useEffect(() => {
    if (!coupon) return;
    if (cart.subtotal <= 0) {
      setCoupon(null);
      setCouponMsg(null);
      return;
    }
    let cancelled = false;
    void applyCoupon(coupon.code, cart.subtotal, bn).then((r) => {
      if (cancelled) return;
      if (r.ok) setCoupon({ code: r.code, discount: r.discount });
      else {
        setCoupon(null);
        setCouponMsg({ ok: false, text: r.message });
        setAnnounce(r.message);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.subtotal]);

  async function submitCoupon() {
    if (!code.trim()) return;
    setCheckingCoupon(true);
    try {
      const r = await applyCoupon(code, cart.subtotal, bn);
      setCouponMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setCoupon({ code: r.code, discount: r.discount });
        setCode("");
        setAnnounce(
          bn
            ? `${r.code} প্রয়োগ হয়েছে — ছাড় ${money(r.discount, lang)}`
            : `${r.code} applied — ${money(r.discount, lang)} off`,
        );
      } else {
        setCoupon(null);
        setAnnounce(r.message);
      }
    } finally {
      setCheckingCoupon(false);
    }
  }


  // Reopening the drawer always starts on the cart list.
  useEffect(() => {
    if (!open) {
      setStep("cart");
      setPlaced(null);
      setErrs({});
    }
  }, [open]);

  function validate() {
    const parsed = formSchema.safeParse(form);
    const fields: Record<string, string> = {};
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      if (f.name) fields.name = bn ? "নাম লিখুন (২+ অক্ষর)" : "Enter your name (2+ characters)";
      if (f.phone) fields.phone = bn ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)";
      if (f.address) fields.address = bn ? "সম্পূর্ণ ঠিকানা লিখুন" : "Enter your full address";
      if (f.note) fields.note = bn ? "নোট ছোট করুন" : "Note is too long";
    }
    return { parsed, fields };
  }

  async function placeOrder() {
    const { parsed, fields } = validate();
    setErrs(fields);
    if (!parsed.success || cart.lines.length === 0) {
      toast.error(
        Object.values(fields)[0] ?? (bn ? "কার্ট খালি" : "Your cart is empty"),
      );
      return;
    }

    const hasSlot = !!slot?.slotId;
    const slotName = hasSlot ? slotLabel(slot!.day, slot!.slotId, bn) : bn ? area.eta_bn : area.eta_en;
    const orderRow = {
      customer_name: parsed.data.name,
      customer_phone: parsed.data.phone,
      address: parsed.data.address,
      area: bn ? area.bn : area.en,
      note: parsed.data.note || null,
      slot: slotName,
      slot_date: hasSlot ? slot!.day : null,
      slot_id: hasSlot ? slot!.slotId : null,
      payment_method: payment,
      subtotal: cart.subtotal,
      discount,
      coupon_code: coupon?.code ?? null,
      delivery_fee: fee,
      total,
    };
    const items = cart.lines.map((l) => ({
      product_id: l.id,
      name_snapshot: bn ? l.name_bn : l.name_en,
      unit_price: l.price,
      quantity: l.qty,
      line_total: l.price * l.qty,
    }));
    const snapshotBase = {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      area: bn ? area.bn : area.en,
      slot: slotName,
      paymentMethod: payment,
      paymentLabel: paymentLabel(payment, bn),
      subtotal: cart.subtotal,
      discount,
      couponCode: coupon?.code ?? null,
      deliveryFee: fee,
      total,
      lines: cart.lines.map((l) => ({
        name: bn ? l.name_bn : l.name_en,
        qty: l.qty,
        price: l.price,
        line_total: l.price * l.qty,
      })),
      createdAt: new Date().toISOString(),
    };

    function finish(orderNo: number | null, queueId: string | null) {
      saveOrderSnapshot({ ...snapshotBase, orderNo, queueId });
      cart.clear();
      setCoupon(null);
      setPlaced(orderNo ?? 0);
      onOpenChange(false);
      void navigate({ to: "/order-confirmed" });
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const entry = await queueOrder(orderRow, items);
      toast.success(
        bn
          ? "অফলাইন — অনলাইনে এলে অর্ডার স্বয়ংক্রিয়ভাবে যাবে"
          : "Offline — your order will be sent automatically when you reconnect",
      );
      setAnnounce(bn ? "অর্ডার সারিতে রাখা হয়েছে" : "Order queued");
      finish(null, entry.id);
      return;
    }

    setPlacing(true);
    try {
      const { data, error } = await supabase
        .from("delivery_orders")
        .insert(orderRow)
        .select("id,order_no")
        .single();
      if (error) throw error;
      const { error: itemErr } = await supabase
        .from("delivery_order_items")
        .insert(items.map((i) => ({ ...i, order_id: data.id })));
      if (itemErr) throw itemErr;

      toast.success(bn ? "অর্ডার নিশ্চিত হয়েছে" : "Order confirmed");
      setAnnounce(bn ? "অর্ডার নিশ্চিত হয়েছে" : "Order confirmed");
      finish(Number(data.order_no), null);
    } catch {
      const entry = await queueOrder(orderRow, items);
      toast.warning(
        bn
          ? "নেটওয়ার্ক সমস্যা — অর্ডার সারিতে রাখা হয়েছে"
          : "Network issue — your order was queued and will retry",
      );
      setAnnounce(bn ? "অর্ডার সারিতে রাখা হয়েছে" : "Order queued");
      finish(null, entry.id);
    } finally {
      setPlacing(false);
    }

  }

  const couponBox = (
    <div className="space-y-1.5">
      {coupon ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <BadgePercent className="size-3.5 text-primary" />
          <span className="font-bold text-primary">{coupon.code}</span>
          <span className="text-muted-foreground">
            −{money(discount, lang)}
          </span>
          <button
            type="button"
            aria-label={bn ? "কুপন সরান" : "Remove coupon"}
            onClick={() => {
              setCoupon(null);
              setCouponMsg(null);
            }}
            className="ml-auto grid size-6 place-items-center rounded-full hover:bg-background"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitCoupon();
              }
            }}
            placeholder={bn ? "প্রোমো কোড" : "Promo code"}
            aria-label={bn ? "প্রোমো কোড" : "Promo code"}
            className="h-10 rounded-full text-sm uppercase"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 rounded-full"
            disabled={checkingCoupon || !code.trim() || cart.subtotal <= 0}
            onClick={() => void submitCoupon()}
          >
            {checkingCoupon ? <Loader2 className="size-4 animate-spin" /> : bn ? "প্রয়োগ" : "Apply"}
          </Button>
        </div>
      )}
      {couponMsg && !coupon && (
        <p className="text-xs font-medium text-destructive">{couponMsg.text}</p>
      )}
    </div>
  );

  const summary = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{bn ? "ডেলিভারি এরিয়া" : "Delivery area"}</span>
        <DeliveryAreaPicker className="h-9" />
      </div>
      <DeliverySlotPicker value={slot} onChange={setSlot} />
      {couponBox}
      <Line label={bn ? "সাবটোটাল" : "Subtotal"} value={money(cart.subtotal, lang)} />
      {discount > 0 && (
        <Line
          label={`${bn ? "ছাড়" : "Discount"} · ${coupon?.code ?? ""}`}
          value={`− ${money(discount, lang)}`}
        />
      )}
      <Line
        label={`${bn ? "ডেলিভারি" : "Delivery"} · ${
          slot?.slotId ? slotText(slot.slotId, bn) : bn ? area.eta_bn : area.eta_en
        }`}
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
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-label={bn ? "কার্ট ও চেকআউট" : "Cart and checkout"}
        className="flex w-[92vw] max-w-md flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2">
            {step === "checkout" && !placed && (
              <button
                type="button"
                onClick={() => setStep("cart")}
                aria-label={bn ? "কার্টে ফিরুন" : "Back to cart"}
                className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <ShoppingBasket className="size-4 text-primary" />
            {placed !== null
              ? bn
                ? "অর্ডার সম্পন্ন"
                : "Order placed"
              : step === "cart"
                ? bn
                  ? "আপনার কার্ট"
                  : "Your cart"
                : bn
                  ? "দ্রুত চেকআউট"
                  : "Express checkout"}
            {step === "cart" && placed === null && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                {num(cart.count, lang)}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {placed !== null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
            <CheckCircle2 className="size-12 text-primary" />
            <p className="text-lg font-bold">
              {placed > 0
                ? bn
                  ? `অর্ডার নম্বর #${num(placed, lang)}`
                  : `Order #${num(placed, lang)}`
                : bn
                  ? "অর্ডার সারিতে রাখা হয়েছে"
                  : "Order queued"}
            </p>
            <p className="text-sm text-muted-foreground">
              {bn
                ? "আমাদের টিম শীঘ্রই কল করে অর্ডার নিশ্চিত করবে।"
                : "Our team will call you shortly to confirm."}
            </p>
            <div className="w-full text-left">
              <CheckoutQueueStatus />
            </div>
            <Button
              className="mt-2 w-full rounded-full"
              onClick={() => onOpenChange(false)}
              size="lg"
            >
              {bn ? "কেনাকাটা চালিয়ে যান" : "Continue shopping"}
            </Button>
          </div>
        ) : step === "cart" ? (
          <>
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {cart.lines.map((l) => {
                const max = stockFor(l.id);
                const atMax = clampQty(l.qty + 1, max ?? l.stock) === l.qty;
                return (
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
                          disabled={atMax}
                          onClick={() => {
                            const next = clampQty(l.qty + 1, max ?? l.stock);
                            if (next === l.qty) {
                              toast.warning(
                                bn
                                  ? `আর যোগ করা যাবে না — স্টকে ${num(l.qty, lang)}টি আছে`
                                  : `No more available — only ${l.qty} in stock`,
                              );
                              return;
                            }
                            cart.setQty(l.id, next);
                          }}
                          className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="size-4" />
                        </button>
                        <span className="ml-auto text-sm font-bold text-primary">
                          {money(l.price * l.qty, lang)}
                        </span>
                      </div>
                      {typeof max === "number" && max > 0 && max <= 5 && (
                        <p className="mt-1 text-[11px] font-medium text-amber-600">
                          {bn ? `স্টকে মাত্র ${num(max, lang)}টি` : `Only ${max} left in stock`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
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
              <div className="p-3">
                <CheckoutQueueStatus />
              </div>
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto border-t border-border bg-muted/40 p-4">
              {summary}
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
                <>
                  <Button
                    size="lg"
                    className="w-full rounded-full font-semibold"
                    disabled={cart.lines.length === 0}
                    onClick={() => setStep("checkout")}
                  >
                    {bn ? "দ্রুত চেকআউট" : "Express checkout"}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full rounded-full font-semibold"
                  >
                    <Link to="/" search={{ checkout: true }} onClick={() => onOpenChange(false)}>
                      {bn ? "সম্পূর্ণ চেকআউট পেজ" : "Full checkout page"}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <form
              id="drawer-checkout"
              className="flex-1 space-y-3 overflow-y-auto p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void placeOrder();
              }}
            >
              <Field
                id="dc-name"
                label={bn ? "আপনার নাম" : "Your name"}
                error={errs.name}
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                autoComplete="name"
              />
              <Field
                id="dc-phone"
                label={bn ? "মোবাইল নম্বর" : "Mobile number"}
                error={errs.phone}
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
              />
              <div className="space-y-1.5">
                <Label htmlFor="dc-address">{bn ? "সম্পূর্ণ ঠিকানা" : "Full address"}</Label>
                <Textarea
                  id="dc-address"
                  rows={3}
                  value={form.address}
                  aria-invalid={!!errs.address}
                  aria-describedby={errs.address ? "dc-address-err" : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="text-base"
                />
                {errs.address && (
                  <p id="dc-address-err" className="text-xs font-medium text-destructive">
                    {errs.address}
                  </p>
                )}
              </div>
              <Field
                id="dc-note"
                label={bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
                value={form.note}
                onChange={(v) => setForm((f) => ({ ...f, note: v }))}
              />
              <div className="rounded-2xl border border-border bg-muted/40 p-3">{summary}</div>
              <CheckoutQueueStatus />
              <p className="text-xs text-muted-foreground">
                {bn
                  ? "পেমেন্ট: ক্যাশ অন ডেলিভারি"
                  : "Payment: cash on delivery"}
              </p>
            </form>
            <div className="border-t border-border bg-muted/40 p-4">
              <Button
                form="drawer-checkout"
                type="submit"
                size="lg"
                disabled={placing || cart.lines.length === 0}
                className="w-full rounded-full font-semibold"
              >
                {placing
                  ? bn
                    ? "পাঠানো হচ্ছে…"
                    : "Placing…"
                  : `${bn ? "অর্ডার নিশ্চিত করুন" : "Confirm order"} · ${money(total, lang)}`}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 text-base"
        {...rest}
      />
      {error && (
        <p id={`${id}-err`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
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
