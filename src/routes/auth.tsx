import { BrandLogo } from "@/components/BrandLogo";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { useServerFn } from "@tanstack/react-start";
import { resetSuperAdminPassword, logAuthAudit } from "@/lib/auth-recovery.functions";
import { ClipboardCopy, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Bazar Bari" },
      { name: "description", content: "Sign in to your Bazar Bari shop account to start billing." },
      { property: "og:title", content: "Sign in — Bazar Bari" },
      { property: "og:description", content: "Sign in to your Bazar Bari shop account." },
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
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const resetFn = useServerFn(resetSuperAdminPassword);
  const authAuditFn = useServerFn(logAuthAudit);
  const [debugInfo, setDebugInfo] = useState<{ 
    status: string; 
    details?: string; 
    timestamp?: string;
    endpoint?: string;
    roleValue?: string;
    isError?: boolean;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function checkBackend() {
    setBusy(true);
    setDebugInfo(null);
    const now = new Date().toLocaleTimeString();
    try {
      // 1. Connection check
      const endpoint = "/rest/v1/business_settings";
      const { data: health, error: healthErr } = await supabase.from("business_settings").select("shop_name").limit(1);
      
      if (healthErr) {
        setDebugInfo({ 
          status: "Backend Unreachable", 
          details: healthErr.message, 
          endpoint,
          timestamp: now,
          isError: true 
        });
        await authAuditFn({ data: { action: "system_check_failed", username: email || "anonymous", reason: `Connection error: ${healthErr.message}` } });
        return;
      }

      // 2. Admin account check
      const username = email || "admin";
      const { data: userCheck, error: userErr } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle();
      
      if (!userCheck) {
        setDebugInfo({ 
          status: "Account Not Found", 
          details: `No profile for "${username}".`,
          timestamp: now,
          isError: true
        });
        await authAuditFn({ data: { action: "system_check_failed", username, reason: "Profile not found" } });
        return;
      }

      // 3. Role check
      const { data: roleCheck, error: roleErr } = await supabase.from("user_roles").select("role").eq("user_id", userCheck.id);
      const rolesStr = roleCheck?.map(r => r.role).join(", ") || "none";
      
      setDebugInfo({ 
        status: "System Verified", 
        details: `User "${userCheck.username}" found.`,
        roleValue: rolesStr,
        timestamp: now,
        isError: rolesStr === "none"
      });

      await authAuditFn({ data: { action: "system_check_success", username: userCheck.username, reason: `Roles: ${rolesStr}` } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDebugInfo({ status: "Error", details: msg, timestamp: now, isError: true });
    } finally {
      setBusy(false);
    }
  }

  const copyDebugInfo = () => {
    if (!debugInfo) return;
    const text = `Status: ${debugInfo.status}\nDetails: ${debugInfo.details}\nTimestamp: ${debugInfo.timestamp}\nEndpoint: ${debugInfo.endpoint || "N/A"}\nRole Value: ${debugInfo.roleValue || "N/A"}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setDebugInfo(null);
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
        if (error) {
          if (error.message.includes("Failed to fetch")) {
            setDebugInfo({ 
              status: "Connection Failed", 
              details: "The backend is currently paused or unreachable.",
              endpoint: "auth.signInWithPassword",
              timestamp: new Date().toLocaleTimeString(),
              isError: true
            });
          } else if (error.message.toLowerCase().includes("invalid login credentials")) {
            setDebugInfo({ 
              status: "Login Failed", 
              details: "Invalid username or password.",
              timestamp: new Date().toLocaleTimeString(),
              isError: true
            });
          }
          await authAuditFn({ data: { action: "login_attempt", username: parsed.data.email, reason: `Failed: ${error.message}` } });
          throw error;
        }
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

  async function onReset() {
    if (!email || !password) {
      toast.error(lang === "bn" ? "ইউজারনেম এবং নতুন পাসওয়ার্ড দিন" : "Please enter username and new password");
      return;
    }
    setBusy(true);
    try {
      const res = await resetFn({ data: { username: email, newPassword: password } });
      await authAuditFn({ data: { action: "password_reset", username: email, reason: "Success" } });
      toast.success(res.message);
      setShowRecovery(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      await authAuditFn({ data: { action: "password_reset", username: email, reason: `Failed: ${msg}` } });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo size={36} priority />
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </Link>
        <LangToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="surface-panel w-full max-w-sm p-6">
          <h1 className="text-2xl font-bold">
            {showRecovery 
              ? (lang === "bn" ? "সুপার অ্যাডমিন রিকভারি" : "Super Admin Recovery")
              : (mode === "signin" ? t("signIn") : t("signUp"))}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

          {debugInfo && (
            <div className={`mt-4 rounded-lg border p-4 text-sm shadow-sm ${!debugInfo.isError ? "border-green-200 bg-green-50 text-green-800" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {!debugInfo.isError ? <ShieldCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {debugInfo.status}
                </div>
                <button onClick={copyDebugInfo} className="rounded p-1 hover:bg-black/5" title="Copy report">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </button>
              </div>
              
              <div className="mt-2 space-y-1 opacity-90">
                {debugInfo.details && <p>{debugInfo.details}</p>}
                {debugInfo.roleValue && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="text-xs uppercase opacity-60">Roles:</span> {debugInfo.roleValue}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider opacity-60">
                  {debugInfo.timestamp && <span>Last Check: {debugInfo.timestamp}</span>}
                  {debugInfo.endpoint && <span className="truncate max-w-[150px]">URL: {debugInfo.endpoint}</span>}
                </div>
              </div>
            </div>
          )}

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
                placeholder={showRecovery ? "admin" : ""}
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{showRecovery ? (lang === "bn" ? "নতুন পাসওয়ার্ড" : "New Password") : t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={showRecovery ? "new-password" : (mode === "signin" ? "current-password" : "new-password")}
                required
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {showRecovery ? (
              <Button type="button" className="w-full" onClick={onReset} disabled={busy}>
                {lang === "bn" ? "পাসওয়ার্ড রিসেট করুন" : "Reset Password"}
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? t("signIn") : t("signUp")}
              </Button>
            )}
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
            {t("continueGoogle")}
          </Button>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? t("noAccount") : t("haveAccount")}
            </button>
            
            <button
              type="button"
              className="w-full text-center text-xs text-primary/60 underline-offset-4 hover:underline"
              onClick={checkBackend}
              disabled={busy}
            >
              {lang === "bn" ? "সিস্টেম কানেকশন ও অ্যাডমিন স্ট্যাটাস চেক করুন" : "Check system connection & admin status"}
            </button>

            {!showRecovery && mode === "signin" && (
              <button
                type="button"
                className="w-full text-center text-xs text-destructive/60 underline-offset-4 hover:underline"
                onClick={() => setShowRecovery(true)}
              >
                {lang === "bn" ? "সুপার অ্যাডমিন পাসওয়ার্ড ভুলে গেছেন?" : "Forgot Super Admin password?"}
              </button>
            )}

            {showRecovery && (
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setShowRecovery(false)}
              >
                {lang === "bn" ? "লগইন স্ক্রিনে ফিরে যান" : "Back to login"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
