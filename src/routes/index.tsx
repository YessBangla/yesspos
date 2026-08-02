import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  FileSpreadsheet,
  Globe2,
  Landmark,
  Lock,
  Plug,
  Printer,
  Quote,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { useSiteContent } from "@/lib/site-content";
import heroShade from "@/assets/hero-shade.jpg";
import cardShade from "@/assets/card-shade.jpg";

const shadeStyle = { "--card-shade": `url(${cardShade})` } as React.CSSProperties;


const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daily Bazar — Retail Billing, Inventory & Accounting Platform" },
      {
        name: "description",
        content:
          "Daily Bazar is an enterprise-grade browser POS and ERP for retail: fast billing, multi-branch inventory, dues, double-entry accounting and reports in Bengali and English.",
      },
      {
        property: "og:title",
        content: "Daily Bazar — Retail Billing, Inventory & Accounting Platform",
      },
      {
        property: "og:description",
        content:
          "Enterprise-grade POS and ERP for retail chains: billing, multi-branch stock, dues, double-entry accounting and analytics in one platform.",
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
          name: "Daily Bazar",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Enterprise point of sale and ERP for retail businesses: billing, multi-branch inventory, dues, double-entry accounting and reports.",
          url: SITE,
          offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
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
  const { text: sc } = useSiteContent();

  const heroMetrics = [
    { icon: Boxes, label: L("স্টক আইটেম", "Stock items"), value: L("১,২৪০", "1,240") },
    { icon: Users, label: L("কাস্টমার", "Customers"), value: L("৮৬২", "862") },
    { icon: Building2, label: L("শাখা", "Branches"), value: L("০৩", "03") },
    { icon: CreditCard, label: L("বকেয়া আদায়", "Dues collected"), value: "৳3,150" },
  ];

  const heroCards = [
    {
      icon: ShoppingCart,
      tag: L("বিলিং", "Billing"),
      metric: L("< ১০ সে.", "< 10 sec"),
      title: L("প্রতি বিলে গড় সময়", "Average time per bill"),
      body: L(
        "বারকোড স্ক্যান, কিবোর্ড শর্টকাট আর এক-ক্লিক পেমেন্টে কাউন্টার দ্রুত চলে।",
        "Barcode scan, keyboard shortcuts and one-click payment keep the counter moving.",
      ),
    },
    {
      icon: Boxes,
      tag: L("ইনভেন্টরি", "Inventory"),
      metric: L("রিয়েল-টাইম", "Real-time"),
      title: L("শাখাভিত্তিক স্টক আপডেট", "Branch-wise stock updates"),
      body: L(
        "প্রতিটি বিক্রি, ক্রয় ও ট্রান্সফারে স্টক সাথে সাথেই সমন্বয় হয়, লো-স্টক অ্যালার্টসহ।",
        "Every sale, purchase and transfer adjusts stock instantly, with low-stock alerts.",
      ),
    },
    {
      icon: Landmark,
      tag: L("অ্যাকাউন্টিং", "Accounting"),
      metric: L("ডাবল-এন্ট্রি", "Double-entry"),
      title: L("স্বয়ংক্রিয় লেজার ও ভাউচার", "Automated ledgers & vouchers"),
      body: L(
        "চার্ট অব অ্যাকাউন্টস, ডে-বুক ও আর্থিক বিবরণী নিজে থেকেই তৈরি হয়।",
        "Chart of accounts, day book and financial statements build themselves.",
      ),
    },
    {
      icon: ShieldCheck,
      tag: L("গভর্ন্যান্স", "Governance"),
      metric: L("৫ রোল", "5 roles"),
      title: L("অ্যাক্সেস কন্ট্রোল ও অডিট", "Access control & audit"),
      body: L(
        "সুপার অ্যাডমিন থেকে স্টাফ পর্যন্ত অনুমতি, আর প্রতিটি অ্যাকশনের অডিট লগ।",
        "Permissions from super admin to staff, with an audit log for every action.",
      ),
    },
  ];



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
      title: L("রিপোর্ট ও অ্যানালিটিক্স", "Reports & Analytics"),
      body: L(
        "দৈনিক বিক্রি, সেরা পণ্য, স্টক ভ্যালু, লাভ-ক্ষতি ও ডিউ রিপোর্ট।",
        "Daily sales, best sellers, stock value, profit and dues reports.",
      ),
    },
    {
      icon: ShieldCheck,
      title: L("ইউজার ও গভর্ন্যান্স", "Users & Governance"),
      body: L(
        "রোলভিত্তিক অ্যাক্সেস, পাসওয়ার্ড রিসেট এবং সম্পূর্ণ অডিট লগ।",
        "Role-based access, password reset and a full audit log.",
      ),
    },
  ];

  const stats = [
    { value: "20+", label: L("সমন্বিত মডিউল", "Integrated modules") },
    { value: "5", label: L("ইউজার রোল লেভেল", "User role levels") },
    { value: "2", label: L("ভাষা (বাংলা/ইংরেজি)", "Languages (BN/EN)") },
    { value: "99.9%", label: L("লক্ষ্যমাত্রা আপটাইম", "Target uptime") },
  ];

  const outcomes = [
    {
      icon: Clock,
      title: L("দ্রুত চেকআউট", "Faster checkout"),
      body: L(
        "কিবোর্ড শর্টকাট ও বারকোড স্ক্যানে কাউন্টারে অপেক্ষা কমে।",
        "Keyboard shortcuts and barcode scanning cut queue time at the counter.",
      ),
    },
    {
      icon: Database,
      title: L("এক সত্য উৎস", "One source of truth"),
      body: L(
        "বিক্রি, স্টক ও লেজার একসাথে আপডেট হয় — ডেটা দুইবার লিখতে হয় না।",
        "Sales, stock and ledgers update together — no duplicate data entry.",
      ),
    },
    {
      icon: Globe2,
      title: L("যেকোনো ডিভাইসে", "Any device, anywhere"),
      body: L(
        "ব্রাউজারেই চলে — ডেস্কটপ, ট্যাব বা মোবাইল, ইনস্টলেশন ছাড়াই।",
        "Runs in the browser on desktop, tablet or mobile with zero installation.",
      ),
    },
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

  const governance = [
    {
      icon: Lock,
      title: L("রোলভিত্তিক অ্যাক্সেস", "Role-based access"),
      body: L(
        "সুপার অ্যাডমিন থেকে স্টাফ — প্রতিটি মেনু ও অ্যাকশন রোল অনুযায়ী নিয়ন্ত্রিত।",
        "Super admin to staff — every menu and action is gated by role.",
      ),
    },
    {
      icon: ShieldCheck,
      title: L("অডিট ট্রেইল", "Audit trail"),
      body: L(
        "লগইন, বিক্রি, রিটার্ন ও সেটিংস পরিবর্তনের সম্পূর্ণ রেকর্ড।",
        "A complete record of logins, sales, returns and settings changes.",
      ),
    },
    {
      icon: Database,
      title: L("সার্ভার-সাইড যাচাই", "Server-side validation"),
      body: L(
        "প্রতিটি সংবেদনশীল অপারেশন সার্ভারে যাচাই হয়, শুধু ব্রাউজারে নয়।",
        "Sensitive operations are verified on the server, not just in the browser.",
      ),
    },
    {
      icon: Plug,
      title: L("API হাব", "API hub"),
      body: L(
        "ইন্টিগ্রেশন ও কী ব্যবস্থাপনা এক জায়গা থেকে কনফিগার করুন।",
        "Configure integrations and key management from a single place.",
      ),
    },
  ];

  const testimonials = [
    {
      quote: L(
        "তিনটি শাখার স্টক আর ডিউ এখন একই ড্যাশবোর্ডে দেখি — মাস শেষের হিসাব দুই দিনের বদলে এক ঘণ্টায়।",
        "Stock and dues for three branches now sit on one dashboard — month-end closing takes an hour instead of two days.",
      ),
      name: L("রায়হান করিম", "Raihan Karim"),
      role: L("পরিচালক, রিটেইল চেইন", "Director, retail chain"),
    },
    {
      quote: L(
        "কাউন্টারের স্টাফরা এক দিনেই শিখে গেছে, আর থার্মাল প্রিন্টে রসিদ সাথে সাথেই বেরোয়।",
        "Counter staff learned it in a day, and thermal receipts print instantly.",
      ),
      name: L("নুসরাত জাহান", "Nusrat Jahan"),
      role: L("ম্যানেজার, ফার্মেসি", "Manager, pharmacy"),
    },
    {
      quote: L(
        "ক্রয়, বিক্রি আর জার্নাল একসাথে থাকায় অ্যাকাউন্ট্যান্টকে আলাদা এক্সেল দিতে হয় না।",
        "Purchases, sales and journals live together, so our accountant no longer needs separate spreadsheets.",
      ),
      name: L("সাইফুল ইসলাম", "Saiful Islam"),
      role: L("মালিক, হোলসেল ডিপো", "Owner, wholesale depot"),
    },
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
    {
      q: L("দলের সবাই কি একসাথে কাজ করতে পারবে?", "Can my whole team work at once?"),
      a: L(
        "হ্যাঁ। পাঁচটি রোল লেভেল আছে এবং একাধিক ইউজার একই সময়ে আলাদা কাউন্টার বা শাখায় কাজ করতে পারে।",
        "Yes. Five role levels are available and multiple users can work concurrently across counters or branches.",
      ),
    },
    {
      q: L("বাংলা ও ইংরেজি দুটোই আছে?", "Is it available in both Bengali and English?"),
      a: L(
        "আছে। পুরো ইন্টারফেস এক ক্লিকে বাংলা বা ইংরেজিতে বদলানো যায়, হিসাব টাকা (৳) ভিত্তিক।",
        "Yes. The entire interface switches between Bengali and English in one click, with Taka (৳) native accounting.",
      ),
    },
  ];

  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <BrandLogo size={36} priority />
            <span className="font-display text-lg font-bold">{sc("brand.name", t("appName"))}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            <a href="#platform" className="hover:text-foreground">{L("প্ল্যাটফর্ম", "Platform")}</a>
            <a href="#modules" className="hover:text-foreground">{L("মডিউল", "Modules")}</a>
            <a href="#workflow" className="hover:text-foreground">{L("কিভাবে কাজ করে", "How it works")}</a>
            <a href="#security" className="hover:text-foreground">{L("নিরাপত্তা", "Security")}</a>
            <a href="#industries" className="hover:text-foreground">{L("কাদের জন্য", "Industries")}</a>
            <a href="#faq" className="hover:text-foreground">{L("প্রশ্নোত্তর", "FAQ")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="accent" size="sm">
              <Link to="/homedelivery">
                <ShoppingBag className="mr-1 size-4" />
                {sc("home.cta_primary", L("হোম ডেলিভারি অর্ডার দিন", "Order home delivery"))}
              </Link>
            </Button>
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
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.10]"
            style={{ backgroundImage: `url(${heroShade})` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/40 via-background/80 to-background"
          />
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:pt-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
              <div className="rise-in">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs font-semibold tracking-wide text-secondary-foreground backdrop-blur">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {sc("home.hero_badge", "POS • Inventory • Accounting • Analytics")}
                </p>
                <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
                  {sc("home.hero_title", t("tagline"))}
                </h1>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                  {sc("home.hero_subtitle", t("heroSub"))}
                </p>
                <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    L("এক স্ক্রিনে বিলিং, স্টক আর হিসাব", "Billing, stock and accounts on one screen"),
                    L("বাংলা ও ইংরেজি — টাকা (৳) ভিত্তিক", "Bengali and English, Taka (৳) native"),
                    L("থার্মাল ও A4 প্রিন্টারে রসিদ", "Receipts on thermal and A4 printers"),
                    L("রোলভিত্তিক অ্যাক্সেস ও অডিট লগ", "Role-based access with a full audit log"),
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{li}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link to="/auth">
                      {t("getStarted")} <ArrowRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="accent">
                    <Link to="/homedelivery">
                      <ShoppingBag className="mr-1 size-4" />
                      {sc("home.cta_primary", L("হোম ডেলিভারি অর্ডার দিন", "Order home delivery"))}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/auth">{sc("home.cta_secondary", t("signIn"))}</Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {L(
                    "কোনো ইনস্টলেশন লাগে না • ব্রাউজারেই চলে • বাংলা ও ইংরেজি",
                    "No installation • Runs in the browser • Bengali & English",
                  )}
                </p>
              </div>

              <div className="rise-in soft-float surface-panel shade-card p-4" style={shadeStyle}>
                <div className="gradient-brand rounded-lg p-4 text-primary-foreground">
                  <p className="text-xs opacity-80">{t("todaySales")}</p>
                  <p className="font-display text-3xl font-bold">৳12,480.00</p>
                  <p className="mt-1 text-xs opacity-80">
                    {L("৪২টি ইনভয়েস • ৩ শাখা", "42 invoices • 3 branches")}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {heroMetrics.map((m) => (
                    <div key={m.label} className="rounded-lg border border-border bg-muted/40 p-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <m.icon className="size-3.5 text-primary" /> {m.label}
                      </span>
                      <p className="mt-1 font-display text-lg font-bold">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero info cards */}
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {heroCards.map((c, i) => (
                <article
                  key={c.title}
                  className="surface-panel shade-card rise-in p-5"
                  style={{ ...shadeStyle, animationDelay: `${0.08 * (i + 1)}s` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                      <c.icon className="size-5" />
                    </span>
                    <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {c.tag}
                    </span>
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{c.metric}</p>
                  <h2 className="mt-0.5 text-sm font-semibold">{c.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </article>
              ))}
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

        {/* Platform / outcomes */}
        <section id="platform" className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <Eyebrow>{L("প্ল্যাটফর্ম", "Platform")}</Eyebrow>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              {L("কাউন্টার থেকে বোর্ডরুম — একটাই সিস্টেম", "One system from counter to boardroom")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {L(
                "প্রতিটি বিক্রি সাথে সাথেই স্টক, ডিউ আর লেজারে প্রতিফলিত হয়, তাই ব্যবস্থাপনা সব সময় সঠিক তথ্যে সিদ্ধান্ত নিতে পারে।",
                "Every sale flows straight into stock, dues and the ledger, so management always decides on current numbers.",
              )}
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {outcomes.map((o) => (
              <div key={o.title} className="surface-panel shade-card p-6" style={shadeStyle}>
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <o.icon className="size-5" />
                </span>
                <h3 className="text-base font-semibold">{o.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="max-w-2xl">
              <Eyebrow>{L("মডিউল", "Modules")}</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {L("সম্পূর্ণ ব্যবসা এক প্ল্যাটফর্মে", "Your whole business, one platform")}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {L(
                  "বিক্রি থেকে হিসাব — প্রতিটি মডিউল একে অপরের সাথে যুক্ত, তাই ডেটা দুইবার লিখতে হয় না।",
                  "From the counter to the ledger, every module is connected — no double entry.",
                )}
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => (
                <article key={m.title} className="surface-panel shade-card p-5" style={shadeStyle}>
                  <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                    <m.icon className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <Eyebrow>{L("ইমপ্লিমেন্টেশন", "Implementation")}</Eyebrow>
            <h2 className="font-display text-3xl font-bold tracking-tight">{L("চার ধাপে শুরু", "Live in four steps")}</h2>
            <p className="mt-3 text-muted-foreground">
              {L(
                "সাধারণত একদিনেই সেটআপ শেষ হয় — আলাদা সার্ভার বা ইনস্টলেশন লাগে না।",
                "Most teams are live within a day — no servers to buy, nothing to install.",
              )}
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflow.map((w) => (
              <div key={w.step} className="surface-panel shade-card p-5" style={shadeStyle}>
                <p className="font-display text-2xl font-bold text-primary/70">{w.step}</p>
                <h3 className="mt-2 text-base font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security & governance */}
        <section id="security" className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Eyebrow>{L("নিরাপত্তা ও গভর্ন্যান্স", "Security & governance")}</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {L("নিয়ন্ত্রণ আপনার হাতে", "Control stays with you")}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {L(
                  "কে কী দেখতে ও করতে পারবে তা রোল দিয়ে নির্ধারিত, আর প্রতিটি গুরুত্বপূর্ণ অ্যাকশন অডিট লগে সংরক্ষিত থাকে।",
                  "Roles define exactly who can see and do what, and every important action is retained in the audit log.",
                )}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {L(
                  "এই পৃষ্ঠার তথ্য প্ল্যাটফর্মে বিদ্যমান ফিচারের বর্ণনা — এটি কোনো স্বাধীন সার্টিফিকেশন নয়।",
                  "This page describes controls available in the product; it is not an independent certification.",
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {governance.map((g) => (
                <div key={g.title} className="surface-panel shade-card p-5" style={shadeStyle}>
                  <g.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries + capability strip */}
        <section id="industries" className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <Eyebrow>{L("ইন্ডাস্ট্রি", "Industries")}</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight">{L("কাদের জন্য", "Built for")}</h2>
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
                <div key={c.t} className="surface-panel shade-card p-5" style={shadeStyle}>
                  <c.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{c.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="max-w-2xl">
              <Eyebrow>{L("গ্রাহক মতামত", "Customer voices")}</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {L("যারা প্রতিদিন কাউন্টারে চালান", "Teams running the counter every day")}
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((tm) => (
                <figure key={tm.name} className="surface-panel flex h-full flex-col p-6">
                  <Quote className="size-5 text-primary/60" />
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {tm.quote}
                  </blockquote>
                  <figcaption className="mt-4 border-t border-border pt-3 text-sm">
                    <span className="font-semibold">{tm.name}</span>
                    <span className="block text-xs text-muted-foreground">{tm.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-4xl px-5 py-16">
          <Eyebrow>{L("প্রশ্নোত্তর", "FAQ")}</Eyebrow>
          <h2 className="font-display text-3xl font-bold tracking-tight">
            {L("সাধারণ প্রশ্ন", "Frequently asked questions")}
          </h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="surface-panel shade-card p-5" style={shadeStyle}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="surface-panel flex flex-col items-center gap-4 p-10 text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {L("আজই আপনার দোকানের হিসাব ডিজিটাল করুন", "Digitise your retail operation today")}
              </h2>
              <p className="max-w-xl text-muted-foreground">
                {L(
                  "অ্যাকাউন্ট খুলে কয়েক মিনিটেই বিলিং শুরু করুন — কোনো ইনস্টলেশন লাগবে না।",
                  "Create an account and start billing in minutes — no installation required.",
                )}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
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
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="gradient-brand flex size-8 items-center justify-center rounded-lg text-primary-foreground">
                <ReceiptText className="size-4" />
              </span>
              <span className="font-display font-bold">{sc("brand.name", t("appName"))}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {sc(
                "footer.about",
                L(
                  "রিটেইল ব্যবসার জন্য বিলিং, ইনভেন্টরি ও হিসাব ব্যবস্থাপনা — বাংলা ও ইংরেজিতে।",
                  "Billing, inventory and accounting for retail businesses — in Bengali and English.",
                ),
              )}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {sc("brand.support_phone", "")} {sc("brand.support_email", "")}
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{L("পণ্য", "Product")}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><a href="#platform" className="hover:text-foreground">{L("প্ল্যাটফর্ম", "Platform")}</a></li>
              <li><a href="#modules" className="hover:text-foreground">{L("মডিউল", "Modules")}</a></li>
              <li><a href="#workflow" className="hover:text-foreground">{L("কিভাবে কাজ করে", "How it works")}</a></li>
              <li><a href="#security" className="hover:text-foreground">{L("নিরাপত্তা", "Security")}</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{L("সমাধান", "Solutions")}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/homedelivery" className="hover:text-foreground">{L("হোম ডেলিভারি অর্ডার", "Home delivery orders")}</Link></li>
              <li><Link to="/track" className="hover:text-foreground">{L("অর্ডার ট্র্যাক", "Track order")}</Link></li>
              <li><a href="#industries" className="hover:text-foreground">{L("ইন্ডাস্ট্রি", "Industries")}</a></li>
              <li><a href="#faq" className="hover:text-foreground">{L("প্রশ্নোত্তর", "FAQ")}</a></li>

            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{L("অ্যাকাউন্ট", "Account")}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground">{t("signIn")}</Link></li>
              <li><Link to="/auth" className="hover:text-foreground">{t("getStarted")}</Link></li>
            </ul>
            <p className="mt-5 font-semibold">{L("আইনগত", "Legal")}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground">{L("প্রাইভেসি পলিসি", "Privacy Policy")}</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">{L("সেবার শর্তাবলি", "Terms of Service")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-sm text-muted-foreground sm:flex-row">
            <p>{sc("footer.copyright", `© ${new Date().getFullYear()} ${t("appName")}`)}</p>
            <p className="text-center">
              {L(
                "Daily Bazar — Shondhaan এর একটি অংশ, Yess Bangla Private Limited এর সিস্টার কনসার্ন",
                "Daily Bazar is a part of Shondhaan, a sister concern of Yess Bangla Private Limited",
              )}
            </p>
          </div>

        </div>
      </footer>
    </div>
  );
}
