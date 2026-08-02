import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { askAssistant, type AssistantTurn } from "@/lib/assistant.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI business assistant — Bazar Bari" },
      { name: "description", content: "Ask about sales, dues, stock and profit in Bengali and get instant answers." },
      { property: "og:title", content: "AI business assistant — Bazar Bari" },
      { property: "og:description", content: "Live shop insights on sales, dues and stock, in Bengali or English." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { lang } = useI18n();
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    L("আজকের বিক্রি কেমন?", "How are today's sales?"),
    L("কোন কাস্টমারদের কাছে বেশি বাকি?", "Who owes the most?"),
    L("কোন পণ্য দ্রুত রিস্টক করা দরকার?", "Which products need restocking?"),
    L("এই মাসের লাভ বাড়ানোর পরামর্শ দিন", "How can I improve this month's profit?"),
  ];

  const send = useMutation({
    mutationFn: async (text: string) => {
      const next: AssistantTurn[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await ask({ data: { messages: next, lang } });
      return res.reply;
    },
    onSuccess: (reply) => setMessages((m) => [...m, { role: "assistant", content: reply }]),
    onError: (e: Error) => {
      const msg =
        e.message.includes("rate_limit")
          ? L("অনেক বেশি অনুরোধ — একটু পরে চেষ্টা করুন।", "Too many requests — try again shortly.")
          : e.message.includes("no_credits")
            ? L("AI ক্রেডিট শেষ। ওয়ার্কস্পেস সেটিংসে ক্রেডিট যোগ করুন।", "AI credits exhausted. Add credits in workspace settings.")
            : L("উত্তর আনা যায়নি।", "Could not get a reply.");
      toast.error(msg);
      setMessages((m) => m.slice(0, -1));
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, send.isPending]);

  function submit(text: string) {
    const q = text.trim();
    if (!q || send.isPending) return;
    setInput("");
    send.mutate(q);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
      <header className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <div>
          <h1 className="font-display text-xl font-bold">{L("AI ব্যবসা সহকারী", "AI business assistant")}</h1>
          <p className="text-xs text-muted-foreground">
            {L("আপনার দোকানের লাইভ তথ্য দেখে উত্তর দেয়", "Answers from your shop's live data")}
          </p>
        </div>
      </header>

      <div className="surface-panel mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {L("ভাবছি…", "Thinking…")}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={L("প্রশ্ন লিখুন…", "Ask a question…")}
            className="min-w-0"
          />
          <Button type="submit" disabled={send.isPending || !input.trim()} className="shrink-0">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
