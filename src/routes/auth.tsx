import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";
import { LangToggle } from "@/components/LangToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Daily Bazar" },
      { name: "description", content: "Sign in to your Daily Bazar shop account to start billing." },
      { property: "og:title", content: "Sign in — Daily Bazar" },
      { property: "og:description", content: "Sign in to your Daily Bazar shop account." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().min(3).max(255),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().max(80).optional(),
});

// Users can sign in with a plain username (mapped to an internal email) or a real email.
function toEmail(value: string) {
  return value.includes("@") ? value.toLowerCase() : `${value.toLowerCase()}@sherapos.local`;
}


function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: toEmail(parsed.data.email),
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: parsed.data.fullName || "",
              username: parsed.data.email.split("@")[0].toLowerCase(),
            },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: toEmail(parsed.data.email),
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await logAudit("login", { details: mode === "signup" ? "signup" : "password" });
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await logAudit("login", { details: "google" });
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="gradient-brand flex size-9 items-center justify-center rounded-lg text-primary-foreground">
            <ReceiptText className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </Link>
        <LangToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="surface-panel w-full max-w-sm p-6">
          <h1 className="text-2xl font-bold">{mode === "signin" ? t("signIn") : t("signUp")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input id="fullName" value={fullName} maxLength={80} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("usernameOrEmail")}</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? t("signIn") : t("signUp")}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
            {t("continueGoogle")}
          </Button>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t("noAccount") : t("haveAccount")}
          </button>
        </div>
      </main>
    </div>
  );
}
