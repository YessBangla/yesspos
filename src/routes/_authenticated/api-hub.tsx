import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plug, Plus, Save, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/api-hub")({
  head: () => ({
    meta: [
      { title: "API Hub — SokolerBazar" },
      {
        name: "description",
        content: "Configure SMS, email, payment gateway and other API integrations for your POS from one place.",
      },
      { property: "og:title", content: "API Hub — SokolerBazar" },
      { property: "og:description", content: "Edit and configure every API integration used by your shop." },
    ],
  }),
  component: ApiHubPage,
});

type ApiRow = {
  id: string;
  provider: string;
  label: string;
  category: string;
  enabled: boolean;
  base_url: string | null;
  api_key: string | null;
  api_secret: string | null;
  sender_id: string | null;
  extra: Record<string, unknown> | null;
  notes: string | null;
};

const CATEGORIES = ["messaging", "payment", "other"] as const;

function ApiHubPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [cat, setCat] = useState<"all" | (typeof CATEGORIES)[number]>("all");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<ApiRow> & { extraText?: string }>>({});
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ provider: "", label: "", category: "other" });

  const rows = useQuery({
    queryKey: ["api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_settings").select("*").order("category").order("label");
      if (error) throw error;
      return data as unknown as ApiRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (row: ApiRow) => {
      const d = drafts[row.id] ?? {};
      let extra: Record<string, unknown> = (row.extra ?? {}) as Record<string, unknown>;
      if (d.extraText !== undefined) {
        const txt = d.extraText.trim();
        if (txt.length === 0) extra = {};
        else {
          try {
            extra = JSON.parse(txt) as Record<string, unknown>;
          } catch {
            throw new Error("Invalid JSON in extra config");
          }
        }
      }
      const patch = {
        label: d.label ?? row.label,
        category: d.category ?? row.category,
        enabled: d.enabled ?? row.enabled,
        base_url: (d.base_url ?? row.base_url) || null,
        api_key: (d.api_key ?? row.api_key) || null,
        api_secret: (d.api_secret ?? row.api_secret) || null,
        sender_id: (d.sender_id ?? row.sender_id) || null,
        notes: (d.notes ?? row.notes) || null,
        extra: extra as unknown as never,
      };
      const { error } = await supabase.from("api_settings").update(patch).eq("id", row.id);
      if (error) throw error;
      await logAudit("settings_update", { entity: "api_settings", entityId: row.id });
    },
    onSuccess: (_d, row) => {
      setDrafts((s) => {
        const n = { ...s };
        delete n[row.id];
        return n;
      });
      queryClient.invalidateQueries({ queryKey: ["api-settings"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const provider = newRow.provider.trim().toLowerCase().replace(/\s+/g, "-");
      if (!provider || !newRow.label.trim()) throw new Error(t("noData"));
      const { error } = await supabase
        .from("api_settings")
        .insert({ provider, label: newRow.label.trim(), category: newRow.category });
      if (error) throw error;
      await logAudit("settings_update", { entity: "api_settings", details: `create ${provider}` });
    },
    onSuccess: () => {
      setAdding(false);
      setNewRow({ provider: "", label: "", category: "other" });
      queryClient.invalidateQueries({ queryKey: ["api-settings"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_settings").delete().eq("id", id);
      if (error) throw error;
      await logAudit("settings_update", { entity: "api_settings", entityId: id, details: "delete" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-settings"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function testConnection(row: ApiRow) {
    const url = (drafts[row.id]?.base_url ?? row.base_url) || "";
    if (!url.startsWith("http")) {
      toast.error("Base URL?");
      return;
    }
    const started = Date.now();
    try {
      await fetch(url, { method: "GET", mode: "no-cors" });
      toast.success(`${row.label}: ${Date.now() - started}ms`);
    } catch {
      toast.error(`${row.label}: unreachable`);
    }
  }

  const visible = useMemo(
    () => (rows.data ?? []).filter((r) => cat === "all" || r.category === cat),
    [rows.data, cat],
  );

  const catLabel = (c: string) =>
    c === "messaging" ? t("messaging") : c === "payment" ? t("paymentGateway") : t("other");

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("apiHub")}</h1>
          <p className="text-sm text-muted-foreground">{t("apiHubHint")}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-1 size-4" /> {t("addApi")}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", ...CATEGORIES] as const).map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>
            {c === "all" ? t("all") : catLabel(c)}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {visible.map((row) => {
          const d = drafts[row.id] ?? {};
          const set = (patch: Partial<ApiRow> & { extraText?: string }) =>
            setDrafts((s) => ({ ...s, [row.id]: { ...s[row.id], ...patch } }));
          const dirty = Object.keys(d).length > 0;
          const enabled = d.enabled ?? row.enabled;
          return (
            <div key={row.id} className="surface-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Plug className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{d.label ?? row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.provider} · {catLabel(d.category ?? row.category)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{enabled ? t("enabled") : t("disabled")}</span>
                  <Switch checked={enabled} onCheckedChange={(v) => set({ enabled: v })} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={t("baseUrl")}>
                  <Input value={d.base_url ?? row.base_url ?? ""} onChange={(e) => set({ base_url: e.target.value })} />
                </Field>
                <Field label={t("senderId")}>
                  <Input
                    value={d.sender_id ?? row.sender_id ?? ""}
                    onChange={(e) => set({ sender_id: e.target.value })}
                  />
                </Field>
                <Field label={t("apiKey")}>
                  <div className="flex gap-1">
                    <Input
                      type={reveal[row.id] ? "text" : "password"}
                      value={d.api_key ?? row.api_key ?? ""}
                      onChange={(e) => set({ api_key: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setReveal((s) => ({ ...s, [row.id]: !s[row.id] }))}
                    >
                      {reveal[row.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </Field>
                <Field label={t("apiSecret")}>
                  <Input
                    type={reveal[row.id] ? "text" : "password"}
                    value={d.api_secret ?? row.api_secret ?? ""}
                    onChange={(e) => set({ api_secret: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("extraJson")}>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      value={d.extraText ?? JSON.stringify(row.extra ?? {}, null, 2)}
                      onChange={(e) => set({ extraText: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t("notes")}>
                    <Input value={d.notes ?? row.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
                  </Field>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(row.id)}>
                  <Trash2 className="mr-1 size-4" /> {t("delete")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => testConnection(row)}>
                  <Wifi className="mr-1 size-4" /> {t("testConnection")}
                </Button>
                <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(row)}>
                  <Save className="mr-1 size-4" /> {t("save")}
                </Button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">{rows.isLoading ? t("loading") : t("noData")}</p>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addApi")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("provider")}>
              <Input
                value={newRow.provider}
                placeholder="e.g. twilio"
                onChange={(e) => setNewRow({ ...newRow, provider: e.target.value })}
              />
            </Field>
            <Field label={t("name")}>
              <Input value={newRow.label} onChange={(e) => setNewRow({ ...newRow, label: e.target.value })} />
            </Field>
            <Field label={t("category")}>
              <div className="flex gap-2">
                {CATEGORIES.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={newRow.category === c ? "default" : "outline"}
                    onClick={() => setNewRow({ ...newRow, category: c })}
                  >
                    {catLabel(c)}
                  </Button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
