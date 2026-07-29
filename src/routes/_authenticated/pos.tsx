import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  CreditCard,
  Keyboard,
  Landmark,
  Mail,
  MessageSquare,
  Minus,
  Package,
  PauseCircle,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBranchStock } from "@/lib/use-branch";
import { matchesSerial, productSerial } from "@/lib/serial";
import { loadPosTabs, savePosTabs } from "@/lib/pos-tabs";
import { useActiveBranch } from "@/lib/active-branch";
import { useMyRole } from "@/lib/use-my-role";
import { money, num, useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getPrinterSize, printHtml, setPrinterSize, type PrinterSize } from "@/lib/print";
import { QuickAddCustomer, QuickAddProduct } from "@/components/QuickAddDialogs";
import {
  REDEEM_MIN_POINTS,
  applyLoyalty,
  maxRedeemable,
  pointsFor,
  pointsToMoney,
  registerMember,
} from "@/lib/loyalty";
import { isOfflineSupported, queueSale } from "@/lib/offline-queue";
import { normalizePhone } from "@/lib/share-invoice";
import { checkPackCart } from "@/lib/pack-size";
import { checkOrderConsistency, formatIssues } from "@/lib/order-check";



export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Sales counter — Sokoler Bazar" },
      { name: "description", content: "Ring up sales, apply coupons and print thermal receipts." },
      { property: "og:title", content: "Sales counter — Sokoler Bazar" },
      { property: "og:description", content: "Ring up sales and print receipts with Sokoler Bazar." },
    ],
  }),
  component: PosPage,
});

type Product = {
  id: string;
  name_en: string;
  name_bn: string;
  sku: string;
  seq: number | null;
  barcode: string | null;
  price: number;
  stock: number;
  unit: string;
  category_id: string | null;
  image_url: string | null;
  pack_size: string | null;
  brand: string | null;
};


type CartLine = { product: Product; qty: number };

type SaleSnapshot = {
  cart: CartLine[];
  discount: string;
  discountMode: "flat" | "percent";
  couponCode: string;
  coupon: Coupon | null;
  taxPct: string;
  paid: string;
  method: string;
  customer: string;
  phone: string;
  email: string;
  contactId: string;
  changeGiven: boolean;
  redeemPoints: string;
};

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

