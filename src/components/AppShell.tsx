import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  BarChart3,
  Barcode,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Landmark,
  ListTree,
  Scale,
  ChevronDown,
  FileText,
  HandCoins,
  History,
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
  Tags,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { QuickActions } from "@/components/QuickActions";
import { useMyBranch } from "@/lib/use-branch";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { canAccess, type Feature } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

type NavItem = {
  to: string;
  feature: Feature;
  label: string;
  icon: ComponentType<{ className?: string }>;
  search?: Record<string, string>;
};
type NavGroup = { id: string; label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useMyRole();
  const myBranch = useMyBranch();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups: NavGroup[] = [
    {
      id: "sale",
      label: t("grpSale"),
      icon: ShoppingCart,
      items: [
        { to: "/pos", feature: "pos", label: t("pos"), icon: ShoppingCart },
        { to: "/sales", feature: "sales", label: t("sales"), icon: ReceiptText },
        { to: "/sales", feature: "sales", label: t("quotations"), icon: FileText, search: { filter: "quotation" } },
        { to: "/sales", feature: "sales", label: t("saleReturns"), icon: RotateCcw, search: { filter: "returns" } },
      ],
    },
    {
      id: "product",
      label: t("grpProduct"),
      icon: Boxes,
      items: [
        { to: "/products", feature: "products", label: t("products"), icon: Boxes },
        { to: "/catalog", feature: "catalog", label: t("catalog"), icon: Tags },
        { to: "/stock-adjustments", feature: "stock-adjustments", label: t("stockAdjust"), icon: SlidersHorizontal },
        { to: "/labels", feature: "labels", label: t("labels"), icon: Barcode },
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
      items: [{ to: "/purchases", feature: "purchases", label: t("purchases"), icon: Truck }],
    },
    {
      id: "finance",
      label: t("grpFinance"),
      icon: HandCoins,
      items: [
        { to: "/payments", feature: "payments", label: t("paymentsLedger"), icon: HandCoins },
        { to: "/expenses", feature: "expenses", label: t("expenses"), icon: Wallet },
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
        { to: "/dashboard", feature: "dashboard", label: t("dashboard"), icon: BarChart3 },
        { to: "/reports", feature: "reports", label: t("reports"), icon: PieChart },
        { to: "/audit-logs", feature: "audit-logs", label: t("auditLog"), icon: History },
      ],
    },
    {
      id: "settings",
      label: t("grpSettings"),
      icon: SettingsIcon,
      items: [
        { to: "/settings", feature: "settings", label: t("settings"), icon: SettingsIcon },
        { to: "/api-hub", feature: "api-hub", label: t("apiHub"), icon: Plug },
      ],

    },
  ];

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(me.data?.role, i.feature)) }))
    .filter((g) => g.items.length > 0);

  const allItems = groups.flatMap((g) => g.items);

  useEffect(() => {
    const active = groups.find((g) => g.items.some((i) => pathname.startsWith(i.to)));
    if (active) setOpen((s) => ({ ...s, [active.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        <span className="gradient-brand flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground">
          <ReceiptText className="size-5" />
        </span>
        {!collapsed && <span className="font-display text-lg font-bold">{t("appName")}</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {visibleGroups.map((g) => {
          const groupActive = g.items.some((i) => pathname.startsWith(i.to));
          const isOpen = collapsed ? false : (open[g.id] ?? groupActive);
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() =>
                  collapsed ? setCollapsed(false) : setOpen((s) => ({ ...s, [g.id]: !(s[g.id] ?? groupActive) }))
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  groupActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0",
                )}
                title={g.label}
              >
                <g.icon className="size-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{g.label}</span>
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </>
                )}
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5 pl-3">
                  {g.items.map((item) => {
                    const active =
                      pathname.startsWith(item.to) &&
                      (!item.search || typeof window === "undefined"
                        ? !item.search
                        : window.location.search.includes(`filter=${item.search.filter}`));
                    return (
                      <Link
                        key={`${item.to}-${item.label}`}
                        to={item.to}
                        search={item.search as never}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
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

      <div className="space-y-1 p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full text-sidebar-foreground/70", collapsed ? "justify-center" : "justify-start")}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="mr-2 size-4" />}
          {!collapsed && t("collapseMenu")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full text-sidebar-foreground/80", collapsed ? "justify-center" : "justify-start")}
          onClick={signOut}
        >
          {collapsed ? <LogOut className="size-4" /> : <LogOut className="mr-2 size-4" />}
          {!collapsed && t("signOut")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
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
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2.5">
          <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5" />
            {myBranch.data?.name ?? t("noBranch")}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">

            <QuickActions />
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
