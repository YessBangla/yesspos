import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, num } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { useBranches, type Branch } from "@/lib/use-branch";

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({
    meta: [
      { title: "Branches — Bazar Bari" },
      { name: "description", content: "Create and manage multiple shop branches, each with its own stock and transactions." },
      { property: "og:title", content: "Branches — Bazar Bari" },
      { property: "og:description", content: "Multi-branch management for your shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BranchesPage,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(20),
});

const emptyForm = { name: "", code: "", address: "", phone: "", is_active: true };

function BranchesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const branches = useBranches();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const stock = useQuery({
    queryKey: ["branch-stock-totals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_stock").select("branch_id,stock");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) map.set(r.branch_id, (map.get(r.branch_id) ?? 0) + Number(r.stock ?? 0));
      return map;
    },
  });

  const staff = useQuery({
    queryKey: ["branch-staff-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("branch_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) if (r.branch_id) map.set(r.branch_id, (map.get(r.branch_id) ?? 0) + 1);
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("branches").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void logAudit(editing ? "branch_update" : "branch_create", { entity: "branch" });
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function startEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code,
      address: b.address ?? "",
      phone: b.phone ?? "",
      is_active: b.is_active,
    });
    setOpen(true);
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("branches")}</h1>
          <p className="text-sm text-muted-foreground">{t("branchesHint")}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm({ ...emptyForm });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> {t("addBranch")}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(branches.data ?? []).map((b) => (
          <div key={b.id} className="surface-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="font-medium">{b.name}</span>
              </div>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(b)}>
                <Pencil className="size-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs uppercase text-muted-foreground">{b.code}</p>
            {b.address && <p className="mt-1 text-sm text-muted-foreground">{b.address}</p>}
            {b.phone && <p className="text-sm text-muted-foreground">{b.phone}</p>}
            <div className="mt-3 flex gap-4 text-sm">
              <span>
                {t("branchStock")}: <strong>{num(stock.data?.get(b.id) ?? 0, lang)}</strong>
              </span>
              <span>
                {t("usersRoles")}: <strong>{num(staff.data?.get(b.id) ?? 0, lang)}</strong>
              </span>
            </div>
            {!b.is_active && <p className="mt-2 text-xs text-destructive">{t("branchActive")}: —</p>}
          </div>
        ))}
        {(branches.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">{branches.isLoading ? t("loading") : t("noData")}</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("branches") : t("addBranch")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("branchName")}</Label>
              <Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("branchCode")}</Label>
              <Input
                value={form.code}
                maxLength={20}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("address")}</Label>
              <Input value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("phone")}</Label>
              <Input value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="branch-active"
                type="checkbox"
                className="size-4"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <Label htmlFor="branch-active">{t("branchActive")}</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
