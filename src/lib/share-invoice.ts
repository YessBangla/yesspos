/**
 * Invoice sharing over WhatsApp / SMS / copy.
 *
 * No gateway account is needed: the message is composed here and handed to the
 * device (wa.me or the sms: handler), which works on phone and desktop alike.
 */

export type ShareLine = { name: string; qty: number; price: number };

export type ShareInvoice = {
  invoice: number | string;
  at?: string;
  lines: ShareLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  shopName: string;
  shopPhone?: string;
  customer?: string;
  footer?: string;
  currency?: string;
};

function fmt(n: number, currency = "৳") {
  return `${currency}${n.toFixed(2)}`;
}

/** Plain-text receipt suitable for any messenger. */
export function buildInvoiceMessage(inv: ShareInvoice, lang: "bn" | "en" = "bn") {
  const c = inv.currency ?? "৳";
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const due = Math.max(inv.total - inv.paid, 0);

  const parts = [
    `*${inv.shopName}*`,
    `${L("চালান", "Invoice")} #${inv.invoice}`,
    inv.at ? new Date(inv.at).toLocaleString() : "",
    inv.customer ? `${L("কাস্টমার", "Customer")}: ${inv.customer}` : "",
    "",
    ...inv.lines.map((l) => `${l.name} × ${l.qty} = ${fmt(l.price * l.qty, c)}`),
    "",
    `${L("সাবটোটাল", "Subtotal")}: ${fmt(inv.subtotal, c)}`,
    inv.discount ? `${L("ছাড়", "Discount")}: -${fmt(inv.discount, c)}` : "",
    inv.tax ? `${L("ভ্যাট", "Tax")}: ${fmt(inv.tax, c)}` : "",
    `*${L("মোট", "Total")}: ${fmt(inv.total, c)}*`,
    `${L("পরিশোধ", "Paid")}: ${fmt(inv.paid, c)}`,
    due > 0 ? `${L("বাকি", "Due")}: ${fmt(due, c)}` : "",
    "",
    inv.footer || L("ধন্যবাদ!", "Thank you!"),
    inv.shopPhone ? `📞 ${inv.shopPhone}` : "",
  ];

  return parts.filter((p) => p !== "").join("\n");
}

/** Reminder text for an unpaid invoice. */
export function buildDueReminder(
  opts: { shopName: string; customer?: string; invoice: number | string; due: number; currency?: string },
  lang: "bn" | "en" = "bn",
) {
  const c = opts.currency ?? "৳";
  return lang === "bn"
    ? `প্রিয় ${opts.customer || "গ্রাহক"}, ${opts.shopName} থেকে চালান #${opts.invoice}-এ ${fmt(opts.due, c)} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।`
    : `Dear ${opts.customer || "customer"}, invoice #${opts.invoice} from ${opts.shopName} has an outstanding balance of ${fmt(opts.due, c)}. Please settle it at your convenience. Thank you.`;
}

/** Digits only, with Bangladesh country code when a local 01... number is given. */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return digits;
}

export function shareOnWhatsApp(phone: string, message: string) {
  const to = normalizePhone(phone);
  const url = to
    ? `https://wa.me/${to}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function shareOnSms(phone: string, message: string) {
  const to = phone.replace(/[^\d+]/g, "");
  window.location.href = `sms:${to}?&body=${encodeURIComponent(message)}`;
}

export async function copyMessage(message: string) {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}
