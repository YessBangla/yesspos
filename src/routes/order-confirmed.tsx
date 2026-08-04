import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, MapPin, PackageCheck, Truck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckoutQueueStatus } from "@/components/CheckoutQueueStatus";
import { OrderTimeline } from "@/components/OrderTimeline";
import { money, num, useI18n } from "@/lib/i18n";
import { readOrderSnapshot, type OrderSnapshot } from "@/lib/order-snapshot";
import { downloadReceipt } from "@/lib/receipt-pdf";
import { paymentLabel } from "@/lib/checkout-payment";
import { listQueuedOrders, subscribeQueue, syncQueuedOrders } from "@/lib/delivery-queue";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/order-confirmed")({
  head: () => ({
    meta: [
      { title: "Order confirmed — Bazar Bari grocery delivery" },
      {
        name: "description",
        content:
          "Your Bazar Bari order summary with applied discounts, delivery slot and live checkout queue status.",
      },
      { property: "og:title", content: "Order confirmed — Bazar Bari" },
      {
        property: "og:description",
        content: "Order summary, discounts and delivery slot for your grocery order.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/order-confirmed` },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/order-confirmed` }],
  }),
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [snap, setSnap] = useState<OrderSnapshot | null>(null);
  const [liveOrderNo, setLiveOrderNo] = useState<number | null>(null);

  useEffect(() => {
    setSnap(readOrderSnapshot());
  }, []);

  // A queued order gets its number as soon as the replay succeeds.
  useEffect(() => {
    if (!snap?.queueId) return;
    const check = () => {
      void listQueuedOrders().then((rows) => {
        const mine = rows.find((r) => r.id === snap.queueId);
        if (mine?.status === "done" && mine.orderNo) setLiveOrderNo(mine.orderNo);
      });
    };
    check();
    void syncQueuedOrders();
    const unsub = subscribeQueue(check);
    return () => {
      unsub();
    };
  }, [snap?.queueId]);


  const orderNo = snap?.orderNo ?? liveOrderNo;
  const queued = !orderNo;

  const paymentText = useMemo(
    () => (snap ? snap.paymentLabel || paymentLabel(snap.paymentMethod, bn) : ""),
    [snap, bn],
  );

  if (!snap) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <PackageCheck className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">
          {bn ? "কোনো সাম্প্রতিক অর্ডার পাওয়া যায়নি" : "No recent order found"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {bn
            ? "অর্ডার নম্বর ও মোবাইল দিয়ে ট্র্যাক করুন অথবা কেনাকাটা শুরু করুন।"
            : "Track with your order number and phone, or start shopping."}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/track">{bn ? "অর্ডার ট্র্যাক" : "Track order"}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/">{bn ? "কেনাকাটা" : "Shop now"}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <section
        aria-live="polite"
        className="rounded-3xl border border-primary/30 bg-primary/5 p-6 text-center"
      >
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-3 text-2xl font-black">
          {queued
            ? bn
              ? "অর্ডার সারিতে রাখা হয়েছে"
              : "Order queued"
            : bn
              ? "অর্ডার নিশ্চিত হয়েছে"
              : "Order confirmed"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {queued
            ? bn
              ? "ইন্টারনেট ফিরলেই অর্ডারটি স্বয়ংক্রিয়ভাবে পাঠানো হবে।"
              : "It will be sent automatically as soon as you are back online."
            : bn
              ? `অর্ডার নম্বর #${num(orderNo!, lang)} — আমাদের টিম শীঘ্রই কল করবে।`
              : `Order #${orderNo} — our team will call you shortly.`}
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "অর্ডার সারাংশ" : "Order summary"}
        </h2>
        <ul className="mt-3 divide-y divide-border">
          {snap.lines.map((l, i) => (
            <li key={`${l.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {l.name} <span className="text-muted-foreground">× {num(l.qty, lang)}</span>
              </span>
              <span className="font-semibold">{money(l.line_total, lang)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
          <Row label={bn ? "সাবটোটাল" : "Subtotal"} value={money(snap.subtotal, lang)} />
          {snap.discount > 0 && (
            <Row
              label={`${bn ? "ছাড়" : "Discount"}${snap.couponCode ? ` · ${snap.couponCode}` : ""}`}
              value={`− ${money(snap.discount, lang)}`}
              tone="text-primary"
            />
          )}
          <Row
            label={bn ? "ডেলিভারি চার্জ" : "Delivery fee"}
            value={snap.deliveryFee === 0 ? (bn ? "ফ্রি" : "Free") : money(snap.deliveryFee, lang)}
          />
          <Row label={bn ? "সর্বমোট" : "Total"} value={money(snap.total, lang)} bold />
        </dl>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card icon={<Clock3 className="size-4 text-primary" />} title={bn ? "ডেলিভারি স্লট" : "Delivery slot"}>
          {snap.slot || (bn ? "দ্রুততম সময়ে" : "Earliest available")}
        </Card>
        <Card icon={<MapPin className="size-4 text-primary" />} title={bn ? "ঠিকানা" : "Address"}>
          {snap.address}
          {snap.area ? ` · ${snap.area}` : ""}
        </Card>
        <Card icon={<Wallet className="size-4 text-primary" />} title={bn ? "পেমেন্ট" : "Payment"}>
          {paymentText}
        </Card>
        <Card icon={<Truck className="size-4 text-primary" />} title={bn ? "গ্রাহক" : "Customer"}>
          {snap.name} · {snap.phone}
        </Card>
      </section>

      {orderNo && (
        <div className="mt-4">
          <OrderTimeline orderNo={orderNo} phone={snap.phone} />
        </div>
      )}

      <div className="mt-4">
        <CheckoutQueueStatus />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="mt-4 w-full rounded-full"
        onClick={() => downloadReceipt({ ...snap, orderNo }, bn)}
      >
        <Download className="mr-1.5 size-4" />
        {bn ? "রসিদ ডাউনলোড (PDF)" : "Download PDF receipt"}
      </Button>


      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="lg" className="flex-1 rounded-full">
          <Link to="/">{bn ? "কেনাকাটা চালিয়ে যান" : "Continue shopping"}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="flex-1 rounded-full">
          <Link to="/track">{bn ? "অর্ডার ট্র্যাক করুন" : "Track order"}</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="flex-1 rounded-full">
          <Link to="/my-orders">{bn ? "আমার অর্ডার" : "Order history"}</Link>
        </Button>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${bold ? "text-base font-bold" : ""}`}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className={tone ?? ""}>{value}</dd>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </p>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}
