import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { askCare, type CareTurn } from "@/lib/care-chat.functions";
import { toast } from "sonner";
import logoMark from "@/assets/bazar-bari-mark.png";

const STORE_KEY = "bazar-bari-care-chat";

function loadHistory(): CareTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CareTurn[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

/** Floating "Bazar Bari Care" support chat, available on the public website. */
export function CareChat() {
  const { lang } = useI18n();
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const ask = useServerFn(askCare);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CareTurn[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage full or blocked — chat still works for this session */
    }
  }, [messages]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const next: CareTurn[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await ask({ data: { messages: next, lang } });
      return res.reply;
    },
    onSuccess: (reply) => setMessages((m) => [...m, { role: "assistant", content: reply }]),
    onError: (e: Error) => {
      const msg = e.message.includes("rate_limit")
        ? L("একটু বেশি অনুরোধ হয়ে গেছে — কিছুক্ষণ পরে আবার চেষ্টা করুন।", "Too many requests — please try again shortly.")
        : e.message.includes("no_credits")
          ? L("সেবাটি সাময়িকভাবে বন্ধ আছে।", "The service is temporarily unavailable.")
          : L("উত্তর আনা যায়নি, আবার চেষ্টা করুন।", "Could not get a reply, please try again.");
      toast.error(msg);
      setMessages((m) => m.slice(0, -1));
    },
  });

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, send.isPending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, send.isPending]);

  const suggestions = [
    L("ডেলিভারি চার্জ ও সময় কত?", "What is the delivery fee and time?"),
    L("অর্ডার কীভাবে ট্র্যাক করবো?", "How do I track my order?"),
    L("কী কী পেমেন্ট মাধ্যম আছে?", "Which payment methods do you accept?"),
    L("পয়েন্ট বা ছাড় কীভাবে পাবো?", "How do loyalty points work?"),
  ];

  function submit(text: string) {
    const q = text.trim();
    if (!q || send.isPending) return;
    setInput("");
    send.mutate(q);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={L("বাজার বাড়ি কেয়ার চ্যাট খুলুন", "Open Bazar Bari Care chat")}
          className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110"
        >
          <MessageCircle className="size-5" aria-hidden />
          <span className="hidden sm:inline">Bazar Bari Care</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 end-0 z-50 flex h-[min(560px,88vh)] w-full max-w-[400px] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:bottom-5 sm:end-5 sm:rounded-2xl">
          <header className="flex items-center gap-2.5 border-b border-border bg-primary px-3 py-2.5 text-primary-foreground">
            <img src={logoMark} alt="" width={32} height={32} className="size-8 rounded-lg bg-card object-contain p-0.5" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold">Bazar Bari Care</p>
              <p className="truncate text-[11px] opacity-90">
                {L("আপনার প্রশ্নের তাৎক্ষণিক উত্তর", "Instant answers about your bazar")}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                aria-label={L("চ্যাট মুছুন", "Clear chat")}
                className="rounded-md p-1.5 hover:bg-black/10"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={L("বন্ধ করুন", "Close chat")}
              className="rounded-md p-1.5 hover:bg-black/10"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {L(
                    "আসসালামু আলাইকুম! বাজার বাড়ি সম্পর্কে যেকোনো প্রশ্ন করুন — পণ্য, দাম, ডেলিভারি বা অর্ডার।",
                    "Hello! Ask anything about Bazar Bari — products, prices, delivery or your order.",
                  )}
                </p>
                <div className="grid gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {send.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {L("লিখছি…", "Typing…")}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-border p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={L("আপনার প্রশ্ন লিখুন…", "Type your question…")}
              aria-label={L("আপনার প্রশ্ন", "Your question")}
              className="min-w-0"
            />
            <Button type="submit" size="icon" disabled={send.isPending || !input.trim()} className="shrink-0">
              <Send className="size-4" aria-hidden />
              <span className="sr-only">{L("পাঠান", "Send")}</span>
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

export default CareChat;
