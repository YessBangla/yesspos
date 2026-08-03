import { supabaseAdmin } from "@/integrations/supabase/client.server";

function money(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Public knowledge snapshot for the "Bazar Bari Care" chat box.
 * Only shop-public information is collected here (never customer or sales data).
 */
export async function buildCareKnowledge(): Promise<string> {
  const [settingsRes, contentRes, catRes, productRes, zoneRes, couponRes] = await Promise.all([
    supabaseAdmin.from("business_settings").select("shop_name,address,phone,currency_symbol").limit(1),
    supabaseAdmin.from("site_content").select("key,label,value_bn,value_en").limit(200),
    supabaseAdmin.from("categories").select("name_bn,name_en").limit(60),
    supabaseAdmin
      .from("products")
      .select("name_bn,name_en,price,unit,pack_size,brand,stock,is_active")
      .eq("is_active", true)
      .order("stock", { ascending: false })
      .limit(120),
    supabaseAdmin
      .from("delivery_zones")
      .select("name_bn,name_en,delivery_fee,min_order,free_delivery_above,eta_minutes,is_active")
      .eq("is_active", true)
      .limit(40),
    supabaseAdmin
      .from("coupons")
      .select("code,type,value,min_amount,max_discount,expires_on,is_active")
      .eq("is_active", true)
      .limit(20),
  ]);

  const s = settingsRes.data?.[0];
  const lines: string[] = [];

  lines.push(
    `Shop: ${s?.shop_name ?? "Bazar Bari"} (বাজার বাড়ি). Currency: ${s?.currency_symbol ?? "৳"} (Bangladeshi Taka).`,
    `Address: ${s?.address ?? "n/a"} | Phone: ${s?.phone ?? "n/a"}`,
    "Bazar Bari is a part of Shondhaan, a sister concern of Yess Bangla Private Limited.",
  );

  lines.push(
    "",
    "WEBSITE PAGES CUSTOMERS CAN USE:",
    "- / : home / corporate landing page",
    "- / : online grocery storefront (home page) (search, categories, cart, checkout with delivery slot, coupon, payment)",
    "- /my-orders : order history, reorder, cancel or reschedule an order (phone verification)",
    "- /track : live delivery tracking with rider name, phone and ETA",
    "- /my-account : customer account and loyalty points",
    "- /auth : staff login for the POS and dashboard",
    "- /privacy and /terms : legal pages",
    "Loyalty: customers earn 10 points per ৳100 purchase; after reaching 1000 points, every 10 points = ৳1 discount.",
    "Payments accepted: Cash, bKash, Nagad, Card and Bank transfer. Both online (home delivery) and in-shop (POS) buying is supported.",
  );

  const zones = zoneRes.data ?? [];
  if (zones.length) {
    lines.push(
      "",
      "DELIVERY ZONES:",
      ...zones.map(
        (z) =>
          `- ${z.name_bn || z.name_en}: fee ৳${money(Number(z.delivery_fee ?? 0))}, min order ৳${money(Number(z.min_order ?? 0))}` +
          (z.free_delivery_above ? `, free delivery above ৳${money(Number(z.free_delivery_above))}` : "") +
          `, ETA ~${z.eta_minutes} min`,
      ),
    );
  }

  const cats = catRes.data ?? [];
  if (cats.length) {
    lines.push("", `CATEGORIES: ${cats.map((c) => `${c.name_bn || c.name_en}`).join(", ")}`);
  }

  const products = productRes.data ?? [];
  if (products.length) {
    lines.push(
      "",
      "PRODUCTS (name — price — pack — availability):",
      ...products.map(
        (p) =>
          `- ${p.name_bn || p.name_en} (${p.name_en}) — ৳${money(Number(p.price ?? 0))}/${p.unit}` +
          (p.pack_size ? ` — ${p.pack_size}` : "") +
          (p.brand ? ` — ${p.brand}` : "") +
          ` — ${Number(p.stock ?? 0) > 0 ? "in stock" : "out of stock"}`,
      ),
    );
  }

  const coupons = couponRes.data ?? [];
  if (coupons.length) {
    lines.push(
      "",
      "ACTIVE COUPONS:",
      ...coupons.map(
        (c) =>
          `- ${c.code}: ${c.type === "percent" ? `${c.value}% off` : `৳${money(Number(c.value ?? 0))} off`}` +
          `, min order ৳${money(Number(c.min_amount ?? 0))}` +
          (c.max_discount ? `, max ৳${money(Number(c.max_discount))}` : "") +
          (c.expires_on ? `, valid till ${c.expires_on}` : ""),
      ),
    );
  }

  const content = contentRes.data ?? [];
  if (content.length) {
    lines.push(
      "",
      "WEBSITE TEXTS (as published):",
      ...content.slice(0, 120).map((r) => `- ${r.label || r.key}: ${(r.value_bn || r.value_en || "").slice(0, 180)}`),
    );
  }

  return lines.join("\n");
}
