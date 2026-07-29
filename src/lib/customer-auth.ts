/** Shopper (storefront) accounts: phone number + PIN, backed by Supabase auth. */
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const CUSTOMER_DOMAIN = "shopper.yesspos.app";

export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

export function isValidPhone(input: string) {
  return /^01[3-9]\d{8}$/.test(normalizePhone(input));
}

export function phoneToEmail(phone: string) {
  return `${normalizePhone(phone)}@${CUSTOMER_DOMAIN}`;
}

export type CustomerSession = {
  user: User | null;
  phone: string;
  name: string;
  loading: boolean;
  isCustomer: boolean;
};

/** Live shopper session. Staff accounts (other email domains) are not shoppers. */
export function useCustomerSession(): CustomerSession {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = user?.email ?? "";
  const isCustomer = email.endsWith(`@${CUSTOMER_DOMAIN}`);
  return {
    user,
    loading,
    isCustomer,
    phone: isCustomer ? email.split("@")[0] : (user?.user_metadata?.phone as string) ?? "",
    name: (user?.user_metadata?.full_name as string) ?? "",
  };
}

export async function customerSignIn(phone: string, pin: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: pin,
  });
  if (error) throw error;
}

export async function customerSignUp(phone: string, pin: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password: pin,
    options: {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/homedelivery` : undefined,
      data: { full_name: fullName, phone: normalizePhone(phone) },
    },
  });
  if (error) throw error;
  // Some projects require confirmation; sign in directly when a session exists.
  if (!data.session) await customerSignIn(phone, pin);
}

export function useCustomerSignOut() {
  return useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
}
