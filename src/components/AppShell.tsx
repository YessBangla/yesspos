import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Barcode,
  Boxes,
  HandCoins,
  History,
  SlidersHorizontal,
  Tags,

  LogOut,
  PieChart,
  ReceiptText,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { canAccess, type Feature } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useMyRole();

  const allNav = [
    { to: "/pos", feature: "pos", label: t("pos"), icon: ShoppingCart },
    { to: "/sales", feature: "sales", label: t("sales"), icon: ReceiptText },
    { to: "/products", feature: "products", label: t("products"), icon: Boxes },
    { to: "/stock-adjustments", feature: "stock-adjustments", label: t("stockAdjust"), icon: SlidersHorizontal },
    { to: "/labels", feature: "labels", label: t("labels"), icon: Barcode },
    { to: "/purchases", feature: "purchases", label: t("purchases"), icon: Truck },
    { to: "/contacts", feature: "contacts", label: t("contacts"), icon: Users },
    { to: "/payments", feature: "payments", label: t("paymentsLedger"), icon: HandCoins },
    { to: "/expenses", feature: "expenses", label: t("expenses"), icon: Wallet },
    { to: "/catalog", feature: "catalog", label: t("catalog"), icon: Tags },
    { to: "/reports", feature: "reports", label: t("reports"), icon: PieChart },
    { to: "/dashboard", feature: "dashboard", label: t("dashboard"), icon: BarChart3 },
    { to: "/users", feature: "users", label: t("usersRoles"), icon: ShieldCheck },
    { to: "/audit-logs", feature: "audit-logs", label: t("auditLog"), icon: History },
    { to: "/settings", feature: "settings", label: t("settings"), icon: SettingsIcon },
  ] as const satisfies readonly { to: string; feature: Feature; label: string; icon: unknown }[];

  const nav = allNav.filter((item) => canAccess(me.data?.role, item.feature));

  async function signOut() {
    await logAudit("logout");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }


  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-56">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="gradient-brand flex size-9 items-center justify-center rounded-lg text-primary-foreground">
            <ReceiptText className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden p-3 md:block">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80"
            onClick={signOut}
          >
            <LogOut className="mr-2 size-4" /> {t("signOut")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 border-b border-border bg-card px-4 py-2.5">
          <LangToggle />
          <Button variant="ghost" size="sm" onClick={signOut} className="md:hidden">
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="min-w-0 flex-1">
          {(() => {
            const current = allNav.find((n) => pathname.startsWith(n.to));
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
