import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { LangToggle } from "@/components/LangToggle";
import { supabase } from "@/integrations/supabase/client";
import { useShopCart } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";

const SITE = "https://yesspos.lovable.app";

type Detail = {
  id: string;
  name_en: string;
  name_bn: string;
  price: number;
  pack_size: string | null;
  image_url: string | null;
  brand: string | null;
  category_id: string | null;
  sku: string;
  unit: string;
  stock: number;
  barcode: string | null;
};

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Product details — Bazar Bari" },
      {
        name: "description",
        content:
          "Full product details: price, pack size, brand, availability and related items, with 1-hour home delivery in Dhaka from Bazar Bari.",
      },
      { property: "og:title", content: "Product details — Bazar Bari" },
      {
        property: "og:description",
        content: "Price, pack size, brand and stock availability with fast home delivery in Dhaka.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/product` }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,name_en,name_bn,price,pack_size,image_url,brand,category_id,sku,unit,stock,barcode",
        )
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Detail | null) ?? null;
    },
  });

  const p = product.data;

  const related = useQuery({
    enabled: !!p?.category_id,
    queryKey: ["product-related", p?.category_id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,price,pack_size,image_url")
        .eq("is_active", true)
        .eq("category_id", p!.category_id!)
        .neq("id", id)
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Array<Pick<
        Detail,
        "id" | "name_en" | "name_bn" | "price" | "pack_size" | "image_url"
      >>;
    },
  });

  const line = p ? cart.lines.find((l) => l.id === p.id) : undefined;
  const qty = line?.qty ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            {bn ? "সব পণ্য" : "All products"}
          </Link>
          <LangToggle />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {product.isLoading && (
          <p className="py-20 text-center text-muted-foreground">…</p>
        )}

        {!product.isLoading && !p && (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">
              {bn ? "পণ্যটি পাওয়া যায়নি" : "Product not found"}
            </p>
            <Link to="/" className="mt-4 inline-block font-semibold text-primary hover:underline">
              {bn ? "হোমে ফিরুন" : "Back to home"}
            </Link>
          </div>
        )}

        {p && (
          <>
            <nav className="mb-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">
                {bn ? "হোম" : "Home"}
              </Link>
              <span className="px-1.5">/</span>
              <span className="text-foreground">{bn ? p.name_bn : p.name_en}</span>
            </nav>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
              <div className="shop-card overflow-hidden p-3">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={bn ? p.name_bn : p.name_en}
                    width={640}
                    height={640}
                    className="aspect-square w-full rounded-2xl bg-muted object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-2xl bg-muted" />
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  {p.brand && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {p.brand}
                    </span>
                  )}
                  <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                    {bn ? p.name_bn : p.name_en}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bn ? p.name_en : p.name_bn}
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <span className="font-display text-3xl font-extrabold text-primary">
                    {money(Number(p.price), lang)}
                  </span>
                  {p.pack_size && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {p.pack_size}
                    </span>
                  )}
                  <span
                    className={
                      p.stock > 0
                        ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                        : "rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                    }
                  >
                    {p.stock > 0
                      ? bn
                        ? `স্টকে আছে (${num(p.stock, lang)} ${p.unit})`
                        : `In stock (${num(p.stock, lang)} ${p.unit})`
                      : bn
                        ? "স্টকে নেই"
                        : "Out of stock"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {qty === 0 ? (
                    <Button
                      size="lg"
                      className="rounded-full"
                      disabled={p.stock <= 0}
                      onClick={() =>
                        cart.add({
                          id: p.id,
                          name_en: p.name_en,
                          name_bn: p.name_bn,
                          price: Number(p.price),
                          pack_size: p.pack_size,
                          image_url: p.image_url,
                        })
                      }
                    >
                      <ShoppingBag className="mr-2 size-4" />
                      {bn ? "কার্টে যোগ করুন" : "Add to cart"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-full bg-primary p-1 text-primary-foreground">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={bn ? "পরিমাণ কমান" : "Decrease quantity"}
                        className="size-10 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                        onClick={() => cart.setQty(p.id, qty - 1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="min-w-8 text-center font-bold">{num(qty, lang)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={bn ? "পরিমাণ বাড়ান" : "Increase quantity"}
                        className="size-10 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                        onClick={() => cart.setQty(p.id, qty + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  )}
                  <Link
                    to="/"
                    search={{ checkout: true }}
                    className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    {bn ? "চেকআউট" : "Checkout"}
                  </Link>
                </div>

                <dl className="shop-card grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                  <Row label={bn ? "ব্র্যান্ড" : "Brand"} value={p.brand ?? "—"} />
                  <Row label={bn ? "প্যাক সাইজ" : "Pack size"} value={p.pack_size ?? "—"} />
                  <Row label={bn ? "একক" : "Unit"} value={p.unit} />
                  <Row label={bn ? "কোড (SKU)" : "SKU"} value={p.sku} />
                  {p.barcode && <Row label={bn ? "বারকোড" : "Barcode"} value={p.barcode} />}
                </dl>

                <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <li className="flex items-center gap-2">
                    <Truck className="size-4 text-primary" />
                    {bn ? "ঢাকায় ১ ঘণ্টায় ডেলিভারি" : "1-hour delivery in Dhaka"}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    {bn ? "তাজা পণ্যের নিশ্চয়তা" : "Freshness guaranteed"}
                  </li>
                </ul>
              </div>
            </div>

            {(related.data ?? []).length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-xl font-extrabold">
                  {bn ? "একই ধরনের পণ্য" : "Related products"}
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {(related.data ?? []).map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/product/$id"
                        params={{ id: r.id }}
                        className="shop-card block p-2.5 hover:shadow-md"
                      >
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={bn ? r.name_bn : r.name_en}
                            loading="lazy"
                            width={280}
                            height={280}
                            className="aspect-square w-full rounded-2xl bg-muted object-cover"
                          />
                        ) : (
                          <div className="aspect-square w-full rounded-2xl bg-muted" />
                        )}
                        <span className="mt-2 line-clamp-2 block text-sm font-semibold">
                          {bn ? r.name_bn : r.name_en}
                        </span>
                        <span className="mt-1 block font-display text-base font-extrabold text-primary">
                          {money(Number(r.price), lang)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
