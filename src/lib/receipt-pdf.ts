/**
 * Printable / downloadable receipt for the last placed order.
 *
 * Rendered through the existing thermal-and-A4 print pipeline so the browser's
 * "Save as PDF" target produces a clean invoice with the item totals, the
 * discount breakdown, the delivery window and the payment method.
 */
import { printHtml } from "@/lib/print";
import type { OrderSnapshot } from "@/lib/order-snapshot";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const tk = (n: number) => `৳ ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function receiptHtml(s: OrderSnapshot, bn: boolean) {
  const t = (b: string, e: string) => (bn ? b : e);
  const rows = s.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.name)}</td>
        <td class="c">${l.qty}</td>
        <td class="r">${tk(l.price)}</td>
        <td class="r">${tk(l.line_total)}</td>
      </tr>`,
    )
    .join("");

  return `<div class="wrap">
    <h2 style="text-align:center;margin:0 0 4px">${t("বাজার বাড়ি", "Bazar Bari")}</h2>
    <p style="text-align:center;margin:0 0 10px">${t("অর্ডার রসিদ", "Order receipt")}</p>
    <p style="margin:0"><strong>${t("অর্ডার", "Order")}:</strong> ${
      s.orderNo ? `#${s.orderNo}` : t("সারিতে আছে", "Queued")
    }</p>
    <p style="margin:0"><strong>${t("তারিখ", "Date")}:</strong> ${new Date(
      s.createdAt,
    ).toLocaleString(bn ? "bn-BD" : "en-GB")}</p>
    <p style="margin:0"><strong>${t("গ্রাহক", "Customer")}:</strong> ${esc(s.name)} · ${esc(s.phone)}</p>
    <p style="margin:0"><strong>${t("ঠিকানা", "Address")}:</strong> ${esc(s.address)}${
      s.area ? `, ${esc(s.area)}` : ""
    }</p>
    <p style="margin:0"><strong>${t("ডেলিভারি সময়", "Delivery time")}:</strong> ${esc(
      s.slot || t("দ্রুততম সময়ে", "Earliest available"),
    )}</p>
    <p style="margin:0 0 8px"><strong>${t("পেমেন্ট", "Payment")}:</strong> ${esc(
      s.paymentLabel || s.paymentMethod,
    )}</p>
    <table style="width:100%;border-collapse:collapse;font-size:inherit">
      <thead><tr>
        <th style="text-align:left">${t("পণ্য", "Item")}</th>
        <th>${t("পরিমাণ", "Qty")}</th>
        <th style="text-align:right">${t("দর", "Rate")}</th>
        <th style="text-align:right">${t("মোট", "Total")}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr />
    <p style="margin:0;display:flex;justify-content:space-between"><span>${t(
      "সাবটোটাল",
      "Subtotal",
    )}</span><span>${tk(s.subtotal)}</span></p>
    ${
      s.discount > 0
        ? `<p style="margin:0;display:flex;justify-content:space-between"><span>${t(
            "ছাড়",
            "Discount",
          )}${s.couponCode ? ` (${esc(s.couponCode)})` : ""}</span><span>- ${tk(s.discount)}</span></p>`
        : ""
    }
    <p style="margin:0;display:flex;justify-content:space-between"><span>${t(
      "ডেলিভারি চার্জ",
      "Delivery fee",
    )}</span><span>${s.deliveryFee === 0 ? t("ফ্রি", "Free") : tk(s.deliveryFee)}</span></p>
    <p style="margin:4px 0 0;display:flex;justify-content:space-between;font-weight:700"><span>${t(
      "সর্বমোট",
      "Total",
    )}</span><span>${tk(s.total)}</span></p>
    <p style="text-align:center;margin-top:12px">${t(
      "বাজার বাড়ি থেকে কেনার জন্য ধন্যবাদ।",
      "Thank you for shopping with Bazar Bari.",
    )}</p>
  </div>`;
}

/** Opens the browser print dialog on A4 so the user can save the PDF. */
export function downloadReceipt(s: OrderSnapshot, bn: boolean) {
  printHtml(receiptHtml(s, bn), "a4");
}
