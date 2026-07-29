import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { countPendingSales, subscribePending, syncPendingSales } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

/**
 * Header pill: shows connection state plus how many sales are waiting to sync.
 * Auto-syncs whenever the browser comes back online.
 */
export function OfflineIndicator() {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    void countPendingSales().then(setPending);
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    const { synced, failed } = await syncPendingSales();
    setSyncing(false);
    refresh();
    if (synced) {
      toast.success(
        lang === "bn" ? `${synced}টি অফলাইন বিক্রয় সিঙ্ক হয়েছে` : `${synced} offline sales synced`,
      );
      queryClient.invalidateQueries();
    }
    if (failed)
      toast.error(lang === "bn" ? `${failed}টি সিঙ্ক করা যায়নি` : `${failed} could not sync`);
  }, [lang, queryClient, refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const unsub = subscribePending(refresh);

    function goOnline() {
      setOnline(true);
      void runSync();
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void runSync();

    return () => {
      unsub();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refresh, runSync]);

  if (online && pending === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        online
          ? "border-warning/40 bg-warning/15 text-warning-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {online ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />}
      <span className="hidden sm:inline">
        {online
          ? lang === "bn"
            ? "সিঙ্ক বাকি"
            : "Pending sync"
          : lang === "bn"
            ? "অফলাইন মোড"
            : "Offline mode"}
      </span>
      {pending > 0 && (
        <span className="rounded-full bg-background/70 px-1.5 py-0.5 tabular-nums">{pending}</span>
      )}
      {online && pending > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1"
          disabled={syncing}
          onClick={() => void runSync()}
        >
          <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
