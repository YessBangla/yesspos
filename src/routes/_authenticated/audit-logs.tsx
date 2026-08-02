import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMyRole } from "@/lib/use-my-role";
import { isAdminRole } from "@/lib/permissions";
import { downloadCsv } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit log — Bazar Bari" },
      { name: "description", content: "See every login and important action taken in your shop account." },
      { property: "og:title", content: "Audit log — Bazar Bari" },
      { property: "og:description", content: "Login history and important action trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogPage,
});

type Row = {
  id: string;
  username: string | null;
  action: string;
  entity: string | null;
  details: string | null;
  created_at: string;
};

const actionKey: Record<string, string> = {
  login: "actLogin",
  logout: "actLogout",
  sale: "actSale",
  sale_return: "actSaleReturn",
  product_create: "actProductCreate",
  product_update: "actProductUpdate",
  product_delete: "actProductDelete",
  user_create: "actUserCreate",
  user_delete: "actUserDelete",
  role_update: "actRoleUpdate",
  password_reset: "actPasswordReset",
  payment: "actPayment",
  stock_adjust: "actStockAdjust",
  purchase: "actPurchase",
  expense: "actExpense",
  settings_update: "actSettings",
};

function AuditLogPage() {
  const { t } = useI18n();
  const me = useMyRole();
  const [query, setQuery] = useState("");

  const logs = useQuery({
    queryKey: ["audit-logs"],
    enabled: isAdminRole(me.data?.role),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, username, action, entity, details, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Row[];
    },
  });

  const label = (a: string) => (actionKey[a] ? t(actionKey[a] as never) : a);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (logs.data ?? []).filter(
      (r) =>
        !q ||
        (r.username ?? "").toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.details ?? "").toLowerCase().includes(q),
    );
  }, [logs.data, query]);

  if (me.isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>;

  if (!isAdminRole(me.data?.role)) {
    return (
      <div className="p-6">
        <div className="surface-panel mx-auto max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">{t("auditLog")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("adminOnly")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("auditLog")}</h1>
          <p className="text-sm text-muted-foreground">{t("auditLogHint")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Time", "User", "Action", "Entity", "Details"],
              rows.map((r) => [
                new Date(r.created_at).toLocaleString(),
                r.username ?? "",
                r.action,
                r.entity ?? "",
                r.details ?? "",
              ]),
            )
          }
        >
          <Download className="mr-2 size-4" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} />
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("time")}</th>
              <th className="px-4 py-3 font-medium">{t("user")}</th>
              <th className="px-4 py-3 font-medium">{t("action")}</th>
              <th className="px-4 py-3 font-medium">{t("details")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{r.username ?? "—"}</td>
                <td className="px-4 py-3">{label(r.action)}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.details ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
