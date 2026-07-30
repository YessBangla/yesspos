import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

type Feedback = {
  id: string;
  kind: string;
  message: string | null;
  rating: number | null;
  resolved: boolean;
  created_at: string;
};

/** Customer feedback (confirm / issue) received for one delivery order. */
export function OrderFeedback({ orderId }: { orderId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["delivery-feedback", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_feedback")
        .select("id,kind,message,rating,resolved,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Feedback[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_feedback")
        .update({ resolved: true })
        .eq("id", id);
      if (error) throw error;
      await logAudit("delivery_feedback_resolve", {
        entity: "delivery_feedback",
        entityId: id,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["delivery-feedback", orderId] });
      toast.success(bn ? "সমাধান হয়েছে" : "Marked resolved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = list.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-1 text-sm font-semibold">
        <MessageSquareWarning className="size-4 text-primary" />
        {bn ? "গ্রাহক ফিডব্যাক" : "Customer feedback"}
      </p>
      <ol className="space-y-2">
        {rows.map((f) => (
          <li key={f.id} className="rounded-md bg-muted/60 p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  f.kind === "issue"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                {f.kind === "issue"
                  ? bn
                    ? "সমস্যা"
                    : "Issue"
                  : bn
                    ? "ডেলিভারি কনফার্ম"
                    : "Delivery confirmed"}
              </span>
              <span className="text-muted-foreground">
                {f.created_at.slice(0, 16).replace("T", " ")}
              </span>
              {f.resolved ? (
                <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
                  <CheckCircle2 className="size-3" /> {bn ? "সমাধান হয়েছে" : "Resolved"}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 px-2 text-[10px]"
                  onClick={() => resolve.mutate(f.id)}
                  disabled={resolve.isPending}
                >
                  {bn ? "সমাধান হয়েছে" : "Mark resolved"}
                </Button>
              )}
            </div>
            {f.message && <p className="mt-1">{f.message}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
