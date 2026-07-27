import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Printer,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yess POS — Retail Billing, Inventory & Accounting" },
      {
        name: "description",
        content:
          "Yess POS is a browser point-of-sale and ERP for retail shops: fast billing, multi-branch inventory, dues, accounting and reports in Bengali and English.",
      },
      { property: "og:title", content: "Yess POS — Retail Billing, Inventory & Accounting" },
      {
        property: "og:description",
        content:
          "Fast billing, multi-branch stock, dues and payment ledgers, accounting and reports — all in one browser POS.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Yess POS",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Point of sale and ERP for retail shops: billing, inventory, dues, accounting and reports.",
          url: SITE,
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();
  const bn = lang === "bn";
  const L = (b: string, e: string) => (bn ? b : e);

  const modules = [
    {
      icon: ShoppingCart,
      title: L("পয়েন্ট অব সেল", "Point of Sale"),
      body: L(
        "বারকোড স্ক্যান, কুপন ও ডিসকাউন্ট, কিবোর্ড শর্টকাট এবং থার্মাল/A4 রসিদ প্রিন্ট।",
        "Barcode scan, coupons and discounts, keyboard shortcuts, thermal and A4 receipts.",
      ),
    },
    {
      icon: Boxes,
      title: L("ইনভেন্টরি", "Inventory"),
      body: L(
        "ক্যাটাগরি, ব্র্যান্ড, ইউনিট, স্টক অ্যাডজাস্টমেন্ট ও লো-স্টক অ্যালার্ট।",
        "Categories, brands, units, stock adjustments and low-stock alerts.",
      ),
    },
    {
      icon: Building2,
      title: L("মাল্টি ব্রাঞ্চ", "Multi-branch"),
      body: L(
        "শাখাভিত্তিক স্টক, শাখার মধ্যে ট্রান্সফার এবং শাখা অনুযায়ী রিপোর্ট।",
        "Per-branch stock, inter-branch transfers and branch-wise reporting.",
      ),
    },
    {
      icon: CreditCard,
      title: L("বাকি ও পেমেন্ট", "Dues & Payments"),
      body: L(
        "নগদ, ব্যাংক, বিকাশ, নগদসহ সব মাধ্যম; ডিউ কালেকশন ও পেমেন্ট লেজার।",
        "Cash, bank, bKash, Nagad and more; due collection and payment ledgers.",
      ),
    },
    {
      icon: Landmark,
      title: L("অ্যাকাউন্টিং", "Accounting"),
      body: L(
        "চার্ট অব অ্যাকাউন্টস, জার্নাল ভাউচার, ডে-বুক ও আর্থিক বিবরণী।",
        "Chart of accounts, journal vouchers, day book and financial statements.",
      ),
    },
    {
      icon: Truck,
      title: L("ক্রয় ও সরবরাহকারী", "Purchase & Suppliers"),
      body: L(
        "ক্রয় ইনভয়েস, ক্রয় রিটার্ন, সাপ্লায়ার প্রোফাইল ও পার্টি স্টেটমেন্ট।",
        "Purchase invoices, purchase returns, supplier profiles and party statements.",
      ),
    },
    {
      icon: BarChart3,
      title: L("রিপোর্ট", "Reports"),
      body: L(
        "দৈনিক বিক্রি, সেরা পণ্য, স্টক ভ্যালু, লাভ-ক্ষতি ও ডিউ রিপোর্ট।",
        "Daily sales, best sellers, stock value, profit and dues reports.",
      ),
    },
    {
      icon: ShieldCheck,
      title: L("ইউজার ও নিরাপত্তা", "Users & Security"),
      body: L(
        "রোলভিত্তিক অ্যাক্সেস, পাসওয়ার্ড রিসেট এবং সম্পূর্ণ অডিট লগ।",
        "Role-based access, password reset and a full audit log.",
      ),
    },
  ];

  const stats = [
    { value: "8+", label: L("সমন্বিত মডিউল", "Integrated modules") },
    { value: "5", label: L("ইউজার রোল", "User roles") },
    { value: "2", label: L("ভাষা (বাংলা/ইংরেজি)", "Languages (BN/EN)") },
    { value: "৳", label: L("টাকা ভিত্তিক হিসাব", "Taka-native accounting") },
  ];

  const workflow = [
    {
      step: "01",
      title: L("প্রতিষ্ঠান সেটআপ", "Set up your business"),
      body: L("শাখা, ইউজার রোল, ট্যাক্স ও রসিদ সেটিংস ঠিক করুন।", "Configure branches, roles, tax and receipt settings."),
    },
    {
      step: "02",
      title: L("পণ্য ও পার্টি যোগ", "Add products & parties"),
      body: L("বারকোডসহ পণ্য, কাস্টমার ও সাপ্লায়ার ইমপোর্ট বা যোগ করুন।", "Add or import products with barcodes, customers and suppliers."),
    },
    {
      step: "03",
      title: L("বিক্রি শুরু", "Start selling"),
      body: L("POS থেকে বিল করুন, স্টক ও লেজার নিজে থেকেই আপডেট হয়।", "Bill from the POS; stock and ledgers update automatically."),
    },
    {
      step: "04",
      title: L("হিসাব ও সিদ্ধান্ত", "Review & decide"),
      body: L("ড্যাশবোর্ড ও রিপোর্টে লাভ, ডিউ আর ক্যাশফ্লো দেখুন।", "Track profit, dues and cash flow on the dashboard and reports."),
    },
  ];

  const audiences = [
    L("মুদি ও ডিপার্টমেন্টাল স্টোর", "Grocery & departmental stores"),
    L("ফার্মেসি ও কসমেটিকস", "Pharmacy & cosmetics"),
    L("ইলেকট্রনিক্স ও মোবাইল শপ", "Electronics & mobile shops"),
    L("পাইকারি ও ডিস্ট্রিবিউশন", "Wholesale & distribution"),
    L("ফ্যাশন ও গার্মেন্টস আউটলেট", "Fashion & garment outlets"),
    L("রেস্টুরেন্ট ও বেকারি", "Restaurants & bakeries"),
  ];

  const faqs = [
    {
      q: L("ইন্সটল করতে হবে কি?", "Do I need to install anything?"),
      a: L(
        "না। ব্রাউজার থেকেই চলে — ডেস্কটপ, ল্যাপটপ, ট্যাব বা মোবাইলে।",
        "No. It runs in the browser on desktop, laptop, tablet or mobile.",
      ),
    },
    {
      q: L("কোন প্রিন্টার সাপোর্ট করে?", "Which printers are supported?"),
      a: L(
        "৫৮/৮০ মিমি থার্মাল প্রিন্টার এবং সাধারণ A4 প্রিন্টার — দুটোতেই রসিদ প্রিন্ট হয়।",
        "58/80 mm thermal printers as well as standard A4 printers.",
      ),
    },
    {
      q: L("একাধিক শাখা চালানো যাবে?", "Can I run multiple branches?"),
      a: L(
        "হ্যাঁ, প্রতিটি শাখার আলাদা স্টক, ট্রান্সফার ও রিপোর্ট আছে।",
        "Yes — each branch has its own stock, transfers and reports.",
      ),
    },
    {
      q: L("ডেটা কতটা নিরাপদ?", "How secure is the data?"),
      a: L(
        "রোলভিত্তিক অ্যাক্সেস কন্ট্রোল, সার্ভার-সাইড যাচাই এবং অডিট লগ দিয়ে প্রতিটি গুরুত্বপূর্ণ অ্যাকশন রেকর্ড থাকে।",
        "Role-based access control, server-side checks and an audit log of every important action.",
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="gradient-brand flex size-9 items-center justify-center rounded-lg text-primary-foreground">
              <ReceiptText className="size-5" />
            </span>
            <span className="font-display text-lg font-bold">{t("appName")}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="hover:text-foreground">{L("মডিউল", "Modules")}</a>
            <a href="#workflow" className="hover:text-foreground">{L("কিভাবে কাজ করে", "How it works")}</a>
            <a href="#industries" className="hover:text-foreground">{L("কাদের জন্য", "Industries")}</a>
            <a href="#faq" className="hover:text-foreground">{L("প্রশ্নোত্তর", "FAQ")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t("signIn")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("getStarted")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-2 md:pt-16">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                POS • Inventory • Accounting • Reports
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">{t("tagline")}</h1>
              <p className="mt-4 max-w-md text-muted-foreground">{t("heroSub")}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  L("এক স্ক্রিনে বিলিং, স্টক আর হিসাব", "Billing, stock and accounts on one screen"),
                  L("বাংলা ও ইংরেজি — টাকা (৳) ভিত্তিক", "Bengali and English, Taka (৳) native"),
                  L("থার্মাল ও A4 প্রিন্টারে রসিদ", "Receipts on thermal and A4 printers"),
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{li}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    {t("getStarted")} <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">{t("signIn")}</Link>
                </Button>
              </div>
            </div>

            <div className="surface-panel p-4">
              <div className="gradient-brand rounded-lg p-4 text-primary-foreground">
                <p className="text-xs opacity-80">{t("todaySales")}</p>
                <p className="font-display text-3xl font-bold">৳12,480.00</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/50 p-3">
                    <div className="h-8 rounded bg-secondary" />
                    <div className="mt-2 h-2 w-3/4 rounded bg-border" />
                    <div className="mt-1 h-2 w-1/2 rounded bg-border" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-10 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-bold text-primary">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold">{L("সম্পূর্ণ ব্যবসা এক প্ল্যাটফর্মে", "Your whole business, one platform")}</h2>
            <p className="mt-2 text-muted-foreground">
              {L(
                "বিক্রি থেকে হিসাব — প্রতিটি মডিউল একে অপরের সাথে যুক্ত, তাই ডেটা দুইবার লিখতে হয় না।",
                "From the counter to the ledger, every module is connected — no double entry.",
              )}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => (
              <article key={m.title} className="surface-panel p-5">
                <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <m.icon className="size-5" />
                </span>
                <h3 className="text-base font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold">{L("চার ধাপে শুরু", "Live in four steps")}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {workflow.map((w) => (
                <div key={w.step} className="surface-panel p-5">
                  <p className="font-display text-2xl font-bold text-primary/70">{w.step}</p>
                  <h3 className="mt-2 text-base font-semibold">{w.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries + capability strip */}
        <section id="industries" className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold">{L("কাদের জন্য", "Built for")}</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {audiences.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Printer, t: L("রসিদ ও লেবেল", "Receipts & labels"), b: L("থার্মাল রসিদ ও বারকোড লেবেল প্রিন্ট।", "Thermal receipts and barcode label printing.") },
                { icon: Users, t: L("রোল ব্যবস্থাপনা", "Role management"), b: L("সুপার অ্যাডমিন থেকে স্টাফ পর্যন্ত অনুমতি।", "Permissions from super admin to staff.") },
                { icon: FileSpreadsheet, t: L("এক্সপোর্ট", "Exports"), b: L("ইউজার ও রিপোর্ট CSV আকারে নামান।", "Download users and reports as CSV.") },
                { icon: ShieldCheck, t: L("অডিট ট্রেইল", "Audit trail"), b: L("লগইন ও গুরুত্বপূর্ণ অ্যাকশনের রেকর্ড।", "Records of logins and key actions.") },
              ].map((c) => (
                <div key={c.t} className="surface-panel p-5">
                  <c.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{c.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-4xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold">{L("সাধারণ প্রশ্ন", "Frequently asked questions")}</h2>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {faqs.map((f) => (
                <div key={f.q} className="surface-panel p-5">
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="surface-panel flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="font-display text-3xl font-bold">
              {L("আজই আপনার দোকানের হিসাব ডিজিটাল করুন", "Digitise your shop today")}
            </h2>
            <p className="max-w-xl text-muted-foreground">
              {L(
                "অ্যাকাউন্ট খুলে কয়েক মিনিটেই বিলিং শুরু করুন — কোনো ইনস্টলেশন লাগবে না।",
                "Create an account and start billing in minutes — no installation required.",
              )}
            </p>
            <Button asChild size="lg">
              <Link to="/auth">
                {t("getStarted")} <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="gradient-brand flex size-8 items-center justify-center rounded-lg text-primary-foreground">
                <ReceiptText className="size-4" />
              </span>
              <span className="font-display font-bold">{t("appName")}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {L("রিটেইল ব্যবসার জন্য বিলিং, ইনভেন্টরি ও হিসাব ব্যবস্থাপনা।", "Billing, inventory and accounting for retail businesses.")}
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{L("পণ্য", "Product")}</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li><a href="#modules" className="hover:text-foreground">{L("মডিউল", "Modules")}</a></li>
              <li><a href="#workflow" className="hover:text-foreground">{L("কিভাবে কাজ করে", "How it works")}</a></li>
              <li><a href="#faq" className="hover:text-foreground">{L("প্রশ্নোত্তর", "FAQ")}</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{L("অ্যাকাউন্ট", "Account")}</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground">{t("signIn")}</Link></li>
              <li><Link to="/auth" className="hover:text-foreground">{t("getStarted")}</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-border py-5 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t("appName")}
        </p>
      </footer>
    </div>
  );
}
