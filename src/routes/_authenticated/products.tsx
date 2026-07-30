import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Images, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/MediaPicker";
import { assignImageToProducts } from "@/lib/media";
import { z } from "zod";
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
import { useBranchStock } from "@/lib/use-branch";
import { useActiveBranch } from "@/lib/active-branch";
import { matchesSerial, productSerial } from "@/lib/serial";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products & stock — Sokoler Bazar" },
      { name: "description", content: "Manage your product catalogue, prices and stock levels." },
      { property: "og:title", content: "Products & stock — Sokoler Bazar" },
      { property: "og:description", content: "Manage catalogue, prices and stock levels." },
    ],
  }),
  component: ProductsPage,
});

type Row = {
  id: string;
  name_en: string;
  name_bn: string;
  sku: string;
  seq: number | null;
  price: number;
  cost: number;
  stock: number;
  low_stock_at: number;
  unit: string;
  is_active: boolean;
  category_id: string | null;
  image_url: string | null;
  pack_size: string | null;
  brand: string | null;
};

const emptyForm = {
  name_en: "",
  name_bn: "",
  sku: "",
  price: "0",
  cost: "0",
  stock: "0",
  low_stock_at: "5",
  unit: "pcs",
  category_id: "",
  image_url: "",
  pack_size: "",
  brand: "",
};

const schema = z.object({
  name_en: z.string().trim().min(1).max(80),
  name_bn: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(40),
  price: z.number().min(0).max(10_000_000),
  cost: z.number().min(0).max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  low_stock_at: z.number().int().min(0).max(10_000),
  unit: z.string().trim().min(1).max(12),
  image_url: z.string().trim().max(500),
  pack_size: z.string().trim().max(40),
  brand: z.string().trim().max(60),
});


function ProductsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [picked, setPicked] = useState<string[]>([]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const brands = useQuery({
    queryKey: ["catalog-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id,name_en,name_bn,logo_url")
        .order("name_en");
      if (error) throw error;
      return data as unknown as { id: string; name_en: string; name_bn: string; logo_url: string | null }[];
    },
    staleTime: 60_000,
  });
  const brandLogo = useMemo(
    () => new Map((brands.data ?? []).map((b) => [b.name_en.toLowerCase(), b.logo_url])),
    [brands.data],
  );

  const myBranch = useActiveBranch();
  const branchCode = myBranch.branch?.code ?? null;
  const branchStock = useBranchStock(myBranch.branchId);

  const products = useQuery({
    queryKey: ["products-all"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,name_en,name_bn,sku,seq,price,cost,stock,low_stock_at,unit,is_active,category_id,image_url,pack_size,brand",
        )
        .order("name_en")
        .limit(2000);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stockMap = branchStock.data;
    return (products.data ?? [])
      .map((p) => ({ ...p, branch_stock: stockMap ? (stockMap.get(p.id) ?? 0) : p.stock }))
      .filter(
        (p) =>
          !q ||
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.includes(query.trim()) ||
          p.sku.toLowerCase().includes(q) ||
          matchesSerial(query, branchCode, p.seq),
      );
  }, [products.data, branchStock.data, query, branchCode]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        ...form,
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
        low_stock_at: Number(form.low_stock_at),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const branchId = myBranch.branchId ?? null;
      const { stock, ...rest } = parsed.data;
      const payload = {
        ...rest,
        category_id: form.category_id || null,
        image_url: rest.image_url || null,
        pack_size: rest.pack_size || null,
        brand: rest.brand || null,
      };

      let productId = editing?.id ?? null;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({ ...payload, stock: branchId ? 0 : stock })
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }
      // Per-branch stock is the source of truth when the user belongs to a branch.
      if (branchId && productId) {
        const { error } = await supabase
          .from("product_stock")
          .upsert({ product_id: productId, branch_id: branchId, stock }, { onConflict: "product_id,branch_id" });
        if (error) throw error;
      } else if (editing) {
        const { error } = await supabase.from("products").update({ stock }).eq("id", editing.id);
        if (error) throw error;
      }
    },

    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulkImage = useMutation({
    mutationFn: async (urls: string[]) => {
      if (!picked.length || !urls.length) return 0;
      if (urls.length === 1) return assignImageToProducts(urls[0], picked);
      // Multiple images: assign them to the selected products in order.
      let n = 0;
      for (let i = 0; i < picked.length; i++) {
        await assignImageToProducts(urls[i % urls.length], [picked[i]]);
        n += 1;
      }
      return n;
    },
    onSuccess: (n) => {
      toast.success(
        lang === "bn" ? `${n}টি পণ্যে ছবি বসানো হয়েছে` : `Image applied to ${n} product(s)`,
      );
      setPicked([]);
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["media-usage"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function startEdit(p: Row & { branch_stock?: number }) {
    setEditing(p);
    setForm({
      name_en: p.name_en,
      name_bn: p.name_bn,
      sku: p.sku,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.branch_stock ?? p.stock),
      low_stock_at: String(p.low_stock_at),
      unit: p.unit,
      category_id: p.category_id ?? "",
      image_url: p.image_url ?? "",
      pack_size: p.pack_size ?? "",
      brand: p.brand ?? "",
    });

    setOpen(true);
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t("products")}</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(50);
              }}
              placeholder={lang === "bn" ? "নাম, সিরিয়াল বা SKU" : "Name, serial or SKU"}
              maxLength={60}
              className="w-56 pl-9"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm });
              setOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> {t("addProduct")}
          </Button>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="surface-panel mt-4 flex flex-wrap items-center gap-3 p-3">
          <Images className="size-4 text-primary" />
          <span className="text-sm font-semibold">
            {lang === "bn" ? `${picked.length}টি পণ্য নির্বাচিত` : `${picked.length} products selected`}
          </span>
          <MediaPicker
            variant="default"
            label={lang === "bn" ? "গ্যালারি থেকে ছবি বসান" : "Assign image from gallery"}
            onSelect={(url) => bulkImage.mutate([url])}
            onSelectMany={(assets) => bulkImage.mutate(assets.map((a) => a.url))}
          />
          <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
            {lang === "bn" ? "নির্বাচন বাতিল" : "Clear selection"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {lang === "bn"
              ? "একটি ছবি বাছলে সব পণ্যে বসবে; একাধিক বাছলে ক্রমানুসারে বসবে।"
              : "One image applies to all; several are applied in order."}
          </span>
        </div>
      )}

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={lang === "bn" ? "সব নির্বাচন" : "Select all"}
                  className="size-4 accent-[hsl(var(--primary))]"
                  checked={picked.length > 0 && picked.length === visible.slice(0, limit).length}
                  onChange={(e) =>
                    setPicked(e.target.checked ? visible.slice(0, limit).map((p) => p.id) : [])
                  }
                />
              </th>
              <th className="px-4 py-3">{lang === "bn" ? "পণ্য" : "Product"}</th>
              <th className="px-4 py-3">{lang === "bn" ? "সিরিয়াল" : "Serial"}</th>
              <th className="px-4 py-3">{t("sku")}</th>
              <th className="px-4 py-3">{t("category")}</th>
              <th className="px-4 py-3 text-right">{t("cost")}</th>
              <th className="px-4 py-3 text-right">{t("price")}</th>
              <th className="px-4 py-3 text-right">{t("stock")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.isLoading && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                  {t("loading")}
                </td>
              </tr>
            )}
            {visible.slice(0, limit).map((p) => {
              const cat = categories.data?.find((c) => c.id === p.category_id);
              const low = p.branch_stock <= p.low_stock_at;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={p.name_en}
                      className="size-4 accent-[hsl(var(--primary))]"
                      checked={picked.includes(p.id)}
                      onChange={() =>
                        setPicked((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={lang === "bn" ? p.name_bn : p.name_en}
                          loading="lazy"
                          width={40}
                          height={40}
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{lang === "bn" ? p.name_bn : p.name_en}</span>
                        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                          {p.brand && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                              {brandLogo.get(p.brand.toLowerCase()) && (
                                <img
                                  src={brandLogo.get(p.brand.toLowerCase()) as string}
                                  alt=""
                                  loading="lazy"
                                  width={14}
                                  height={14}
                                  className="size-3.5 rounded-full object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                              {p.brand}
                            </span>
                          )}
                          {p.pack_size}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                    {productSerial(branchCode, p.seq)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cat ? (lang === "bn" ? cat.name_bn : cat.name_en) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{money(Number(p.cost), lang)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(Number(p.price), lang)}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        p.branch_stock <= 0
                          ? "bg-destructive/10 text-destructive"
                          : low
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {num(p.branch_stock, lang)} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        onClick={() => remove.mutate(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length > limit && (
              <tr>
                <td className="px-4 py-4" colSpan={9}>
                  <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + 100)}>
                    {lang === "bn" ? "আরও দেখুন" : "Load more"} ({num(visible.length - limit, lang)})
                  </Button>
                </td>
              </tr>
            )}
            {!products.isLoading && visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("editProduct") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${t("products")} (EN)`} value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} />
            <Field label={`${t("products")} (বাংলা)`} value={form.name_bn} onChange={(v) => setForm({ ...form, name_bn: v })} />
            <Field label={t("sku")} value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("category")} />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {lang === "bn" ? c.name_bn : c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label={t("cost")} value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
            <Field label={t("price")} value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <Field label={t("stock")} value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />
            <Field label={t("lowStock")} value={form.low_stock_at} onChange={(v) => setForm({ ...form, low_stock_at: v })} />
            <Field label={t("unit")} value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <div className="space-y-1.5">
              <Label>{t("brand")}</Label>
              <Input
                value={form.brand}
                list="brand-options"
                maxLength={60}
                placeholder={lang === "bn" ? "যেমন প্রাণ, তীর" : "e.g. Pran, Teer"}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <datalist id="brand-options">
                {(brands.data ?? []).map((b) => (
                  <option key={b.id} value={b.name_en} />
                ))}
              </datalist>
            </div>
            <Field
              label={lang === "bn" ? "পরিমাণ / ওজন (যেমন ১ কেজি)" : "Pack size / weight"}
              value={form.pack_size}
              onChange={(v) => setForm({ ...form, pack_size: v })}
            />
            <div className="sm:col-span-2">
              <Field
                label={lang === "bn" ? "প্রাইম/কভার ছবির লিংক" : "Prime / cover image URL"}
                value={form.image_url}
                onChange={(v) => setForm({ ...form, image_url: v })}
                maxLength={500}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MediaPicker
                  variant="default"
                  onSelect={(url) => setForm((f) => ({ ...f, image_url: url }))}
                  onSelectMany={(assets) => {
                    if (!assets.length) return;
                    setForm((f) => ({ ...f, image_url: assets[0].url }));
                    if (assets.length > 1) {
                      toast.info(
                        lang === "bn"
                          ? "প্রথম ছবিটি কভার হিসেবে বসানো হয়েছে; বাকিগুলো তালিকা থেকে অন্য পণ্যে বসাতে পারবেন।"
                          : "First image set as cover; use the product list to apply the rest.",
                      );
                    }
                  }}
                  label={lang === "bn" ? "গ্যালারি থেকে কভার ছবি বাছুন" : "Choose cover from gallery"}
                />
                {form.image_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  >
                    {lang === "bn" ? "ছবি সরান" : "Remove image"}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "সব ছবি ইমেজ গ্যালারিতে সংরক্ষিত থাকে"
                    : "All images live in the image gallery"}
                </span>
              </div>
            </div>
            {form.image_url && (
              <img
                src={form.image_url}
                alt=""
                loading="lazy"
                width={80}
                height={80}
                className="size-20 rounded-xl border border-border object-cover"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength = 80,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

