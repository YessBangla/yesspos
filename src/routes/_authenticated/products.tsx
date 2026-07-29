import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
      { title: "Products & stock — SheraPOS" },
      { name: "description", content: "Manage your product catalogue, prices and stock levels." },
      { property: "og:title", content: "Products & stock — SheraPOS" },
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
});


function ProductsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const myBranch = useActiveBranch();
  const branchCode = myBranch.branch?.code ?? null;
  const branchStock = useBranchStock(myBranch.branchId);

  const products = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name_en");
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
      const payload = { ...rest, category_id: form.category_id || null };
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
              onChange={(e) => setQuery(e.target.value)}
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

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
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
                <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                  {t("loading")}
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const cat = categories.data?.find((c) => c.id === p.category_id);
              const low = p.branch_stock <= p.low_stock_at;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
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
                        {p.pack_size && (
                          <span className="text-xs font-normal text-muted-foreground">{p.pack_size}</span>
                        )}
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
            {!products.isLoading && visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
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
            <Field
              label={lang === "bn" ? "পরিমাণ / ওজন (যেমন ১ কেজি)" : "Pack size / weight"}
              value={form.pack_size}
              onChange={(v) => setForm({ ...form, pack_size: v })}
            />
            <div className="sm:col-span-2">
              <Field
                label={lang === "bn" ? "ছবির লিংক" : "Image URL"}
                value={form.image_url}
                onChange={(v) => setForm({ ...form, image_url: v })}
              />
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
