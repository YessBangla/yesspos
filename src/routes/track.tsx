import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your grocery order — Sokoler Bazar" },
      { name: "description", content: "Check the live status of your home delivery grocery order with order number and phone." },
      { property: "og:title", content: "Track your grocery order — Sokoler Bazar" },
      { property: "og:description", content: "Live status of your home delivery order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type Tracked = { order_no: number; status: string; total: number; created_at: string };

function TrackPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Tracked | null | "none">(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const { data } = await supabase.rpc("track_delivery_order", {
      _order_no: Number(orderNo),
      _phone: phone.trim(),
    });
    const row = (data as unknown as Tracked[] | null)?.[0] ?? null;
    setResult(row ?? "none");
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-2xl font-bold">{bn ? "অর্ডার ট্র্যাক করুন" : "Track your order"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {bn ? "অর্ডার নম্বর ও ফোন নম্বর দিন।" : "Enter your order number and phone."}
      </p>
      <div className="surface-panel mt-6 space-y-3 p-4">
        <div className="space-y-1.5">
          <Label>{bn ? "অর্ডার নম্বর" : "Order no."}</Label>
          <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} inputMode="numeric" maxLength={12} />
        </div>
        <div className="space-y-1.5">
          <Label>{bn ? "ফোন" : "Phone"}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </div>
        <Button className="w-full" onClick={search} disabled={loading || !orderNo || !phone}>
          <PackageSearch className="mr-1 size-4" /> {bn ? "খুঁজুন" : "Track"}
        </Button>

        {result === "none" && (
          <p className="text-sm text-destructive">{bn ? "অর্ডার পাওয়া যায়নি।" : "No matching order found."}</p>
        )}
        {result && result !== "none" && (
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "অর্ডার" : "Order"}</span>
              <span className="font-semibold">#{result.order_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "অবস্থা" : "Status"}</span>
              <span className="font-semibold uppercase">{result.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "মোট" : "Total"}</span>
              <span className="font-semibold">{money(Number(result.total), lang)}</span>
            </div>
          </div>
        )}
      </div>
      <Link to="/homedelivery" className="mt-6 inline-block text-sm text-primary underline">
        {bn ? "← দোকানে ফিরে যান" : "← Back to shop"}
      </Link>
    </main>
  );
}
