/**
 * Storefront menu bar shared by the homepage and every category page.
 *
 * Layout mirrors a classic Bangladeshi e-commerce portal bar: a solid
 * "All categories" pill on the left, icon menu links with an underlined
 * active tab in the middle and the hotline plus cart on the right. On mobile
 * the same links collapse into a touch-friendly hamburger sheet.
 */
import { useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Apple,
  Baby,
  Beef,
  ChevronDown,
  Cookie,
  CupSoda,
  Croissant,
  Drumstick,
  Egg,
  Fish,
  Home,
  LayoutGrid,
  Leaf,
  LifeBuoy,
  PiggyBank,

  Menu,
  Milk,
  PawPrint,
  Phone,
  Pill,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Truck,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/CartDrawer";
import { useShopCart } from "@/lib/shop-cart";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/category-slug";

export type NavCategory = { id: string; name_en: string; name_bn: string };

type NavLink = { to?: string; href?: string; icon: LucideIcon; bn: string; en: string };

const LINKS: NavLink[] = [
  { to: "/", icon: Home, bn: "হোম", en: "Home" },
  { to: "/shop", icon: ShoppingBasket, bn: "স্টোর", en: "Store" },
  { to: "/budget", icon: PiggyBank, bn: "বাজেট বাজার", en: "Budget planner" },

  { to: "/track", icon: Truck, bn: "অর্ডার ট্র্যাক", en: "Track order" },
  { to: "/my-orders", icon: ShoppingBag, bn: "আমার অর্ডার", en: "My orders" },
  { href: "tel:16710", icon: LifeBuoy, bn: "সহায়তা", en: "Support" },
];

/** Keyword → icon so every category row in the menu carries a visual cue. */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/rice|grain|chal|atta|flour|dal|lentil/i, Wheat],
  [/oil|spice|masala|salt|sugar/i, Leaf],
  [/fruit|vegetable|veg|shak|shobji/i, Apple],
  [/meat|beef|mutton/i, Beef],
  [/chicken|poultry/i, Drumstick],
  [/fish|seafood/i, Fish],
  [/egg/i, Egg],
  [/milk|dairy|cheese|yogurt/i, Milk],
  [/tea|coffee|drink|juice|beverage/i, CupSoda],
  [/snack|chips|biscuit|chocolate|candy/i, Cookie],
  [/bread|bakery|cake/i, Croissant],
  [/baby|child|kids/i, Baby],
  [/health|medicine|pharma|care/i, Pill],
  [/pet|dog|cat/i, PawPrint],
  [/clean|home|household|beauty|cosmetic/i, Sparkles],
];

function iconFor(c: NavCategory): LucideIcon {
  const hay = `${c.name_en} ${c.name_bn}`;
  for (const [re, icon] of ICON_RULES) if (re.test(hay)) return icon;
  return ShoppingBasket;
}

