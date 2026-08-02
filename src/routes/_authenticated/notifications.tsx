import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { NotificationLog } from "@/components/NotificationLog";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "SMS notification log — Bazar Bari" },
      {
        name: "description",
        content:
          "Track every customer SMS: delivered, pending or failed, with one-click resend for failures.",
      },
      { property: "og:title", content: "SMS notification log — Bazar Bari" },
      {
        property: "og:description",
        content: "Monitor customer SMS delivery status and resend failed messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="gradient-brand grid size-10 place-items-center rounded-2xl text-primary-foreground">
          <MessageSquareText className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold">
            {bn ? "SMS নোটিফিকেশন লগ" : "SMS notification log"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "প্রতিটি বার্তার স্ট্যাটাস দেখুন — ব্যর্থ হলে এক ক্লিকে আবার পাঠান।"
              : "See every message's status and resend the failed ones in one click."}
          </p>
        </div>
      </header>
      <NotificationLog />
    </div>
  );
}
