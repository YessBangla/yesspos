import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Eye, HandCoins, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getPrinterSize, printHtml, PRINTER_SIZES, type PrinterSize } from "@/lib/print";
import { ShareInvoiceButtons } from "@/components/ShareInvoiceButtons";


export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales, quotations & returns — Daily Bazar" },
      {
        name: "description",
        content: "Search invoices, reprint receipts, collect dues, convert quotations and record sale returns.",
      },
      { property: "og:title", content: "Sales, quotations & returns — Daily Bazar" },
      { property: "og:description", content: "Invoices, dues, quotations and returns in one register." },
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
  customer_phone: string | null;
  contact_id: string | null;
  branch_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
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

const SALE_COLUMNS =
  "id,invoice_no,customer_name,customer_phone,contact_id,branch_id,subtotal,discount,tax,total,paid,payment_method,status,created_at";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function SalesPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [filter, setFilter] = useState<"all" | "final" | "draft" | "quotation" | "returns">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const f = search.filter;
    if (f === "quotation" || f === "returns" || f === "final" || f === "draft") setFilter(f);
  }, [search.filter]);

  const [returning, setReturning] = useState<Sale | null>(null);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [collecting, setCollecting] = useState<Sale | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const settings = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(SALE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Sale[];
    },
  });

  const detailSale = returning ?? viewing;
  const items = useQuery({
    queryKey: ["sale-items", detailSale?.id],
    enabled: !!detailSale,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("id,product_id,name_snapshot,unit_price,quantity")
        .eq("sale_id", detailSale!.id);
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
      void logAudit("sale_return", { entity: "sale" });
      invalidateAll();
      toast.success(t("returnSale"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const convert = useMutation({
    mutationFn: async (sale: Sale) => {
      const { error } = await supabase
        .from("sales")
        .update({ status: "final", paid: Number(sale.paid) })
        .eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void logAudit("sale", { entity: "sale", details: "converted" });
      invalidateAll();
      toast.success(t("converted"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const collect = useMutation({
    mutationFn: async () => {
      const sale = collecting!;
      const due = Math.max(Number(sale.total) - Number(sale.paid), 0);
      const amount = Math.min(Number(payAmount) || 0, due);
      if (amount <= 0) throw new Error(t("noData"));
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        direction: "in",
        amount,
        method: payMethod,
        sale_id: sale.id,
        contact_id: sale.contact_id,
        branch_id: sale.branch_id,
        user_id: userData.user?.id ?? null,
        note: `Invoice #${sale.invoice_no}`,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("sales")
        .update({ paid: Number(sale.paid) + amount })
        .eq("id", sale.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      setCollecting(null);
      setPayAmount("");
      void logAudit("payment", { entity: "sale" });
      invalidateAll();
      toast.success(t("paymentSaved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function invalidateAll() {
    for (const key of [
      "sales",
      "products",
      "branch-stock",
      "products-all",
      "returns",
      "stats",
      "payments",
      "dashboard",
    ])
      queryClient.invalidateQueries({ queryKey: [key] });
  }

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

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return (sales.data ?? []).filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      const ts = new Date(s.created_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (!term) return true;
      return (
        String(s.invoice_no).includes(term) ||
        (s.customer_name ?? "").toLowerCase().includes(term) ||
        (s.customer_phone ?? "").toLowerCase().includes(term)
      );
    });
  }, [sales.data, filter, q, from, to]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, s) => {
          acc.total += Number(s.total);
          acc.paid += Number(s.paid);
          acc.due += Math.max(Number(s.total) - Number(s.paid), 0);
          return acc;
        },
        { total: 0, paid: 0, due: 0 },
      ),
    [visible],
  );

  function exportCsv() {
    const head = ["Invoice", "Date", "Customer", "Phone", "Status", "Subtotal", "Discount", "Tax", "Total", "Paid", "Due"];
    const rows = visible.map((s) => [
      s.invoice_no,
      new Date(s.created_at).toISOString(),
      s.customer_name ?? "",
      s.customer_phone ?? "",
      s.status,
      s.subtotal,
      s.discount,
      s.tax,
      s.total,
      s.paid,
      Math.max(Number(s.total) - Number(s.paid), 0),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printInvoice(sale: Sale, lines: Item[], size: PrinterSize) {
    const s = settings.data;
    const rows = lines
      .map(
        (l) => `<tr><td>${escapeHtml(l.name_snapshot)}</td><td class="num">${l.quantity}</td>
        <td class="num">${Number(l.unit_price).toFixed(2)}</td>
        <td class="num">${(Number(l.unit_price) * l.quantity).toFixed(2)}</td></tr>`,
      )
      .join("");
    const line = (a: string, b: string, bold = false) =>
      `<div class="row${bold ? " total" : ""}"><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></div>`;
    printHtml(
      `<div class="center">
        <p class="shop">${escapeHtml(s?.shop_name ?? "Daily Bazar")}</p>
        ${s?.address ? `<div class="sm">${escapeHtml(s.address)}</div>` : ""}
        ${s?.phone ? `<div class="sm">${escapeHtml(s.phone)}</div>` : ""}
        <div class="sm muted">${t("invoice")} #${sale.invoice_no} · ${new Date(sale.created_at).toLocaleString()}</div>
        ${sale.customer_name ? `<div class="sm">${escapeHtml(sale.customer_name)} ${escapeHtml(sale.customer_phone ?? "")}</div>` : ""}
      </div>
      <hr />
      <table><thead><tr><th>${t("items")}</th><th class="num">${t("qty")}</th><th class="num">${t("price")}</th><th class="num">${t("total")}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <hr />
      ${line(t("subtotal"), Number(sale.subtotal).toFixed(2))}
      ${line(t("discount"), `-${Number(sale.discount).toFixed(2)}`)}
      ${line(t("tax"), Number(sale.tax).toFixed(2))}
      ${line(t("total"), Number(sale.total).toFixed(2), true)}
      ${line(t("paid"), Number(sale.paid).toFixed(2))}
      ${line(t("due"), Math.max(Number(sale.total) - Number(sale.paid), 0).toFixed(2))}
      <hr />
      <div class="center sm">${escapeHtml(s?.receipt_footer ?? t("thanks"))}</div>`,
      size,
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">{t("sales")}</h1>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="mr-1.5 size-4" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "final", "draft", "quotation", "returns"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? t("all") : k === "returns" ? t("saleReturns") : t(k)}
          </Button>
        ))}
      </div>

      {filter !== "returns" && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder={t("searchInvoice")} value={q} onChange={(e) => setQ(e.target.value)} />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("from")} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("to")} />
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("total")}</span>
              <span className="font-bold">{money(totals.total, lang)}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              {t("paid")}: <strong className="text-foreground">{money(totals.paid, lang)}</strong>
            </span>
            <span>
              {t("due")}: <strong className="text-destructive">{money(totals.due, lang)}</strong>
            </span>
            <span>
              {t("items")}: <strong className="text-foreground">{num(visible.length, lang)}</strong>
            </span>
          </div>
        </>
      )}

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
                  <td className="px-4 py-3 font-medium">#{r.sales ? num(Number(r.sales.invoice_no), lang) : "-"}</td>
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
          <table className="w-full min-w-[860px] text-sm">
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
              {visible.map((s) => {
                const due = Math.max(Number(s.total) - Number(s.paid), 0);
                return (
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
                    <td className="px-4 py-3 text-right text-destructive">{money(due, lang)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(s)} title={t("view")}>
                          <Eye className="size-4" />
                        </Button>
                        {s.status !== "final" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => convert.mutate(s)}
                            disabled={convert.isPending}
                            title={t("convertToSale")}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                        {s.status === "final" && due > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCollecting(s);
                              setPayAmount(String(due));
                              setPayMethod("cash");
                            }}
                            title={t("collectDue")}
                          >
                            <HandCoins className="size-4" />
                          </Button>
                        )}
                        {s.status === "final" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReturning(s);
                              setQtys({});
                              setReason("");
                            }}
                            title={t("returnSale")}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Invoice detail + reprint */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("invoiceDetail")} · #{viewing ? num(Number(viewing.invoice_no), lang) : ""}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                {viewing.customer_name || t("walkIn")} · {new Date(viewing.created_at).toLocaleString()}
              </div>
              <div className="space-y-1 rounded-lg border border-dashed border-border p-3">
                {items.isLoading && <p className="text-muted-foreground">{t("loading")}</p>}
                {(items.data ?? []).map((i) => (
                  <div key={i.id} className="flex justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {i.name_snapshot} × {num(i.quantity, lang)}
                    </span>
                    <span>{money(Number(i.unit_price) * i.quantity, lang)}</span>
                  </div>
                ))}
                {!items.isLoading && (items.data ?? []).length === 0 && (
                  <p className="text-muted-foreground">{t("noData")}</p>
                )}
              </div>
              <div className="space-y-1">
                <Row label={t("subtotal")} value={money(Number(viewing.subtotal), lang)} />
                <Row label={t("discount")} value={`− ${money(Number(viewing.discount), lang)}`} />
                <Row label={t("tax")} value={money(Number(viewing.tax), lang)} />
                <div className="flex justify-between font-bold">
                  <span>{t("total")}</span>
                  <span>{money(Number(viewing.total), lang)}</span>
                </div>
                <Row label={t("paid")} value={money(Number(viewing.paid), lang)} />
                <Row
                  label={t("due")}
                  value={money(Math.max(Number(viewing.total) - Number(viewing.paid), 0), lang)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRINTER_SIZES.map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    variant={size === getPrinterSize() ? "default" : "outline"}
                    onClick={() => printInvoice(viewing, items.data ?? [], size)}
                  >
                    <Printer className="mr-1.5 size-4" />
                    {size === "58mm" ? t("thermal58") : size === "80mm" ? t("thermal80") : t("a4Print")}
                  </Button>
                ))}
              </div>
              <ShareInvoiceButtons
                phone={viewing.customer_phone}
                invoice={{
                  invoice: Number(viewing.invoice_no),
                  at: viewing.created_at,
                  lines: (items.data ?? []).map((i) => ({
                    name: i.name_snapshot,
                    qty: i.quantity,
                    price: Number(i.unit_price),
                  })),
                  subtotal: Number(viewing.subtotal),
                  discount: Number(viewing.discount),
                  tax: Number(viewing.tax),
                  total: Number(viewing.total),
                  paid: Number(viewing.paid),
                  shopName: settings.data?.shop_name ?? "Daily Bazar",
                  shopPhone: settings.data?.phone ?? "",
                  customer: viewing.customer_name ?? "",
                  footer: settings.data?.receipt_footer ?? "",
                }}
              />

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collect due */}
      <Dialog open={!!collecting} onOpenChange={(o) => !o && setCollecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("collectDue")} · #{collecting ? num(Number(collecting.invoice_no), lang) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("amount")}</Label>
              <Input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentMethod")}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["cash", "bkash", "nagad", "rocket", "card", "bank", "other"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCollecting(null)}>
                {t("cancel")}
              </Button>
              <Button onClick={() => collect.mutate()} disabled={collect.isPending}>
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return */}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
