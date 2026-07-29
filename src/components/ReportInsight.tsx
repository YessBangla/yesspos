import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getReportInsight } from "@/lib/insights.functions";
import { useI18n } from "@/lib/i18n";

/** Renders very small markdown: **bold**, bullets and numbered headings. */
function InsightText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text
        .split("\n")
        .filter((l) => l.trim())
        .map((line, i) => {
          const bullet = /^\s*([-*•]|\d+\.)\s+/.test(line);
          const clean = line.replace(/^\s*([-*•]|\d+\.)\s+/, "");
          const parts = clean.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} className={bullet ? "pl-4 -indent-3 before:mr-1 before:content-['•']" : "font-medium"}>
              {parts.map((p, j) =>
                p.startsWith("**") ? (
                  <strong key={j} className="text-foreground">
                    {p.slice(2, -2)}
                  </strong>
                ) : (
                  <span key={j}>{p}</span>
                ),
              )}
            </p>
          );
        })}
    </div>
  );
}

export function ReportInsight({ from, to }: { from: string; to: string }) {
  const { lang } = useI18n();
  const [text, setText] = useState("");
  const ask = useServerFn(getReportInsight);

  const run = useMutation({
    mutationFn: async () => ask({ data: { from, to, lang } }),
    onSuccess: (r) => setText(r.insight),
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.includes("rate_limit")
          ? lang === "bn"
            ? "একটু পরে আবার চেষ্টা করুন"
            : "Rate limited — try again shortly"
          : msg.includes("no_credits")
            ? lang === "bn"
              ? "AI ক্রেডিট শেষ"
              : "AI credits exhausted"
            : lang === "bn"
              ? "বিশ্লেষণ করা গেল না"
              : "Could not generate insight",
      );
    },
  });

  return (
    <div className="surface-panel mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold">{lang === "bn" ? "AI ব্যবসা বিশ্লেষণ" : "AI business insight"}</h2>
            <p className="text-xs text-muted-foreground">
              {lang === "bn"
                ? "এই সময়ের বিক্রি, বকেয়া, স্টক ও খরচ দেখে করণীয় পরামর্শ"
                : "Read-out and recommended actions for this period"}
            </p>
          </div>
        </div>
        <Button size="sm" variant={text ? "outline" : "default"} onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
          {text ? (lang === "bn" ? "আবার বিশ্লেষণ" : "Re-analyse") : lang === "bn" ? "বিশ্লেষণ করুন" : "Analyse"}
        </Button>
      </div>

      {text ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <InsightText text={text} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {lang === "bn"
            ? "উপরের তারিখ অনুযায়ী লাইভ ডেটা থেকে সংক্ষিপ্ত বিশ্লেষণ ও পরবর্তী পদক্ষেপ পেতে বোতামে চাপ দিন।"
            : "Press the button to get a short, data-backed read-out with next actions."}
        </p>
      )}
    </div>
  );
}
