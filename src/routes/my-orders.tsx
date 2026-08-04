import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BellRing, PackageSearch, RotateCcw, ShoppingBasket, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { useCustomerSession } from "@/lib/customer-auth";
import { useShopCart } from "@/lib/shop-cart";
import { LangToggle } from "@/components/LangToggle";
import { OrderActions } from "@/components/OrderActions";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/my-orders")({
  head: () => ({
    meta: [
      { title: "My orders — Bazar Bari grocery delivery" },
      {
        name: "description",
        content:
          "Your grocery order history with live tracking links, status updates and one-click reorder.",
      },
      { property: "og:title", content: "My orders — Bazar Bari" },
      { property: "og:description", content: "Order history, tracking and one-click reorder." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/my-orders` },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/my-orders` }],
  }),
  component: MyOrdersPage,
});

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

function statusLabel(status: string, bn: boolean) {
  const map: Record<string, [string, string]> = {
    pending: ["Placed", "গৃহীত"],
    confirmed: ["Confirmed", "নিশ্চিত"],
    packed: ["Packed", "প্যাক হয়েছে"],
    shipped: ["Out for delivery", "পথে আছে"],
    delivered: ["Delivered", "ডেলিভারড"],
    cancelled: ["Cancelled", "বাতিল"],
  };
  const pair = map[status] ?? [status, status];
  return bn ? pair[1] : pair[0];
}

function MyOrdersPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, isCustomer, loading } = useCustomerSession();
  const cart = useShopCart();
  const [busy, setBusy] = useState<string | null>(null);

  const signedIn = !!user && isCustomer;

  const orders = useQuery({
    queryKey: ["my-orders-page", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select(
          "id,order_no,status,total,subtotal,discount,coupon_code,delivery_fee,slot,address,area,payment_method,customer_phone,created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  /** Pull the exact lines of a past order back into the cart. */
  async function reorder(orderId: string) {
    setBusy(orderId);
    try {
      const { data: items, error } = await supabase
        .from("delivery_order_items")
        .select("product_id,name_snapshot,quantity")
        .eq("order_id", orderId);
      if (error) throw error;

      const ids = (items ?? []).map((i) => i.product_id).filter(Boolean) as string[];
      if (ids.length === 0) throw new Error(bn ? "পণ্য পাওয়া যায়নি" : "No items found");

      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id,name_en,name_bn,price,pack_size,image_url,is_active")
        .in("id", ids);
      if (pErr) throw pErr;

      let added = 0;
      let missing = 0;
      for (const item of items ?? []) {
        const p = (products ?? []).find((x) => x.id === item.product_id);
        if (!p || p.is_active === false) {
          missing += 1;
          continue;
        }
        cart.add(
          {
            id: p.id,
            name_en: p.name_en,
            name_bn: p.name_bn ?? p.name_en,
            price: Number(p.price ?? 0),
            pack_size: p.pack_size ?? null,
            image_url: p.image_url ?? null,
          },
          Number(item.quantity ?? 1),
        );
        added += 1;
      }

      if (added === 0) {
        toast.error(bn ? "পণ্যগুলো এখন পাওয়া যাচ্ছে না" : "Those products are not available now");
        return;
      }
      toast.success(
        bn
          ? `${num(added, lang)} টি পণ্য কার্টে যোগ হয়েছে${missing ? ` · ${num(missing, lang)} টি নেই` : ""}`
          : `${added} item(s) added to cart${missing ? ` · ${missing} unavailable` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="storefront min-h-screen bg-muted/30">
      <StorefrontHeader />
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bn ? "দোকানে ফিরুন" : "Back to shop"}
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold">{bn ? "আমার অর্ডার" : "My orders"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bn
            ? "অর্ডারের ইতিহাস, লাইভ ট্র্যাকিং এবং এক ক্লিকে আবার অর্ডার।"
            : "Order history, live tracking and one-click reorder."}
        </p>

        {!signedIn ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {bn ? "অর্ডার দেখতে লগইন করুন।" : "Sign in to see your orders."}
            </p>
            <Button asChild className="mt-4">
              <Link to="/signin">{bn ? "লগইন / রেজিস্টার" : "Sign in / Register"}</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {orders.isLoading && (
              <p className="text-sm text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
            )}

            {!orders.isLoading && (orders.data ?? []).length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center">
                <PackageSearch className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {bn ? "এখনো কোনো অর্ডার নেই।" : "You have not ordered yet."}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/">{bn ? "কেনাকাটা শুরু করুন" : "Start shopping"}</Link>
                </Button>
              </div>
            )}

            {(orders.data ?? []).map((o) => {
              const idx = FLOW.indexOf(o.status as (typeof FLOW)[number]);
              return (
                <article key={o.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-bold">#{num(Number(o.order_no), lang)}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {statusLabel(o.status, bn)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString(bn ? "bn-BD" : "en-GB")}
                    {o.slot ? ` · ${o.slot}` : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {o.address}, {o.area}
                  </p>

                  {idx >= 0 && (
                    <ol className="mt-3 flex items-center gap-1" aria-label={bn ? "অগ্রগতি" : "Progress"}>
                      {FLOW.map((s, i) => (
                        <li
                          key={s}
                          className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`}
                          aria-current={i === idx ? "step" : undefined}
                        >
                          <span className="sr-only">{statusLabel(s, bn)}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="mt-3 space-y-0.5 text-sm">
                    <Line label={bn ? "সাবটোটাল" : "Subtotal"} value={money(Number(o.subtotal ?? 0), lang)} />
                    {Number(o.discount ?? 0) > 0 && (
                      <Line
                        label={`${bn ? "ছাড়" : "Discount"}${o.coupon_code ? ` (${o.coupon_code})` : ""}`}
                        value={`− ${money(Number(o.discount), lang)}`}
                      />
                    )}
                    <Line label={bn ? "ডেলিভারি" : "Delivery"} value={money(Number(o.delivery_fee ?? 0), lang)} />
                    <div className="flex items-center justify-between pt-1 font-bold">
                      <span>{bn ? "সর্বমোট" : "Total"}</span>
                      <span>{money(Number(o.total ?? 0), lang)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`/track?order=${o.order_no}&phone=${encodeURIComponent(o.customer_phone ?? "")}`}
                      >
                        <Truck className="mr-1 size-4" />
                        {bn ? "ট্র্যাক করুন" : "Track order"}
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void reorder(o.id)}
                      disabled={busy === o.id}
                    >
                      <RotateCcw className="mr-1 size-4" />
                      {bn ? "আবার অর্ডার" : "Reorder"}
                    </Button>
                    <OrderActions
                      order={{
                        id: o.id,
                        order_no: Number(o.order_no),
                        status: o.status,
                        slot: o.slot,
                        customer_phone: o.customer_phone,
                      }}
                    />
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/" search={{ checkout: true }}>
                        <ShoppingBasket className="mr-1 size-4" />
                        {bn ? "কার্টে যান" : "Go to cart"}
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}

            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <BellRing className="size-4 text-primary" />
              {bn
                ? "প্রতিটি স্ট্যাটাস পরিবর্তনে আপনার মোবাইলে এসএমএস আপডেট পাঠানো হয়।"
                : "You get an SMS update on your mobile at every status change."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
