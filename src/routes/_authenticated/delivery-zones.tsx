import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/delivery-zones")({
  head: () => ({
    meta: [
      { title: "Delivery zones & fees — SokolerBazar" },
      { name: "description", content: "Configure home delivery areas, charges, free-delivery limits and ETA." },
      { property: "og:title", content: "Delivery zones & fees — SokolerBazar" },
      { property: "og:description", content: "Manage delivery coverage, fees and minimum order value per area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ZonesPage,
});

type Zone = {
  id: string;
  name_en: string;
  name_bn: string;
  delivery_fee: number;
  free_delivery_above: number | null;
  min_order: number;
  eta_minutes: number;
  is_active: boolean;
  sort_order: number;
};

const EMPTY = {
  name_en: "",
  name_bn: "",
  delivery_fee: "29",
  free_delivery_above: "500",
  min_order: "100",
  eta_minutes: "60",
};

function ZonesPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });

  const zones = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_zones").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as Zone[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["delivery-zones"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name_en.trim() || !form.name_bn.trim()) throw new Error(bn ? "নাম দিন" : "Name required");
      const { error } = await supabase.from("delivery_zones").insert({
        name_en: form.name_en.trim(),
        name_bn: form.name_bn.trim(),
        delivery_fee: Number(form.delivery_fee) || 0,
        free_delivery_above: form.free_delivery_above ? Number(form.free_delivery_above) : null,
        min_order: Number(form.min_order) || 0,
        eta_minutes: Number(form.eta_minutes) || 60,
        sort_order: (zones.data?.length ?? 0) + 1,
      });
      if (error) throw error;
      await logAudit("zone_create", { entity: "delivery_zones", details: form.name_en });
    },
    onSuccess: () => {
      setForm({ ...EMPTY });
      invalidate();
      toast.success(bn ? "এলাকা যোগ হয়েছে" : "Zone added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Zone> }) => {
      const { error } = await supabase.from("delivery_zones").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
      if (error) throw error;
      await logAudit("zone_delete", { entity: "delivery_zones", entityId: id });
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
        <MapPin className="mr-2 inline size-6 text-primary" />
        {bn ? "ডেলিভারি এলাকা ও চার্জ" : "Delivery zones & fees"}
      </h1>

      <div className="surface-panel grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-7">
        <Input
          value={form.name_bn}
          maxLength={40}
          onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
          placeholder={bn ? "এলাকা (বাংলা)" : "Area (Bangla)"}
        />
        <Input
          value={form.name_en}
          maxLength={40}
          onChange={(e) => setForm({ ...form, name_en: e.target.value })}
          placeholder={bn ? "এলাকা (ইংরেজি)" : "Area (English)"}
        />
        <Input
          value={form.delivery_fee}
          onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
          placeholder={bn ? "ডেলিভারি চার্জ" : "Fee"}
          inputMode="numeric"
        />
        <Input
          value={form.free_delivery_above}
          onChange={(e) => setForm({ ...form, free_delivery_above: e.target.value })}
          placeholder={bn ? "ফ্রি ডেলিভারি (৳+)" : "Free above"}
          inputMode="numeric"
        />
        <Input
          value={form.min_order}
          onChange={(e) => setForm({ ...form, min_order: e.target.value })}
          placeholder={bn ? "সর্বনিম্ন অর্ডার" : "Min order"}
          inputMode="numeric"
        />
        <Input
          value={form.eta_minutes}
          onChange={(e) => setForm({ ...form, eta_minutes: e.target.value })}
          placeholder={bn ? "সময় (মিনিট)" : "ETA (min)"}
          inputMode="numeric"
        />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-1 size-4" />
          {bn ? "যোগ করুন" : "Add"}
        </Button>
      </div>

      <div className="surface-panel overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">{bn ? "এলাকা" : "Area"}</th>
              <th className="p-3">{bn ? "চার্জ" : "Fee"}</th>
              <th className="p-3">{bn ? "ফ্রি ডেলিভারি" : "Free above"}</th>
              <th className="p-3">{bn ? "সর্বনিম্ন" : "Min order"}</th>
              <th className="p-3">{bn ? "সময়" : "ETA"}</th>
              <th className="p-3">{bn ? "অবস্থা" : "Status"}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(zones.data ?? []).map((z) => (
              <tr key={z.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  {bn ? z.name_bn : z.name_en}
                  <span className="ml-1 text-xs text-muted-foreground">{bn ? z.name_en : z.name_bn}</span>
                </td>
                <td className="p-3">{money(Number(z.delivery_fee), lang)}</td>
                <td className="p-3">{z.free_delivery_above ? money(Number(z.free_delivery_above), lang) : "—"}</td>
                <td className="p-3">{money(Number(z.min_order), lang)}</td>
                <td className="p-3">
                  {num(z.eta_minutes, lang)} {bn ? "মিনিট" : "min"}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => patch.mutate({ id: z.id, values: { is_active: !z.is_active } })}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      z.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {z.is_active ? (bn ? "চালু" : "Active") : bn ? "বন্ধ" : "Off"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(z.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(zones.data ?? []).length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  {bn ? "কোনো এলাকা নেই" : "No zones yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
