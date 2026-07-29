/** Branch-code based product serial numbers, e.g. MAIN-00042. */

export function productSerial(branchCode: string | null | undefined, seq: number | null | undefined) {
  const code = (branchCode ?? "GEN").toUpperCase();
  const n = Number(seq ?? 0);
  return `${code}-${String(n).padStart(5, "0")}`;
}

/** True when the typed query looks like (part of) this product's serial. */
export function matchesSerial(
  query: string,
  branchCode: string | null | undefined,
  seq: number | null | undefined,
) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const serial = productSerial(branchCode, seq).toLowerCase();
  if (serial.includes(q)) return true;
  // Typing just the number ("42" or "00042") should also find the product.
  const digits = q.replace(/\D/g, "");
  if (digits && String(Number(seq ?? 0)) === String(Number(digits))) return true;
  return false;
}
