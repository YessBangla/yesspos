import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, LogOut, MapPin, Package, Plus, ShoppingBasket, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { money, num, useI18n } from "@/lib/i18n";
import { isValidPhone, normalizePhone, useCustomerSession } from "@/lib/customer-auth";
import { CustomerAuthDialog } from "@/components/CustomerAccountMenu";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/my-account")({
  validateSearch: (input: Record<string, unknown>) => {
    const tab = input.tab === "addresses" || input.tab === "profile" ? input.tab : "orders";
    return { tab } as { tab: "orders" | "addresses" | "profile" };
  },
  head: () => ({
    meta: [
      { title: "My account — Daily Bazar online grocery" },
      { name: "description", content: "See your grocery order history, track deliveries and manage saved delivery addresses." },
      { property: "og:title", content: "My account — Daily Bazar" },
      { property: "og:description", content: "Order history, delivery tracking and saved addresses in one place." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/my-account` },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/my-account` }],
  }),
  component: MyAccountPage,
});

const addressSchema = z.object({
  label: z.string().trim().min(1).max(20),
  full_name: z.string().trim().min(2).max(60),
  phone: z.string().trim(),
  address: z.string().trim().min(10).max(300),
  area: z.string().trim().min(2).max(80),
  note: z.string().trim().max(200),
});

const emptyAddress = { label: "Home", full_name: "", phone: "", address: "", area: "", note: "" };

function MyAccountPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, isCustomer, name, phone, loading } = useCustomerSession();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [authOpen, setAuthOpen] = useState(false);
  const [form, setForm] = useState(emptyAddress);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) setAuthOpen(true);
  }, [loading, user]);

  const signedIn = !!user && isCustomer;

  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("id,order_no,status,total,subtotal,delivery_fee,slot,address,area,payment_method,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const addresses = useQuery({
    queryKey: ["my-addresses", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const spent = useMemo(
    () => (orders.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0),
    [orders.data],
  );

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success || !isValidPhone(form.phone)) {
      toast.error(bn ? "সব ঘর সঠিকভাবে পূরণ করুন" : "Please fill every field correctly");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customer_addresses").insert({
      ...parsed.data,
      phone: normalizePhone(form.phone),
      note: form.note || null,
      user_id: user!.id,
      is_default: (addresses.data?.length ?? 0) === 0,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm(emptyAddress);
    toast.success(bn ? "ঠিকানা সংরক্ষিত হয়েছে" : "Address saved");
    void qc.invalidateQueries({ queryKey: ["my-addresses"] });
  }

  async function removeAddress(id: string) {
    const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["my-addresses"] });
  }

  async function makeDefault(id: string) {
    await supabase.from("customer_addresses").update({ is_default: false }).neq("id", id);
    const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["my-addresses"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success(bn ? "লগআউট হয়েছে" : "Signed out");
    void navigate({ to: "/homedelivery", replace: true });
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/homedelivery" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {bn ? "দোকানে ফিরুন" : "Back to shop"}
          </Link>
          <span className="gradient-brand ml-auto grid size-8 place-items-center rounded-xl text-primary-foreground">
            <ShoppingBasket className="size-4" />
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold">{bn ? "আমার অ্যাকাউন্ট" : "My account"}</h1>

        {!signedIn ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {bn ? "অর্ডার ও ঠিকানা দেখতে লগইন করুন।" : "Sign in to see your orders and saved addresses."}
            </p>
            <Button className="mt-4" onClick={() => setAuthOpen(true)}>
              {bn ? "লগইন / রেজিস্টার" : "Sign in / Register"}
            </Button>
            <CustomerAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label={bn ? "নাম" : "Name"} value={name || (bn ? "গ্রাহক" : "Customer")} />
              <Stat label={bn ? "মোবাইল" : "Mobile"} value={normalizePhone(phone)} />
              <Stat label={bn ? "মোট কেনাকাটা" : "Lifetime spend"} value={money(spent, lang)} />
            </div>

            <Tabs
              value={tab}
              onValueChange={(v) => navigate({ search: { tab: v as "orders" }, replace: true })}
              className="mt-6"
            >
              <TabsList>
                <TabsTrigger value="orders">
                  <Package className="mr-1 size-4" />
                  {bn ? "অর্ডার" : "Orders"}
                </TabsTrigger>
                <TabsTrigger value="addresses">
                  <MapPin className="mr-1 size-4" />
                  {bn ? "ঠিকানা" : "Addresses"}
                </TabsTrigger>
                <TabsTrigger value="profile">{bn ? "প্রোফাইল" : "Profile"}</TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="mt-4 space-y-3">
                {orders.isLoading && <p className="text-sm text-muted-foreground">…</p>}
                {!orders.isLoading && (orders.data ?? []).length === 0 && (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    {bn ? "এখনো কোনো অর্ডার নেই।" : "No orders yet."}
                    <div className="mt-3">
                      <Button asChild size="sm">
                        <Link to="/homedelivery">{bn ? "কেনাকাটা শুরু করুন" : "Start shopping"}</Link>
                      </Button>
                    </div>
                  </div>
                )}
                {(orders.data ?? []).map((o) => (
                  <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display font-bold">#{num(Number(o.order_no), lang)}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString(bn ? "bn-BD" : "en-GB")} · {o.slot ?? "—"}
                    </p>
                    <p className="mt-1 text-sm">{o.address}, {o.area}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{o.payment_method}</span>
                      <span className="font-bold">{money(Number(o.total), lang)}</span>
                    </div>
                    <Link
                      to="/track"
                      className="mt-2 inline-block text-xs text-primary underline"
                    >
                      {bn ? "অর্ডার ট্র্যাক করুন" : "Track this order"}
                    </Link>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="addresses" className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {(addresses.data ?? []).map((a) => (
                    <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {a.label} {a.is_default && <Star className="ml-1 inline size-3.5 fill-warning text-warning" />}
                        </span>
                        <div className="flex gap-1">
                          {!a.is_default && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => makeDefault(a.id)}>
                              {bn ? "ডিফল্ট" : "Set default"}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeAddress(a.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm">{a.full_name} · {a.phone}</p>
                      <p className="text-sm text-muted-foreground">{a.address}, {a.area}</p>
                    </div>
                  ))}
                  {(addresses.data ?? []).length === 0 && !addresses.isLoading && (
                    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      {bn ? "কোনো সংরক্ষিত ঠিকানা নেই" : "No saved addresses"}
                    </p>
                  )}
                </div>

                <form onSubmit={saveAddress} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <p className="font-display font-bold">{bn ? "নতুন ঠিকানা" : "New address"}</p>
                  <Field label={bn ? "লেবেল" : "Label"} value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
                  <Field label={bn ? "পুরো নাম" : "Full name"} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
                  <Field label={bn ? "মোবাইল" : "Mobile"} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Field label={bn ? "এলাকা" : "Area"} value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
                  <div className="space-y-1.5">
                    <Label>{bn ? "সম্পূর্ণ ঠিকানা" : "Full address"}</Label>
                    <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} maxLength={300} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{bn ? "নোট" : "Note"}</Label>
                    <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} />
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>
                    <Plus className="mr-1 size-4" />
                    {bn ? "ঠিকানা সংরক্ষণ" : "Save address"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="profile" className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                  <p><span className="text-muted-foreground">{bn ? "নাম" : "Name"}: </span>{name || "—"}</p>
                  <p className="mt-1"><span className="text-muted-foreground">{bn ? "মোবাইল" : "Mobile"}: </span>{normalizePhone(phone)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {bn ? "পয়েন্ট ও মেম্বারশিপ দোকানের কাউন্টারে আপনার নম্বর দিয়ে দেখা যাবে।" : "Loyalty points are linked to your mobile number at the counter."}
                  </p>
                </div>
                <Button variant="outline" onClick={signOut} className="text-destructive">
                  <LogOut className="mr-1 size-4" />
                  {bn ? "লগআউট" : "Sign out"}
                </Button>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} />
    </div>
  );
}