const PAYMENT_METHODS: { id: string; key: TKey; icon: typeof Banknote }[] = [
  { id: "cash", key: "cash", icon: Banknote },
  { id: "bkash", key: "bkash", icon: Smartphone },
  { id: "nagad", key: "nagad", icon: Smartphone },
  { id: "rocket", key: "rocket", icon: Smartphone },
  { id: "upay", key: "upay", icon: Smartphone },
  { id: "card", key: "card", icon: CreditCard },
  { id: "bank", key: "bank", icon: Landmark },
  { id: "cheque", key: "cheque", icon: ReceiptText },
  { id: "due", key: "creditDue", icon: Wallet },
  { id: "other", key: "other", icon: Wallet },
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
  const [method, setMethod] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [scan, setScan] = useState("");
  const [changeGiven, setChangeGiven] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [tabs, setTabs] = useState<{ id: string; name: string }[]>([{ id: "t1", name: "1" }]);
  const [activeTab, setActiveTab] = useState("t1");
  const stash = useRef<Record<string, SaleSnapshot>>({});
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

  const myBranch = useActiveBranch();
  const branchCode = myBranch.branch?.code ?? null;
  const branchStock = useBranchStock(myBranch.branchId);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku,seq,barcode,price,stock,unit,category_id,image_url,pack_size,brand")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data as unknown as Product[];
    },
    staleTime: 60_000,
  });

  const me = useMyRole();

  const todayTotal = useQuery({
    queryKey: ["pos-today-total"],
    staleTime: 30_000,
    queryFn: async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .eq("status", "final")
        .gte("created_at", from.toISOString());
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
    },
  });

  const categoryName = useMemo(
    () =>
      new Map<string, string>(
        (categories.data ?? []).map((c) => [c.id, lang === "bn" ? c.name_bn : c.name_en]),
      ),
    [categories.data, lang],
  );

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
            (p.barcode ?? "").toLowerCase().includes(q) ||
            matchesSerial(query, branchCode, p.seq)),
      );
  }, [products.data, branchStock.data, query, cat, branchCode]);


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
  const selectedMember = useMemo(() => {
    const c = (customers.data ?? []).find((x) => x.id === contactId) as
      | { id: string; name: string; is_member?: boolean | null; loyalty_points?: number | null }
      | undefined;
    if (!c) return null;
    return { id: c.id, name: c.name, isMember: !!c.is_member, points: Number(c.loyalty_points ?? 0) };
  }, [customers.data, contactId]);

  const preLoyaltyTotal = Math.max(
    subtotal - Math.min(Math.max(manualDiscount + couponDiscount, 0), subtotal),
    0,
  );
  const redeemCap = maxRedeemable(selectedMember?.points ?? 0, preLoyaltyTotal);
  const redeemPts = selectedMember?.isMember
    ? Math.max(0, Math.min(Math.floor(Number(redeemPoints) || 0), redeemCap))
    : 0;
  const loyaltyDiscount = pointsToMoney(redeemPts);
  const discountVal = Math.min(Math.max(manualDiscount + couponDiscount + loyaltyDiscount, 0), subtotal);
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
      list.find(
        (x) =>
          (x.barcode ?? "").toLowerCase() === code ||
          x.sku.toLowerCase() === code ||
          productSerial(branchCode, x.seq).toLowerCase() === code,
      ) ??
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
    setChangeGiven(false);
    setCustomer("");
    setPhone("");
    setEmail("");
    setContactId("");
    setRedeemPoints("");
    setMethod("");
  }, [settings.data?.default_tax_pct]);

  const captureSale = useCallback(
    (): SaleSnapshot => ({
      cart,
      discount,
      discountMode,
      couponCode,
      coupon,
      taxPct,
      paid,
      method,
      customer,
      phone,
      email,
      contactId,
      redeemPoints,
      changeGiven,
    }),
    [cart, discount, discountMode, couponCode, coupon, taxPct, paid, method, customer, phone, email, contactId, changeGiven, redeemPoints],
  );

  const applySale = useCallback((s: SaleSnapshot) => {
    setCart(s.cart);
    setDiscount(s.discount);
    setDiscountMode(s.discountMode);
    setCouponCode(s.couponCode);
    setCoupon(s.coupon);
    setTaxPct(s.taxPct);
    setPaid(s.paid);
    setMethod(s.method);
    setCustomer(s.customer);
    setPhone(s.phone);
    setEmail(s.email);
    setContactId(s.contactId);
    setRedeemPoints(s.redeemPoints ?? "");
    setChangeGiven(s.changeGiven);
  }, []);

  // Restore any sale tabs left open before the seller navigated to another menu.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadPosTabs<SaleSnapshot>();
    if (!saved) return;
    stash.current = saved.stash;
    setTabs(saved.tabs);
    setActiveTab(saved.activeTab);
    const snap = saved.stash[saved.activeTab];
    if (snap) applySale(snap);
  }, [applySale]);

  const snapshot = captureSale();
  useEffect(() => {
    if (!hydrated.current) return;
    savePosTabs({ tabs, activeTab, stash: { ...stash.current, [activeTab]: snapshot } });
  }, [tabs, activeTab, snapshot]);

  const switchTab = useCallback(
    (id: string) => {
      if (id === activeTab) return;
      stash.current[activeTab] = captureSale();
      const next = stash.current[id];
      if (next) applySale(next);
      else resetSale();
      setActiveTab(id);
    },
    [activeTab, applySale, captureSale, resetSale],
  );

  const newTab = useCallback(() => {
    stash.current[activeTab] = captureSale();
    const id = `t${Date.now()}`;
    setTabs((prev) => [...prev, { id, name: String(prev.length + 1) }]);
    setActiveTab(id);
    resetSale();
  }, [activeTab, captureSale, resetSale]);

  const doCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const rest = prev.filter((x) => x.id !== id);
        delete stash.current[id];
        if (id === activeTab) {
          const fallback = rest[rest.length - 1];
          setActiveTab(fallback.id);
          const snap = stash.current[fallback.id];
          if (snap) applySale(snap);
          else resetSale();
        }
        return rest;
      });
    },
    [activeTab, applySale, resetSale],
  );

  // Closing a sale tab that still holds items must be confirmed first, so an
  // accidental click on the × never wipes a pending customer's cart.
  const [closeAsk, setCloseAsk] = useState<string | null>(null);

  const closeTab = useCallback(
    (id: string) => {
      const count = id === activeTab ? cart.length : (stash.current[id]?.cart.length ?? 0);
      if (count > 0) {
        setCloseAsk(id);
        return;
      }
      doCloseTab(id);
    },
    [activeTab, cart.length, doCloseTab],
  );

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

      // 1) Local pack size / weight validation.
      const packIssues = checkPackCart(
        cart.map((l) => ({
          name: lang === "bn" ? l.product.name_bn : l.product.name_en,
          pack_size: l.product.pack_size,
          unit: l.product.unit,
          qty: l.qty,
          stock: l.product.stock,
        })),
      );
      if (packIssues.length > 0) throw new Error(packIssues.map((i) => (lang === "bn" ? i.bn : i.en)).join("\n"));

      // 2) Backend consistency check (price / pack size / stock across branches).
      if (status === "final") {
        const issues = await checkOrderConsistency(
          cart.map((l) => ({
            product_id: l.product.id,
            name: lang === "bn" ? l.product.name_bn : l.product.name_en,
            price: Number(l.product.price),
            pack_size: l.product.pack_size,
            quantity: l.qty,
          })),
        );
        if (issues.length > 0) throw new Error(formatIssues(issues, lang === "bn"));
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) throw new Error("Unauthorized");

      const salePayload = {
        cashier_id: uid,
        branch_id: myBranch.branchId,
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
      };
      const itemRows = cart.map((l) => ({
        product_id: l.product.id,
        name_snapshot: lang === "bn" ? l.product.name_bn : l.product.name_en,
        unit_price: Number(l.product.price),
        quantity: l.qty,
        line_total: Number(l.product.price) * l.qty,
      }));

      const s = settings.data;
      const baseReceipt = {
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
        shopName: s?.shop_name ?? t("appName"),
        shopAddress: s?.address ?? "",
        shopPhone: s?.phone ?? "",
        footer: s?.receipt_footer ?? t("thanks"),
      };

      // No network: keep selling. The sale is stored locally and replayed later.
      if (typeof navigator !== "undefined" && !navigator.onLine && isOfflineSupported()) {
        await queueSale(salePayload, itemRows);
        return {
          loyalty: null as { earned: number; redeemed: number } | null,
          status,
          offline: true,
          receipt: {
            ...baseReceipt,
            invoice: 0,
            at: new Date().toISOString(),
          } satisfies Receipt,
        };
      }

      const { data: sale, error } = await supabase
        .from("sales")
        .insert(salePayload)
        .select("id,invoice_no,created_at")
        .single();
      if (error) throw error;

      // Items are stored for every status. The database only moves stock when
      // the sale is final (or when a hold/quotation is later converted).
      const items = itemRows.map((i) => ({ ...i, sale_id: sale.id }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      let loyalty: { earned: number; redeemed: number } | null = null;
      if (status === "final" && contactId && selectedMember?.isMember) {
        try {
          await applyLoyalty({
            contactId,
            saleId: sale.id,
            amount: total,
            redeemPoints: redeemPts,
            branchId: myBranch.branchId ?? null,
          });
          loyalty = { earned: pointsFor(total), redeemed: redeemPts };
        } catch {
          /* points are best-effort; never block a completed sale */
        }
      }

      return {
        loyalty,
        status,
        offline: false,
        receipt: {
          ...baseReceipt,
          invoice: Number(sale.invoice_no),
          at: sale.created_at as string,
        } satisfies Receipt,
      };
    },
    onSuccess: ({ status, offline, receipt: r, loyalty }) => {
      if (loyalty) {
        toast.success(
          lang === "bn"
            ? `পয়েন্ট: +${loyalty.earned}${loyalty.redeemed ? ` / ব্যবহৃত ${loyalty.redeemed}` : ""}`
            : `Points: +${loyalty.earned}${loyalty.redeemed ? ` / used ${loyalty.redeemed}` : ""}`,
        );
      }
      void logAudit("sale", { entity: "sale", details: `${status} · ${r?.invoice ?? ""}` });
      if (status === "final") {
        setReceipt(r);
        toast.success(
          offline
            ? lang === "bn"
              ? "অফলাইনে সংরক্ষিত — নেট এলে অটো সিঙ্ক হবে"
              : "Saved offline — will sync automatically"
            : t("saleDone"),
        );
      } else toast.success(status === "draft" ? t("holdSale") : t("saveQuotation"));

      resetSale();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Keyboard shortcuts ----
  const checkoutMutate = checkout.mutate;
  const canCheckout = cart.length > 0 && !checkout.isPending;
  const paidEntered = paid.trim() !== "" && Number.isFinite(Number(paid));
  const fullyPaid = paidEntered && Number(paid) + 0.009 >= total;
  const changeSettled = method !== "cash" || changeVal <= 0.009 || changeGiven;
  const canPay = canCheckout && !!method && fullyPaid && changeSettled;
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
        if (canPay) checkoutMutate("final");
        else if (canCheckout) toast.error(t("selectPaymentFirst"));
      } else if (key === "Escape" && !isTyping) {
        e.preventDefault();
        resetSale();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canCheckout, canPay, checkoutMutate, resetSale, t]);

  const cashierName = me.data?.username ?? "";
  const initials = (cashierName || "?").slice(0, 2).toUpperCase();

  return (
    <div className="p-2 sm:p-4">
      <div className="surface-panel flex flex-col overflow-hidden p-0 lg:h-[calc(100vh-4.5rem)]">
        {/* Terminal summary bar */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 gradient-brand px-3 py-2.5 text-primary-foreground sm:px-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <h1 className="hidden font-display text-lg font-bold tracking-tight sm:block">
              {t("appName")}
            </h1>
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5">
              <span className="truncate text-[11px] opacity-80">{t("todaySales")}</span>
              <span className="font-display text-base font-bold">
                {money(todayTotal.data ?? 0, lang)}
              </span>
            </div>
            <div className="hidden items-center gap-3 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 md:flex">
              <span className="text-[11px] opacity-80">{t("items")}</span>
              <span className="font-display text-base font-bold">{num(itemCount, lang)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-wider opacity-70">
                {myBranch.branch?.name ?? t("branch")}
              </p>
              <p className="truncate text-sm font-semibold">{cashierName}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full border border-primary-foreground/25 bg-primary-foreground/20 text-xs font-bold">
              {initials}
            </span>
          </div>
        </header>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-muted/40 px-2 py-1.5">
          {tabs.map((tb) => (
            <div
              key={tb.id}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                tb.id === activeTab ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
              )}
            >
              <button type="button" onClick={() => switchTab(tb.id)} className="whitespace-nowrap">
                {lang === "bn" ? `বিক্রয় ${tb.name}` : `Sale ${tb.name}`}
                {(tb.id === activeTab ? cart.length : (stash.current[tb.id]?.cart.length ?? 0)) > 0 &&
                  ` · ${num(tb.id === activeTab ? cart.length : (stash.current[tb.id]?.cart.length ?? 0), lang)}`}
              </button>
              {tabs.length > 1 && (
                <button type="button" onClick={() => closeTab(tb.id)} aria-label="close" className="opacity-70 hover:opacity-100">
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={newTab}>
            <Plus className="mr-1 size-3.5" />
            {lang === "bn" ? "নতুন বিক্রয়" : "New sale"}
          </Button>
        </div>

        <AlertDialog open={closeAsk !== null} onOpenChange={(o) => !o && setCloseAsk(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {lang === "bn" ? "এই বিক্রয় বন্ধ করবেন?" : "Close this sale?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {lang === "bn"
                  ? "এই ট্যাবে পণ্য রয়েছে। বন্ধ করলে কার্টের সব পণ্য মুছে যাবে।"
                  : "This tab still has items. Closing it will discard the cart."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (closeAsk) doCloseTab(closeAsk);
                  setCloseAsk(null);
                }}
              >
                {lang === "bn" ? "হ্যাঁ, বন্ধ করুন" : "Yes, close"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_420px]">
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
              <QuickAddProduct onCreated={(product) => add(product)} />
              <ShortcutHelp />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2 sm:px-4 sm:py-3">
            <button
              type="button"
              onClick={() => setCat("all")}
              className={cn(
                "min-h-10 whitespace-nowrap rounded-full border px-5 py-2 text-sm font-medium transition",
                cat === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50",
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
                  "min-h-10 whitespace-nowrap rounded-full border px-5 py-2 text-sm font-medium transition",
                  cat === c.id
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50",
                )}
              >
                {lang === "bn" ? c.name_bn : c.name_en}
              </button>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto bg-muted/30 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 xl:grid-cols-4 2xl:grid-cols-5">
            {products.isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
            {visible.map((p) => {
              const out = p.stock <= 0;
              const low = !out && p.stock <= 5;
              const catName = categoryName.get(p.category_id ?? "") ?? "";
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out}
                  onClick={() => add(p)}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-lift)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-muted transition-colors group-hover:bg-primary/5">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={lang === "bn" ? p.name_bn : p.name_en}
                        loading="lazy"
                        width={512}
                        height={512}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <Package className="size-10 text-primary/20 transition-transform group-hover:scale-110" />
                    )}

                    <span
                      className={cn(
                        "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        out
                          ? "bg-destructive/10 text-destructive"
                          : low
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-success/10 text-success",
                      )}
                    >
                      {out ? t("outOfStock") : `${num(p.stock, lang)} ${p.unit}`}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {catName && (
                      <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {catName}
                      </span>
                    )}
                    <span className="line-clamp-1 text-sm font-bold">
                      {lang === "bn" ? p.name_bn : p.name_en}
                    </span>
                    {p.brand && (
                      <span className="mt-0.5 w-fit rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {p.brand}
                      </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {productSerial(branchCode, p.seq)}
                      {p.pack_size ? ` · ${p.pack_size}` : ""}
                    </span>
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-1">
                    <span className="font-display text-base font-bold text-primary">
                      {money(Number(p.price), lang)}
                    </span>
                    <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110">
                      <Plus className="size-4" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Checkout */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-border bg-card lg:border-l lg:border-t-0">
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <ShoppingCart className="size-4 shrink-0 text-primary" />
              <span className="truncate text-base font-bold">{t("cart")}</span>
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-display text-[11px] font-bold text-primary-foreground">
                {String(cart.length).padStart(2, "0")}
              </span>
            </div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={resetSale}
              >
                <Trash2 className="mr-1 size-3" /> {t("clear")}
              </Button>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-b border-border p-3 sm:p-4">
            <div className="flex items-center gap-2">
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
                <SelectTrigger className="h-11 min-w-0 flex-1 rounded-xl bg-muted/50">
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
              <QuickAddCustomer
                onCreated={(c) => {
                  setContactId(c.id);
                  setCustomer(c.name);
                  setPhone(c.phone ?? "");
                  setEmail(c.email ?? "");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                value={customer}
                maxLength={80}
                placeholder={t("customer")}
                onChange={(e) => setCustomer(e.target.value)}
                className="h-10 rounded-xl bg-muted/50"
              />
              <Input
                value={phone}
                maxLength={20}
                inputMode="tel"
                placeholder={t("phone")}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-xl bg-muted/50"
              />
            </div>

            <MemberPanel
              lang={lang}
              member={selectedMember}
              phone={phone}
              customer={customer}
              redeemPoints={redeemPoints}
              redeemCap={redeemCap}
              onRedeemChange={setRedeemPoints}
              onMember={(m) => {
                setContactId(m.id);
                setCustomer(m.name);
                setPhone(m.phone ?? "");
                queryClient.invalidateQueries({ queryKey: ["contacts"] });
              }}
            />
          </div>

          <div className="flex-none space-y-2.5 p-3 sm:p-4">
            {cart.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShoppingCart className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("emptyCart")}</p>
              </div>
            )}
            {cart.map((l, i) => (
              <div
                key={l.product.id}
                className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-card font-display text-sm font-bold text-primary">
                  {num(i + 1, lang)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold">
                      {lang === "bn" ? l.product.name_bn : l.product.name_en}
                    </p>
                    <button
                      type="button"
                      aria-label={t("clear")}
                      onClick={() => setQty(l.product.id, 0)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-md"
                        onClick={() => setQty(l.product.id, l.qty - 1)}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-bold">{num(l.qty, lang)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-md"
                        onClick={() => setQty(l.product.id, l.qty + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-sm font-bold">
                        {money(Number(l.product.price) * l.qty, lang)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        @ {money(Number(l.product.price), lang)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex-none border-t border-border bg-card p-3 sm:p-4">
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
                  className="h-10 rounded-xl bg-card pl-9 uppercase"
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
                  className="h-10 rounded-lg bg-card"
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
                  className="mt-[7px] h-10 rounded-lg bg-card"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-card p-3 text-sm">
              <Row label={`${t("subtotal")} · ${num(itemCount, lang)} ${t("items")}`} value={money(subtotal, lang)} />
              {manualDiscount > 0 && (
                <Row label={t("discount")} value={`− ${money(manualDiscount, lang)}`} tone="success" />
              )}
              {coupon && (
                <Row
                  label={`${t("coupon")} · ${coupon.code}`}
                  value={`− ${money(couponDiscount, lang)}`}
                  tone="success"
                />
              )}
              {redeemPts > 0 && (
                <Row
                  label={lang === "bn" ? `পয়েন্ট (${num(redeemPts, lang)})` : `Points (${redeemPts})`}
                  value={`− ${money(loyaltyDiscount, lang)}`}
                  tone="success"
                />
              )}
              <Row label={`${t("tax")} ${num(Number(taxPct) || 0, lang)}%`} value={money(taxVal, lang)} />
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-display text-lg font-bold">{t("total")}</span>
                <span className="font-display text-3xl font-bold text-primary">{money(total, lang)}</span>
              </div>
            </div>

            {/* Payment methods */}
            <div className="mt-3">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("paymentMethod")}
              </Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-[10px] font-bold leading-tight transition",
                        method === m.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="line-clamp-1">{t(m.key)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {method === "cash" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg text-xs"
                  onClick={() => setPaid(total.toFixed(2))}
                >
                  {t("exactAmount")}
                </Button>
                {[100, 200, 500, 1000, 2000].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                    onClick={() => setPaid(String((Number(paid) || 0) + v))}
                  >
                    +{num(v, lang)}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-end gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {method === "cash" ? t("cashReceived") : t("paid")}
                </Label>
                <Input
                  ref={paidRef}
                  inputMode="decimal"
                  value={paid}
                  disabled={!method}
                  placeholder={total.toFixed(2)}
                  onChange={(e) => {
                    setPaid(e.target.value);
                    setChangeGiven(false);
                  }}
                  className="h-12 rounded-xl bg-success/10 text-lg font-bold"
                />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {changeVal >= 0 ? (method === "cash" ? t("changeReturn") : t("change")) : t("due")}
                </p>
                <p
                  className={cn(
                    "font-display text-xl font-bold",
                    changeVal < 0 ? "text-destructive" : "text-success",
                  )}
                >
                  {money(Math.abs(changeVal), lang)}
                </p>
              </div>
            </div>

            {method === "cash" && fullyPaid && changeVal > 0.009 && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-warning/60 bg-warning/10 px-3 py-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={changeGiven}
                  onChange={(e) => setChangeGiven(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span>
                  {lang === "bn"
                    ? `ফেরত ${money(changeVal, lang)} গ্রাহককে দেওয়া হয়েছে`
                    : `Change ${money(changeVal, lang)} returned to customer`}
                </span>
              </label>
            )}

            <Button
              variant="accent"
              className="mt-3 h-16 w-full rounded-2xl font-display text-lg font-black"
              disabled={!canPay}
              onClick={() => checkout.mutate("final")}
            >
              {t("checkout")} · {money(total, lang)}
            </Button>
            {cart.length > 0 && !canPay && (
              <p className="mt-1 text-center text-xs font-semibold text-destructive">
                {!method
                  ? t("selectPaymentFirst")
                  : !fullyPaid
                    ? lang === "bn"
                      ? "সম্পূর্ণ পেমেন্ট অ্যামাউন্ট দিন"
                      : "Enter the full payment amount"
                    : lang === "bn"
                      ? "ফেরত দেওয়ার পর টিক দিন"
                      : "Confirm the change was returned"}
              </p>
            )}

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
      </div>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}


function MemberPanel({
  lang,
  member,
  phone,
  customer,
  redeemPoints,
  redeemCap,
  onRedeemChange,
  onMember,
}: {
  lang: "bn" | "en";
  member: { id: string; name: string; isMember: boolean; points: number } | null;
  phone: string;
  customer: string;
  redeemPoints: string;
  redeemCap: number;
  onRedeemChange: (v: string) => void;
  onMember: (m: { id: string; name: string; phone: string | null }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const bn = lang === "bn";

  async function join() {
    const p = phone.trim();
    if (p.length < 6) {
      toast.error(bn ? "সদস্য করতে ফোন নম্বর দিন" : "Enter a phone number to enrol");
      return;
    }
    setBusy(true);
    try {
      const m = await registerMember(p, customer.trim() || p);
      onMember({ id: m.id, name: m.name, phone: m.phone });
      toast.success(bn ? "সদস্য হয়ে গেছে" : "Member added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!member?.isMember) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {bn ? "ফোন নম্বর দিয়ে সদস্য করুন — প্রতি ১০৳-এ ১ পয়েন্ট" : "Enrol by phone — 1 point per ৳10"}
        </p>
        <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" disabled={busy} onClick={join}>
          {bn ? "সদস্য করুন" : "Make member"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="truncate text-primary">
          {bn ? "সদস্য" : "Member"} · {member.name}
        </span>
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
          {num(member.points, lang)} {bn ? "পয়েন্ট" : "pts"}
        </span>
      </div>
      {redeemCap > 0 ? (
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={redeemPoints}
            placeholder={bn ? "পয়েন্ট ব্যবহার" : "Redeem points"}
            onChange={(e) => onRedeemChange(e.target.value)}
            className="h-9 rounded-lg bg-card text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0 text-xs"
            onClick={() => onRedeemChange(String(redeemCap))}
          >
            {bn ? "সর্বোচ্চ" : "Max"} {num(redeemCap, lang)}
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {bn
            ? `${num(REDEEM_MIN_POINTS, lang)} পয়েন্ট হলে ব্যবহার করা যাবে (১০ পয়েন্ট = ১৳)`
            : `Redeemable from ${REDEEM_MIN_POINTS} points (10 points = ৳1)`}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex items-center justify-between gap-2 text-muted-foreground">
      <span className={cn("min-w-0 truncate", tone === "success" && "text-success")}>{label}</span>
      <span className={cn("font-medium text-foreground", tone === "success" && "text-success")}>
        {value}
      </span>
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
                const to = normalizePhone(receipt.phone);
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
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={!receipt.method}
            title={receipt.method ? undefined : t("selectPaymentFirst")}
            onClick={() => printHtml(buildPrintHtml(), size)}
          >
            <Printer className="mr-1 size-4" /> {t("print")}
          </Button>
          <Button className="h-12 flex-1" onClick={onClose}>
            {t("newSale")}
          </Button>
        </div>
        {!receipt.method && (
          <p className="text-center text-xs font-semibold text-destructive">{t("selectPaymentFirst")}</p>
        )}

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
