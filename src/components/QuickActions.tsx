import { useEffect, useRef, useState } from "react";
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
    { to: "/branches", feature: "branches" as Feature, label: t("addBranch") },
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

function evaluate(expr: string): number | null {
  const clean = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/%/g, "/100");
  if (!clean.trim()) return null;
  if (!/^[\d+\-*/.\s()]+$/.test(clean)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict";return (${clean})`)() as number;
    return Number.isFinite(val) ? Math.round(val * 10000) / 10000 : null;
  } catch {
    return null;
  }
}

function MiniCalculator() {
  const { lang } = useI18n();
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const live = evaluate(expr);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const keys = [
    ["C", "(", ")", "%"],
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"],
  ];

  function equals() {
    const val = evaluate(expr);
    if (val === null) return;
    setHistory((h) => [`${expr} = ${val}`, ...h].slice(0, 6));
    setExpr(String(val));
  }

  function press(k: string) {
    if (k === "C") return setExpr("");
    if (k === "=") return equals();
    setExpr((e) => e + k);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-muted px-3 py-2">
        <input
          ref={inputRef}
          value={expr}
          inputMode="decimal"
          autoComplete="off"
          placeholder={lang === "bn" ? "যেমন 250*3+50" : "e.g. 250*3+50"}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              equals();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setExpr("");
            }
          }}
          className="w-full bg-transparent text-right text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="text-right font-display text-xl font-bold">{live ?? 0}</div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {keys.flat().map((k) => (
          <Button
            key={k}
            size="sm"
            variant={k === "=" ? "default" : /[0-9.]/.test(k) ? "secondary" : "outline"}
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-right text-xs text-muted-foreground">
          {history.map((h, i) => (
            <button
              key={i}
              className="block w-full truncate text-right hover:text-foreground"
              onClick={() => setExpr(h.split(" = ")[1] ?? "")}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        {lang === "bn"
          ? "কিবোর্ডে লিখুন · Enter = ফলাফল · Esc = মুছুন"
          : "Type with keyboard · Enter = result · Esc = clear"}
      </p>
    </div>
  );
}

