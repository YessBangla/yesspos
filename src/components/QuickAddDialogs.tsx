import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useActiveBranch } from "@/lib/active-branch";
import { logAudit } from "@/lib/audit";

type QuickCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: string;
};

type QuickProduct = {
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
};

/** [+] Quick-create a customer straight from the POS screen. */
export function QuickAddCustomer({ onCreated }: { onCreated?: (c: QuickCustomer) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  const save = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error(t("customer"));
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          type: "customer",
          name: name.slice(0, 80),
          phone: form.phone.trim().slice(0, 20) || null,
          email: form.email.trim().slice(0, 120) || null,
          address: form.address.trim().slice(0, 200) || null,
        })
        .select("id,name,phone,email,type")
        .single();
      if (error) throw error;
      return data as QuickCustomer;
    },
    onSuccess: (c) => {
      void logAudit("contact_create", { entity: "contact", entityId: c.id });
      qc.setQueryData<QuickCustomer[]>(["contacts"], (old) =>
        old ? [c, ...old.filter((item) => item.id !== c.id)] : [c],
      );
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onCreated?.(c);
      setForm({ name: "", phone: "", email: "", address: "" });
      setOpen(false);
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" className="h-11 shrink-0 gap-1.5 whitespace-nowrap rounded-xl px-3" aria-label={t("newCustomer")}>
          <Plus className="size-4 shrink-0" />
          <span className="hidden text-xs font-semibold sm:inline">{t("newCustomer")}</span>
        </Button>

      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newCustomer")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("name")}</Label>
            <Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} maxLength={20} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("address")}</Label>
            <Input value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** [+] Quick-create a product (with optional opening stock for this branch). */
export function QuickAddProduct({ onCreated }: { onCreated?: (product: QuickProduct) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const myBranch = useActiveBranch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name_en: "",
    name_bn: "",
    sku: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    unit: "pcs",
    category_id: "",
    pack_size: "",
    image_url: "",
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const nameEn = form.name_en.trim() || form.name_bn.trim();
      if (!nameEn) throw new Error(t("nameEn"));
      const sku = form.sku.trim() || `P${Date.now().toString().slice(-8)}`;
      const { data, error } = await supabase
        .from("products")
        .insert({
          name_en: nameEn.slice(0, 100),
          name_bn: (form.name_bn.trim() || nameEn).slice(0, 100),
          sku,
          barcode: form.barcode.trim() || null,
          price: Number(form.price) || 0,
          cost: Number(form.cost) || 0,
          unit: form.unit.trim() || "pcs",
          category_id: form.category_id || null,
          pack_size: form.pack_size.trim() || null,
          image_url: form.image_url.trim() || null,
          is_active: true,
        })
        .select("id,name_en,name_bn,sku,seq,barcode,price,stock,unit,category_id,image_url,pack_size")
        .single();
      if (error) throw error;

      const qty = Number(form.stock) || 0;
      if (qty > 0 && myBranch.branchId) {
        const { data: userData } = await supabase.auth.getUser();
        const { error: adjError } = await supabase.from("stock_adjustments").insert({
          product_id: data.id,
          branch_id: myBranch.branchId,
          user_id: userData.user?.id ?? null,
          type: "add",
          quantity: qty,
          reason: "opening",
          adjusted_on: new Date().toISOString().slice(0, 10),
        });
        if (adjError) throw adjError;
      }
      return {
        ...(data as QuickProduct),
        price: Number(data.price) || 0,
        stock: qty > 0 ? qty : Number(data.stock) || 0,
      };
    },
    onSuccess: (product) => {
      void logAudit("product_create", { entity: "product", entityId: product.id });
      qc.setQueryData<QuickProduct[]>(["products"], (old) =>
        old ? [product, ...old.filter((item) => item.id !== product.id)] : [product],
      );
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["branch-stock"] });
      onCreated?.(product);
      setForm({ name_en: "", name_bn: "", sku: "", barcode: "", price: "", cost: "", stock: "", unit: "pcs", category_id: "", pack_size: "", image_url: "" });
      setOpen(false);
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" className="h-12 shrink-0 gap-1.5 whitespace-nowrap rounded-xl px-3" aria-label={t("newProduct")}>
          <Plus className="size-4" />
          <span className="hidden text-xs font-semibold sm:inline">{t("newProduct")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newProduct")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("nameEn")}</Label>
            <Input value={form.name_en} maxLength={100} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("nameBn")}</Label>
            <Input value={form.name_bn} maxLength={100} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("sku")}</Label>
            <Input value={form.sku} maxLength={40} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("category")}</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder={t("category")} />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("price")}</Label>
            <Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("cost")}</Label>
            <Input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("stock")}</Label>
            <Input inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("unit")}</Label>
            <Input value={form.unit} maxLength={20} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("packSize")}</Label>
            <Input
              value={form.pack_size}
              maxLength={40}
              placeholder="1 kg / 500 ml"
              onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("imageUrl")}</Label>
            <Input
              value={form.image_url}
              maxLength={500}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </div>
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
  );
}