export function StorefrontNav({
  categories,
  counts,
  activeCategoryId,
  onCheckout,
}: {
  categories: NavCategory[];
  counts?: Map<string, number>;
  activeCategoryId?: string;
  /** Optional host-provided checkout handler (homepage opens its own flow). */
  onCheckout?: () => void;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [megaOpen, setMegaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const megaRef = useRef<HTMLDivElement | null>(null);
  const megaBtnRef = useRef<HTMLButtonElement | null>(null);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cart = useShopCart();

  const catLink = (c: NavCategory) => ({
    to: "/category/$slug" as const,
    params: { slug: slugify(c.name_en) },
  });

  const isActive = (l: NavLink) =>
    !!l.to && (l.to === "/" ? pathname === "/" : pathname.startsWith(l.to));

  const openMega = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMegaOpen(false), 160);
  };

  /** Roving keyboard focus inside the mega menu. */
  const megaItems = () =>
    Array.from(megaRef.current?.querySelectorAll<HTMLElement>("[data-mega-item]") ?? []);
  const focusItem = (i: number) => {
    const items = megaItems();
    if (items.length === 0) return;
    items[(i + items.length) % items.length]?.focus();
  };
  const onMegaKeyDown = (e: ReactKeyboardEvent) => {
    const items = megaItems();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      focusItem(idx + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      focusItem(idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === "Tab") {
      setMegaOpen(false);
    }
  };



  const desktopItem = (active: boolean) =>
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
              <p className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="size-3.5" />
                {bn ? "সব ক্যাটাগরি" : "All categories"}
              </p>
              <ul className="flex flex-col gap-0.5">
                {categories.map((c) => {
                  const Icon = iconFor(c);
                  return (
                    <li key={c.id}>
                      <Link
                        {...catLink(c)}
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-muted",
                          activeCategoryId === c.id && "bg-primary/10 font-semibold text-primary",
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
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
                  );
                })}
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

        {/* Desktop: mega menu — opens on hover, tap and keyboard */}
        <div
          className="relative hidden shrink-0 lg:block"
          onMouseEnter={openMega}
          onMouseLeave={scheduleClose}
          onKeyDown={(e) => {
            if (e.key === "Escape" && megaOpen) {
              setMegaOpen(false);
              megaBtnRef.current?.focus();
            }
          }}
        >
          <button
            ref={megaBtnRef}
            type="button"
            id="mega-trigger"
            aria-expanded={megaOpen}
            aria-haspopup="menu"
            aria-controls="mega-menu"
            onClick={() => setMegaOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openMega();
                window.setTimeout(() => focusItem(0), 0);
              }
            }}
            className="flex min-h-12 items-center gap-2 rounded-t-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LayoutGrid className="size-4" />
            <span>{bn ? "সব ক্যাটাগরি" : "All categories"}</span>
            <ChevronDown className={cn("size-4 transition-transform", megaOpen && "rotate-180")} />
          </button>
          {megaOpen && (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMegaOpen(false)}
              />
              <div
                id="mega-menu"
                ref={megaRef}
                role="menu"
                aria-labelledby="mega-trigger"
                className="absolute left-0 top-full z-40 w-[min(92vw,780px)] origin-top-left animate-scale-in rounded-2xl rounded-tl-none border border-border bg-popover p-3 shadow-xl"
                onMouseEnter={openMega}
                onMouseLeave={scheduleClose}
                onKeyDown={onMegaKeyDown}
              >
                <div className="mb-2 h-1 w-12 rounded-full bg-primary/30 lg:hidden" />
                <div className="grid gap-1 sm:grid-cols-3">
                  {categories.map((c) => {
                    const Icon = iconFor(c);
                    const active = activeCategoryId === c.id;
                    return (
                      <Link
                        key={c.id}
                        {...catLink(c)}
                        role="menuitem"
                        data-mega-item=""
                        onClick={() => setMegaOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-muted hover:shadow-sm focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          active && "bg-primary/10 ring-1 ring-primary/30",
                        )}
                      >

                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-150 group-hover:scale-105",
                            active && "bg-primary text-primary-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate font-semibold",
                              active && "text-primary",
                            )}
                          >
                            {c.name_bn}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {c.name_en}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {num(counts?.get(c.id) ?? 0, lang)}
                        </span>
                      </Link>
                    );
                  })}
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
              <Link key={l.bn} to={l.to} className={desktopItem(active)}>
                {body}
              </Link>
            ) : (
              <a key={l.bn} href={l.href} className={desktopItem(false)}>
                {body}
              </a>
            );
          })}
        </nav>

        {/* Mobile: quick category strip keeps browsing one tap away */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-1.5 pl-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.slice(0, 12).map((c) => {
            const Icon = iconFor(c);
            return (
              <Link
                key={c.id}
                {...catLink(c)}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 text-xs font-medium text-muted-foreground",
                  activeCategoryId === c.id &&
                    "border-primary bg-primary/10 font-semibold text-primary",
                )}
              >
                <Icon className="size-3.5" />
                {bn ? c.name_bn : c.name_en}
              </Link>
            );
          })}
        </div>

        <a
          href="tel:16710"
          className="hidden shrink-0 items-center gap-1.5 px-3 text-sm font-semibold text-primary lg:flex"
        >
          <Phone className="size-4" />
          {bn ? "হটলাইন ১৬৭১০" : "Hotline 16710"}
        </a>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={bn ? "কার্ট দেখুন" : "Open cart"}
          className="relative my-1.5 flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ShoppingBasket className="size-4" />
          <span className="hidden text-sm sm:inline">{bn ? "কার্ট" : "Cart"}</span>
          {cart.count > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {num(cart.count, lang)}
            </span>
          )}
        </button>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={onCheckout} />
    </div>
  );
}
