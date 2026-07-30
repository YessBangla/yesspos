import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Percent, Plus, Save, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { downloadCsv, logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coupons")({
  head: () => ({
    meta: [
      { title: "Coupon manager — Sokoler Bazar" },
      {
        name: "description",
        content:
          "Create discount coupons with validity dates, usage limits and minimum order value for the Sokoler Bazar storefront.",
      },
      { property: "og:title", content: "Coupon manager — Sokoler Bazar" },
      {
        property: "og:description",
        content: "Create and control storefront discount codes, limits and expiry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CouponsPage,
});

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_amount: number;
  max_discount: number | null;
  is_active: boolean;
  starts_on: string | null;
  expires_on: string | null;
  usage_limit: number | null;
  used_count: number;
  note: string | null;
  created_at: string;
};

const EMPTY = {
  code: "",
  type: "percent",
  value: "10",
  min_amount: "0",
  max_discount: "",
  starts_on: "",
  expires_on: "",
  usage_limit: "",
  note: "",
};

function statusOf(c: Coupon) {
  const today = new Date().toISOString().slice(0, 10);
  if (!c.is_active) return "paused";
  if (c.starts_on && c.starts_on > today) return "scheduled";
  if (c.expires_on && c.expires_on < today) return "expired";
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return "used_up";
  return "live";
}

function CouponsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Coupon[];
    },
  });

  const rows = useMemo(() => {
    const all = list.data ?? [];
    const term = q.trim().toLowerCase();
    return term ? all.filter((c) => c.code.toLowerCase().includes(term)) : all;
  }, [list.data, q]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coupons"] });

  const create = useMutation({
    mutationFn: async () => {
      const code = form.code.trim().toUpperCase();
      if (!code) throw new Error(bn ? "কুপন কোড দিন" : "Coupon code is required");
      const value = Number(form.value);
      if (!Number.isFinite(value) || value <= 0)
        throw new Error(bn ? "সঠিক ছাড়ের পরিমাণ দিন" : "Enter a valid discount value");
      if (form.type === "percent" && value > 100)
        throw new Error(bn ? "শতকরা ১০০ এর বেশি নয়" : "Percent cannot exceed 100");
      if (form.starts_on && form.expires_on && form.starts_on > form.expires_on)
        throw new Error(bn ? "শুরুর তারিখ শেষের পরে হতে পারে না" : "Start date must be before expiry");

      const { error } = await supabase.from("coupons").insert({
        code,
        type: form.type,
        value,
        min_amount: Number(form.min_amount || 0),
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        starts_on: form.starts_on || null,
        expires_on: form.expires_on || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        note: form.note.trim() || null,
      });
      if (error) throw error;
      await logAudit("coupon_create", "coupons", code);
    },
    onSuccess: () => {
      setForm({ ...EMPTY });
      invalidate();
      toast.success(bn ? "কুপন তৈরি হয়েছে" : "Coupon created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values, code }: { id: string; values: Partial<Coupon>; code: string }) => {
      const { error } = await supabase.from("coupons").update(values).eq("id", id);
      if (error) throw error;
      await logAudit("coupon_update", "coupons", code);
    },
    onSuccess: () => {
      invalidate();
      toast.success(bn ? "সংরক্ষিত" : "Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (c: Coupon) => {
      const { error } = await supabase.from("coupons").delete().eq("id", c.id);
      if (error) throw error;
      await logAudit("coupon_delete", "coupons", c.code);
    },
    onSuccess: () => {
      invalidate();
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    downloadCsv(
      "coupons.csv",
      (rows ?? []).map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value,
        min_amount: c.min_amount,
        max_discount: c.max_discount ?? "",
        starts_on: c.starts_on ?? "",
        expires_on: c.expires_on ?? "",
        usage_limit: c.usage_limit ?? "",
        used_count: c.used_count,
        status: statusOf(c),
      })),
    );
  }

  const statusText: Record<string, [string, string]> = {
    live: ["Live", "সক্রিয়"],
    paused: ["Paused", "বন্ধ"],
    scheduled: ["Scheduled", "নির্ধারিত"],
    expired: ["Expired", "মেয়াদোত্তীর্ণ"],
    used_up: ["Limit reached", "সীমা শেষ"],
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="gradient-brand grid size-10 place-items-center rounded-2xl text-primary-foreground">
          <Ticket className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold">
            {bn ? "কুপন ম্যানেজমেন্ট" : "Coupon management"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "কুপন তৈরি করুন, মেয়াদ, ব্যবহার সীমা ও ন্যূনতম অর্ডার ভ্যালু ঠিক করুন।"
              : "Create coupons and control validity, usage limits and minimum order value."}
          </p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}>
          {bn ? "CSV ডাউনলোড" : "Download CSV"}
        </Button>
      </header>

      {/* Create form */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Plus className="size-4 text-primary" />
          {bn ? "নতুন কুপন" : "New coupon"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={bn ? "কুপন কোড" : "Coupon code"}>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EID25"
            />
          </Field>
          <Field label={bn ? "ধরন" : "Type"}>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="percent">{bn ? "শতকরা (%)" : "Percent (%)"}</option>
              <option value="fixed">{bn ? "নির্দিষ্ট টাকা" : "Fixed amount"}</option>
            </select>
          </Field>
          <Field label={bn ? "ছাড়ের পরিমাণ" : "Discount value"}>
            <Input
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label={bn ? "সর্বোচ্চ ছাড় (৳)" : "Max discount (৳)"}>
            <Input
              type="number"
              min={0}
              value={form.max_discount}
              onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
              placeholder={bn ? "সীমা নেই" : "No cap"}
            />
          </Field>
          <Field label={bn ? "ন্যূনতম অর্ডার (৳)" : "Minimum order (৳)"}>
            <Input
              type="number"
              min={0}
              value={form.min_amount}
              onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
            />
          </Field>
          <Field label={bn ? "ব্যবহার সীমা" : "Usage limit"}>
            <Input
              type="number"
              min={1}
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
              placeholder={bn ? "সীমাহীন" : "Unlimited"}
            />
          </Field>
          <Field label={bn ? "শুরুর তারিখ" : "Starts on"}>
            <Input
              type="date"
              value={form.starts_on}
              onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
            />
          </Field>
          <Field label={bn ? "মেয়াদ শেষ" : "Expires on"}>
            <Input
              type="date"
              value={form.expires_on}
              onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
            />
          </Field>
          <Field label={bn ? "নোট" : "Note"} className="sm:col-span-2 lg:col-span-3">
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={bn ? "ক্যাম্পেইনের বিবরণ" : "Campaign description"}
            />
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              <Plus className="mr-1 size-4" />
              {bn ? "কুপন তৈরি" : "Create coupon"}
            </Button>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={bn ? "কোড খুঁজুন…" : "Search code…"}
            className="max-w-xs"
          />
          <span className="ml-auto text-xs text-muted-foreground">
            {num(rows.length, lang)} {bn ? "টি কুপন" : "coupons"}
          </span>
        </div>

        {list.isLoading && (
          <p className="p-6 text-sm text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
        )}
        {!list.isLoading && rows.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            {bn ? "কোনো কুপন নেই।" : "No coupons yet."}
          </p>
        )}

        <ul className="divide-y divide-border">
          {rows.map((c) => {
            const st = statusOf(c);
            const usedPct =
              c.usage_limit && c.usage_limit > 0
                ? Math.min(100, Math.round((c.used_count / c.usage_limit) * 100))
                : 0;
            return (
              <li key={c.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-primary/10 px-2 py-1 font-mono text-sm font-bold text-primary">
                      {c.code}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        st === "live" && "bg-emerald-500/15 text-emerald-600",
                        st === "paused" && "bg-muted text-muted-foreground",
                        st === "scheduled" && "bg-amber-500/15 text-amber-600",
                        (st === "expired" || st === "used_up") && "bg-destructive/10 text-destructive",
                      )}
                    >
                      {bn ? statusText[st][1] : statusText[st][0]}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Percent className="size-3.5" />
                      {c.type === "percent"
                        ? `${num(Number(c.value), lang)}%`
                        : money(Number(c.value), lang)}
                      {c.max_discount ? ` · ${bn ? "সর্বোচ্চ" : "max"} ${money(Number(c.max_discount), lang)}` : ""}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {bn ? "ন্যূনতম অর্ডার" : "Min order"}: {money(Number(c.min_amount ?? 0), lang)}
                    {" · "}
                    <CalendarClock className="inline size-3.5" />{" "}
                    {c.starts_on ?? (bn ? "এখনই" : "now")} → {c.expires_on ?? (bn ? "মেয়াদহীন" : "no expiry")}
                    {" · "}
                    {bn ? "ব্যবহৃত" : "Used"}: {num(c.used_count ?? 0, lang)}
                    {c.usage_limit ? ` / ${num(c.usage_limit, lang)}` : ` (${bn ? "সীমাহীন" : "unlimited"})`}
                  </p>
                  {c.note && <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>}
                  {!!c.usage_limit && (
                    <div className="mt-2 h-1.5 w-full max-w-sm rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    className="w-28"
                    defaultValue={c.usage_limit ?? ""}
                    placeholder={bn ? "সীমা" : "Limit"}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== (c.usage_limit ?? null))
                        patch.mutate({ id: c.id, code: c.code, values: { usage_limit: v } });
                    }}
                  />
                  <Input
                    type="date"
                    className="w-40"
                    defaultValue={c.expires_on ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== (c.expires_on ?? null))
                        patch.mutate({ id: c.id, code: c.code, values: { expires_on: v } });
                    }}
                  />
                  <Button
                    size="sm"
                    variant={c.is_active ? "outline" : "default"}
                    onClick={() =>
                      patch.mutate({ id: c.id, code: c.code, values: { is_active: !c.is_active } })
                    }
                  >
                    <Save className="mr-1 size-4" />
                    {c.is_active ? (bn ? "বন্ধ করুন" : "Pause") : bn ? "চালু করুন" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(bn ? "কুপনটি মুছবেন?" : "Delete this coupon?")) remove.mutate(c);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
