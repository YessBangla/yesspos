import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type InsightInput = { from: string; to: string; lang?: "bn" | "en" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(input: unknown): InsightInput {
  const raw = input as InsightInput;
  if (!raw || !DATE.test(raw.from ?? "") || !DATE.test(raw.to ?? "")) {
    throw new Error("from/to must be YYYY-MM-DD");
  }
  return { from: raw.from, to: raw.to, lang: raw.lang === "en" ? "en" : "bn" };
}

function money(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * AI insight for the report period. Reads live data as the signed-in user (RLS applies),
 * then asks Lovable AI for a short business read-out plus recommended actions.
 */
export const getReportInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const supabase = context.supabase;
    const startIso = new Date(`${data.from}T00:00:00`).toISOString();
    const endIso = new Date(`${data.to}T23:59:59`).toISOString();

    const [salesRes, itemsRes, expenseRes, purchaseRes, lowStockRes] = await Promise.all([
      supabase
        .from("sales")
        .select("id,invoice_no,customer_name,total,paid,created_at,status")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase.from("sale_items").select("name_snapshot,quantity,line_total").limit(1000),
      supabase.from("expenses").select("amount,spent_on").gte("spent_on", data.from).lte("spent_on", data.to),
      supabase.from("purchases").select("total,purchased_on").gte("purchased_on", data.from).lte("purchased_on", data.to),
      supabase.from("products").select("name_en,name_bn,stock,low_stock_at").order("stock").limit(15),
    ]);

    const sales = (salesRes.data ?? []).filter((s) => s.status === "final");
    const salesTotal = sales.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const paidTotal = sales.reduce((s, r) => s + Number(r.paid ?? 0), 0);
    const dueTotal = salesTotal - paidTotal;
    const expenseTotal = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const purchaseTotal = (purchaseRes.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);

    const byDay = new Map<string, number>();
    for (const s of sales) {
      const d = (s.created_at ?? "").slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + Number(s.total ?? 0));
    }
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const best = [...days].sort((a, b) => b[1] - a[1])[0];
    const worst = [...days].sort((a, b) => a[1] - b[1])[0];

    const topMap = new Map<string, { qty: number; amount: number }>();
    for (const it of itemsRes.data ?? []) {
      const k = it.name_snapshot ?? "-";
      const cur = topMap.get(k) ?? { qty: 0, amount: 0 };
      cur.qty += Number(it.quantity ?? 0);
      cur.amount += Number(it.line_total ?? 0);
      topMap.set(k, cur);
    }
    const top = [...topMap.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 6);

    const lowStock = (lowStockRes.data ?? []).filter((p) => Number(p.stock ?? 0) <= Number(p.low_stock_at ?? 0));

    const topDues = sales
      .map((s) => ({ inv: s.invoice_no, name: s.customer_name ?? "Walk-in", due: Number(s.total ?? 0) - Number(s.paid ?? 0) }))
      .filter((s) => s.due > 0.5)
      .sort((a, b) => b.due - a.due)
      .slice(0, 6);

    const snapshot = [
      `Period: ${data.from} to ${data.to} (${days.length} active days)`,
      `Sales: ${money(salesTotal)} across ${sales.length} invoices; collected ${money(paidTotal)}; outstanding ${money(dueTotal)}`,
      `Average invoice: ${money(sales.length ? salesTotal / sales.length : 0)}`,
      `Purchases: ${money(purchaseTotal)}; Expenses: ${money(expenseTotal)}`,
      `Approx. margin after purchases+expenses: ${money(salesTotal - purchaseTotal - expenseTotal)}`,
      `Best day: ${best ? `${best[0]} = ${money(best[1])}` : "n/a"}; weakest day: ${worst ? `${worst[0]} = ${money(worst[1])}` : "n/a"}`,
      `Daily sales series: ${days.map(([d, v]) => `${d}:${money(v)}`).join(", ") || "none"}`,
      `Best sellers: ${top.map(([n, v]) => `${n} (${v.qty} pcs, ${money(v.amount)})`).join("; ") || "none"}`,
      `Low stock: ${lowStock.map((p) => `${p.name_bn || p.name_en}=${p.stock}`).join("; ") || "none"}`,
      `Biggest dues: ${topDues.map((d) => `#${d.inv} ${d.name} = ${money(d.due)}`).join("; ") || "none"}`,
    ].join("\n");

    const system = [
      "You are the business analyst inside Daily Bazar, a POS/ERP app for shops in Bangladesh.",
      data.lang === "en" ? "Write in clear, simple English." : "সহজ বাংলায় লিখুন (সংখ্যা ইংরেজি অঙ্কে)।",
      "Currency is Bangladeshi Taka (৳).",
      "Write a short report read-out with exactly these markdown sections:",
      "1. **সারসংক্ষেপ / Summary** — 2-3 bullets on how the period went.",
      "2. **লক্ষণীয় / What stands out** — 2-3 bullets (trend, best/weak day, top product, dues, stock risk).",
      "3. **করণীয় / Recommended actions** — 3-4 concrete, prioritised actions with numbers.",
      "Only use numbers from the snapshot. If data is missing, say so instead of guessing. Keep it under 200 words.",
      "",
      "LIVE DATA SNAPSHOT:",
      snapshot,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.lang === "en" ? "Analyse this period." : "এই সময়ের ব্যবসা বিশ্লেষণ করুন।" },
        ],
      }),
    });

    if (res.status === 429) throw new Error("rate_limit");
    if (res.status === 402) throw new Error("no_credits");
    if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      insight: json.choices?.[0]?.message?.content ?? "",
      metrics: { salesTotal, paidTotal, dueTotal, expenseTotal, purchaseTotal, invoices: sales.length },
    };
  });
