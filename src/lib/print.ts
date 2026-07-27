export type PrinterSize = "58mm" | "80mm" | "a4";

export const PRINTER_SIZES: PrinterSize[] = ["58mm", "80mm", "a4"];

const STORAGE_KEY = "sherapos-printer";

export function getPrinterSize(): PrinterSize {
  if (typeof window === "undefined") return "80mm";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "58mm" || v === "80mm" || v === "a4" ? v : "80mm";
}

export function setPrinterSize(size: PrinterSize) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, size);
}

function pageCss(size: PrinterSize) {
  if (size === "a4") {
    return `@page { size: A4; margin: 14mm; }
      body { width: auto; font-size: 13px; }
      .wrap { max-width: 190mm; margin: 0 auto; }`;
  }
  const width = size === "58mm" ? "58mm" : "80mm";
  const inner = size === "58mm" ? "54mm" : "76mm";
  return `@page { size: ${width} auto; margin: 2mm; }
    body { width: ${inner}; font-size: ${size === "58mm" ? "11px" : "12.5px"}; }
    .wrap { width: ${inner}; }`;
}

/**
 * Prints arbitrary receipt HTML through a hidden iframe so the main app UI is
 * never affected. Works with thermal (58/80mm) and normal A4/laser printers.
 */
export function printHtml(innerHtml: string, size: PrinterSize = getPrinterSize()) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>Receipt</title>
<style>
  * { box-sizing: border-box; }
  ${pageCss(size)}
  body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .shop { font-size: 1.35em; font-weight: 800; margin: 0; }
  .muted { color: #333; }
  .sm { font-size: 0.85em; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; text-align: left; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .total { font-weight: 800; font-size: 1.2em; }
</style></head><body><div class="wrap">${innerHtml}</div></body></html>`);
  doc.close();

  const run = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => frame.remove(), 1500);
    }
  };

  if (doc.readyState === "complete") window.setTimeout(run, 120);
  else frame.onload = () => window.setTimeout(run, 120);
}
