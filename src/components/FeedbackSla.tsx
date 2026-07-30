import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CheckCircle2, Clock, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  order_id: string | null;
  order_no: number | null;
  customer_phone: string | null;
  kind: string;
  message: string | null;
  severity: string;
  resolved: boolean;
  resolved_at: string | null;
  escalated: boolean;
  escalated_at: string | null;
  due_at: string | null;
  created_at: string;
};

type Filter = "open" | "overdue" | "escalated" | "all";

function minutesLeft(due: string | null) {
  if (!due) return null;
  return Math.round((new Date(due).getTime() - Date.now()) / 60000);
}

/** SLA + escalation board for customer delivery feedback (confirm / issue). */
export function FeedbackSla() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const list = useQuery({
    queryKey: ["feedback-sla"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_feedback")
        .select(
          "id,order_id,order_no,customer_phone,kind,message,severity,resolved,resolved_at,escalated,escalated_at,due_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const escalate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("escalate_overdue_feedback");
      if (error) throw error;
      await logAudit("delivery_feedback_escalate", {
        entity: "delivery_feedback",
        details: `${data ?? 0} escalated`,
      });
      return (data as number) ?? 0;
    },
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: ["feedback-sla"] });
      void qc.invalidateQueries({ queryKey: ["order-notifications"] });
      toast.success(
        n > 0
          ? bn
            ? `${n} টি ফিডব্যাক এস্কেলেট ও নোটিফাই করা হয়েছে`
            : `${n} feedback escalated & notified`
          : bn
            ? "কোনো SLA অতিক্রম হয়নি"
            : "No overdue feedback",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_feedback")
        .update({ resolved: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feedback-sla"] });
      toast.success(bn ? "সমাধান হয়েছে" : "Resolved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = list.data ?? [];
  const stats = useMemo(() => {
    const open = rows.filter((r) => !r.resolved);
    const overdue = open.filter((r) => (minutesLeft(r.due_at) ?? 1) < 0);
    return {
      open: open.length,
      overdue: overdue.length,
      escalated: open.filter((r) => r.escalated).length,
      issues: open.filter((r) => r.kind === "issue").length,
    };
  }, [rows]);

  const shown = rows.filter((r) => {
    if (filter === "all") return true;
    if (r.resolved) return false;
    if (filter === "overdue") return (minutesLeft(r.due_at) ?? 1) < 0;
    if (filter === "escalated") return r.escalated;
    return true;
  });

  const cards = [
    { label: bn ? "খোলা" : "Open", value: stats.open, icon: Clock },
    { label: bn ? "SLA পার" : "Overdue", value: stats.overdue, icon: Timer },
    { label: bn ? "এস্কেলেটেড" : "Escalated", value: stats.escalated, icon: AlertTriangle },
    { label: bn ? "সমস্যা" : "Issues", value: stats.issues, icon: BellRing },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {bn ? "ফিডব্যাক SLA ও এস্কেলেশন" : "Feedback SLA & escalation"}
        </h2>
        <Button
          size="sm"
          className="ml-auto"
          disabled={escalate.isPending}
          onClick={() => escalate.mutate()}
        >
          {escalate.isPending ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <BellRing className="mr-1 size-3.5" />
          )}
          {bn ? "সময় পেরোনো গুলো নোটিফাই" : "Notify overdue"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-muted/40 p-2">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <c.icon className="size-3.5" /> {c.label}
            </p>
            <p className="text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {(["open", "overdue", "escalated", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              filter === f
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {f === "open"
              ? bn
                ? "খোলা"
                : "Open"
              : f === "overdue"
                ? bn
                  ? "SLA পার"
                  : "Overdue"
                : f === "escalated"
                  ? bn
                    ? "এস্কেলেটেড"
                    : "Escalated"
                  : bn
                    ? "সব"
                    : "All"}
          </button>
        ))}
      </div>

      <ol className="mt-3 space-y-2">
        {shown.map((r) => {
          const left = minutesLeft(r.due_at);
          const overdue = !r.resolved && left != null && left < 0;
          return (
            <li
              key={r.id}
              className={cn(
                "rounded-lg border p-2 text-xs",
                overdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{r.order_no ?? "-"}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold",
                    r.kind === "issue"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {r.kind === "issue"
                    ? bn
                      ? "সমস্যা"
                      : "Issue"
                    : bn
                      ? "কনফার্ম"
                      : "Confirmed"}
                </span>
                {r.escalated && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700">
                    {bn ? "এস্কেলেটেড" : "Escalated"}
                  </span>
                )}
                {r.resolved ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-primary">
                    <CheckCircle2 className="size-3.5" /> {bn ? "সমাধান" : "Resolved"}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "ml-auto font-semibold",
                      overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {left == null
                      ? "—"
                      : overdue
                        ? bn
                          ? `${Math.abs(left)} মিনিট দেরি`
                          : `${Math.abs(left)} min late`
                        : bn
                          ? `${left} মিনিট বাকি`
                          : `${left} min left`}
                  </span>
                )}
              </div>
              {r.message && <p className="mt-1">{r.message}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {r.customer_phone ?? ""} · {r.created_at.slice(0, 16).replace("T", " ")}
              </p>
              {!r.resolved && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 h-7 text-[11px]"
                  onClick={() => resolve.mutate(r.id)}
                >
                  {bn ? "সমাধান হয়েছে" : "Mark resolved"}
                </Button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {bn ? "কোনো ফিডব্যাক নেই।" : "No feedback here."}
          </li>
        )}
      </ol>
    </section>
  );
}
