import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CloudDownload, CloudUpload, DatabaseBackup, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useI18n, num } from "@/lib/i18n";
import { useMyRole } from "@/lib/use-my-role";
import { isAdminRole } from "@/lib/permissions";
import { logAudit, downloadCsv } from "@/lib/audit";
import { BACKUP_TABLES, buildBackup, downloadJson, parseBackup, restoreBackup, type BackupFile, type RestoreResult } from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/data-backup")({
  head: () => ({
    meta: [
      { title: "Daily data backup & restore — Bazar Bari" },
      { name: "description", content: "Download every day's shop data as a backup file and upload it again to restore." },
      { property: "og:title", content: "Daily data backup & restore — Bazar Bari" },
      { property: "og:description", content: "Export and import your full shop data, day by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataBackupPage,
});

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function DataBackupPage() {
  const { t, lang } = useI18n();
  const me = useMyRole();
  const today = iso(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [loaded, setLoaded] = useState<BackupFile | null>(null);
  const [results, setResults] = useState<RestoreResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (me.data && !isAdminRole(me.data.role)) {
    return (
      <div className="p-6">
        <div className="surface-panel flex items-center gap-3 p-6">
          <ShieldCheck className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>
        </div>
      </div>
    );
  }

  async function handleDownload() {
    setBusy("export");
    setProgress("");
    try {
      const file = await buildBackup(from, to, full, (table, i, total) => setProgress(`${table} (${i}/${total})`));
      const total = Object.values(file.tables).reduce((s, r) => s + r.length, 0);
      downloadJson(`bazar-bari-backup-${full ? "full" : from === to ? from : `${from}_${to}`}.json`, file);
      downloadCsv(
        `bazar-bari-backup-summary-${from}.csv`,
        [t("table"), t("rows")],
        Object.entries(file.tables).map(([k, v]) => [k, v.length]),
      );
      void logAudit("data_backup", { entity: "backup", details: `${file.scope} ${from}..${to} rows=${total}` });
      toast.success(`${t("backupReady")} — ${num(total, lang)} ${t("rows")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setLoaded(parseBackup(await f.text()));
      setResults(null);
    } catch {
      toast.error(t("invalidBackupFile"));
      setLoaded(null);
    }
  }

  async function handleRestore() {
    if (!loaded) return;
    if (!window.confirm(t("restoreConfirm"))) return;
    setBusy("import");
    setResults(null);
    try {
      const res = await restoreBackup(loaded, null, (table, i, total) => setProgress(`${table} (${i}/${total})`));
      setResults(res);
      const ok = res.reduce((s, r) => s + r.inserted, 0);
      void logAudit("data_restore", { entity: "backup", details: `${loaded.from}..${loaded.to} rows=${ok}` });
      toast.success(`${t("restoreDone")} — ${num(ok, lang)} ${t("rows")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  const loadedRows = loaded ? Object.entries(loaded.tables).filter(([, v]) => v.length > 0) : [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <DatabaseBackup className="size-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">{t("dataBackup")}</h1>
          <p className="text-sm text-muted-foreground">{t("dataBackupHint")}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="surface-panel p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <CloudDownload className="size-5" /> {t("downloadData")}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("from")}</Label>
              <Input type="date" value={from} disabled={full} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("to")}</Label>
              <Input type="date" value={to} disabled={full} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFrom(today);
                setTo(today);
                setFull(false);
              }}
            >
              {t("todayOnly")}
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="size-4" />
            {t("fullBackup")}
          </label>
          <Button className="mt-4" onClick={handleDownload} disabled={busy !== null}>
            <CloudDownload className="mr-1 size-4" />
            {busy === "export" ? `${t("loading")} ${progress}` : t("downloadBackup")}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{t("backupIncludes")}: {BACKUP_TABLES.length} {t("table")}</p>
        </section>

        <section className="surface-panel p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <CloudUpload className="size-5" /> {t("uploadData")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("uploadDataHint")}</p>
          <input ref={fileRef} type="file" accept="application/json" onChange={handlePick} className="mt-3 block w-full text-sm" />
          {loaded && (
            <div className="mt-3 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">
                {loaded.scope} · {loaded.from} → {loaded.to}
              </p>
              <p className="text-muted-foreground">
                {num(loadedRows.reduce((s, [, v]) => s + v.length, 0), lang)} {t("rows")} · {loadedRows.length} {t("table")}
              </p>
            </div>
          )}
          <Button className="mt-4" onClick={handleRestore} disabled={!loaded || busy !== null}>
            <CloudUpload className="mr-1 size-4" />
            {busy === "import" ? `${t("loading")} ${progress}` : t("restoreBackup")}
          </Button>
        </section>
      </div>

      {results && (
        <div className="surface-panel mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("table")}</th>
                <th className="px-4 py-3 text-right">{t("restored")}</th>
                <th className="px-4 py-3 text-right">{t("failed")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.table} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {r.table}
                    {r.error && <span className="ml-2 text-xs text-destructive">{r.error}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">{num(r.inserted, lang)}</td>
                  <td className="px-4 py-2.5 text-right">{num(r.failed, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
