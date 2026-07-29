import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, PackageX, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { downloadCsv } from "@/lib/audit";
import { useActiveBranch } from "@/lib/active-branch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & stock status — Sokoler Bazar" },
      {
        name: "description",
        content:
          "Branch-wise inventory valuation, low-stock and out-of-stock alerts, with one-click CSV export.",
      },
      { property: "og:title", content: "Inventory & stock status — Sokoler Bazar" },
      {
        property: "og:description",
        content: "Stock status, low-stock alerts and inventory valuation for every branch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

type Row = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock: number;
  lowAt: number;
  cost: number;
  price: number;
  status: "out" | "low" | "ok";
};

function InventoryPage() {
  const { t, lang } = useI18n();
  const { options: allowedBranches, canSwitch, branchId: myBranchId } = useActiveBranch();
  const [branchId, setBranchId] = useState<string>("all");

  // Staff without switching rights only ever see their own location.
  useEffect(() => {
    if (!canSwitch && myBranchId) setBranchId(myBranchId);
  }, [canSwitch, myBranchId]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const data = useQuery({
    queryKey: ["inventory-status", branchId],
    queryFn: async () => {
      const [productsRes, stockRes] = await Promise.all([
        supabase
          .from("products")
          .select("id,name_en,name_bn,sku,unit,stock,low_stock_at,cost,price")
          .eq("is_active", true)
          .order("name_en"),
        branchId === "all"
          ? Promise.resolve({ data: null, error: null })
          : supabase.from("product_stock").select("product_id,stock").eq("branch_id", branchId),
      ]);
      if (productsRes.error) throw productsRes.error;
      const perBranch = new Map<string, number>(
        ((stockRes.data ?? []) as { product_id: string; stock: number }[]).map((r) => [
          r.product_id,
          Number(r.stock ?? 0),
        ]),
      );
      return (productsRes.data ?? []).map((p) => {
        const stock = branchId === "all" ? Number(p.stock ?? 0) : (perBranch.get(p.id) ?? 0);
        const lowAt = Number(p.low_stock_at ?? 0);
        return {
          id: p.id,
          name: lang === "bn" ? p.name_bn : p.name_en,
          sku: p.sku,
          unit: p.unit,
          stock,
          lowAt,
          cost: Number(p.cost ?? 0),
          price: Number(p.price ?? 0),
          status: stock <= 0 ? "out" : stock <= lowAt ? "low" : "ok",
        } satisfies Row;
      });
    },
  });

  const rows = data.data ?? [];

  const stats = useMemo(() => {
    return {
      items: rows.length,
      units: rows.reduce((s, r) => s + r.stock, 0),
      costValue: rows.reduce((s, r) => s + r.stock * r.cost, 0),
      saleValue: rows.reduce((s, r) => s + r.stock * r.price, 0),
      low: rows.filter((r) => r.status === "low").length,
      out: rows.filter((r) => r.status === "out").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle);
    });
  }, [rows, q, filter]);

  const alerts = useMemo(
    () => rows.filter((r) => r.status !== "ok").sort((a, b) => a.stock - b.stock),
    [rows],
  );

  function exportCsv(list: Row[], name: string) {
    downloadCsv(
      `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      [t("products"), "SKU", t("unit"), t("stock"), t("lowStock"), t("costValue"), t("saleValue"), "Status"],
      list.map((r) => [
        r.name,
        r.sku,
        r.unit,
        r.stock,
        r.lowAt,
        (r.stock * r.cost).toFixed(2),
        (r.stock * r.price).toFixed(2),
        r.status,
      ]),
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("stockReport")}
          </p>
          <h1 className="font-display text-2xl font-bold">
            {lang === "bn" ? "ইনভেন্টরি ও স্টক স্ট্যাটাস" : "Inventory & stock status"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn"
              ? "ব্রাঞ্চভিত্তিক স্টক, কম স্টকের সতর্কতা ও মূল্যায়ন এক জায়গায়।"
              : "Branch-wise stock levels, low-stock alerts and valuation in one place."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCsv(visible, "inventory")}>
          <Download className="mr-1 size-4" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("products")} value={num(stats.items, lang)} icon={<Boxes className="size-4" />} />
        <Stat label={t("totalStock")} value={num(stats.units, lang)} />
        <Stat label={t("costValue")} value={money(stats.costValue, lang)} />
        <Stat label={t("saleValue")} value={money(stats.saleValue, lang)} highlight />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="surface-panel flex items-end gap-2 p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>{t("branch")}</Label>
            <Select value={branchId} onValueChange={setBranchId} disabled={!canSwitch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canSwitch && <SelectItem value="all">{t("allBranches")}</SelectItem>}
                {allowedBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="surface-panel space-y-1.5 p-3">
          <Label>{t("search")}</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU / name" />
        </div>
        <div className="surface-panel space-y-1.5 p-3">
          <Label>{t("stock")}</Label>
          <div className="flex gap-1">
            {(["all", "low", "out"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filter === k ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFilter(k)}
              >
                {k === "all" ? t("all") : k === "low" ? t("lowStock") : t("outOfStock")}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <AlertTriangle className="size-4 text-warning-foreground" /> {t("lowStockItems")}
          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground">
            {num(stats.low, lang)}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
            <PackageX className="size-3" /> {num(stats.out, lang)}
          </span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => exportCsv(alerts, "low-stock")}>
          <Download className="mr-1 size-4" /> {t("exportCsv")}
        </Button>
      </div>
      <div className="surface-panel mt-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.slice(0, 12).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.sku}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                r.status === "out"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/20 text-warning-foreground",
              )}
            >
              {r.status === "out" ? t("outOfStock") : `${num(r.stock, lang)} ${r.unit}`}
            </span>
          </div>
        ))}
        {alerts.length === 0 && (
          <p className="px-1 py-3 text-sm text-muted-foreground">
            {data.isLoading ? t("loading") : t("noData")}
          </p>
        )}
      </div>

      <div className="surface-panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("products")}</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">{t("stock")}</th>
              <th className="px-4 py-3 text-right">{t("lowStock")}</th>
              <th className="px-4 py-3 text-right">{t("costValue")}</th>
              <th className="px-4 py-3 text-right">{t("saleValue")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.sku}</td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-semibold",
                    r.status === "out" && "text-destructive",
                    r.status === "low" && "text-warning-foreground",
                  )}
                >
                  {num(r.stock, lang)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{num(r.lowAt, lang)}</td>
                <td className="px-4 py-2.5 text-right">{money(r.stock * r.cost, lang)}</td>
                <td className="px-4 py-2.5 text-right">{money(r.stock * r.price, lang)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  {data.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("font-display text-2xl font-bold", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
