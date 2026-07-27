import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calculator, HandCoins, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMyRole } from "@/lib/use-my-role";
import { canAccess, type Feature } from "@/lib/permissions";

/** POSghor-style header quick actions: add, calculator, POS, payment, date, alerts. */
export function QuickActions() {
  const { t, lang } = useI18n();
  const me = useMyRole();
  const role = me.data?.role;
  const allow = (f: Feature) => canAccess(role, f);

  const today = new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const lowStock = useQuery({
    queryKey: ["low-stock-alerts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,stock,low_stock_at")
        .eq("is_active", true)
        .order("stock")
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((p) => Number(p.stock) <= Number(p.low_stock_at));
    },
  });

  const alerts = lowStock.data ?? [];

  const addLinks = [
    { to: "/products", feature: "products" as Feature, label: t("products") },
    { to: "/purchases", feature: "purchases" as Feature, label: t("purchases") },
    { to: "/contacts", feature: "contacts" as Feature, label: t("contacts") },
    { to: "/expenses", feature: "expenses" as Feature, label: t("expenses") },
    { to: "/stock-adjustments", feature: "stock-adjustments" as Feature, label: t("stockAdjust") },
  ].filter((l) => allow(l.feature));

  return (
    <div className="flex items-center gap-2">
      {addLinks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="secondary" className="size-9" aria-label={t("quickAdd")}>
              <Plus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("quickAdd")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {addLinks.map((l) => (
              <DropdownMenuItem key={l.to} asChild>
                <Link to={l.to}>{l.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="secondary" className="size-9" aria-label={t("calculator")}>
            <Calculator className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <MiniCalculator />
        </PopoverContent>
      </Popover>

      {allow("pos") && (
        <Button asChild size="sm" className="h-9 gap-2">
          <Link to="/pos">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">{t("saleQuick")}</span>
          </Link>
        </Button>
      )}

      {allow("payments") && (
        <Button asChild size="icon" variant="secondary" className="size-9" aria-label={t("quickPayment")}>
          <Link to="/payments">
            <HandCoins className="size-4" />
          </Link>
        </Button>
      )}

      <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">{today}</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="relative size-9" aria-label={t("notifications")}>
            <Bell className="size-4" />
            {alerts.length > 0 && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {alerts.length > 9 ? "9+" : alerts.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">{t("notifications")}</div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">{t("noNotifications")}</p>
            )}
            {alerts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
                <span className="truncate">{lang === "bn" ? p.name_bn : p.name_en}</span>
                <span
                  className={
                    Number(p.stock) <= 0
                      ? "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
                      : "shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground"
                  }
                >
                  {Number(p.stock) <= 0 ? t("outOfStock") : `${t("lowStock")}: ${p.stock}`}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MiniCalculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");

  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

  function press(k: string) {
    if (k === "=") {
      try {
        if (!/^[\d+\-*/.\s()]+$/.test(expr)) throw new Error("bad");
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict";return (${expr})`)() as number;
        setResult(Number.isFinite(val) ? String(Math.round(val * 100) / 100) : "0");
      } catch {
        setResult("0");
      }
      return;
    }
    setExpr((e) => e + k);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-muted px-3 py-2 text-right">
        <div className="truncate text-xs text-muted-foreground">{expr || "\u00a0"}</div>
        <div className="text-lg font-bold">{result}</div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {keys.map((k) => (
          <Button key={k} size="sm" variant={k === "=" ? "default" : "outline"} onClick={() => press(k)}>
            {k}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setExpr("");
          setResult("0");
        }}
      >
        C
      </Button>
    </div>
  );
}
