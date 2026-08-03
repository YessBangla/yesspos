import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, FileText, Mail, Phone, ShieldCheck, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const SITE = "https://yesspos.lovable.app";

/** Corporate / B2B page: company profile and bulk supply enquiries. */
export const Route = createFileRoute("/corporate")({
  head: () => ({
    meta: [
      { title: "Corporate & bulk supply — Bazar Bari" },
      {
        name: "description",
        content:
          "Bazar Bari corporate desk: monthly grocery supply, pantry restocking and invoiced bulk orders for offices, factories and institutions in Bangladesh.",
      },
      { property: "og:title", content: "Corporate & bulk supply — Bazar Bari" },
      {
        property: "og:description",
        content: "Invoiced bulk grocery supply and pantry management for offices and institutions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/corporate` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Corporate & bulk supply — Bazar Bari" },
      {
        name: "twitter:description",
        content: "Invoiced bulk grocery supply and pantry management for offices and institutions.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE}/corporate` }],
  }),
  component: CorporatePage,
});

function CorporatePage() {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const services = [
    {
      icon: Building2,
      title: bn ? "অফিস প্যান্ট্রি সরবরাহ" : "Office pantry supply",
      body: bn
        ? "চা, কফি, চিনি, পানি ও দৈনন্দিন প্যান্ট্রি পণ্যের নিয়মিত সরবরাহ।"
        : "Recurring supply of tea, coffee, sugar, water and everyday pantry items.",
    },
    {
      icon: Truck,
      title: bn ? "নির্ধারিত ডেলিভারি সূচি" : "Scheduled delivery",
      body: bn
        ? "সাপ্তাহিক বা মাসিক নির্ধারিত সময়ে আপনার প্রতিষ্ঠানে পৌঁছে দেওয়া হয়।"
        : "Weekly or monthly delivery windows agreed with your facilities team.",
    },
    {
      icon: FileText,
      title: bn ? "চালান ও ক্রেডিট" : "Invoicing & credit",
      body: bn
        ? "প্রতিষ্ঠানের নামে চালান, স্টেটমেন্ট ও অনুমোদিত ক্রেডিট সীমা।"
        : "Company-name invoices, monthly statements and approved credit limits.",
    },
    {
      icon: Users,
      title: bn ? "ডেডিকেটেড ম্যানেজার" : "Dedicated manager",
      body: bn
        ? "একজন অ্যাকাউন্ট ম্যানেজার অর্ডার ও অভিযোগ দেখভাল করেন।"
        : "One account manager owns your orders, returns and escalations.",
    },
    {
      icon: ShieldCheck,
      title: bn ? "মান নিয়ন্ত্রণ" : "Quality control",
      body: bn
        ? "মেয়াদ, ওজন ও প্যাকেজিং যাচাই করে প্রতিটি চালান পাঠানো হয়।"
        : "Every consignment is checked for expiry, weight and packaging.",
    },
    {
      icon: Phone,
      title: bn ? "অগ্রাধিকার সাপোর্ট" : "Priority support",
      body: bn
        ? "কর্মদিবসে সকাল ৮টা থেকে রাত ১০টা পর্যন্ত হটলাইন সেবা।"
        : "Hotline coverage from 8am to 10pm on all working days.",
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {bn ? "দোকানে ফিরুন" : "Back to shop"}
          </Link>
          <Link to="/signin" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            {bn ? "লগইন" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {bn ? "বাজার বাড়ি কর্পোরেট" : "Bazar Bari Corporate"}
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            {bn
              ? "প্রতিষ্ঠানের জন্য নির্ভরযোগ্য মাসিক বাজার সরবরাহ"
              : "Dependable monthly grocery supply for your organisation"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {bn
              ? "বাজার বাড়ি — শোন্ধান-এর একটি উদ্যোগ, ইয়েস বাংলা প্রাইভেট লিমিটেড-এর সহযোগী প্রতিষ্ঠান। অফিস, কারখানা, হাসপাতাল ও শিক্ষাপ্রতিষ্ঠানে চালানভিত্তিক বাল্ক সরবরাহ দিয়ে থাকি।"
              : "Bazar Bari is part of Shondhaan, a sister concern of Yess Bangla Private Limited. We supply offices, factories, hospitals and campuses with invoiced bulk grocery orders."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="h-11 rounded-full px-6">
              <a href="mailto:corporate@bazarbari.com">
                <Mail className="mr-1.5 size-4" />
                {bn ? "কর্পোরেট ডেস্কে লিখুন" : "Email the corporate desk"}
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-6">
              <a href="tel:16710">
                <Phone className="mr-1.5 size-4" />
                16710
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-xl font-bold">{bn ? "আমরা যা দিই" : "What we provide"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article key={s.title} className="rounded-2xl border border-border bg-card p-5">
              <s.icon className="size-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-10">
          <div className="min-w-[240px] flex-1">
            <h2 className="font-display text-lg font-bold">
              {bn ? "একটি কর্পোরেট অ্যাকাউন্ট খুলুন" : "Open a corporate account"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {bn
                ? "প্রতিষ্ঠানের নাম, মাসিক আনুমানিক চাহিদা ও যোগাযোগের তথ্য পাঠালে ১ কর্মদিবসের মধ্যে প্রস্তাব পাঠানো হবে।"
                : "Send your company name, estimated monthly volume and contact details — we respond with a proposal within one working day."}
            </p>
          </div>
          <Button asChild className="h-11 rounded-full px-6">
            <a href="mailto:corporate@bazarbari.com">{bn ? "প্রস্তাব চান" : "Request a proposal"}</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
