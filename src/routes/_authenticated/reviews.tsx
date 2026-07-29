import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({
    meta: [
      { title: "Product reviews & ratings — Yess POS" },
      { name: "description", content: "Moderate customer product reviews and ratings for the online storefront." },
      { property: "og:title", content: "Product reviews & ratings — Yess POS" },
      { property: "og:description", content: "Approve, reject and monitor shopper feedback on products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewsPage,
});

type Review = {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
};

function ReviewsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");

  const reviews = useQuery({
    queryKey: ["product-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Review[];
    },
  });

  const products = useQuery({
    queryKey: ["review-products"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name_en,name_bn").limit(2000);
      if (error) throw error;
      return data as { id: string; name_en: string; name_bn: string }[];
    },
  });

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products.data ?? []) map.set(p.id, bn ? p.name_bn : p.name_en);
    return map;
  }, [products.data, bn]);

  const visible = (reviews.data ?? []).filter((r) =>
    tab === "all" ? true : tab === "pending" ? !r.is_approved : r.is_approved,
  );

  const avg = useMemo(() => {
    const list = (reviews.data ?? []).filter((r) => r.is_approved);
    if (!list.length) return 0;
    return list.reduce((s, r) => s + r.rating, 0) / list.length;
  }, [reviews.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-reviews"] });

  const approve = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("product_reviews").update({ is_approved: value }).eq("id", id);
      if (error) throw error;
      await logAudit("review_moderate", { entity: "product_reviews", entityId: id, details: String(value) });
    },
    onSuccess: () => {
      invalidate();
      toast.success(bn ? "আপডেট হয়েছে" : "Updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_reviews").delete().eq("id", id);
      if (error) throw error;
      await logAudit("review_moderate", { entity: "product_reviews", entityId: id, details: "deleted" });
    },
    onSuccess: () => {
      invalidate();
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          <Star className="mr-2 inline size-6 text-primary" />
          {bn ? "পণ্য রিভিউ ও রেটিং" : "Product reviews & ratings"}
        </h1>
        <span className="text-sm text-muted-foreground">
          {bn ? "গড় রেটিং" : "Average rating"}: <strong>{avg ? avg.toFixed(1) : "—"}</strong> ·{" "}
          {num((reviews.data ?? []).length, lang)} {bn ? "রিভিউ" : "reviews"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              tab === s ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground",
            )}
          >
            {s === "pending"
              ? bn
                ? "অপেক্ষমাণ"
                : "Pending"
              : s === "approved"
                ? bn
                  ? "অনুমোদিত"
                  : "Approved"
                : bn
                  ? "সব"
                  : "All"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((r) => (
          <div key={r.id} className="surface-panel space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{nameOf.get(r.product_id) ?? r.product_id.slice(0, 8)}</p>
              <span className="text-amber-500">{"★".repeat(Math.max(1, Math.min(5, r.rating)))}</span>
            </div>
            <p className="text-sm text-muted-foreground">{r.comment || (bn ? "মন্তব্য নেই" : "No comment")}</p>
            <p className="text-xs text-muted-foreground">
              {r.customer_name} · {r.created_at.slice(0, 10)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant={r.is_approved ? "outline" : "default"} onClick={() => approve.mutate({ id: r.id, value: !r.is_approved })}>
                <Check className="mr-1 size-4" />
                {r.is_approved ? (bn ? "লুকান" : "Unpublish") : bn ? "অনুমোদন" : "Approve"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(r.id)}>
                <Trash2 className="mr-1 size-4" />
                {bn ? "মুছুন" : "Delete"}
              </Button>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="text-muted-foreground">{bn ? "কোনো রিভিউ নেই" : "No reviews"}</p>}
      </div>
    </div>
  );
}
