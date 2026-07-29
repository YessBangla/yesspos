import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { SITE_CONTENT_KEY, useSiteContent, type SiteContentRow } from "@/lib/site-content";

const GROUP_LABEL: Record<string, [string, string]> = {
  brand: ["ব্র্যান্ড", "Brand"],
  home: ["হোম পেজ", "Home page"],
  shop: ["হোম ডেলিভারি", "Home delivery"],
  footer: ["ফুটার", "Footer"],
};

/** Admin editor: change every public text of the site without touching code. */
export function SiteContentEditor() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const queryClient = useQueryClient();
  const { rows, isLoading } = useSiteContent();
  const [draft, setDraft] = useState<Record<string, { value_bn: string; value_en: string }>>({});

  // Seed the draft once per loaded row set. Guarding on the row signature keeps
  // an unstable query result from re-triggering the effect forever.
  const signature = rows.map((r) => r.id).join(",");
  useEffect(() => {
    if (!signature) return;
    setDraft((prev) =>
      Object.fromEntries(
        rows.map((r) => [r.id, prev[r.id] ?? { value_bn: r.value_bn, value_en: r.value_en }]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const groups = useMemo(() => {
    const map = new Map<string, SiteContentRow[]>();
    rows.forEach((r) => map.set(r.group_name, [...(map.get(r.group_name) ?? []), r]));
    return [...map.entries()];
  }, [rows]);

  const save = useMutation({
    mutationFn: async () => {
      const changed = rows.filter(
        (r) =>
          draft[r.id] &&
          (draft[r.id].value_bn !== r.value_bn || draft[r.id].value_en !== r.value_en),
      );
      if (!changed.length) return 0;
      for (const row of changed) {
        const { error } = await supabase
          .from("site_content")
          .update({
            value_bn: draft[row.id].value_bn.slice(0, 1000),
            value_en: draft[row.id].value_en.slice(0, 1000),
          })
          .eq("id", row.id);
        if (error) throw error;
      }
      return changed.length;
    },
    onSuccess: (count) => {
      void logAudit("settings_update", { entity: "site_content", details: `${count} texts` });
      queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });
      toast.success(bn ? `${count} টি লেখা সংরক্ষণ হয়েছে` : `${count} texts saved`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">…</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">
            {bn ? "ওয়েবসাইটের লেখা" : "Website content"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "হোম পেজ, ডেলিভারি পোর্টাল ও ফুটারের সব লেখা এখান থেকেই বদলান। সেভ করলেই সাথে সাথে সবাই নতুন লেখা দেখবে।"
              : "Change every public text here. Saving updates all visitors instantly."}
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="shrink-0">
          {bn ? "সংরক্ষণ" : "Save"}
        </Button>
      </div>

      {groups.map(([group, items]) => (
        <div key={group} className="rounded-xl border border-border p-4">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            {GROUP_LABEL[group] ? GROUP_LABEL[group][bn ? 0 : 1] : group}
          </p>
          <div className="mt-3 space-y-4">
            {items.map((row) => {
              const value = draft[row.id] ?? { value_bn: row.value_bn, value_en: row.value_en };
              const Field = row.kind === "textarea" ? Textarea : Input;
              return (
                <div key={row.id} className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{row.label} — বাংলা</Label>
                    <Field
                      value={value.value_bn}
                      onChange={(e: { target: { value: string } }) =>
                        setDraft((d) => ({ ...d, [row.id]: { ...value, value_bn: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{row.label} — English</Label>
                    <Field
                      value={value.value_en}
                      onChange={(e: { target: { value: string } }) =>
                        setDraft((d) => ({ ...d, [row.id]: { ...value, value_en: e.target.value } }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
