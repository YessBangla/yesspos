/**
 * Shared corporate storefront header (brand, search, account, cart) with the
 * full category navigation bar underneath. Used by secondary pages such as the
 * budget planner and order pages so they carry the same menu bar as the shop.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingBag } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { LangToggle } from "@/components/LangToggle";
import { CustomerAccountMenu } from "@/components/CustomerAccountMenu";
import { StorefrontNav } from "@/components/StorefrontNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useShopCart } from "@/lib/shop-cart";
import { money, num, useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/lib/site-content";

export function StorefrontHeader() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const cart = useShopCart();
  const navigate = useNavigate();
  const { text: sc } = useSiteContent();
  const [query, setQuery] = useState("");

  const categories = useQuery({
    queryKey: ["storefront-header-categories"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name_en,name_bn")
        .order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
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
            void navigate({ to: "/", search: { q: query.trim() || undefined } });
          }}
        >
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <label htmlFor="sf-search" className="sr-only">
            {bn ? "পণ্য খুঁজুন" : "Search products"}
          </label>
          <Input
            id="sf-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={60}
            placeholder={bn ? "পণ্য খুঁজুন" : "Search products"}
            className="h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
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

      <StorefrontNav categories={categories.data ?? []} />
    </header>
  );
}
