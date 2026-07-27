import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Shop settings — SheraPOS" },
      { name: "description", content: "Set your shop name, address, VAT rate and receipt footer." },
      { property: "og:title", content: "Shop settings — SheraPOS" },
      { property: "og:description", content: "Shop name, address, VAT rate and receipt footer." },
    ],
  }),
  component: SettingsPage,
});

type Settings = {
  id: string;
  shop_name: string;
  address: string | null;
  phone: string | null;
  currency_symbol: string;
  default_tax_pct: number;
  receipt_footer: string | null;
};

function SettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    shop_name: "",
    address: "",
    phone: "",
    default_tax_pct: "0",
    receipt_footer: "",
  });

  const settings = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as Settings | null;
    },
  });

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({
      shop_name: s.shop_name ?? "",
      address: s.address ?? "",
      phone: s.phone ?? "",
      default_tax_pct: String(s.default_tax_pct ?? 0),
      receipt_footer: s.receipt_footer ?? "",
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        shop_name: form.shop_name.trim().slice(0, 80) || "SheraPOS",
        address: form.address.trim().slice(0, 200) || null,
        phone: form.phone.trim().slice(0, 20) || null,
        default_tax_pct: Math.min(Math.max(Number(form.default_tax_pct) || 0, 0), 100),
        receipt_footer: form.receipt_footer.trim().slice(0, 200) || null,
      };
      if (settings.data?.id) {
        const { error } = await supabase.from("business_settings").update(payload).eq("id", settings.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void logAudit("settings_update", { entity: "settings" });
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold">{t("settings")}</h1>

      <div className="surface-panel mt-4 max-w-2xl space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("shopName")}</Label>
            <Input
              value={form.shop_name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("address")}</Label>
            <Input
              value={form.address}
              maxLength={200}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("defaultTax")}</Label>
            <Input
              inputMode="decimal"
              value={form.default_tax_pct}
              onChange={(e) => setForm({ ...form, default_tax_pct: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("receiptFooter")}</Label>
            <Input
              value={form.receipt_footer}
              maxLength={200}
              onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
