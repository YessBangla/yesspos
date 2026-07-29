/** Mobile money / gateway helpers (bKash, Nagad, Rocket, Upay, SSLCommerz). */

export type GatewayId = "bkash" | "nagad" | "rocket" | "upay" | "sslcommerz";

export type Gateway = {
  id: GatewayId;
  label: string;
  labelBn: string;
  /** Merchant app deep link scheme, used for push/QR payments. */
  scheme: string;
  color: string;
};

export const GATEWAYS: Gateway[] = [
  { id: "bkash", label: "bKash", labelBn: "বিকাশ", scheme: "bkash", color: "#e2136e" },
  { id: "nagad", label: "Nagad", labelBn: "নগদ", scheme: "nagad", color: "#ee7024" },
  { id: "rocket", label: "Rocket", labelBn: "রকেট", scheme: "rocket", color: "#8a2be2" },
  { id: "upay", label: "Upay", labelBn: "উপায়", scheme: "upay", color: "#f5a623" },
  { id: "sslcommerz", label: "SSLCommerz", labelBn: "এসএসএলকমার্স", scheme: "https", color: "#0a5c36" },
];

export function gatewayById(id: string) {
  return GATEWAYS.find((g) => g.id === id);
}

/** Stable reference we can reconcile on later, e.g. SP-1042-8391. */
export function buildPaymentRef(invoiceNo?: number | null) {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SP-${invoiceNo ?? "NA"}-${rand}`;
}

/**
 * Payload encoded in the QR the customer scans. Merchant apps read the
 * merchant number + amount; the reference lets us reconcile automatically.
 */
export function buildQrPayload(opts: {
  gateway: GatewayId;
  merchantNumber: string;
  amount: number;
  reference: string;
  baseUrl?: string;
}) {
  const { gateway, merchantNumber, amount, reference, baseUrl } = opts;
  if (gateway === "sslcommerz") {
    const base = baseUrl || "https://securepay.sslcommerz.com/gwprocess/v4/";
    return `${base}?merchant=${encodeURIComponent(merchantNumber)}&amount=${amount.toFixed(2)}&tran_id=${encodeURIComponent(reference)}`;
  }
  const scheme = gatewayById(gateway)?.scheme ?? gateway;
  return `${scheme}://pay?merchant=${encodeURIComponent(merchantNumber)}&amount=${amount.toFixed(2)}&ref=${encodeURIComponent(reference)}`;
}

/** Message sent to the customer with the payment instruction. */
export function buildPushMessage(opts: {
  lang: "bn" | "en";
  shopName: string;
  gatewayLabel: string;
  merchantNumber: string;
  amount: number;
  reference: string;
  invoiceNo?: number | null;
}) {
  const { lang, shopName, gatewayLabel, merchantNumber, amount, reference, invoiceNo } = opts;
  const amt = amount.toFixed(2);
  if (lang === "bn") {
    return [
      `${shopName}`,
      invoiceNo ? `চালান #${invoiceNo}` : "",
      `পরিশোধযোগ্য: ৳${amt}`,
      `${gatewayLabel} মার্চেন্ট নম্বর: ${merchantNumber}`,
      `রেফারেন্স দিন: ${reference}`,
      "পেমেন্ট করে ট্রানজেকশন আইডি পাঠান, ধন্যবাদ।",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `${shopName}`,
    invoiceNo ? `Invoice #${invoiceNo}` : "",
    `Amount due: BDT ${amt}`,
    `${gatewayLabel} merchant number: ${merchantNumber}`,
    `Use reference: ${reference}`,
    "Please share the transaction ID after paying. Thank you.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Note we store on the payment row — reconciliation reads it back. */
export function buildPaymentNote(reference: string, trxId: string) {
  return `REF:${reference} TRX:${trxId}`;
}

export function parsePaymentNote(note: string | null | undefined) {
  const ref = /REF:([A-Za-z0-9-]+)/.exec(note ?? "")?.[1] ?? null;
  const trx = /TRX:([A-Za-z0-9-]+)/.exec(note ?? "")?.[1] ?? null;
  return { ref, trx };
}

/** Invoice number encoded inside a reference such as SP-1042-8391. */
export function invoiceFromRef(ref: string | null) {
  const n = /^SP-(\d+)-/.exec(ref ?? "")?.[1];
  return n ? Number(n) : null;
}
