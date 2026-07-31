import { supabase } from "@/integrations/supabase/client";

/** Tables included in a site backup, with the column used for day filtering (null = full table). */
export const BACKUP_TABLES = [
  { name: "business_settings", dateCol: null },
  { name: "branches", dateCol: null },
  { name: "categories", dateCol: null },
  { name: "brands", dateCol: null },
  { name: "units", dateCol: null },
  { name: "products", dateCol: "created_at" },
  { name: "product_stock", dateCol: null },
  { name: "contacts", dateCol: "created_at" },
  { name: "sales", dateCol: "created_at" },
  { name: "sale_items", dateCol: "created_at" },
  { name: "sale_returns", dateCol: "created_at" },
  { name: "sale_return_items", dateCol: null },
  { name: "purchases", dateCol: "purchased_on" },
  { name: "purchase_items", dateCol: null },
  { name: "purchase_returns", dateCol: "created_at" },
  { name: "purchase_return_items", dateCol: null },
  { name: "payments", dateCol: "created_at" },
  { name: "expenses", dateCol: "spent_on" },
  { name: "expense_categories", dateCol: null },
  { name: "accounts", dateCol: null },
  { name: "account_transactions", dateCol: "created_at" },
  { name: "ledger_accounts", dateCol: null },
  { name: "journal_entries", dateCol: "created_at" },
  { name: "journal_lines", dateCol: null },
  { name: "stock_adjustments", dateCol: "created_at" },
  { name: "stock_transfers", dateCol: "created_at" },
  { name: "stock_transfer_items", dateCol: null },
  { name: "delivery_orders", dateCol: "created_at" },
  { name: "delivery_order_items", dateCol: null },
  { name: "delivery_zones", dateCol: null },
  { name: "delivery_riders", dateCol: null },
  { name: "coupons", dateCol: "created_at" },
  { name: "promotions", dateCol: "created_at" },
  { name: "loyalty_ledger", dateCol: "created_at" },
  { name: "customer_addresses", dateCol: "created_at" },
  { name: "customer_notifications", dateCol: "created_at" },
  { name: "product_reviews", dateCol: "created_at" },
  { name: "media_assets", dateCol: "created_at" },
  { name: "site_content", dateCol: null },
  { name: "audit_logs", dateCol: "created_at" },
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number]["name"];

export type BackupFile = {
  format: "sokoler-bazar-backup";
  version: 1;
  exported_at: string;
  from: string;
  to: string;
  scope: "day" | "range" | "full";
  tables: Record<string, Record<string, unknown>[]>;
};

const PAGE = 1000;

/** Read every row of a table for the given day/range (or all rows when the table has no date column). */
async function fetchTable(
  name: string,
  dateCol: string | null,
  from: string,
  to: string,
  full: boolean,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; ; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabase.from as any)(name).select("*").range(page * PAGE, page * PAGE + PAGE - 1);
    if (!full && dateCol) {
      const isTimestamp = dateCol === "created_at";
      q = isTimestamp
        ? q.gte(dateCol, new Date(`${from}T00:00:00`).toISOString()).lte(dateCol, new Date(`${to}T23:59:59`).toISOString())
        : q.gte(dateCol, from).lte(dateCol, to);
    }
    const { data, error } = await q;
    if (error) throw new Error(`${name}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

export async function buildBackup(
  from: string,
  to: string,
  full: boolean,
  onProgress?: (table: string, index: number, total: number) => void,
): Promise<BackupFile> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const t = BACKUP_TABLES[i];
    onProgress?.(t.name, i + 1, BACKUP_TABLES.length);
    try {
      tables[t.name] = await fetchTable(t.name, t.dateCol, from, to, full);
    } catch {
      tables[t.name] = [];
    }
  }
  return {
    format: "sokoler-bazar-backup",
    version: 1,
    exported_at: new Date().toISOString(),
    from,
    to,
    scope: full ? "full" : from === to ? "day" : "range",
    tables,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed?.format !== "sokoler-bazar-backup" || typeof parsed.tables !== "object") {
    throw new Error("Invalid backup file");
  }
  return parsed;
}

export type RestoreResult = { table: string; inserted: number; failed: number; error?: string };

/** Upsert every row back into the database, table by table, in dependency order. */
export async function restoreBackup(
  file: BackupFile,
  only: string[] | null,
  onProgress?: (table: string, index: number, total: number) => void,
): Promise<RestoreResult[]> {
  const names = BACKUP_TABLES.map((t) => t.name).filter(
    (n) => (!only || only.includes(n)) && (file.tables[n]?.length ?? 0) > 0,
  );
  const results: RestoreResult[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    onProgress?.(name, i + 1, names.length);
    const rows = file.tables[name] ?? [];
    let inserted = 0;
    let failed = 0;
    let firstError: string | undefined;
    for (let s = 0; s < rows.length; s += 200) {
      const chunk = rows.slice(s, s + 200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)(name).upsert(chunk, { onConflict: "id" });
      if (error) {
        failed += chunk.length;
        firstError ??= error.message;
      } else {
        inserted += chunk.length;
      }
    }
    results.push({ table: name, inserted, failed, error: firstError });
  }
  return results;
}
