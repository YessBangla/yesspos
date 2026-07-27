import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales & returns — SheraPOS" },
      { name: "description", content: "Browse every invoice, quotations and record sale returns with stock-back." },
      { property: "og:title", content: "Sales & returns — SheraPOS" },
      { property: "og:description", content: "Browse invoices and record sale returns." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { filter?: string } => ({
    filter: typeof search.filter === "string" ? search.filter : undefined,
  }),
  component: SalesPage,
});

type Sale = {
  id: string;
  invoice_no: number;
  customer_name: string | null;
  total: number;
  paid: number;
  payment_method: string;
  status: string;
  created_at: string;
};

type Item = {
  id: string;
  product_id: string | null;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
};

function SalesPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [filter, setFilter] = useState<"all" | "final" | "draft" | "quotation" | "returns">("all");

  useEffect(() => {
    const f = search.filter;
    if (f === "quotation" || f === "returns" || f === "final" || f === "draft") setFilter(f);
  }, [search.filter]);
  const [returning, setReturning] = useState<Sale | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,invoice_no,customer_name,total,paid,payment_method,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Sale[];
    },
  });

  const items = useQuery({
    queryKey: ["sale-items", returning?.id],
    enabled: !!returning,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("id,product_id,name_snapshot,unit_price,quantity")
        .eq("sale_id", returning!.id);
      if (error) throw error;
      return data as unknown as Item[];
    },
  });

  const submitReturn = useMutation({
    mutationFn: async () => {
      const rows = (items.data ?? [])
        .map((i) => ({ i, q: Math.min(Number(qtys[i.id]) || 0, i.quantity) }))
        .filter((r) => r.q > 0);
      if (rows.length === 0) throw new Error(t("noData"));
      const total = rows.reduce((s, r) => s + Number(r.i.unit_price) * r.q, 0);
      const { data: userData } = await supabase.auth.getUser();
      const { data: ret, error } = await supabase
        .from("sale_returns")
        .insert({
          sale_id: returning!.id,
          user_id: userData.user?.id ?? null,
          total,
          reason: reason.trim().slice(0, 200) || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase.from("sale_return_items").insert(
        rows.map((r) => ({
          return_id: ret.id,
          product_id: r.i.product_id,
          name_snapshot: r.i.name_snapshot,
          unit_price: Number(r.i.unit_price),
          quantity: r.q,
          line_total: Number(r.i.unit_price) * r.q,
        })),
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      setReturning(null);
      setQtys({});
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(t("returnSale"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const returns = useQuery({
    queryKey: ["returns"],
    enabled: filter === "returns",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_returns")
        .select("id,total,reason,created_at,sales(invoice_no)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as {
        id: string;
        total: number;
        reason: string | null;
        created_at: string;
        sales: { invoice_no: number } | null;
      }[];
    },
  });

  const visible = (sales.data ?? []).filter((s) => filter === "all" || s.status === filter);

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold">{t("sales")}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "final", "draft", "quotation", "returns"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? t("all") : k === "returns" ? t("saleReturns") : t(k)}
          </Button>
        ))}
      </div>

      {filter === "returns" ? (
        <div className="surface-panel mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("invoice")}</th>
                <th className="px-4 py-3">{t("date")}</th>
                <th className="px-4 py-3">{t("reason")}</th>
                <th className="px-4 py-3 text-right">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {(returns.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    #{r.sales ? num(Number(r.sales.invoice_no), lang) : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">
                    {money(Number(r.total), lang)}
                  </td>
                </tr>
              ))}
              {(returns.data ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    {returns.isLoading ? t("loading") : t("noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("invoice")}</th>
              <th className="px-4 py-3">{t("customer")}</th>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3 text-right">{t("total")}</th>
              <th className="px-4 py-3 text-right">{t("due")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">#{num(Number(s.invoice_no), lang)}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.customer_name || t("walkIn")}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      s.status === "final"
                        ? "bg-muted text-muted-foreground"
                        : "bg-warning/20 text-warning-foreground",
                    )}
                  >
                    {s.status === "final" ? t("final") : s.status === "draft" ? t("draft") : t("quotation")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{money(Number(s.total), lang)}</td>
                <td className="px-4 py-3 text-right text-destructive">
                  {money(Math.max(Number(s.total) - Number(s.paid), 0), lang)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReturning(s);
                      setQtys({});
                      setReason("");
                    }}
                  >
                    <RotateCcw className="mr-1 size-4" /> {t("returnSale")}
                  </Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  {sales.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("returnSale")} · #{returning ? num(Number(returning.invoice_no), lang) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {items.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
            {(items.data ?? []).map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(i.unit_price), lang)} · {t("qty")} {num(i.quantity, lang)}
                  </p>
                </div>
                <Input
                  className="h-9 w-20"
                  inputMode="numeric"
                  placeholder="0"
                  value={qtys[i.id] ?? ""}
                  onChange={(e) => setQtys({ ...qtys, [i.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>{t("reason")}</Label>
            <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturning(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => submitReturn.mutate()} disabled={submitReturn.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
