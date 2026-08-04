/** Storefront checkout payment options (kept in sync with delivery_orders.payment_method). */
export type CheckoutPaymentId = "cod" | "bkash" | "nagad" | "card";

export type CheckoutPayment = {
  id: CheckoutPaymentId;
  en: string;
  bn: string;
  /** Short helper shown under the option. */
  hintEn: string;
  hintBn: string;
  /** Online payments need a confirmation step before the order is sent. */
  online: boolean;
};

export const CHECKOUT_PAYMENTS: CheckoutPayment[] = [
  {
    id: "cod",
    en: "Cash on delivery",
    bn: "ক্যাশ অন ডেলিভারি",
    hintEn: "Pay the rider when your order arrives",
    hintBn: "পণ্য হাতে পেয়ে রাইডারকে পরিশোধ করুন",
    online: false,
  },
  {
    id: "bkash",
    en: "bKash",
    bn: "বিকাশ",
    hintEn: "Send money to the merchant number, then confirm",
    hintBn: "মার্চেন্ট নম্বরে সেন্ড মানি করে নিশ্চিত করুন",
    online: true,
  },
  {
    id: "nagad",
    en: "Nagad",
    bn: "নগদ",
    hintEn: "Send money to the merchant number, then confirm",
    hintBn: "মার্চেন্ট নম্বরে সেন্ড মানি করে নিশ্চিত করুন",
    online: true,
  },
  {
    id: "card",
    en: "Card / online",
    bn: "কার্ড / অনলাইন",
    hintEn: "Pay securely on delivery confirmation link",
    hintBn: "নিরাপদ অনলাইন পেমেন্ট লিংকে পরিশোধ করুন",
    online: true,
  },
];

export function paymentLabel(id: string, bn: boolean) {
  const p = CHECKOUT_PAYMENTS.find((x) => x.id === id);
  if (!p) return id;
  return bn ? p.bn : p.en;
}
