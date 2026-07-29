import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog setup — SokolerBazar" },
      { name: "description", content: "Manage product categories, brands and units in Bangla and English." },
      { property: "og:title", content: "Catalog setup — SokolerBazar" },
      { property: "og:description", content: "Categories, brands and units for your shop." },
    ],
  }),
  component: CatalogPage,
});

type TableName = "categories" | "brands" | "units";

const schema = z.object({
  name_bn: z.string().trim().min(1).max(60),
  name_en: z.string().trim().min(1).max(60),
});

function CatalogList({ table, title }: { table: TableName; title: string }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const hasLogo = table === "brands";
  const [form, setForm] = useState({ name_bn: "", name_en: "", logo_url: "" });

  const rows = useQuery({
    queryKey: [`catalog-${table}`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(hasLogo ? "id,name_en,name_bn,logo_url" : "id,name_en,name_bn")
        .order("name_en");
      if (error) throw error;
      return data as unknown as { id: string; name_en: string; name_bn: string; logo_url?: string | null }[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = hasLogo ? { ...parsed.data, logo_url: form.logo_url.trim() || null } : parsed.data;
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name_bn: "", name_en: "", logo_url: "" });
      queryClient.invalidateQueries({ queryKey: [`catalog-${table}`] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`catalog-${table}`] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="surface-panel p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          className="w-36 flex-1"
          placeholder={t("nameBn")}
          maxLength={60}
          value={form.name_bn}
          onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
        />
        <Input
          className="w-36 flex-1"
          placeholder={t("nameEn")}
          maxLength={60}
          value={form.name_en}
          onChange={(e) => setForm({ ...form, name_en: e.target.value })}
        />
        {hasLogo && (
          <Input
            className="w-full"
            placeholder={lang === "bn" ? "ব্র্যান্ড লোগোর লিংক" : "Brand logo URL"}
            maxLength={500}
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
          />
        )}
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="mr-1 size-4" /> {t("add")}
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {(rows.data ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">{t("noData")}</li>}
        {(rows.data ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2">
              {hasLogo &&
                (r.logo_url ? (
                  <img
                    src={r.logo_url}
                    alt={r.name_en}
                    loading="lazy"
                    width={24}
                    height={24}
                    className="size-6 rounded-full border border-border object-contain"
                  />
                ) : (
                  <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {r.name_en.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              {lang === "bn" ? r.name_bn : r.name_en}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogPage() {
  const { t } = useI18n();
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold">{t("catalog")}</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CatalogList table="categories" title={t("categoriesList")} />
        <CatalogList table="brands" title={t("brands")} />
        <CatalogList table="units" title={t("units")} />
      </div>
    </div>
  );
}
