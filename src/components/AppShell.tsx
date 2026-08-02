import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Ticket,
  MessageSquareText,
  ArrowRightLeft,
  Bike,
  MapPin,
  Megaphone,
  Star,
  Store,
  Smartphone,
  BarChart3,
  Barcode,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  FileSpreadsheet,
  Landmark,
  ListTree,
  Scale,
  ChevronDown,
  FileText,
  HandCoins,
  History,
  ImageOff,
  Images,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plug,
  ReceiptText,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Truck,
  Users,
  Wallet,
  DatabaseBackup,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { QuickActions } from "@/components/QuickActions";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { OfflineIndicator } from "@/components/OfflineIndicator";

import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { canAccess, type Feature } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { SIMPLE_ROUTES, useSimpleMode } from "@/lib/simple-mode";
import { dashboardThemeAttrs, useDashboardTheme } from "@/lib/dashboard-theme";
import { readNavMemory, writeNavMemory } from "@/lib/nav-memory";
import { activeNavKey, isPathMatch, navItemKey } from "@/lib/nav-active";

type NavItem = {
  to: string;
  feature: Feature;
  label: string;
  icon: ComponentType<{ className?: string }>;
  search?: Record<string, string>;
};
type NavGroup = { id: string; label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const dashTheme = useDashboardTheme();
  const navRef = useRef<HTMLElement | null>(null);
  const [lastItem, setLastItem] = useState<string | null>(null);
  const me = useMyRole();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { simple, toggle: toggleSimple } = useSimpleMode();

  const groups: NavGroup[] = [
    {
      id: "home",
      label: t("dashboard"),
      icon: BarChart3,
      items: [{ to: "/dashboard", feature: "dashboard", label: t("dashboard"), icon: BarChart3 }],
    },
    {

      id: "sale",
      label: t("grpSale"),
      icon: ShoppingCart,
      items: [
        { to: "/pos", feature: "pos", label: t("pos"), icon: ShoppingCart },
        { to: "/sales", feature: "sales", label: t("sales"), icon: ReceiptText },
        { to: "/sales", feature: "sales", label: t("quotations"), icon: FileText, search: { filter: "quotation" } },
        { to: "/sales", feature: "sales", label: t("saleReturns"), icon: RotateCcw, search: { filter: "returns" } },
        {
          to: "/delivery-orders",
          feature: "delivery-orders",
          label: lang === "bn" ? "হোম ডেলিভারি" : "Home delivery",
          icon: Truck,
        },
      ],
    },
    {
      id: "product",
      label: t("grpProduct"),
      icon: Boxes,
      items: [
        { to: "/products", feature: "products", label: t("products"), icon: Boxes },
        {
          to: "/product-audit",
          feature: "product-audit",
          label: lang === "bn" ? "ছবি অডিট" : "Image audit",
          icon: ImageOff,
        },
        { to: "/catalog", feature: "catalog", label: t("catalog"), icon: Tags },
        { to: "/stock-adjustments", feature: "stock-adjustments", label: t("stockAdjust"), icon: SlidersHorizontal },
        { to: "/stock-count", feature: "stock-count", label: t("stockCount"), icon: ClipboardList },
        { to: "/labels", feature: "labels", label: t("labels"), icon: Barcode },
      ],
    },
    {
      id: "media",
      label: lang === "bn" ? "ইমেজ গ্যালারি" : "Image gallery",
      icon: Images,
      items: [
        {
          to: "/media",
          feature: "media",
          label: lang === "bn" ? "ইমেজ গ্যালারি" : "Image gallery",
          icon: Images,
        },
      ],
    },
    {
      id: "ecom",
      label: lang === "bn" ? "হোম ডেলিভারি" : "Home Delivery",
      icon: Store,
      items: [
        {
          to: "/commerce",
          feature: "commerce",
          label: lang === "bn" ? "ই-কমার্স ড্যাশবোর্ড" : "Commerce dashboard",
          icon: Store,
        },
        {
          to: "/delivery-orders",
          feature: "delivery-orders",
          label: lang === "bn" ? "ডেলিভারি অর্ডার" : "Delivery orders",
          icon: Truck,
        },
        { to: "/riders", feature: "riders", label: lang === "bn" ? "রাইডার" : "Riders", icon: Bike },
        {
          to: "/delivery-zones",
          feature: "delivery-zones",
          label: lang === "bn" ? "ডেলিভারি এলাকা" : "Delivery zones",
          icon: MapPin,
        },
        {
          to: "/promotions",
          feature: "promotions",
          label: lang === "bn" ? "প্রোমোশন" : "Promotions",
          icon: Megaphone,
        },
        {
          to: "/coupons",
          feature: "coupons",
          label: lang === "bn" ? "কুপন" : "Coupons",
          icon: Ticket,
        },
        {
          to: "/notifications",
          feature: "notifications",
          label: lang === "bn" ? "SMS লগ" : "SMS log",
          icon: MessageSquareText,
        },
        { to: "/reviews", feature: "reviews", label: lang === "bn" ? "রিভিউ" : "Reviews", icon: Star },
      ],
    },
    {
      id: "branch",
      label: t("multiBranch"),
      icon: Building2,
      items: [
        { to: "/branches", feature: "branches", label: t("branches"), icon: Building2 },
        { to: "/stock-transfers", feature: "stock-transfers", label: t("stockTransfer"), icon: ArrowRightLeft },
      ],
    },


    {
      id: "purchase",
      label: t("grpPurchase"),
      icon: Truck,
      items: [
        { to: "/purchases", feature: "purchases", label: t("purchases"), icon: Truck },
        { to: "/purchase-orders", feature: "purchase-orders", label: t("purchaseOrders"), icon: ClipboardCheck },
      ],
    },
    {
      id: "finance",
      label: t("grpFinance"),
      icon: HandCoins,
      items: [
        { to: "/payments", feature: "payments", label: t("paymentsLedger"), icon: HandCoins },
        { to: "/expenses", feature: "expenses", label: t("expenses"), icon: Wallet },
        {
          to: "/mobile-payments",
          feature: "mobile-payments",
          label: lang === "bn" ? "মোবাইল পেমেন্ট" : "Mobile payments",
          icon: Smartphone,
        },
      ],
    },
    {
      id: "accounting",
      label: t("grpAccounts"),
      icon: Landmark,
      items: [
        { to: "/accounts", feature: "accounts", label: t("accounts"), icon: Landmark },
        { to: "/chart-of-accounts", feature: "chart-of-accounts", label: t("chartOfAccounts"), icon: ListTree },
        { to: "/journal", feature: "journal", label: t("journal"), icon: BookOpenCheck },
        { to: "/day-book", feature: "day-book", label: t("dayBook"), icon: CalendarDays },
        { to: "/financials", feature: "financials", label: t("financials"), icon: Scale },
        { to: "/party-statement", feature: "party-statement", label: t("partyStatement"), icon: FileSpreadsheet },
      ],
    },
    {
      id: "people",
      label: t("grpPeople"),
      icon: Users,
      items: [
        { to: "/contacts", feature: "contacts", label: t("contacts"), icon: Users },
        { to: "/users", feature: "users", label: t("usersRoles"), icon: ShieldCheck },
      ],
    },
    {
      id: "reports",
      label: t("grpReports"),
      icon: PieChart,
      items: [
        { to: "/reports", feature: "reports", label: t("reports"), icon: PieChart },
        { to: "/inventory", feature: "inventory", label: t("inventoryStatus"), icon: Boxes },
        { to: "/audit-logs", feature: "audit-logs", label: t("auditLog"), icon: History },
        { to: "/assistant", feature: "assistant", label: t("aiAssistant"), icon: Sparkles },
      ],
    },
    {
      id: "settings",
      label: t("grpSettings"),
      icon: SettingsIcon,
      items: [
        { to: "/settings", feature: "settings", label: t("settings"), icon: SettingsIcon },
        { to: "/site-content", feature: "site-content", label: t("websiteContent"), icon: FileText },
        { to: "/data-backup", feature: "data-backup", label: t("dataBackup"), icon: DatabaseBackup },
      ],
    },
    {
      id: "apihub",
      label: t("apiHub"),
      icon: Plug,
      items: [{ to: "/api-hub", feature: "api-hub", label: t("apiHub"), icon: Plug }],
    },
  ];

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          canAccess(me.data?.role, i.feature) &&
          (!simple || (SIMPLE_ROUTES as readonly string[]).includes(i.to)),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const allItems = groups.flatMap((g) => g.items);

  // Route-driven highlight: nested/deep links keep the right item selected.
  const activeKey = useMemo(
    () => activeNavKey(allItems, pathname, searchStr ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, searchStr, lang, simple, me.data?.role],
  );

  /**
   * Keyboard navigation for the menu rail: Up/Down move focus, Home/End jump,
   * Right/Left (mirrored in RTL) expand/collapse a group, Enter/Space activate
   * the focused item and Escape closes the mobile drawer or the open group.
   */
  const onNavKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const rail = navRef.current;
      if (!rail) return;
      const nodes = Array.from(rail.querySelectorAll<HTMLElement>("[data-nav-focusable]")).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
      const current = document.activeElement as HTMLElement | null;
      const index = current ? nodes.indexOf(current) : -1;
      const focusAt = (i: number) => {
        const next = nodes[(i + nodes.length) % nodes.length];
        next?.focus();
      };

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusAt(index + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusAt(index - 1);
          break;
        case "Home":
          e.preventDefault();
          focusAt(0);
          break;
        case "End":
          e.preventDefault();
          focusAt(nodes.length - 1);
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          const expand = rtl ? e.key === "ArrowLeft" : e.key === "ArrowRight";
          const groupId = current?.getAttribute("data-nav-group");
          if (!groupId) break;
          e.preventDefault();
          setOpen((st) => ({ ...st, [groupId]: expand }));
          break;
        }
        case "Enter":
        case " ": {
          if (current?.tagName === "A") {
            e.preventDefault();
            current.click();
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          if (mobileOpen) {
            setMobileOpen(false);
            break;
          }
          const groupId = current?.getAttribute("data-nav-group") ?? current?.getAttribute("data-nav-parent");
          if (groupId) setOpen((st) => ({ ...st, [groupId]: false }));
          current?.blur();
          break;
        }
        default:
          break;
      }
    },
    [mobileOpen],
  );

  // Restore the remembered menu state (expanded groups, collapse, selection,
  // scroll) after a page refresh/reload.
  useEffect(() => {
    const mem = readNavMemory();
    setOpen((s) => ({ ...mem.open, ...s }));
    setCollapsed(mem.collapsed);
    setLastItem(mem.item);
    const el = navRef.current;
    if (el && mem.scroll) requestAnimationFrame(() => el.scrollTo({ top: mem.scroll }));
  }, []);

  useEffect(() => {
    const active = groups.find((g) => g.items.some((i) => isPathMatch(pathname, i.to)));
    if (active) setOpen((s) => ({ ...s, [active.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Persist the current selection + menu layout on every navigation.
  useEffect(() => {
    if (activeKey) {
      setLastItem(activeKey);
      writeNavMemory({ item: activeKey, href: `${pathname}${searchStr ?? ""}` });
    }
  }, [activeKey, pathname, searchStr]);

  useEffect(() => {
    writeNavMemory({ open, collapsed });
  }, [open, collapsed]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => writeNavMemory({ scroll: el.scrollTop }));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    await logAudit("logout");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-2")}>
        <BrandLogo size={36} priority />
        {!collapsed && <span className="truncate font-display text-lg font-bold">{t("appName")}</span>}
      </div>

      <nav
        ref={navRef}
        aria-label={t("dashboard")}
        onKeyDown={onNavKeyDown}
        className="nav-rail flex-1 space-y-1 overflow-y-auto px-2 pb-3"
      >
        {visibleGroups.map((g) => {
          const groupActive = g.items.some((i) => navItemKey(i) === activeKey);
          const isOpen = collapsed ? false : (open[g.id] ?? groupActive);
          if (g.items.length === 1 && !g.items[0].search) {
            const only = g.items[0];
            return (
              <Link
                key={g.id}
                to={only.to}
                title={g.label}
                data-nav-focusable=""
                aria-current={groupActive ? "page" : undefined}
                className={cn(
                  "nav-item group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold",
                  groupActive
                    ? "bg-sidebar-primary/15 text-sidebar-primary shadow-[inset_0_1px_0_oklch(1_0_0/0.14)] ring-1 ring-sidebar-primary/30"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.1)]",
                  collapsed && "justify-center px-0",
                )}
              >
                {!collapsed && <span className="nav-indicator" data-active={groupActive ? "on" : "off"} />}
                <g.icon
                  className={cn(
                    "nav-icon size-4 shrink-0",
                    groupActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/75 group-hover:text-sidebar-primary",
                  )}
                />
                {!collapsed && <span className="flex-1 truncate text-start">{g.label}</span>}
              </Link>
            );
          }
          return (
            <div key={g.id}>
              <button
                type="button"
                data-nav-focusable=""
                data-nav-group={g.id}
                aria-expanded={isOpen}
                onClick={() =>
                  collapsed ? setCollapsed(false) : setOpen((s) => ({ ...s, [g.id]: !(s[g.id] ?? groupActive) }))
                }
                className={cn(
                  "nav-item group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold",
                  groupActive
                    ? "bg-sidebar-primary/12 text-sidebar-primary ring-1 ring-sidebar-primary/25"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.1)]",
                  collapsed && "justify-center px-0",
                )}
                title={g.label}
              >
                {!collapsed && <span className="nav-indicator" data-active={groupActive ? "on" : "off"} />}
                <g.icon
                  className={cn(
                    "nav-icon size-4 shrink-0",
                    groupActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/75 group-hover:text-sidebar-primary",
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-start">{g.label}</span>
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </>
                )}
              </button>

              {isOpen && (
                <div className="mt-1 ms-5 space-y-0.5 border-s border-sidebar-border/70 ps-2.5">
                  {g.items.map((item) => {
                    const active = navItemKey(item) === activeKey;
                    return (
                      <Link
                        key={`${item.to}-${item.label}`}
                        to={item.to}
                        search={item.search as never}
                        data-nav-focusable=""
                        data-nav-parent={g.id}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "nav-item group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                          active
                            ? "bg-sidebar-primary/15 font-semibold text-sidebar-primary ring-1 ring-sidebar-primary/30"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                          !active &&
                            lastItem === navItemKey(item) &&
                            "text-sidebar-foreground ring-1 ring-sidebar-primary/20",
                        )}
                      >
                        <span className="nav-dot" data-active={active ? "on" : "off"} />
                        <item.icon
                          className={cn(
                            "nav-icon size-4 shrink-0",
                            active
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/70 group-hover:text-sidebar-primary",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border/70 p-2">
        <Button
          variant={simple ? "secondary" : "ghost"}
          size="sm"
          title={t("simpleModeHint")}
          className={cn(
            "w-full text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center" : "justify-start",
          )}
          onClick={toggleSimple}
        >
          <Sparkles className={cn("size-4", !collapsed && "mr-2")} />
          {!collapsed && (simple ? t("fullMode") : t("simpleMode"))}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center" : "justify-start",
          )}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="mr-2 size-4" />}
          {!collapsed && t("collapseMenu")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-sidebar-foreground/85 hover:bg-destructive/10 hover:text-destructive",
            collapsed ? "justify-center" : "justify-start",
          )}
          onClick={signOut}
        >
          {collapsed ? <LogOut className="size-4" /> : <LogOut className="mr-2 size-4" />}
          {!collapsed && t("signOut")}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className="app-chrome flex min-h-screen bg-background"
      {...dashboardThemeAttrs(dashTheme.theme, dashTheme.mode, dashTheme.glass, dashTheme.contrast)}
    >
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 bg-sidebar text-sidebar-foreground transition-all md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-sidebar-border/70 bg-sidebar/85 px-3 py-2.5 text-sidebar-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/70">
          <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <BranchSwitcher />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <OfflineIndicator />
            <QuickActions />
            <TextSizeToggle />
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={signOut} className="md:hidden">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          {(() => {
            const current = allItems.find((n) => pathname.startsWith(n.to));
            if (me.isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>;
            if (current && !canAccess(me.data?.role, current.feature)) {
              return (
                <div className="p-6">
                  <div className="surface-panel mx-auto max-w-md p-6 text-center">
                    <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">{t("noAccess")}</p>
                  </div>
                </div>
              );
            }
            return children;
          })()}
        </main>
      </div>
    </div>
  );
}
