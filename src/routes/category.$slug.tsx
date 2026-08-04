/**
 * Category landing page: /category/$slug
 *
 * Shows the category's items with a category-scoped search box, brand
 * ("sub-category") chips, sorting and add-to-cart — reusing the storefront
 * cart so the basket stays in sync with the homepage.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  ShoppingBasket,
} from "lucide-react";
import { z } from "zod";
import { BrandLogo } from "@/components/BrandLogo";
import { LangToggle } from "@/components/LangToggle";
import { CustomerAccountMenu } from "@/components/CustomerAccountMenu";
import { StorefrontNav } from "@/components/StorefrontNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useShopCart } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";
import { slugify, titleCase } from "@/lib/category-slug";
import { useSiteContent } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const SITE = "https://yesspos.lovable.app";

const SORTS = ["relevance", "price_asc", "price_desc", "name_asc", "name_desc"] as const;
type SortKey = (typeof SORTS)[number];

const searchSchema = z.object({
  q: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(60).optional(),
  sort: z.enum(SORTS).optional(),
});

type CatSearch = z.infer<typeof searchSchema>;

type P = {
  id: string;
  name_en: string;
  name_bn: string;
  price: number;
  pack_size: string | null;
  image_url: string | null;
  brand: string | null;
  category_id: string | null;
};

export const Route = createFileRoute("/category/$slug")({
  validateSearch: (input: Record<string, unknown>) => {
    const parsed = searchSchema.safeParse({
      q: typeof input.q === "string" && input.q.trim() ? input.q : undefined,
      brand: typeof input.brand === "string" && input.brand.trim() ? input.brand : undefined,
      sort: typeof input.sort === "string" ? (input.sort as SortKey) : undefined,
    });
    return parsed.success ? parsed.data : {};
  },
  head: ({ params }) => {
    const name = titleCase(params.slug);
    const title = `${name} online in Dhaka — home delivery | Bazar Bari`;
    const description = `Browse ${name.toLowerCase()} at Bazar Bari. Fresh stock, transparent prices and 1-hour home delivery in Dhaka.`;
    const canonical = `${SITE}/category/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { text: sc } = useSiteContent();
  const cart = useShopCart();
  const [query, setQuery] = useState(search.q ?? "");

  const categories = useQuery({
    queryKey: ["shop-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name_en,name_bn")
        .order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,price,pack_size,image_url,brand,category_id")
        .order("name_en");
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const category = useMemo(
    () => (categories.data ?? []).find((c) => slugify(c.name_en) === slug) ?? null,
    [categories.data, slug],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (products.data ?? []).forEach((p) => {
      if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    });
    return m;
  }, [products.data]);

  const inCategory = useMemo(
    () => (products.data ?? []).filter((p) => category && p.category_id === category.id),
    [products.data, category],
  );

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    inCategory.forEach((p) => {
      const b = p.brand?.trim();
      if (b) m.set(b, (m.get(b) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inCategory]);

  const sort = search.sort ?? "relevance";
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inCategory.filter(
      (p) =>
        (!search.brand || p.brand === search.brand) &&
        (!q || p.name_en.toLowerCase().includes(q) || p.name_bn.includes(query.trim())),
    );
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "name_asc") sorted.sort((a, b) => a.name_en.localeCompare(b.name_en));
    if (sort === "name_desc") sorted.sort((a, b) => b.name_en.localeCompare(a.name_en));
    return sorted;
  }, [inCategory, query, search.brand, sort]);

  const notReady = categories.isLoading || products.isLoading;
  const missing = !notReady && !category;

  return (
    <main className="storefront app-fit min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BrandLogo size={40} />
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-lg font-extrabold text-primary">
                {sc("brand.name", "Bazar Bari")}
              </span>
              <span className="block text-[11px] font-medium text-muted-foreground">
                {bn ? "অনলাইন সুপারশপ" : "Online supershop"}
              </span>
            </span>
          </Link>

          <form
            role="search"
            className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted/40 pl-4 pr-1.5 shadow-sm focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/15"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                search: (prev: CatSearch) => ({ ...prev, q: query.trim() || undefined }),
              });
            }}
          >
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <label htmlFor="cat-search" className="sr-only">
              {bn ? "এই ক্যাটাগরিতে খুঁজুন" : "Search in this category"}
            </label>
            <Input
              id="cat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={60}
              placeholder={
                category
                  ? `${bn ? category.name_bn : category.name_en} — ${bn ? "খুঁজুন" : "search"}`
                  : bn
                    ? "পণ্য খুঁজুন"
                    : "Search products"
              }
              className="h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ search: (prev: CatSearch) => ({ ...prev, q: undefined }) });
                }}
                className="shrink-0 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {bn ? "মুছুন" : "Clear"}
              </button>
            )}
            <button
              type="submit"
              className="hidden h-9 shrink-0 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground sm:inline-flex"
            >
              {bn ? "খুঁজুন" : "Search"}
            </button>
          </form>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <LangToggle />
            <CustomerAccountMenu />
          </div>

          <Button asChild className="h-12 shrink-0 rounded-full px-4 font-semibold">
            <Link to="/" search={{ checkout: true }}>
              <ShoppingBag className="mr-1.5 size-4" />
              <span className="hidden sm:inline">{num(cart.count, lang)} · </span>
              {money(cart.subtotal, lang)}
            </Link>
          </Button>
        </div>

        <StorefrontNav
          categories={categories.data ?? []}
          counts={counts}
          activeCategoryId={category?.id}
        />
      </header>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-primary hover:underline">
            {bn ? "হোম" : "Home"}
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-semibold text-foreground">
            {category ? (bn ? category.name_bn : category.name_en) : titleCase(slug)}
          </span>
        </nav>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
              {category ? (bn ? category.name_bn : category.name_en) : titleCase(slug)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {num(visible.length, lang)} {bn ? "টি পণ্য" : "items"}
              {search.brand ? ` · ${search.brand}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="cat-sort" className="sr-only">
              {bn ? "সাজান" : "Sort"}
            </label>
            <select
              id="cat-sort"
              value={sort}
              onChange={(e) =>
                navigate({
                  search: (prev: CatSearch) => ({
                    ...prev,
                    sort: e.target.value === "relevance" ? undefined : (e.target.value as SortKey),
                  }),
                })
              }
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="relevance">{bn ? "সাজেস্টেড" : "Recommended"}</option>
              <option value="price_asc">{bn ? "দাম: কম → বেশি" : "Price: low → high"}</option>
              <option value="price_desc">{bn ? "দাম: বেশি → কম" : "Price: high → low"}</option>
              <option value="name_asc">A → Z</option>
              <option value="name_desc">Z → A</option>
            </select>
          </div>
        </div>

        {/* Sub-category (brand) chips */}
        {brands.length > 0 && (
          <nav
            aria-label={bn ? "সাব-ক্যাটাগরি" : "Sub-categories"}
            className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <Link
              to="/category/$slug"
              params={{ slug }}
              search={(prev: CatSearch) => ({ ...prev, brand: undefined })}
              className={cn(
                "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm",
                !search.brand
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {bn ? "সব" : "All"}
            </Link>
            {brands.map(([b, n]) => (
              <Link
                key={b}
                to="/category/$slug"
                params={{ slug }}
                search={(prev: CatSearch) => ({ ...prev, brand: b })}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm",
                  search.brand === b
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {b}
                <span className="text-[11px] opacity-70">{num(n, lang)}</span>
              </Link>
            ))}
          </nav>
        )}

        {/* Grid */}
        {notReady ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="shop-card h-64 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : missing ? (
          <div className="shop-card mt-8 p-8 text-center">
            <ShoppingBasket className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">
              {bn ? "এই ক্যাটাগরিটি পাওয়া যায়নি" : "This category was not found"}
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/">{bn ? "হোমে ফিরুন" : "Back to home"}</Link>
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="shop-card mt-8 p-8 text-center">
            <p className="font-semibold">{bn ? "কোনো পণ্য মেলেনি" : "No products matched"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bn ? "অন্য শব্দ দিয়ে খুঁজে দেখুন" : "Try a different search term"}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {visible.map((p) => {
              const qty = cart.lines.find((l) => l.id === p.id)?.qty ?? 0;
              return (
                <article key={p.id} className="shop-card shop-tile group flex flex-col p-2.5">
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="relative block overflow-hidden rounded-2xl bg-muted"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={bn ? p.name_bn : p.name_en}
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={320}
                        className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="aspect-square w-full" />
                    )}
                    {p.pack_size && (
                      <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground backdrop-blur">
                        {p.pack_size}
                      </span>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 px-1.5 pb-1 pt-3">
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary hover:underline"
                    >
                      {bn ? p.name_bn : p.name_en}
                    </Link>
                    {p.brand && (
                      <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                        {p.brand}
                      </span>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="font-display text-lg font-extrabold leading-none text-primary">
                        {money(Number(p.price), lang)}
                      </span>
                      {qty === 0 ? (
                        <Button
                          size="icon"
                          className="size-11 shrink-0 rounded-full"
                          aria-label={`${bn ? "কার্টে যোগ করুন" : "Add to cart"}: ${bn ? p.name_bn : p.name_en}`}
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
                          <Plus className="size-4" />
                        </Button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={bn ? "পরিমাণ কমান" : "Decrease quantity"}
                            className="size-9 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                            onClick={() => cart.setQty(p.id, qty - 1)}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="min-w-5 text-center text-sm font-bold">
                            {num(qty, lang)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={bn ? "পরিমাণ বাড়ান" : "Increase quantity"}
                            className="size-9 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground"
                            onClick={() => cart.setQty(p.id, qty + 1)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Other categories */}
        {(categories.data ?? []).length > 1 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-extrabold">
              {bn ? "অন্যান্য ক্যাটাগরি" : "Other categories"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(categories.data ?? [])
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <Link
                    key={c.id}
                    to="/category/$slug"
                    params={{ slug: slugify(c.name_en) }}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary hover:text-primary"
                  >
                    {bn ? c.name_bn : c.name_en}
                    <span className="text-[11px] text-muted-foreground">
                      {num(counts.get(c.id) ?? 0, lang)}
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        )}

        <a
          href="tel:16710"
          className="mt-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 font-semibold text-primary sm:hidden"
        >
          <Phone className="size-4" />
          {bn ? "হটলাইন ১৬৭১০" : "Hotline 16710"}
        </a>
      </div>
    </main>
  );
}
