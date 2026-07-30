/** Storefront promo codes — validated in the database so the coupon list stays private. */
import { supabase } from "@/integrations/supabase/client";

export type CouponResult = {
  ok: boolean;
  code: string;
  discount: number;
  reason: string;
  message: string;
};

function messageFor(reason: string, bn: boolean, min?: number) {
  switch (reason) {
    case "ok":
      return bn ? "কুপন প্রয়োগ হয়েছে" : "Coupon applied";
    case "not_found":
      return bn ? "কুপন কোডটি সঠিক নয়" : "That promo code does not exist";
    case "inactive":
      return bn ? "কুপনটি আর সক্রিয় নেই" : "This coupon is no longer active";
    case "expired":
      return bn ? "কুপনের মেয়াদ শেষ" : "This coupon has expired";
    case "min_amount":
      return bn
        ? `এই কুপনের জন্য আরও বেশি কেনাকাটা প্রয়োজন${min ? ` (কমপক্ষে ৳${min})` : ""}`
        : `Your cart is below this coupon's minimum${min ? ` (৳${min})` : ""}`;
    default:
      return bn ? "কুপন যাচাই করা যায়নি" : "Could not check that coupon";
  }
}

export async function applyCoupon(
  code: string,
  subtotal: number,
  bn: boolean,
): Promise<CouponResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, code: "", discount: 0, reason: "empty", message: messageFor("", bn) };
  }
  const { data, error } = await supabase.rpc("validate_coupon", {
    _code: trimmed,
    _subtotal: subtotal,
  });
  if (error) {
    return { ok: false, code: trimmed, discount: 0, reason: "error", message: messageFor("", bn) };
  }
  const row = Array.isArray(data) ? data[0] : null;
  const reason = (row?.reason as string) ?? "not_found";
  const discount = Number(row?.discount ?? 0);
  return {
    ok: reason === "ok" && discount > 0,
    code: (row?.code as string) ?? trimmed,
    discount,
    reason,
    message: messageFor(reason, bn),
  };
}
