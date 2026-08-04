/**
 * Saved delivery addresses for signed-in shoppers.
 *
 * Shown at checkout after the delivery area is chosen so the customer can pick
 * a stored address in one tap instead of retyping it.
 */
import { useQuery } from "@tanstack/react-query";
import { Home, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCustomerSession } from "@/lib/customer-auth";
import { useI18n } from "@/lib/i18n";

export type SavedAddress = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string;
  area: string;
  note: string | null;
  is_default: boolean;
};

export function SavedAddressPicker({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect: (a: SavedAddress) => void;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, isCustomer } = useCustomerSession();

  const addresses = useQuery({
    queryKey: ["saved-addresses", user?.id],
    enabled: !!user && isCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id,label,full_name,phone,address,area,note,is_default")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedAddress[];
    },
  });

  if (!user || !isCustomer || (addresses.data ?? []).length === 0) return null;

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Home className="size-3.5 text-primary" />
        {bn ? "সংরক্ষিত ঠিকানা" : "Saved addresses"}
      </legend>
      <div className="grid gap-2">
        {(addresses.data ?? []).map((a) => {
          const active = selectedId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a)}
              aria-pressed={active}
              className={`flex min-h-11 items-start gap-2 rounded-2xl border p-3 text-left text-xs transition ${
                active ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
              }`}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-semibold">
                  {a.label}
                  {a.is_default ? ` · ${bn ? "ডিফল্ট" : "Default"}` : ""}
                </span>
                <span className="block text-muted-foreground">
                  {a.address}
                  {a.area ? `, ${a.area}` : ""}
                </span>
                <span className="block text-muted-foreground">
                  {a.full_name} · {a.phone}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
