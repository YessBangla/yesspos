import { supabase } from "@/integrations/supabase/client";

/** Loyalty rules: 1 point per 10 currency spent (100৳ = 10 points). */
export const POINTS_PER_CURRENCY_SPENT = 0.1;
/** Points can only be spent once the balance reaches this. */
export const REDEEM_MIN_POINTS = 1000;
/** 10 points = 1 currency unit of discount. */
export const POINTS_PER_CURRENCY = 10;

export type Member = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_member: boolean;
  loyalty_points: number;
};

/** Points earned for a purchase amount. */
export function pointsFor(amount: number): number {
  return Math.floor(Math.max(amount, 0) / 10);
}

/** Currency value of a point balance. */
export function pointsToMoney(points: number): number {
  return Math.max(points, 0) / POINTS_PER_CURRENCY;
}

/** How many points a member may spend on a bill of `total`. */
export function maxRedeemable(balance: number, total: number): number {
  if (!Number.isFinite(balance) || balance < REDEEM_MIN_POINTS) return 0;
  return Math.max(0, Math.min(Math.floor(balance), Math.floor(total * POINTS_PER_CURRENCY)));
}

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Register (or look up) a member by phone — works from any branch. */
export async function registerMember(phone: string, name: string): Promise<Member> {
  const { data, error } = await (supabase as unknown as Rpc).rpc("register_member", {
    _phone: phone.trim(),
    _name: name.trim(),
  });
  if (error) throw new Error(error.message);
  return data as Member;
}

/** Redeem + earn points for a finalised sale. Returns the new balance. */
export async function applyLoyalty(input: {
  contactId: string;
  saleId: string | null;
  amount: number;
  redeemPoints: number;
  branchId: string | null;
}): Promise<number> {
  const { data, error } = await (supabase as unknown as Rpc).rpc("apply_loyalty", {
    _contact_id: input.contactId,
    _sale_id: input.saleId,
    _amount: input.amount,
    _redeem_points: input.redeemPoints,
    _branch_id: input.branchId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
