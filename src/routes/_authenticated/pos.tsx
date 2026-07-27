import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Keyboard,
  Mail,
  MessageSquare,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getPrinterSize, printHtml, setPrinterSize, type PrinterSize } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Sales counter — SheraPOS" },
      { name: "description", content: "Ring up sales, apply coupons and print thermal receipts." },
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

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_amount: number;
  max_discount: number | null;
  is_active: boolean;
  expires_on: string | null;
};

type Receipt = {
  invoice: number;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  couponCode: string;
  tax: number;
  total: number;
  paid: number;
  method: string;
  customer: string;
  phone: string;
  email: string;
  at: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  footer: string;
};

const PAYMENT_METHODS: { id: string; key: TKey }[] = [
  { id: "cash", key: "cash" },
  { id: "bkash", key: "bkash" },
  { id: "nagad", key: "nagad" },
  { id: "rocket", key: "rocket" },
  { id: "upay", key: "upay" },
  { id: "card", key: "card" },
  { id: "bank", key: "bank" },
  { id: "cheque", key: "cheque" },
  { id: "due", key: "creditDue" },
  { id: "other", key: "other" },
];

function PosPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [discountMode, setDiscountMode] = useState<"flat" | "percent">("flat");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [taxPct, setTaxPct] = useState("0");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [scan, setScan] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

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
    staleTime: 60_000,
  });

  useEffect(() => {
    const pct = settings.data?.default_tax_pct;
    if (pct != null) setTaxPct(String(pct));
  }, [settings.data?.default_tax_pct]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stockMap = branchStock.data;
    return (products.data ?? [])
      .map((p) => (stockMap ? { ...p, stock: stockMap.get(p.id) ?? 0 } : p))
      .filter(
        (p) =>
          (cat === "all" || p.category_id === cat) &&
          (!q ||
            p.name_en.toLowerCase().includes(q) ||
            p.name_bn.includes(query.trim()) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode ?? "").toLowerCase().includes(q)),
      );
  }, [products.data, branchStock.data, query, cat]);


  const subtotal = cart.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);
  const manualDiscount =
    discountMode === "percent"
      ? (subtotal * (Number(discount) || 0)) / 100
      : Number(discount) || 0;
  const couponDiscount = useMemo(() => {
    if (!coupon) return 0;
    const raw = coupon.type === "percent" ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
    return coupon.max_discount != null ? Math.min(raw, Number(coupon.max_discount)) : raw;
  }, [coupon, subtotal]);
  const discountVal = Math.min(Math.max(manualDiscount + couponDiscount, 0), subtotal);
  const taxVal = ((subtotal - discountVal) * (Number(taxPct) || 0)) / 100;
  const total = Math.max(subtotal - discountVal + taxVal, 0);
  const paidVal = paid === "" ? total : Number(paid) || 0;
  const changeVal = paidVal - total;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const add = useCallback(
    (p: Product) => {
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
    },
    [t],
  );

  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const list = products.data ?? [];
    const p =
      list.find((x) => (x.barcode ?? "").toLowerCase() === code || x.sku.toLowerCase() === code) ??
      list.find(
        (x) => x.name_en.toLowerCase().includes(code) || x.name_bn.includes(scan.trim()),
      );
    if (!p) toast.error(t("noData"));
    else add(p);
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

  const resetSale = useCallback(() => {
    setCart([]);
    setDiscount("0");
    setDiscountMode("flat");
    setCoupon(null);
    setCouponCode("");
    setTaxPct(String(settings.data?.default_tax_pct ?? 0));
    setPaid("");
    setCustomer("");
    setPhone("");
    setEmail("");
    setContactId("");
    setMethod("cash");
  }, [settings.data?.default_tax_pct]);

  const applyCoupon = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .ilike("code", code.trim())
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Coupon | null;
    },
    onSuccess: (c) => {
      if (!c || !c.is_active) return toast.error(t("couponInvalid"));
      if (c.expires_on && new Date(c.expires_on) < new Date(new Date().toDateString()))
        return toast.error(t("couponExpired"));
      if (subtotal < Number(c.min_amount)) return toast.error(t("couponMin"));
      setCoupon(c);
      toast.success(`${t("couponApplied")} · ${c.code}`);
    },
    onError: () => toast.error(t("couponInvalid")),
  });

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
          coupon_code: coupon?.code ?? null,
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
          couponCode: coupon?.code ?? "",
          tax: taxVal,
          total,
          paid: paidVal,
          method,
          customer,
          phone,
          email,
          at: sale.created_at as string,
          shopName: s?.shop_name ?? t("appName"),
          shopAddress: s?.address ?? "",
          shopPhone: s?.phone ?? "",
          footer: s?.receipt_footer ?? t("thanks"),
        } satisfies Receipt,
      };
    },
    onSuccess: ({ status, receipt: r }) => {
      void logAudit("sale", { entity: "sale", details: `${status} · ${r?.invoice ?? ""}` });
      if (status === "final") {
        setReceipt(r);
        toast.success(t("saleDone"));
      } else toast.success(status === "draft" ? t("holdSale") : t("saveQuotation"));
      resetSale();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Keyboard shortcuts ----
  const checkoutMutate = checkout.mutate;
  const canCheckout = cart.length > 0 && !checkout.isPending;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key;
      const isTyping =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);

      if (key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (key === "F3") {
        e.preventDefault();
        scanRef.current?.focus();
      } else if (key === "F4") {
        e.preventDefault();
        paidRef.current?.focus();
        paidRef.current?.select();
      } else if (key === "F8") {
        e.preventDefault();
        setCart((prev) => {
          if (prev.length === 0) return prev;
          toast.info(t("voided"));
          return prev.slice(0, -1);
        });
      } else if (key === "F9" || (key === "Enter" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        if (canCheckout) checkoutMutate("final");
      } else if (key === "Escape" && !isTyping) {
        e.preventDefault();
        resetSale();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canCheckout, checkoutMutate, resetSale, t]);

  return (
    <div className="p-2 sm:p-4">
      <div className="surface-panel grid overflow-hidden p-0 lg:h-[calc(100vh-6rem)] lg:grid-cols-[1fr_420px]">
        {/* Catalog */}
        <section className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && visible[0]) {
                    add(visible[0]);
                    setQuery("");
                  }
                }}
                placeholder={t("search")}
                maxLength={60}
                className="h-12 rounded-xl bg-muted/50 pl-10 text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56 sm:flex-none">
                <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <Input
                  ref={scanRef}
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={onScan}
                  placeholder={t("scanBarcode")}
                  maxLength={60}
                  className="h-12 w-full rounded-xl bg-primary/5 pl-10 text-base"
                />
              </div>
              <ShortcutHelp />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2 sm:px-4 sm:py-3">
            <button
              type="button"
              onClick={() => setCat("all")}
              className={cn(
                "min-h-10 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition",
                cat === "all"
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {t("all")}
            </button>
            {(categories.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={cn(
                  "min-h-10 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition",
                  cat === c.id
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {lang === "bn" ? c.name_bn : c.name_en}
              </button>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-2.5 overflow-y-auto bg-muted/30 p-2.5 sm:grid-cols-3 sm:gap-4 sm:p-4 xl:grid-cols-4">
            {products.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
            {visible.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out}
                  onClick={() => add(p)}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-2.5 text-left shadow-sm transition-all active:scale-[0.97] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] disabled:pointer-events-none disabled:opacity-50 sm:p-4"
                >
                  <span className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-primary/10 font-display text-2xl font-bold text-primary/70 transition-colors group-hover:bg-primary/20 sm:mb-3">
                    {(lang === "bn" ? p.name_bn : p.name_en).slice(0, 2)}
                  </span>
                  <span className="line-clamp-1 text-[13px] font-semibold sm:text-sm">
                    {lang === "bn" ? p.name_bn : p.name_en}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[11px] sm:text-xs",
                      out
                        ? "text-destructive"
                        : p.stock <= 5
                          ? "text-warning-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {out ? t("outOfStock") : `${num(p.stock, lang)} ${p.unit}`}
                  </span>
                  <span className="mt-2 flex items-center justify-between sm:mt-3">
                    <span className="font-display text-sm font-bold text-primary">
                      {money(Number(p.price), lang)}
                    </span>
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                      <Plus className="size-3.5" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Checkout */}
        <aside className="flex min-h-0 flex-col border-t border-border bg-muted/40 lg:border-l lg:border-t-0">
          <div className="space-y-2 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("selectCustomer")}
              </Label>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetSale}>
                  <Trash2 className="mr-1 size-3" /> {t("clear")}
                </Button>
              )}
            </div>
            <Select
              value={contactId}
              onValueChange={(v) => {
                setContactId(v);
                const c = (customers.data ?? []).find((x) => x.id === v);
                if (c) {
                  setCustomer(c.name);
                  setPhone(c.phone ?? "");
                  setEmail(c.email ?? "");
                }
              }}
            >
              <SelectTrigger className="h-11 rounded-xl bg-card">
                <SelectValue placeholder={t("walkIn")} />
              </SelectTrigger>
              <SelectContent>
                {(customers.data ?? [])
                  .filter((c) => c.type === "customer")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={customer}
                maxLength={80}
                placeholder={t("customer")}
                onChange={(e) => setCustomer(e.target.value)}
                className="h-10 rounded-xl bg-card"
              />
              <Input
                value={phone}
                maxLength={20}
                inputMode="tel"
                placeholder={t("phone")}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-xl bg-card"
              />
            </div>
          </div>

          <div className="min-h-24 flex-1 space-y-2 overflow-y-auto px-3 pb-2 sm:px-4">
            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
            )}
            {cart.map((l) => (
              <div
                key={l.product.id}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:gap-3 sm:p-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {(lang === "bn" ? l.product.name_bn : l.product.name_en).slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {lang === "bn" ? l.product.name_bn : l.product.name_en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(l.product.price), lang)} × {num(l.qty, lang)} ={" "}
                    <span className="font-semibold text-foreground">
                      {money(Number(l.product.price) * l.qty, lang)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 rounded-lg sm:size-8"
                    onClick={() => setQty(l.product.id, l.qty - 1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{num(l.qty, lang)}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 rounded-lg sm:size-8"
                    onClick={() => setQty(l.product.id, l.qty + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 text-muted-foreground hover:text-destructive sm:size-8"
                    onClick={() => setQty(l.product.id, 0)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-10 border-t border-border bg-card p-3 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.5)] sm:p-4">
            {/* Coupon */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && couponCode.trim()) applyCoupon.mutate(couponCode);
                  }}
                  maxLength={24}
                  placeholder={t("coupon")}
                  disabled={!!coupon}
                  className="h-10 rounded-xl bg-muted/50 pl-9 uppercase"
                />
              </div>
              {coupon ? (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl text-xs"
                  onClick={() => {
                    setCoupon(null);
                    setCouponCode("");
                  }}
                >
                  {t("removeCoupon")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="h-10 rounded-xl text-xs font-semibold"
                  disabled={!couponCode.trim() || applyCoupon.isPending}
                  onClick={() => applyCoupon.mutate(couponCode)}
                >
                  {t("applyCoupon")}
                </Button>
              )}
            </div>

            {/* Discount + tax */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("discount")}
                  </Label>
                  <div className="flex overflow-hidden rounded-md border border-border">
                    {(["flat", "percent"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDiscountMode(m)}
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] font-bold",
                          discountMode === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground",
                        )}
                      >
                        {m === "flat" ? "৳" : "%"}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-10 rounded-lg bg-muted/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("tax")} %
                </Label>
                <Input
                  inputMode="decimal"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  className="mt-[7px] h-10 rounded-lg bg-muted/50"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 space-y-1.5 rounded-xl bg-muted/40 p-3 text-sm">
              <Row label={`${t("subtotal")} · ${num(itemCount, lang)} ${t("items")}`} value={money(subtotal, lang)} />
              {manualDiscount > 0 && (
                <Row label={t("discount")} value={`− ${money(manualDiscount, lang)}`} />
              )}
              {coupon && (
                <Row label={`${t("coupon")} · ${coupon.code}`} value={`− ${money(couponDiscount, lang)}`} />
              )}
              <Row label={`${t("tax")} ${num(Number(taxPct) || 0, lang)}%`} value={money(taxVal, lang)} />
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-display text-lg font-bold">{t("total")}</span>
                <span className="font-display text-2xl font-bold text-primary">{money(total, lang)}</span>
              </div>
            </div>

            {/* Payment methods */}
            <div className="mt-3">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("paymentMethod")}
              </Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "min-h-10 rounded-xl border-2 px-1 py-2 text-[11px] font-bold leading-tight transition",
                      method === m.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    {t(m.key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-end gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("paid")}
                </Label>
                <Input
                  ref={paidRef}
                  inputMode="decimal"
                  value={paid}
                  placeholder={total.toFixed(2)}
                  onChange={(e) => setPaid(e.target.value)}
                  className="h-12 rounded-xl bg-success/10 text-lg font-bold"
                />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {changeVal >= 0 ? t("change") : t("due")}
                </p>
                <p className="font-display text-xl font-bold">{money(Math.abs(changeVal), lang)}</p>
              </div>
            </div>

            <Button
              className="mt-3 h-14 w-full rounded-2xl text-base font-bold shadow-[var(--shadow-lift)] active:scale-[0.98]"
              disabled={!canCheckout}
              onClick={() => checkout.mutate("final")}
            >
              {t("checkout")} · {money(total, lang)}
            </Button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-11 rounded-xl text-xs font-semibold"
                disabled={!canCheckout}
                onClick={() => checkout.mutate("draft")}
              >
                <PauseCircle className="mr-1 size-4" /> {t("holdSale")}
              </Button>
              <Button
                variant="secondary"
                className="h-11 rounded-xl text-xs font-semibold"
                disabled={!canCheckout}
                onClick={() => checkout.mutate("quotation")}
              >
                {t("saveQuotation")}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-muted-foreground">
      <span className="min-w-0 truncate">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ShortcutHelp() {
  const { t } = useI18n();
  const rows: { k: string; label: TKey }[] = [
    { k: "F2", label: "scFocusSearch" },
    { k: "F3", label: "scFocusScan" },
    { k: "Enter", label: "scAddFirst" },
    { k: "F4", label: "scPayment" },
    { k: "F8", label: "scVoid" },
    { k: "F9 / Ctrl+↵", label: "scComplete" },
    { k: "Esc", label: "scClear" },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="size-12 shrink-0 rounded-xl" aria-label={t("shortcuts")}>
          <Keyboard className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-sm font-bold">{t("shortcuts")}</p>
        <ul className="space-y-1.5 text-xs">
          {rows.map((r) => (
            <li key={r.k} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t(r.label)}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {r.k}
              </kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [size, setSize] = useState<PrinterSize>("80mm");

  useEffect(() => {
    setSize(getPrinterSize());
  }, []);

  if (!receipt) return null;

  const methodLabel =
    PAYMENT_METHODS.find((m) => m.id === receipt.method)?.key ?? ("other" as TKey);

  const summaryText = [
    `${receipt.shopName} — ${t("invoice")} #${receipt.invoice}`,
    ...receipt.lines.map(
      (l) =>
        `${lang === "bn" ? l.product.name_bn : l.product.name_en} x${l.qty} = ${money(
          Number(l.product.price) * l.qty,
        )}`,
    ),
    `${t("total")}: ${money(receipt.total)}`,
    `${t("paid")}: ${money(receipt.paid)}`,
    receipt.footer,
  ].join("\n");

  function buildPrintHtml() {
    if (!receipt) return "";
    const rows = receipt.lines
      .map(
        (l) => `<tr><td>${escapeHtml(lang === "bn" ? l.product.name_bn : l.product.name_en)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${Number(l.product.price).toFixed(2)}</td>
        <td class="num">${(Number(l.product.price) * l.qty).toFixed(2)}</td></tr>`,
      )
      .join("");
    const line = (a: string, b: string, bold = false) =>
      `<div class="row${bold ? " total" : ""}"><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></div>`;
    return `
      <div class="center">
        <p class="shop">${escapeHtml(receipt.shopName)}</p>
        ${receipt.shopAddress ? `<div class="sm">${escapeHtml(receipt.shopAddress)}</div>` : ""}
        ${receipt.shopPhone ? `<div class="sm">${escapeHtml(receipt.shopPhone)}</div>` : ""}
        <div class="sm muted">${t("invoice")} #${receipt.invoice} · ${new Date(receipt.at).toLocaleString()}</div>
        ${receipt.customer ? `<div class="sm">${escapeHtml(receipt.customer)} ${escapeHtml(receipt.phone ?? "")}</div>` : ""}
      </div>
      <hr />
      <table>
        <thead><tr><th>${t("items")}</th><th class="num">${t("qty")}</th><th class="num">${t("price")}</th><th class="num">${t("total")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr />
      ${line(t("subtotal"), receipt.subtotal.toFixed(2))}
      ${line(`${t("discount")}${receipt.couponCode ? ` (${receipt.couponCode})` : ""}`, `-${receipt.discount.toFixed(2)}`)}
      ${line(t("tax"), receipt.tax.toFixed(2))}
      ${line(t("total"), receipt.total.toFixed(2), true)}
      ${line(`${t("paid")} (${t(methodLabel)})`, receipt.paid.toFixed(2))}
      ${line(t("change"), Math.max(receipt.paid - receipt.total, 0).toFixed(2))}
      <hr />
      <div class="center sm">${escapeHtml(receipt.footer)}</div>`;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("receipt")}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-dashed border-border p-4 text-sm">
          <p className="text-center font-display text-lg font-bold">{receipt.shopName || t("appName")}</p>
          {receipt.shopAddress && <p className="text-center text-xs">{receipt.shopAddress}</p>}
          {receipt.shopPhone && <p className="text-center text-xs">{receipt.shopPhone}</p>}
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
          <Row
            label={receipt.couponCode ? `${t("discount")} · ${receipt.couponCode}` : t("discount")}
            value={`− ${money(receipt.discount, lang)}`}
          />
          <Row label={t("tax")} value={money(receipt.tax, lang)} />
          <div className="mt-1 flex justify-between font-bold">
            <span>{t("total")}</span>
            <span>{money(receipt.total, lang)}</span>
          </div>
          <Row label={`${t("paid")} · ${t(methodLabel)}`} value={money(receipt.paid, lang)} />
          <Row label={t("change")} value={money(Math.max(receipt.paid - receipt.total, 0), lang)} />
          <p className="mt-3 text-center text-xs text-muted-foreground">{receipt.footer || t("thanks")}</p>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("printerSize")}
          </Label>
          <Select
            value={size}
            onValueChange={(v) => {
              const s = v as PrinterSize;
              setSize(s);
              setPrinterSize(s);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58mm">{t("thermal58")}</SelectItem>
              <SelectItem value="80mm">{t("thermal80")}</SelectItem>
              <SelectItem value="a4">{t("a4Print")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("customerCopy")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                if (!receipt.phone) return toast.error(t("needPhone"));
                window.location.href = `sms:${receipt.phone}?&body=${encodeURIComponent(summaryText)}`;
              }}
            >
              <MessageSquare className="mr-1 size-3.5" /> SMS
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                if (!receipt.phone) return toast.error(t("needPhone"));
                const to = receipt.phone.replace(/[^0-9]/g, "");
                window.open(`https://wa.me/${to}?text=${encodeURIComponent(summaryText)}`, "_blank");
              }}
            >
              <MessageSquare className="mr-1 size-3.5" /> WA
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                window.location.href = `mailto:${receipt.email ?? ""}?subject=${encodeURIComponent(
                  `${t("invoice")} #${receipt.invoice}`,
                )}&body=${encodeURIComponent(summaryText)}`;
              }}
            >
              <Mail className="mr-1 size-3.5" /> {t("sendEmail")}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={() => printHtml(buildPrintHtml(), size)}>
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
          <Button className="h-12 flex-1" onClick={onClose}>
            {t("newSale")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
