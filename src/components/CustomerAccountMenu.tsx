/** Storefront account button: shopper login / signup dialog + account menu with logout. */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, MapPin, Package, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import {
  customerSignIn,
  customerSignUp,
  isValidPhone,
  normalizePhone,
  useCustomerSession,
} from "@/lib/customer-auth";
import { supabase } from "@/integrations/supabase/client";

export function CustomerAuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
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
      onOpenChange(false);
      setPin("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "signin"
              ? bn ? "লগইন করুন" : "Sign in"
              : bn ? "নতুন অ্যাকাউন্ট" : "Create account"}
          </DialogTitle>
          <DialogDescription>
            {bn
              ? "মোবাইল নম্বর ও পিন দিয়ে অর্ডার, ঠিকানা ও পয়েন্ট এক জায়গায়।"
              : "Use your mobile number and PIN to keep orders, addresses and points together."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
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
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={32}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? (bn ? "লগইন" : "Sign in") : bn ? "অ্যাকাউন্ট খুলুন" : "Create account"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs text-primary hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? bn ? "অ্যাকাউন্ট নেই? নতুন খুলুন" : "No account? Create one"
              : bn ? "অ্যাকাউন্ট আছে? লগইন করুন" : "Already have an account? Sign in"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerAccountMenu({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, isCustomer, name, phone } = useCustomerSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success(bn ? "লগআউট হয়েছে" : "Signed out");
    navigate({ to: "/homedelivery", replace: true });
  }

  if (!user || !isCustomer) {
    return (
      <>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          className={compact ? "h-8 px-2 text-xs" : "h-11 rounded-full"}
          onClick={() => setOpen(true)}
        >
          <UserIcon className="mr-1 size-4" />
          {bn ? "লগইন" : "Sign in"}
        </Button>
        <CustomerAuthDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full">
          <UserIcon className="mr-1 size-4" />
          <span className="max-w-[90px] truncate">{name || normalizePhone(phone)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuLabel className="truncate">{name || (bn ? "আমার অ্যাকাউন্ট" : "My account")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/my-account" search={{ tab: "orders" }}>
            <Package className="mr-2 size-4" />
            {bn ? "আমার অর্ডার" : "My orders"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/my-account" search={{ tab: "addresses" }}>
            <MapPin className="mr-2 size-4" />
            {bn ? "ঠিকানা" : "Addresses"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" />
          {bn ? "লগআউট" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
