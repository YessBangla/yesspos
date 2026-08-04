/**
 * Storefront menu bar shared by the homepage and every category page.
 *
 * Layout mirrors a classic Bangladeshi e-commerce portal bar: a solid
 * "All categories" pill on the left, icon menu links with an underlined
 * active tab in the middle and the hotline on the right. On mobile the same
 * links collapse into a touch-friendly hamburger sheet.
 */
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/category-slug";

export type NavCategory = { id: string; name_en: string; name_bn: string };

type NavLink = { to?: string; href?: string; icon: LucideIcon; bn: string; en: string };

const LINKS: NavLink[] = [
  { to: "/", icon: Home, bn: "হোম", en: "Home" },
  { to: "/shop", icon: ShoppingBasket, bn: "স্টোর", en: "Store" },
  { to: "/track", icon: Truck, bn: "অর্ডার ট্র্যাক", en: "Track order" },
  { to: "/my-orders", icon: ShoppingBag, bn: "আমার অর্ডার", en: "My orders" },
  { to: "/corporate", icon: Building2, bn: "কর্পোরেট", en: "Corporate" },
  { href: "tel:16710", icon: LifeBuoy, bn: "সহায়তা", en: "Support" },
];

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const catLink = (c: NavCategory) => ({
    to: "/category/$slug" as const,
    params: { slug: slugify(c.name_en) },
  });

  const isActive = (l: NavLink) => !!l.to && (l.to === "/" ? pathname === "/" : pathname.startsWith(l.to));

  const desktopItem = (l: NavLink, active: boolean) =>
    cn(
      "relative flex min-h-12 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors",
      "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary after:transition-transform after:duration-200",
      active
        ? "text-primary after:scale-x-100"
        : "text-muted-foreground hover:text-primary after:scale-x-0",
    );

  return (
    <div className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 text-sm sm:px-3">
        {/* Mobile: hamburger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            aria-label={bn ? "মেনু" : "Menu"}
            className="my-1.5 flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground lg:hidden"
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
              {LINKS.map((l) => {
                const cls = cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 font-medium",
                  isActive(l) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                );
                const body = (
                  <>
                    <l.icon className="size-4 shrink-0" />
                    {bn ? l.bn : l.en}
                  </>
                );
                return l.to ? (
                  <Link key={l.bn} to={l.to} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <a key={l.bn} href={l.href} className={cls}>
                    {body}
                  </a>
                );
              })}
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
                        "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted",
                        activeCategoryId === c.id && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        <span className="block truncate font-medium">{c.name_bn}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {c.name_en}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {num(counts?.get(c.id) ?? 0, lang)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="tel:16710"
              className="m-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 font-semibold text-primary"
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
            className="flex min-h-12 items-center gap-2 rounded-t-xl bg-primary px-4 font-semibold text-primary-foreground"
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
              <div className="absolute left-0 top-full z-40 w-[min(92vw,760px)] rounded-2xl rounded-tl-none border border-border bg-popover p-3 shadow-xl">
                <div className="grid gap-1 sm:grid-cols-3">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      {...catLink(c)}
                      onClick={() => setMegaOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted",
                        activeCategoryId === c.id && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.name_bn}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {c.name_en}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
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
          className="hidden flex-1 items-center gap-0.5 overflow-x-auto pl-2 lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {LINKS.map((l) => {
            const active = isActive(l);
            const body = (
              <>
                <l.icon className="size-4" />
                {bn ? l.bn : l.en}
              </>
            );
            return l.to ? (
              <Link key={l.bn} to={l.to} className={desktopItem(l, active)}>
                {body}
              </Link>
            ) : (
              <a key={l.bn} href={l.href} className={desktopItem(l, false)}>
                {body}
              </a>
            );
          })}
        </nav>

        {/* Mobile: quick category strip keeps browsing one tap away */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-1.5 pl-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.slice(0, 12).map((c) => (
            <Link
              key={c.id}
              {...catLink(c)}
              className={cn(
                "flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-xs font-medium text-muted-foreground",
                activeCategoryId === c.id &&
                  "border-primary bg-primary/10 font-semibold text-primary",
              )}
            >
              {bn ? c.name_bn : c.name_en}
            </Link>
          ))}
        </div>

        <a
          href="tel:16710"
          className="hidden shrink-0 items-center gap-1.5 px-3 text-sm font-semibold text-primary lg:flex"
        >
          <Phone className="size-4" />
          {bn ? "হটলাইন ১৬৭১০" : "Hotline 16710"}
        </a>
      </div>
    </div>
  );
}
