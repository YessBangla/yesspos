import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions & banners — Bazar Bari" },
      { name: "description", content: "Create storefront hero banners, campaign strips and seasonal offers." },
      { property: "og:title", content: "Promotions & banners — Bazar Bari" },
      { property: "og:description", content: "Manage home delivery marketing banners and campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PromotionsPage,
});

type Promo = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  kind: string;
  placement: string;
  bg_color: string | null;
  sort_order: number;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
};

const EMPTY = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "/",
  kind: "banner",
  placement: "hero",
  bg_color: "#0f766e",
  starts_on: "",
  ends_on: "",
};

function PromotionsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });

  const promos = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promotions").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as Promo[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["promotions"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error(bn ? "শিরোনাম দিন" : "Title required");
      const { error } = await supabase.from("promotions").insert({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim() || null,
        link_url: form.link_url.trim() || null,
        kind: form.kind,
        placement: form.placement,
        bg_color: form.bg_color || null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        sort_order: (promos.data?.length ?? 0) + 1,
      });
      if (error) throw error;
      await logAudit("promotion_create", { entity: "promotions", details: form.title });
    },
    onSuccess: () => {
      setForm({ ...EMPTY });
      invalidate();
      toast.success(bn ? "প্রোমোশন যোগ হয়েছে" : "Promotion added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Promo> }) => {
      const { error } = await supabase.from("promotions").update(values).eq("id", id);
      if (error) throw error;
      await logAudit("promotion_update", { entity: "promotions", entityId: id });
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
      await logAudit("promotion_delete", { entity: "promotions", entityId: id });
    },
    onSuccess: () => {
      invalidate();
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold">
        <Megaphone className="mr-2 inline size-6 text-primary" />
        {bn ? "প্রোমোশন ও ব্যানার" : "Promotions & banners"}
      </h1>

      <div className="surface-panel grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={form.title}
          maxLength={80}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={bn ? "শিরোনাম" : "Title"}
        />
        <Input
          value={form.subtitle}
          maxLength={120}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder={bn ? "সাবটাইটেল" : "Subtitle"}
        />
        <Input
          value={form.image_url}
          maxLength={300}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          placeholder={bn ? "ছবির লিংক" : "Image URL"}
        />
        <Input
          value={form.link_url}
          maxLength={200}
          onChange={(e) => setForm({ ...form, link_url: e.target.value })}
          placeholder={bn ? "ক্লিক লিংক" : "Link URL"}
        />
        <select
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="banner">{bn ? "ব্যানার" : "Banner"}</option>
          <option value="campaign">{bn ? "ক্যাম্পেইন" : "Campaign"}</option>
        </select>
        <select
          value={form.placement}
          onChange={(e) => setForm({ ...form, placement: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="hero">{bn ? "হিরো স্লাইডার" : "Hero slider"}</option>
          <option value="strip">{bn ? "টপ স্ট্রিপ" : "Top strip"}</option>
          <option value="category">{bn ? "ক্যাটাগরি" : "Category"}</option>
        </select>
        <div className="flex gap-2">
          <Input
            type="date"
            value={form.starts_on}
            onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
          />
          <Input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <Input
            type="color"
            value={form.bg_color}
            onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
            className="w-16 p-1"
          />
          <Button className="flex-1" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-1 size-4" />
            {bn ? "যোগ করুন" : "Add"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(promos.data ?? []).map((p) => (
          <div key={p.id} className="surface-panel overflow-hidden p-0">
            <div
              className="flex h-24 items-end bg-cover bg-center p-3 text-white"
              style={{
                backgroundColor: p.bg_color ?? "#0f766e",
                backgroundImage: p.image_url ? `url(${p.image_url})` : undefined,
              }}
            >
              <div className="rounded-lg bg-black/35 px-2 py-1">
                <p className="font-display font-bold">{p.title}</p>
                {p.subtitle && <p className="text-xs">{p.subtitle}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold">{p.placement}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold">{p.kind}</span>
              {p.ends_on && <span>→ {p.ends_on}</span>}
              <button
                type="button"
                onClick={() => patch.mutate({ id: p.id, values: { is_active: !p.is_active } })}
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  p.is_active ? "bg-primary/10 text-primary" : "bg-muted",
                )}
              >
                {p.is_active ? (bn ? "চালু" : "Live") : bn ? "বন্ধ" : "Paused"}
              </button>
              <Button size="icon" variant="ghost" className="ml-auto" onClick={() => remove.mutate(p.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {(promos.data ?? []).length === 0 && (
          <p className="text-muted-foreground">{bn ? "কোনো প্রোমোশন নেই" : "No promotions yet"}</p>
        )}
      </div>
    </div>
  );
}
