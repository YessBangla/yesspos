import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { num, useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { useBranches } from "@/lib/use-branch";

export const Route = createFileRoute("/_authenticated/stock-transfers")({
  head: () => ({
    meta: [
      { title: "Stock transfers — Sokoler Bazar" },
      { name: "description", content: "Move inventory between shop branches and keep per-branch stock accurate." },
      { property: "og:title", content: "Stock transfers — Sokoler Bazar" },
      { property: "og:description", content: "Branch to branch inventory movement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockTransfersPage,
});

type Line = { product_id: string; name: string; qty: string };

function StockTransfersPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const branches = useBranches();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState("");

  const products = useQuery({
    queryKey: ["products-transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_en,name_bn,sku")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const transfers = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("id,from_branch_id,to_branch_id,note,transfer_date,stock_transfer_items(id,name_snapshot,quantity)")
        .order("transfer_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name ?? "—";

  const productName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products.data ?? []) map.set(p.id, lang === "bn" ? p.name_bn : p.name_en);
    return map;
  }, [products.data, lang]);

  const addLine = (productId: string) => {
    if (!productId || lines.some((l) => l.product_id === productId)) return;
    setLines([...lines, { product_id: productId, name: productName.get(productId) ?? "", qty: "1" }]);
    setPick("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!from || !to) throw new Error(t("sameBranchError"));
      if (from === to) throw new Error(t("sameBranchError"));
      const items = lines
        .map((l) => ({ ...l, quantity: Math.floor(Number(l.qty) || 0) }))
        .filter((l) => l.quantity > 0);
      if (items.length === 0) throw new Error(t("noItems"));
      const { data: userData } = await supabase.auth.getUser();
      const { data: transfer, error } = await supabase
        .from("stock_transfers")
        .insert({
          from_branch_id: from,
          to_branch_id: to,
          note: note.trim() || null,
          user_id: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemErr } = await supabase.from("stock_transfer_items").insert(
        items.map((l) => ({
          transfer_id: transfer.id,
          product_id: l.product_id,
          name_snapshot: l.name,
          quantity: l.quantity,
        })),
      );
      if (itemErr) throw itemErr;
    },
    onSuccess: () => {
      void logAudit("stock_transfer", { entity: "stock_transfer" });
      setOpen(false);
      setLines([]);
      setNote("");
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      qc.invalidateQueries({ queryKey: ["branch-stock"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-all"] });
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("stockTransfer")}</h1>
          <p className="text-sm text-muted-foreground">{t("stockTransferHint")}</p>
        </div>
        <Button
          onClick={() => {
            setFrom(branches.data?.[0]?.id ?? "");
            setTo(branches.data?.[1]?.id ?? "");
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> {t("newTransfer")}
        </Button>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("fromBranch")}</th>
              <th className="px-4 py-3">{t("toBranch")}</th>
              <th className="px-4 py-3">{t("transferItems")}</th>
              <th className="px-4 py-3">{t("note")}</th>
            </tr>
          </thead>
          <tbody>
            {(transfers.data ?? []).map((tr) => (
              <tr key={tr.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{tr.transfer_date}</td>
                <td className="px-4 py-3">{branchName(tr.from_branch_id)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <ArrowRightLeft className="size-3 text-muted-foreground" />
                    {branchName(tr.to_branch_id)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(tr.stock_transfer_items ?? [])
                    .map((i) => `${i.name_snapshot} × ${num(i.quantity, lang)}`)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tr.note ?? "—"}</td>
              </tr>
            ))}
            {(transfers.data ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                  {transfers.isLoading ? t("loading") : t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("newTransfer")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("fromBranch")}</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue placeholder={t("branchName")} />
                </SelectTrigger>
                <SelectContent>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("toBranch")}</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue placeholder={t("branchName")} />
                </SelectTrigger>
                <SelectContent>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("transferItems")}</Label>
              <Select value={pick} onValueChange={addLine}>
                <SelectTrigger>
                  <SelectValue placeholder={t("search")} />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(lang === "bn" ? p.name_bn : p.name_en) + ` · ${p.sku}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.product_id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{l.name}</span>
                <Input
                  className="w-24"
                  inputMode="numeric"
                  value={l.qty}
                  onChange={(e) =>
                    setLines(lines.map((x, xi) => (xi === i ? { ...x, qty: e.target.value } : x)))
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  onClick={() => setLines(lines.filter((_, xi) => xi !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{t("note")}</Label>
            <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
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
