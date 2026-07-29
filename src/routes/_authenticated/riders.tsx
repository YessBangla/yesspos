import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { useActiveBranch } from "@/lib/active-branch";

export const Route = createFileRoute("/_authenticated/riders")({
  head: () => ({
    meta: [
      { title: "Delivery riders — SokolerBazar" },
      { name: "description", content: "Manage delivery riders, contact numbers, vehicles and live order load." },
      { property: "og:title", content: "Delivery riders — SokolerBazar" },
      { property: "og:description", content: "Rider roster and assignment load for home delivery operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RidersPage,
});

type Rider = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  nid: string | null;
  is_active: boolean;
  branch_id: string | null;
  note: string | null;
};

const VEHICLES = ["bike", "cycle", "van", "foot"];

function RidersPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const branch = useActiveBranch();
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "bike", nid: "" });

  const riders = useQuery({
    queryKey: ["riders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_riders").select("*").order("created_at");
      if (error) throw error;
      return data as unknown as Rider[];
    },
  });

  const openOrders = useQuery({
    queryKey: ["rider-open-orders"],
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("id,rider_id,status")
        .not("status", "in", "(delivered,cancelled)")
        .limit(500);
      if (error) throw error;
      return data as { id: string; rider_id: string | null; status: string }[];
    },
  });

  const load = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of openOrders.data ?? []) {
      if (!o.rider_id) continue;
      map.set(o.rider_id, (map.get(o.rider_id) ?? 0) + 1);
    }
    return map;
  }, [openOrders.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["riders"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.phone.trim()) throw new Error(bn ? "নাম ও ফোন দিন" : "Name and phone required");
      const { error } = await supabase.from("delivery_riders").insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicle: form.vehicle,
        nid: form.nid.trim() || null,
        branch_id: branch.branchId ?? null,
      });
      if (error) throw error;
      await logAudit("rider_create", { entity: "delivery_riders", details: form.name });
    },
    onSuccess: () => {
      setForm({ name: "", phone: "", vehicle: "bike", nid: "" });
      invalidate();
      toast.success(bn ? "রাইডার যোগ হয়েছে" : "Rider added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Rider> }) => {
      const { error } = await supabase.from("delivery_riders").update(values).eq("id", id);
      if (error) throw error;
      await logAudit("rider_update", { entity: "delivery_riders", entityId: id });
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_riders").delete().eq("id", id);
      if (error) throw error;
      await logAudit("rider_delete", { entity: "delivery_riders", entityId: id });
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
        <Bike className="mr-2 inline size-6 text-primary" />
        {bn ? "ডেলিভারি রাইডার" : "Delivery riders"}
      </h1>

      <div className="surface-panel grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          value={form.name}
          maxLength={60}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={bn ? "রাইডারের নাম" : "Rider name"}
        />
        <Input
          value={form.phone}
          maxLength={20}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={bn ? "মোবাইল নম্বর" : "Phone"}
          inputMode="tel"
        />
        <select
          value={form.vehicle}
          onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {VEHICLES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <Input
          value={form.nid}
          maxLength={30}
          onChange={(e) => setForm({ ...form, nid: e.target.value })}
          placeholder={bn ? "এনআইডি (ঐচ্ছিক)" : "NID (optional)"}
        />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-1 size-4" />
          {bn ? "যোগ করুন" : "Add"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(riders.data ?? []).map((r) => (
          <div key={r.id} className="surface-panel space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-bold">{r.name}</p>
                <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="size-3" /> {r.phone}
                </a>
                <p className="text-xs text-muted-foreground">
                  {r.vehicle}
                  {r.nid ? ` · NID ${r.nid}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                {bn ? "চলমান" : "Open"}: {num(load.get(r.id) ?? 0, lang)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => patch.mutate({ id: r.id, values: { is_active: !r.is_active } })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  r.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {r.is_active ? (bn ? "ডিউটিতে" : "On duty") : bn ? "বন্ধ" : "Off duty"}
              </button>
              <Button size="icon" variant="ghost" className="ml-auto" onClick={() => remove.mutate(r.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {(riders.data ?? []).length === 0 && (
          <p className="text-muted-foreground">{bn ? "কোনো রাইডার নেই" : "No riders yet"}</p>
        )}
      </div>
    </div>
  );
}
