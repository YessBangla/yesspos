import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "login"
  | "logout"
  | "sale"
  | "sale_return"
  | "product_create"
  | "product_update"
  | "product_delete"
  | "user_create"
  | "user_delete"
  | "role_update"
  | "password_reset"
  | "payment"
  | "stock_adjust"
  | "purchase"
  | "expense"
  | "settings_update"
  | "account_create"
  | "account_txn"
  | "journal_entry"
  | "ledger_account"
  | "branch_create"
  | "branch_update"
  | "stock_transfer"
  | "contact_create"
  | "delivery_order"
  | "zone_create"
  | "zone_update"
  | "zone_delete"
  | "rider_create"
  | "rider_update"
  | "rider_delete"
  | "promotion_create"
  | "promotion_update"
  | "promotion_delete"
  | "review_moderate"
  | "delivery_proof_upload"
  | "delivery_proof_verify"
  | "delivery_feedback_escalate"
  | "delivery_feedback_resolve";


/** Fire-and-forget audit trail entry. Never blocks or breaks the calling flow. */
export async function logAudit(
  action: AuditAction,
  opts: { entity?: string; entityId?: string | null; details?: string } = {},
) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? null,
      action,
      entity: opts.entity ?? null,
      entity_id: opts.entityId ?? null,
      details: opts.details?.slice(0, 300) ?? null,
    });
  } catch {
    /* audit logging must never surface errors to the user */
  }
}

/** Build and download a CSV file in the browser. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
