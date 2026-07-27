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
  price: number;
  cost: number;
  stock: number;
  low_stock_at: number;
  unit: string;
  is_active: boolean;
  category_id: string | null;
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
    return (products.data ?? []).filter(
      (p) =>
        !q ||
        p.name_en.toLowerCase().includes(q) ||
        p.name_bn.includes(query.trim()) ||
        p.sku.toLowerCase().includes(q),
    );
  }, [products.data, query]);

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
      const payload = { ...parsed.data, category_id: form.category_id || null };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
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

  function startEdit(p: Row) {
    setEditing(p);
    setForm({
      name_en: p.name_en,
      name_bn: p.name_bn,
      sku: p.sku,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      low_stock_at: String(p.low_stock_at),
      unit: p.unit,
      category_id: p.category_id ?? "",
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
              placeholder={t("search")}
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
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{lang === "bn" ? "পণ্য" : "Product"}</th>
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
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  {t("loading")}
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const cat = categories.data?.find((c) => c.id === p.category_id);
              const low = p.stock <= p.low_stock_at;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{lang === "bn" ? p.name_bn : p.name_en}</td>
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
                        p.stock <= 0
                          ? "bg-destructive/10 text-destructive"
                          : low
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {num(p.stock, lang)} {p.unit}
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
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
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
