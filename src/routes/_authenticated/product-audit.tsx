import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ImageOff, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { parsePackSize } from "@/lib/pack-size";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/product-audit")({
  head: () => ({
    meta: [
      { title: "Product image audit — Daily Bazar" },
      {
        name: "description",
        content: "Find products with missing, shared or invalid images and pack sizes, then repair them in bulk.",
      },
      { property: "og:title", content: "Product image audit — Daily Bazar" },
      { property: "og:description", content: "Audit and bulk-repair missing product images and pack sizes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductAuditPage,
});

type Row = {
  id: string;
  name_en: string;
  name_bn: string;
  sku: string;
  brand: string | null;
  pack_size: string | null;
  image_url: string | null;
  is_active: boolean;
};

type IssueKey = "no_image" | "shared_image" | "no_pack" | "bad_pack" | "no_brand";

const ISSUE_LABEL: Record<IssueKey, { en: string; bn: string }> = {
  no_image: { en: "No image", bn: "ছবি নেই" },
  shared_image: { en: "Shared image", bn: "একই ছবি একাধিক পণ্যে" },
  no_pack: { en: "No pack size", bn: "প্যাক সাইজ নেই" },
  bad_pack: { en: "Invalid pack size", bn: "প্যাক সাইজ ভুল" },
  no_brand: { en: "No brand", bn: "ব্র্যান্ড নেই" },
};

function ProductAuditPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [filter, setFilter] = useState<IssueKey | "all">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [packSize, setPackSize] = useState("");

  const products = useQuery({
    queryKey: ["audit-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku,brand,pack_size,image_url,is_active")
        .order("name_en")
        .limit(5000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const { rows, counts, library } = useMemo(() => {
    const all = products.data ?? [];
    const usage = new Map<string, number>();
    all.forEach((p) => {
      const u = (p.image_url ?? "").trim();
      if (u) usage.set(u, (usage.get(u) ?? 0) + 1);
    });

    const withIssues = all
      .map((p) => {
        const issues: IssueKey[] = [];
        const url = (p.image_url ?? "").trim();
        if (!url) issues.push("no_image");
        else if ((usage.get(url) ?? 0) > 1) issues.push("shared_image");
        const pack = (p.pack_size ?? "").trim();
        if (!pack) issues.push("no_pack");
        else if (!parsePackSize(pack)) issues.push("bad_pack");
        if (!(p.brand ?? "").trim()) issues.push("no_brand");
        return { p, issues };
      })
      .filter((r) => r.issues.length > 0);

    const counts = { total: all.length, flagged: withIssues.length } as Record<string, number>;
    (Object.keys(ISSUE_LABEL) as IssueKey[]).forEach((k) => {
      counts[k] = withIssues.filter((r) => r.issues.includes(k)).length;
    });

    const library = [...usage.entries()].sort((a, b) => a[1] - b[1]).map(([url, n]) => ({ url, n }));

    return {
      rows: filter === "all" ? withIssues : withIssues.filter((r) => r.issues.includes(filter)),
      counts,
      library,
    };
  }, [products.data, filter]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const repair = useMutation({
    mutationFn: async () => {
      const patch: { image_url?: string; pack_size?: string } = {};
      if (imageUrl.trim()) patch.image_url = imageUrl.trim().slice(0, 500);
      if (packSize.trim()) {
        if (!parsePackSize(packSize.trim())) throw new Error(bn ? "প্যাক সাইজ ভুল (যেমন 500g, 1kg, 12 pcs)" : "Invalid pack size (e.g. 500g, 1kg, 12 pcs)");
        patch.pack_size = packSize.trim().slice(0, 40);
      }
      if (Object.keys(patch).length === 0)
        throw new Error(bn ? "ছবির লিংক বা প্যাক সাইজ দিন" : "Enter an image URL or pack size");
      if (selectedIds.length === 0) throw new Error(bn ? "পণ্য নির্বাচন করুন" : "Select at least one product");

      const { error } = await supabase.from("products").update(patch).in("id", selectedIds);
      if (error) throw error;
      await logAudit("product_update", {
        entity: "product",
        details: `Bulk repaired ${selectedIds.length} product(s): ${Object.keys(patch).join(", ")}`,
      });
      return selectedIds.length;
    },
    onSuccess: (n) => {
      toast.success(bn ? `${n} টি পণ্য আপডেট হয়েছে` : `${n} product(s) updated`);
      setSelected({});
      setImageUrl("");
      setPackSize("");
      qc.invalidateQueries({ queryKey: ["audit-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shop-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {bn ? "পণ্যের ছবি ও তথ্য অডিট" : "Product image & data audit"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "ছবি নেই / একই ছবি একাধিক পণ্যে / প্যাক সাইজ নেই — সব একসাথে ঠিক করুন।"
              : "Missing images, images reused across products and missing pack sizes — repair them in bulk."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
          {counts.flagged === 0 ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <AlertTriangle className="size-4 text-warning" />
          )}
          <span>
            <b>{counts.flagged}</b> / {counts.total} {bn ? "পণ্যে সমস্যা" : "products flagged"}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`${bn ? "সব" : "All"} (${counts.flagged})`} />
        {(Object.keys(ISSUE_LABEL) as IssueKey[]).map((k) => (
          <Chip
            key={k}
            active={filter === k}
            onClick={() => setFilter(k)}
            label={`${bn ? ISSUE_LABEL[k].bn : ISSUE_LABEL[k].en} (${counts[k] ?? 0})`}
          />
        ))}
      </div>

      <section className="surface-panel space-y-3 p-4">
        <h2 className="font-display text-lg font-bold">{bn ? "বাল্ক রিপেয়ার" : "Bulk repair"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{bn ? "ছবির লিংক" : "Image URL"}</Label>
            <Input
              value={imageUrl}
              maxLength={500}
              placeholder="/products/milk.jpg"
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{bn ? "প্যাক সাইজ / ওজন" : "Pack size / weight"}</Label>
            <Input value={packSize} maxLength={40} placeholder="500g" onChange={(e) => setPackSize(e.target.value)} />
          </div>
        </div>

        {library.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {bn ? "ছবির লাইব্রেরি (কম ব্যবহৃত আগে)" : "Image library (least used first)"}
            </Label>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {library.slice(0, 60).map((i) => (
                <button
                  key={i.url}
                  type="button"
                  title={`${i.url} · ${i.n}`}
                  onClick={() => setImageUrl(i.url)}
                  className={cn(
                    "relative size-12 overflow-hidden rounded-lg border",
                    imageUrl === i.url ? "border-primary ring-2 ring-primary/40" : "border-border",
                  )}
                >
                  <img src={i.url} alt="" loading="lazy" className="size-full object-cover" />
                  <span className="absolute bottom-0 right-0 bg-background/80 px-1 text-[9px] font-bold">{i.n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => repair.mutate()}
            disabled={repair.isPending || selectedIds.length === 0}
          >
            <Wand2 className="mr-1 size-4" />
            {bn ? "নির্বাচিত পণ্যে প্রয়োগ করুন" : "Apply to selected"} ({selectedIds.length})
          </Button>
          <Button variant="outline" onClick={() => setSelected(Object.fromEntries(rows.map((r) => [r.p.id, true])))}>
            {bn ? "সব নির্বাচন" : "Select all shown"}
          </Button>
          <Button variant="ghost" onClick={() => setSelected({})}>
            {bn ? "বাতিল" : "Clear"}
          </Button>
        </div>
      </section>

      <section className="surface-panel divide-y divide-border">
        {products.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
        {!products.isLoading && rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {bn ? "কোনো সমস্যা পাওয়া যায়নি 🎉" : "No issues found 🎉"}
          </p>
        )}
        {rows.map(({ p, issues }) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={!!selected[p.id]}
              onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
            />
            {p.image_url ? (
              <img src={p.image_url} alt="" loading="lazy" className="size-11 rounded-lg border border-border object-cover" />
            ) : (
              <div className="grid size-11 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
                <ImageOff className="size-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{bn ? p.name_bn : p.name_en}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.sku} {p.pack_size ? `· ${p.pack_size}` : ""} {p.brand ? `· ${p.brand}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {issues.map((i) => (
                <span key={i} className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                  {bn ? ISSUE_LABEL[i].bn : ISSUE_LABEL[i].en}
                </span>
              ))}
            </div>
          </label>
        ))}
      </section>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
