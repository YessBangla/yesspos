/**
 * Storefront menu bar shared by the homepage and every category page.
 *
 * Desktop: "All categories" mega-menu + inline menu links.
 * Mobile: a hamburger sheet holding the same links and the full category list,
 * with touch-friendly (min 44px) rows.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  Home,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Phone,
  ShoppingBag,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/category-slug";

export type NavCategory = { id: string; name_en: string; name_bn: string };

const itemClass =
  "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function StorefrontNav({
  categories,
  counts,
  activeCategoryId,
}: {
  categories: NavCategory[];
  counts?: Map<string, number>;
  activeCategoryId?: string;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [megaOpen, setMegaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const catLink = (c: NavCategory) => ({
    to: "/category/$slug" as const,
    params: { slug: slugify(c.name_en) },
  });

  const links = (
    <>
      <Link to="/" className={itemClass}>
        <Home className="size-4" />
        {bn ? "হোম" : "Home"}
      </Link>
      <Link to="/" search={{}} className={itemClass}>
        <ShoppingBasket className="size-4" />
        {bn ? "সব পণ্য" : "All products"}
      </Link>
      <Link to="/track" className={itemClass}>
        <Truck className="size-4" />
        {bn ? "অর্ডার ট্র্যাক" : "Track order"}
      </Link>
      <Link to="/my-orders" className={itemClass}>
        <ShoppingBag className="size-4" />
        {bn ? "আমার অর্ডার" : "My orders"}
      </Link>
      <Link to="/corporate" className={itemClass}>
        <Building2 className="size-4" />
        {bn ? "কর্পোরেট" : "Corporate"}
      </Link>
      <a href="tel:16710" className={itemClass}>
        <LifeBuoy className="size-4" />
        {bn ? "সহায়তা" : "Support"}
      </a>
    </>
  );

  return (
    <div className="border-t border-border">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 py-1.5 text-sm">
        {/* Mobile: hamburger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            aria-label={bn ? "মেনু" : "Menu"}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground lg:hidden"
          >
            <Menu className="size-4" />
            <span className="text-sm">{bn ? "মেনু" : "Menu"}</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-0">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle>{bn ? "মেনু" : "Menu"}</SheetTitle>
            </SheetHeader>
            <nav
              aria-label={bn ? "মোবাইল মেনু" : "Mobile menu"}
              className="flex flex-col gap-0.5 p-2"
              onClick={() => setSheetOpen(false)}
            >
              {links}
            </nav>
            <div className="border-t border-border p-2">
              <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {bn ? "সব ক্যাটাগরি" : "All categories"}
              </p>
              <ul className="flex flex-col gap-0.5">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      {...catLink(c)}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted",
                        activeCategoryId === c.id && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="truncate">{bn ? c.name_bn : c.name_en}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {num(counts?.get(c.id) ?? 0, lang)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="tel:16710"
              className="m-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 font-semibold text-primary"
            >
              <Phone className="size-4" />
              {bn ? "হটলাইন ১৬৭১০" : "Hotline 16710"}
            </a>
          </SheetContent>
        </Sheet>

        {/* Desktop: mega menu */}
        <div className="relative hidden shrink-0 lg:block">
          <button
            type="button"
            aria-expanded={megaOpen}
            onClick={() => setMegaOpen((o) => !o)}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground"
          >
            <LayoutGrid className="size-4" />
            <span>{bn ? "সব ক্যাটাগরি" : "All categories"}</span>
            <ChevronDown className={cn("size-4 transition-transform", megaOpen && "rotate-180")} />
          </button>
          {megaOpen && (
            <>
              <button
                type="button"
                aria-label={bn ? "বন্ধ করুন" : "Close"}
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMegaOpen(false)}
              />
              <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(92vw,720px)] rounded-2xl border border-border bg-popover p-3 shadow-xl">
                <div className="grid gap-1 sm:grid-cols-3">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      {...catLink(c)}
                      onClick={() => setMegaOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                        activeCategoryId === c.id && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="truncate">{bn ? c.name_bn : c.name_en}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {num(counts?.get(c.id) ?? 0, lang)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <nav
          aria-label={bn ? "প্রধান মেনু" : "Main menu"}
          className="hidden flex-1 items-center gap-0.5 overflow-x-auto px-1 lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links}
        </nav>

        {/* Mobile: quick category strip keeps browsing one tap away */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto px-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.slice(0, 10).map((c) => (
            <Link
              key={c.id}
              {...catLink(c)}
              className={cn(
                "flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-xs font-medium text-muted-foreground",
                activeCategoryId === c.id && "border-primary bg-primary/10 font-semibold text-primary",
              )}
            >
              {bn ? c.name_bn : c.name_en}
            </Link>
          ))}
        </div>

        <a
          href="tel:16710"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-primary lg:flex"
        >
          <Phone className="size-4" />
          {bn ? "হটলাইন ১৬৭১০" : "Hotline 16710"}
        </a>
      </div>
    </div>
  );
}
