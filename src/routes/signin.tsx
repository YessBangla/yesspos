import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, Lock, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { customerSignIn, customerSignUp, isValidPhone } from "@/lib/customer-auth";

const SITE = "https://yesspos.lovable.app";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — Bazar Bari customer account" },
      {
        name: "description",
        content:
          "Sign in to your Bazar Bari account with your mobile number and PIN to track orders, save addresses and collect loyalty points.",
      },
      { property: "og:title", content: "Sign in — Bazar Bari" },
      { property: "og:description", content: "Mobile number and PIN sign in for Bazar Bari online grocery customers." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/signin` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/signin` }],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      toast.error(bn ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)");
      return;
    }
    if (pin.length < 6) {
      toast.error(bn ? "পিন কমপক্ষে ৬ সংখ্যার হতে হবে" : "PIN must be at least 6 characters");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      toast.error(bn ? "আপনার নাম লিখুন" : "Enter your name");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") await customerSignIn(phone, pin);
      else await customerSignUp(phone, pin, name.trim());
      toast.success(bn ? "লগইন সফল" : "Signed in");
      navigate({ to: "/my-account", search: { tab: "orders" } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/already registered/i.test(msg)) {
        setMode("signin");
        toast.error(bn ? "এই নম্বরে অ্যাকাউন্ট আছে — পিন দিয়ে লগইন করুন" : "Account exists — sign in with your PIN");
      } else if (/invalid login/i.test(msg)) {
        toast.error(bn ? "নম্বর বা পিন ভুল" : "Wrong number or PIN");
      } else {
        toast.error(msg || (bn ? "সমস্যা হয়েছে" : "Something went wrong"));
      }
    } finally {
      setBusy(false);
    }
  }

  const points = [
    {
      icon: Truck,
      title: bn ? "দ্রুত হোম ডেলিভারি" : "Fast home delivery",
      body: bn ? "ঢাকার ভেতরে নির্ধারিত স্লটে পণ্য পৌঁছে যায়।" : "Scheduled delivery slots across Dhaka city.",
    },
    {
      icon: ShieldCheck,
      title: bn ? "নিরাপদ অ্যাকাউন্ট" : "Secure account",
      body: bn ? "মোবাইল নম্বর ও ব্যক্তিগত পিন দিয়ে সুরক্ষিত লগইন।" : "Mobile number plus private PIN protects your data.",
    },
    {
      icon: Building2,
      title: bn ? "কর্পোরেট সাপোর্ট" : "Corporate support",
      body: bn ? "অফিস ও প্রতিষ্ঠানের নিয়মিত সরবরাহে বিশেষ সেবা।" : "Dedicated supply service for offices and institutions.",
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
          <Link to="/corporate" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            {bn ? "কর্পোরেট" : "Corporate"}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.05fr_minmax(0,420px)]">
        <section className="order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {bn ? "বাজার বাড়ি অ্যাকাউন্ট" : "Bazar Bari account"}
          </p>
          <h1 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            {bn
              ? "একটি অ্যাকাউন্টে অর্ডার, ঠিকানা ও লয়ালটি পয়েন্ট"
              : "One account for orders, addresses and loyalty points"}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {bn
              ? "মোবাইল নম্বর ও পিন দিয়ে লগইন করলেই অর্ডারের ইতিহাস, লাইভ ট্র্যাকিং ও সংরক্ষিত ঠিকানা এক জায়গায় পাবেন।"
              : "Sign in with your mobile number and PIN to keep order history, live tracking and saved addresses in one place."}
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {points.map((p) => (
              <li key={p.title} className="rounded-2xl border border-border bg-card p-4">
                <p.icon className="size-5 text-primary" />
                <p className="mt-2.5 text-sm font-semibold">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <h2 className="font-display text-lg font-bold">
                {mode === "signin"
                  ? bn ? "লগইন করুন" : "Sign in"
                  : bn ? "নতুন অ্যাকাউন্ট" : "Create account"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {bn ? "শুধু মোবাইল নম্বর ও পিন প্রয়োজন।" : "Only your mobile number and PIN are required."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    "rounded-full py-1.5 font-medium transition-colors " +
                    (mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {m === "signin" ? (bn ? "লগইন" : "Sign in") : bn ? "রেজিস্টার" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="cust-name">{bn ? "পুরো নাম" : "Full name"}</Label>
                  <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">{bn ? "মোবাইল নম্বর" : "Mobile number"}</Label>
                <Input
                  id="cust-phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={14}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-pin">{bn ? "পিন (৬+ সংখ্যা)" : "PIN (6+ characters)"}</Label>
                <Input
                  id="cust-pin"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={32}
                />
              </div>
              <Button type="submit" className="h-11 w-full rounded-full" disabled={busy}>
                {mode === "signin" ? (bn ? "লগইন" : "Sign in") : bn ? "অ্যাকাউন্ট খুলুন" : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              {bn ? "স্টাফ বা অ্যাডমিন?" : "Staff or admin?"}{" "}
              <Link to="/auth" className="font-medium text-primary hover:underline">
                {bn ? "স্টাফ লগইন" : "Staff login"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
