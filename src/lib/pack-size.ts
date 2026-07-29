/**
 * Pack size / weight helpers.
 *
 * Every sellable product carries a pack size such as "1kg", "500g", "1L" or
 * "12 pcs". POS and the online checkout use these helpers so a line can never
 * be sold with a quantity that does not line up with the catalog pack.
 */

export type ParsedPack = { value: number; unit: string; canonical: string };

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  l: "l",
  ltr: "l",
  litre: "l",
  liter: "l",
  ml: "ml",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  pack: "pcs",
  packet: "pcs",
  dozen: "dozen",
  bundle: "pcs",
};

/** Parses "500 g", "1kg", "12 pcs" → { value, unit }. Returns null when unusable. */
export function parsePackSize(raw: string | null | undefined): ParsedPack | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  const m = s.match(/^([\d.]+)\s*([a-z]+)$/);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = UNIT_ALIASES[m[2]];
  if (!Number.isFinite(value) || value <= 0 || !unit) return null;
  return { value, unit, canonical: `${value}${unit === "pcs" ? " pcs" : unit}` };
}

export type PackIssue = { code: string; en: string; bn: string };

export type PackCheckInput = {
  name: string;
  pack_size: string | null;
  unit?: string | null;
  qty: number;
  stock?: number | null;
};

const MAX_QTY = 999;

/** Validates one cart line against its pack size. Returns null when consistent. */
export function checkPackLine(line: PackCheckInput): PackIssue | null {
  const { name, qty } = line;

  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      code: "qty_invalid",
      en: `${name}: quantity must be at least 1`,
      bn: `${name}: পরিমাণ কমপক্ষে ১ হতে হবে`,
    };
  }
  if (!Number.isInteger(qty)) {
    return {
      code: "qty_fraction",
      en: `${name} is sold per pack — use whole packs, not fractions`,
      bn: `${name} প্যাক হিসেবে বিক্রি হয় — ভগ্নাংশ নয়, পূর্ণ প্যাক দিন`,
    };
  }
  if (qty > MAX_QTY) {
    return {
      code: "qty_max",
      en: `${name}: maximum ${MAX_QTY} packs per order`,
      bn: `${name}: প্রতি অর্ডারে সর্বোচ্চ ${MAX_QTY} প্যাক`,
    };
  }

  const pack = parsePackSize(line.pack_size);
  if (!pack) {
    return {
      code: "pack_missing",
      en: `${name}: pack size / weight is missing or invalid — cannot sell`,
      bn: `${name}: প্যাক সাইজ/ওজন নেই বা ভুল — বিক্রি করা যাবে না`,
    };
  }

  const u = (line.unit ?? "").trim().toLowerCase();
  const weightUnit = ["kg", "g", "l", "ml"].includes(pack.unit);
  if (["kg", "kilogram", "litre", "liter", "l"].includes(u) && !weightUnit) {
    return {
      code: "unit_mismatch",
      en: `${name}: unit "${u}" does not match pack "${line.pack_size}"`,
      bn: `${name}: ইউনিট "${u}" প্যাক "${line.pack_size}" এর সাথে মেলে না`,
    };
  }

  if (line.stock != null && qty > line.stock) {
    return {
      code: "stock",
      en: `${name}: only ${line.stock} in stock`,
      bn: `${name}: স্টকে আছে মাত্র ${line.stock}`,
    };
  }

  return null;
}

/** Validates a whole cart. Returns every issue found. */
export function checkPackCart(lines: PackCheckInput[]): PackIssue[] {
  return lines.map(checkPackLine).filter((i): i is PackIssue => i !== null);
}

/** Total weight/count label for a line, e.g. 3 × 500g → "1.5kg". */
export function packTotalLabel(pack_size: string | null, qty: number) {
  const p = parsePackSize(pack_size);
  if (!p) return "";
  const total = p.value * qty;
  return p.unit === "pcs" ? `${total} pcs` : `${Number(total.toFixed(3))}${p.unit}`;
}
