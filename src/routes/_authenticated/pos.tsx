import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Barcode, Minus, PauseCircle, Plus, Printer, Search, Trash2, X } from "lucide-react";
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


export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Sales counter — SheraPOS" },
      { name: "description", content: "Ring up sales, apply discounts and print receipts." },
      { property: "og:title", content: "Sales counter — SheraPOS" },
      { property: "og:description", content: "Ring up sales and print receipts with SheraPOS." },
    ],
  }),
  component: PosPage,
});

type Product = {
  id: string;
  name_en: string;
  name_bn: string;
  sku: string;
  barcode: string | null;
  price: number;
  stock: number;
  unit: string;
  category_id: string | null;
};

type CartLine = { product: Product; qty: number };

type Receipt = {
  invoice: number;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  method: string;
  customer: string;
  at: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  footer: string;
};

function PosPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [taxPct, setTaxPct] = useState("0");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [contactId, setContactId] = useState("");
  const [scan, setScan] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const settings = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const customers = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku,barcode,price,stock,unit,category_id")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  useEffect(() => {
    const pct = settings.data?.default_tax_pct;
    if (pct != null) setTaxPct(String(pct));
  }, [settings.data?.default_tax_pct]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (cat === "all" || p.category_id === cat) &&
        (!q ||
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.includes(query.trim()) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q)),
    );
  }, [products.data, query, cat]);


  const subtotal = cart.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);
  const discountVal = Math.min(Number(discount) || 0, subtotal);
  const taxVal = ((subtotal - discountVal) * (Number(taxPct) || 0)) / 100;
  const total = Math.max(subtotal - discountVal + taxVal, 0);
  const paidVal = paid === "" ? total : Number(paid) || 0;
  const changeVal = paidVal - total;

  function add(p: Product) {
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      const currentQty = found?.qty ?? 0;
      if (currentQty + 1 > p.stock) {
        toast.error(t("outOfStock"));
        return prev;
      }
      return found
        ? prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { product: p, qty: 1 }];
    });
  }

  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const p = (products.data ?? []).find(
      (x) => (x.barcode ?? "").toLowerCase() === code || x.sku.toLowerCase() === code,
    );
    if (!p) {
      toast.error(t("noData"));
    } else {
      add(p);
    }
    setScan("");
    scanRef.current?.focus();
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, qty: Math.min(Math.max(qty, 0), l.product.stock) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function resetSale() {
    setCart([]);
    setDiscount("0");
    setTaxPct(String(settings.data?.default_tax_pct ?? 0));
    setPaid("");
    setCustomer("");
    setPhone("");
    setContactId("");
    setMethod("cash");
  }

  const checkout = useMutation({
    mutationFn: async (status: "final" | "draft" | "quotation" = "final") => {
      if (cart.length === 0) throw new Error(t("emptyCart"));
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Unauthorized");

      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          cashier_id: uid,
          contact_id: contactId || null,
          status,
          customer_name: customer.trim().slice(0, 80) || null,
          customer_phone: phone.trim().slice(0, 20) || null,
          subtotal,
          discount: discountVal,
          tax: taxVal,
          total,
          paid: status === "final" ? paidVal : 0,
          payment_method: method,
        })
        .select("id,invoice_no,created_at")
        .single();
      if (error) throw error;

      if (status === "final") {
        const items = cart.map((l) => ({
          sale_id: sale.id,
          product_id: l.product.id,
          name_snapshot: lang === "bn" ? l.product.name_bn : l.product.name_en,
          unit_price: Number(l.product.price),
          quantity: l.qty,
          line_total: Number(l.product.price) * l.qty,
        }));
        const { error: itemsError } = await supabase.from("sale_items").insert(items);
        if (itemsError) throw itemsError;
      }

      const s = settings.data;
      return {
        status,
        receipt: {
          invoice: Number(sale.invoice_no),
          lines: cart,
          subtotal,
          discount: discountVal,
          tax: taxVal,
          total,
          paid: paidVal,
          method,
          customer,
          at: sale.created_at as string,
          shopName: s?.shop_name ?? t("appName"),
          shopAddress: s?.address ?? "",
          shopPhone: s?.phone ?? "",
          footer: s?.receipt_footer ?? t("thanks"),
        } satisfies Receipt,
      };
    },
    onSuccess: ({ status, receipt: r }) => {
      if (status === "final") setReceipt(r);
      else toast.success(status === "draft" ? t("holdSale") : t("saveQuotation"));
      resetSale();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_380px]">
      {/* Catalog */}
      <section className="min-w-0">
        <div className="relative">
          <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={onScan}
            placeholder={t("scanBarcode")}
            maxLength={60}
            className="mb-3 h-11 pl-9"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            maxLength={60}
            className="h-11 pl-9"
          />
        </div>


        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={cat === "all" ? "default" : "outline"}
            onClick={() => setCat("all")}
          >
            {t("all")}
          </Button>
          {(categories.data ?? []).map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={cat === c.id ? "default" : "outline"}
              onClick={() => setCat(c.id)}
            >
              {lang === "bn" ? c.name_bn : c.name_en}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {visible.map((p) => {
            const out = p.stock <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={out}
                onClick={() => add(p)}
                className={cn(
                  "surface-panel group flex flex-col items-start p-3 text-left transition hover:shadow-[var(--shadow-lift)] disabled:opacity-50",
                )}
              >
                <span className="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-secondary font-display text-xl font-bold text-secondary-foreground">
                  {(lang === "bn" ? p.name_bn : p.name_en).slice(0, 2)}
                </span>
                <span className="line-clamp-2 text-sm font-semibold leading-snug">
                  {lang === "bn" ? p.name_bn : p.name_en}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{p.sku}</span>
                <span className="mt-2 flex w-full items-center justify-between">
                  <span className="font-display font-bold text-primary">{money(Number(p.price), lang)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      out
                        ? "bg-destructive/10 text-destructive"
                        : p.stock <= 5
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {out ? t("outOfStock") : `${num(p.stock, lang)} ${p.unit}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cart */}
      <aside className="surface-panel flex h-fit flex-col p-4 lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("cart")}</h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetSale}>
              <Trash2 className="mr-1 size-4" /> {t("clear")}
            </Button>
          )}
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {cart.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>}
          {cart.map((l) => (
            <div key={l.product.id} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {lang === "bn" ? l.product.name_bn : l.product.name_en}
                </p>
                <p className="text-xs text-muted-foreground">
                  {money(Number(l.product.price), lang)} × {num(l.qty, lang)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(l.product.id, l.qty - 1)}>
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{num(l.qty, lang)}</span>
                <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(l.product.id, l.qty + 1)}>
                  <Plus className="size-3" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(l.product.id, 0)}>
                  <X className="size-3" />
                </Button>
              </div>
              <span className="w-16 text-right text-sm font-semibold">
                {money(Number(l.product.price) * l.qty, lang)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("discount")}</Label>
            <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tax")} %</Label>
            <Input inputMode="decimal" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("customer")}</Label>
            <Input value={customer} maxLength={80} onChange={(e) => setCustomer(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("phone")}</Label>
            <Input value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
          <Row label={t("subtotal")} value={money(subtotal, lang)} />
          <Row label={t("discount")} value={`− ${money(discountVal, lang)}`} />
          <Row label={t("tax")} value={money(taxVal, lang)} />
          <div className="flex items-center justify-between border-t border-border pt-2 font-display text-xl font-bold">
            <span>{t("total")}</span>
            <span className="text-primary">{money(total, lang)}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {(["cash", "card", "mobile"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              className="flex-1"
              variant={method === m ? "default" : "outline"}
              onClick={() => setMethod(m)}
            >
              {t(m)}
            </Button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          <Label className="text-xs">{t("paid")}</Label>
          <Input
            inputMode="decimal"
            value={paid}
            placeholder={total.toFixed(2)}
            onChange={(e) => setPaid(e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            {changeVal >= 0 ? t("change") : t("due")}: {money(Math.abs(changeVal), lang)}
          </p>
        </div>

        <Button
          className="mt-4 h-12 text-base"
          disabled={cart.length === 0 || checkout.isPending}
          onClick={() => checkout.mutate("final")}
        >
          {t("checkout")} · {money(total, lang)}
        </Button>

        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={cart.length === 0 || checkout.isPending}
            onClick={() => checkout.mutate("draft")}
          >
            <PauseCircle className="mr-1 size-4" /> {t("holdSale")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={cart.length === 0 || checkout.isPending}
            onClick={() => checkout.mutate("quotation")}
          >
            {t("saveQuotation")}
          </Button>
        </div>

      </aside>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  if (!receipt) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("receipt")}</DialogTitle>
        </DialogHeader>
        <div id="receipt-print" className="rounded-lg border border-dashed border-border p-4 text-sm">
          <p className="text-center font-display text-lg font-bold">{t("appName")}</p>
          <p className="text-center text-xs text-muted-foreground">
            {t("invoice")} #{num(receipt.invoice, lang)} · {new Date(receipt.at).toLocaleString()}
          </p>
          {receipt.customer && <p className="mt-1 text-center text-xs">{receipt.customer}</p>}
          <div className="my-3 space-y-1 border-y border-dashed border-border py-3">
            {receipt.lines.map((l) => (
              <div key={l.product.id} className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {lang === "bn" ? l.product.name_bn : l.product.name_en} × {num(l.qty, lang)}
                </span>
                <span>{money(Number(l.product.price) * l.qty, lang)}</span>
              </div>
            ))}
          </div>
          <Row label={t("subtotal")} value={money(receipt.subtotal, lang)} />
          <Row label={t("discount")} value={`− ${money(receipt.discount, lang)}`} />
          <Row label={t("tax")} value={money(receipt.tax, lang)} />
          <div className="mt-1 flex justify-between font-bold">
            <span>{t("total")}</span>
            <span>{money(receipt.total, lang)}</span>
          </div>
          <Row label={t("paid")} value={money(receipt.paid, lang)} />
          <Row label={t("change")} value={money(Math.max(receipt.paid - receipt.total, 0), lang)} />
          <p className="mt-3 text-center text-xs text-muted-foreground">{t("thanks")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.print()}>
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {t("newSale")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
